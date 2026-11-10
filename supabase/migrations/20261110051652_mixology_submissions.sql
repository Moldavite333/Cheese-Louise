-- Prepared locally. Public intake stays disabled until separately authorized/configured.
begin;
create function private.mixology_valid_submission(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;
begin
  if jsonb_typeof(d) is distinct from 'object' or d->'schemaVersion' is distinct from '1'::jsonb or octet_length(d::text)>16384
    or d->'permission' is distinct from 'true'::jsonb or jsonb_typeof(d->'mayCredit') is distinct from 'boolean'
    or coalesce(d->>'variant','') not in ('alcoholic','alcohol_free') then return false;end if;
  foreach k in array array['title','idea','ingredients','method','credit','sourceUrl'] loop
    if jsonb_typeof(d->k) is distinct from 'string' then return false;end if;
  end loop;
  if length(trim(d->>'title')) not between 1 and 160 or length(trim(d->>'idea')) not between 1 and 3000
    or length(d->>'ingredients')>4000 or length(d->>'method')>4000 or length(d->>'credit')>80 or length(d->>'sourceUrl')>2000
    or (d->>'mayCredit'='false' and d->>'credit'<>'') then return false;end if;
  if d->>'sourceUrl'<>'' and ((d->>'sourceUrl') !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$'
    or (d->>'sourceUrl') ~* '([?&](token|access_token|apikey|api_key|authorization|signature|key|sig|auth|auth_token|client_secret|password|session|jwt|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)=|/storage/v1/object/sign/)') then return false;end if;
  if exists(select 1 from jsonb_object_keys(d) as key where key not in ('schemaVersion','title','idea','ingredients','method','variant','credit','mayCredit','permission','sourceUrl')) then return false;end if;
  return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_submission(jsonb) from public;
grant execute on function private.mixology_valid_submission(jsonb) to authenticated,service_role;
create table public.mixology_submissions (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
  request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),document jsonb not null,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),revision bigint not null default 1 check(revision>0),
  received_at timestamptz not null default clock_timestamp(),moderated_at timestamptz,moderated_by uuid references auth.users(id),redacted_at timestamptz,
  imported_cocktail_id uuid,imported_recipe_id uuid,imported_variant text,
  unique(id,workspace_id),
  foreign key(imported_cocktail_id,workspace_id) references public.cocktails(id,workspace_id),
  foreign key(imported_recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id),
  check((redacted_at is null and private.mixology_valid_submission(document)) or (redacted_at is not null and document='{}'::jsonb)),
  check((status='accepted' and imported_cocktail_id is not null and imported_recipe_id is not null and imported_variant in ('alcoholic','alcohol_free')) or (status<>'accepted' and imported_cocktail_id is null and imported_recipe_id is null and imported_variant is null))
);
alter table public.mixology_submissions enable row level security;
revoke all on public.mixology_submissions from public,anon,authenticated,service_role;
grant select on public.mixology_submissions to authenticated;
grant select,insert on public.mixology_submissions to service_role;
create policy mixology_submissions_host_read on public.mixology_submissions for select to authenticated using(private.is_workspace_member(workspace_id));
create unique index mixology_submissions_dedup on public.mixology_submissions(workspace_id,request_digest) where redacted_at is null;
create index mixology_submissions_queue on public.mixology_submissions(workspace_id,status,received_at desc);
create function private.mixology_submission_insert_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status<>'pending' or new.revision<>1 or new.redacted_at is not null or new.imported_recipe_id is not null or new.imported_cocktail_id is not null
    or new.moderated_by is not null or new.moderated_at is not null then raise exception 'new_submission_must_be_pending';end if;
  new.received_at:=clock_timestamp();return new;
end $$;
revoke all on function private.mixology_submission_insert_guard() from public;
create trigger mixology_submission_insert_guard before insert on public.mixology_submissions for each row execute function private.mixology_submission_insert_guard();
create table public.mixology_submission_decisions (
  id uuid primary key,workspace_id uuid not null,submission_id uuid not null,source_revision bigint not null,
  decision text not null check(decision in ('accepted','rejected','reopened','redacted')),
  reason text not null check(reason in ('development','duplicate','off_topic','needs_work','privacy','other')),
  request_fingerprint text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
  imported_cocktail_id uuid,imported_recipe_id uuid,
  foreign key(submission_id,workspace_id) references public.mixology_submissions(id,workspace_id)
);
alter table public.mixology_submission_decisions enable row level security;
revoke all on public.mixology_submission_decisions from public,anon,authenticated,service_role;
grant select on public.mixology_submission_decisions to authenticated;
create policy mixology_submission_decisions_host_read on public.mixology_submission_decisions for select to authenticated using(private.is_workspace_member(workspace_id));
create index mixology_submission_decisions_history on public.mixology_submission_decisions(submission_id,created_at);

create table private.mixology_submission_limits (
  workspace_id uuid not null references public.workspaces(id),bucket text not null,window_at timestamptz not null,count integer not null default 0,
  primary key(workspace_id,bucket,window_at)
);
create table private.mixology_submission_requests (
  workspace_id uuid not null references public.workspaces(id),request_id uuid not null,payload_digest text not null,subject_key text,
  lease_token uuid not null,status text not null default 'reserved' check(status in ('reserved','received','failed')),created_at timestamptz not null default clock_timestamp(),
  submission_id uuid,primary key(workspace_id,request_id),foreign key(submission_id,workspace_id) references public.mixology_submissions(id,workspace_id)
);
alter table private.mixology_submission_limits enable row level security;
alter table private.mixology_submission_requests enable row level security;
revoke all on private.mixology_submission_limits,private.mixology_submission_requests from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.mixology_submission_limits,private.mixology_submission_requests to service_role;

create function public.mixology_submission_reserve(p_workspace uuid,p_request uuid,p_digest text,p_subject text,p_lease uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r private.mixology_submission_requests;day_at timestamptz:=date_trunc('day',clock_timestamp());minute_at timestamptz:=date_trunc('minute',clock_timestamp());n integer;
begin
  if p_digest is null or p_subject is null or p_digest !~ '^[0-9a-f]{64}$' or p_subject !~ '^[0-9a-f]{64}$' or p_request is null or p_lease is null then raise exception 'invalid_intake_identity';end if;
  insert into private.mixology_submission_limits values(p_workspace,'global-day',day_at,0) on conflict do nothing;
  perform 1 from private.mixology_submission_limits where workspace_id=p_workspace and bucket='global-day' and window_at=day_at for update;
  delete from private.mixology_submission_requests where workspace_id=p_workspace and created_at<clock_timestamp()-interval '48 hours';
  delete from private.mixology_submission_limits where workspace_id=p_workspace and window_at<clock_timestamp()-interval '48 hours';
  select * into r from private.mixology_submission_requests where workspace_id=p_workspace and request_id=p_request;
  if found then
    if r.payload_digest<>p_digest then return jsonb_build_object('status','mismatch');end if;
    if r.status='received' then return jsonb_build_object('status','received');end if;
    if r.status='reserved' and r.created_at>clock_timestamp()-interval '60 seconds' then return jsonb_build_object('status','running');end if;
    update private.mixology_submission_requests set status='failed',subject_key=null where workspace_id=p_workspace and request_id=p_request;
    return jsonb_build_object('status','failed');
  end if;
  select count into n from private.mixology_submission_limits where workspace_id=p_workspace and bucket='global-day' and window_at=day_at;
  if n>=100 then return jsonb_build_object('status','limited');end if;
  insert into private.mixology_submission_limits values(p_workspace,'global-minute',minute_at,0) on conflict do nothing;
  select count into n from private.mixology_submission_limits where workspace_id=p_workspace and bucket='global-minute' and window_at=minute_at;
  if n>=10 then return jsonb_build_object('status','limited');end if;
  insert into private.mixology_submission_limits values(p_workspace,'subject:'||p_subject,day_at,0) on conflict do nothing;
  select count into n from private.mixology_submission_limits where workspace_id=p_workspace and bucket='subject:'||p_subject and window_at=day_at;
  if n>=3 then return jsonb_build_object('status','limited');end if;
  update private.mixology_submission_limits set count=count+1 where workspace_id=p_workspace and ((bucket='global-day' and window_at=day_at) or (bucket='global-minute' and window_at=minute_at) or (bucket='subject:'||p_subject and window_at=day_at));
  insert into private.mixology_submission_requests(workspace_id,request_id,payload_digest,subject_key,lease_token) values(p_workspace,p_request,p_digest,p_subject,p_lease);
  return jsonb_build_object('status','acquired');
end $$;
create function public.mixology_submission_finish(p_workspace uuid,p_request uuid,p_lease uuid,p_digest text,p_document jsonb,p_valid boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r private.mixology_submission_requests;sid uuid;
begin
  select * into r from private.mixology_submission_requests where workspace_id=p_workspace and request_id=p_request for update;
  if p_lease is null or p_digest is null or r.request_id is null or r.lease_token<>p_lease or r.payload_digest<>p_digest then raise exception 'intake_reservation_unavailable';end if;
  if r.status='received' then return jsonb_build_object('status','received');end if;
  if r.status<>'reserved' then raise exception 'intake_reservation_unavailable';end if;
  if not coalesce(p_valid,false) then
    update private.mixology_submission_requests set status='failed',subject_key=null where workspace_id=p_workspace and request_id=p_request;
    return jsonb_build_object('status','failed');
  end if;
  if not private.mixology_valid_submission(p_document) then raise exception 'invalid_submission';end if;
  insert into public.mixology_submissions(workspace_id,request_digest,document) values(p_workspace,p_digest,p_document) on conflict(workspace_id,request_digest) where redacted_at is null do nothing returning id into sid;
  if sid is null then select id into sid from public.mixology_submissions where workspace_id=p_workspace and request_digest=p_digest and redacted_at is null;end if;
  update private.mixology_submission_requests set status='received',subject_key=null,submission_id=sid where workspace_id=p_workspace and request_id=p_request;
  return jsonb_build_object('status','received');
end $$;
revoke all on function public.mixology_submission_reserve(uuid,uuid,text,text,uuid),public.mixology_submission_finish(uuid,uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.mixology_submission_reserve(uuid,uuid,text,text,uuid),public.mixology_submission_finish(uuid,uuid,uuid,text,jsonb,boolean) to service_role;

-- Narrow private capability: hosts have read access only; all moderation writes pass this checked operation.
-- SECURITY DEFINER is confined to private schema, checks the real caller and workspace explicitly,
-- and never accepts SQL, existing target recipe IDs, actor IDs or tested/approval fields.
create function private.mixology_moderate_submission(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.mixology_submissions;e public.mixology_submission_decisions;c public.cocktails;r public.mixology_recipes;actor uuid:=auth.uid();fingerprint text;
begin
  if actor is null then raise exception 'moderation_forbidden' using errcode='42501';end if;
  select * into s from public.mixology_submissions where id=p_submission for update;
  if s.id is null or not private.is_workspace_member(s.workspace_id) then raise exception 'moderation_forbidden' using errcode='42501';end if;
  if p_operation is null or p_decision is null or p_reason is null or p_decision not in ('accepted','rejected','reopened','redacted') or p_reason not in ('development','duplicate','off_topic','needs_work','privacy','other') then raise exception 'invalid_moderation';end if;
  fingerprint:=md5(jsonb_build_object('revision',p_revision,'decision',p_decision,'reason',p_reason,'variant',p_variant,'recipe',p_recipe)::text);
  select * into e from public.mixology_submission_decisions where id=p_operation;
  if found then
    if e.submission_id<>s.id or e.created_by<>actor or e.request_fingerprint<>fingerprint then raise exception 'moderation_retry_mismatch';end if;
    return jsonb_build_object('submission',to_jsonb(s),'decision',to_jsonb(e));
  end if;
  if s.revision<>p_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  if s.redacted_at is not null then raise exception 'submission_text_removed';end if;
  if p_decision='accepted' then
    if s.status<>'pending' then raise exception 'only_pending_can_be_accepted';end if;
    if p_variant is null or p_variant not in ('alcoholic','alcohol_free') or not private.mixology_valid_document(p_recipe) then raise exception 'invalid_import_recipe';end if;
    perform 1 from public.workspaces where id=s.workspace_id for update;
    if exists(select 1 from public.cocktails where workspace_id=s.workspace_id and lower(name)=lower(trim(p_recipe->>'name'))) then raise exception 'submission_name_exists';end if;
    insert into public.cocktails(workspace_id,name,cocktail_type,ingredients,method,glassware,garnish,notes,tested,rating,created_by)
      values(s.workspace_id,trim(p_recipe->>'name'),'cheese_louise',
        coalesce((select string_agg(concat_ws(' ',nullif(a->>'quantity',''),nullif(a->>'unit',''),a->>'name'),E'\n' order by n) from jsonb_array_elements(p_recipe->'ingredients') with ordinality t(a,n)),''),
        coalesce((select string_agg(a->>'text',E'\n' order by n) from jsonb_array_elements(p_recipe->'steps') with ordinality t(a,n)),''),p_recipe->>'glassware',p_recipe->>'garnish',p_recipe->>'notes',false,null,actor) returning * into c;
    insert into public.mixology_recipes(workspace_id,cocktail_id,variant,document,legacy_evidence,projection_updated_at,created_by,updated_by)
      values(s.workspace_id,c.id,p_variant,p_recipe,'{}',c.updated_at,actor,actor) returning * into r;
    update public.mixology_submissions set status='accepted',imported_cocktail_id=c.id,imported_recipe_id=r.id,imported_variant=p_variant where id=s.id;
  elsif p_decision='rejected' then
    if s.status<>'pending' or p_recipe is not null or p_variant is not null then raise exception 'invalid_rejection';end if;
    update public.mixology_submissions set status='rejected' where id=s.id;
  elsif p_decision='reopened' then
    if s.status<>'rejected' or p_recipe is not null or p_variant is not null then raise exception 'invalid_reopen';end if;
    update public.mixology_submissions set status='pending' where id=s.id;
  else
    if p_recipe is not null or p_variant is not null then raise exception 'invalid_redaction';end if;
    update public.mixology_submissions set document='{}',redacted_at=clock_timestamp() where id=s.id;
  end if;
  update public.mixology_submissions set revision=revision+1,moderated_by=actor,moderated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.mixology_submission_decisions(id,workspace_id,submission_id,source_revision,decision,reason,request_fingerprint,created_by,imported_cocktail_id,imported_recipe_id)
    values(p_operation,s.workspace_id,s.id,p_revision,p_decision,p_reason,fingerprint,actor,s.imported_cocktail_id,s.imported_recipe_id) returning * into e;
  return jsonb_build_object('submission',to_jsonb(s),'decision',to_jsonb(e));
end $$;
revoke all on function private.mixology_moderate_submission(uuid,uuid,bigint,text,text,text,jsonb) from public,anon,service_role;
grant execute on function private.mixology_moderate_submission(uuid,uuid,bigint,text,text,text,jsonb) to authenticated;
create function public.mixology_submission_moderate(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb) returns jsonb language sql security invoker set search_path='' as $$
  select private.mixology_moderate_submission(p_operation,p_submission,p_revision,p_decision,p_reason,p_variant,p_recipe)
$$;
revoke all on function public.mixology_submission_moderate(uuid,uuid,bigint,text,text,text,jsonb) from public,anon,service_role;
grant execute on function public.mixology_submission_moderate(uuid,uuid,bigint,text,text,text,jsonb) to authenticated;
commit;
