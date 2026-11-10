-- Additive local-only increment. No listener feedback becomes host tasting evidence.
begin;
create function private.mixology_valid_submission_v1(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
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
revoke all on function private.mixology_valid_submission_v1(jsonb) from public;
grant execute on function private.mixology_valid_submission_v1(jsonb) to authenticated,service_role;
create or replace function private.mixology_valid_submission(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if d->'schemaVersion'='1'::jsonb then return private.mixology_valid_submission_v1(d);end if;
  if octet_length(d::text)>16384 or d->'schemaVersion' is distinct from '2'::jsonb or jsonb_typeof(d->'kind') is distinct from 'string'
    or d->>'kind' not in ('idea','feedback','variation') or jsonb_typeof(d->'reference') is distinct from 'string'
    or length(d->>'reference')>240 or (d->>'kind'<>'idea' and length(trim(d->>'reference'))=0)
    or (d->>'kind'='feedback' and (d->>'ingredients'<>'' or d->>'method'<>'')) then return false;end if;
  return private.mixology_valid_submission_v1((d-'kind'-'reference')||'{"schemaVersion":1}'::jsonb);
exception when others then return false;
end $$;
alter table public.mixology_submissions add column kind text not null default 'idea' check(kind in ('idea','feedback','variation'));
alter table public.mixology_submissions add column reviewed_version_id uuid;
alter table public.mixology_submissions add foreign key(reviewed_version_id,workspace_id) references public.mixology_versions(id,workspace_id);
alter table public.mixology_submission_decisions add column reviewed_version_id uuid;
alter table public.mixology_submission_decisions add foreign key(reviewed_version_id,workspace_id) references public.mixology_versions(id,workspace_id);
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.mixology_submissions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%imported_variant%' loop
   execute format('alter table public.mixology_submissions drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.mixology_submissions add constraint mixology_submission_import_shape check(
 (status='accepted' and ((kind='feedback' and imported_cocktail_id is null and imported_recipe_id is null and imported_variant is null)
  or (kind<>'feedback' and imported_cocktail_id is not null and imported_recipe_id is not null and imported_variant in ('alcoholic','alcohol_free'))))
 or (status<>'accepted' and imported_cocktail_id is null and imported_recipe_id is null and imported_variant is null and reviewed_version_id is null));
alter table public.mixology_submissions add constraint mixology_submission_kind_matches check(redacted_at is not null or kind=coalesce(document->>'kind','idea'));
create or replace function private.mixology_submission_insert_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status<>'pending' or new.revision<>1 or new.redacted_at is not null or new.imported_recipe_id is not null or new.imported_cocktail_id is not null
  or new.imported_variant is not null or new.reviewed_version_id is not null or new.moderated_by is not null or new.moderated_at is not null then raise exception 'new_submission_must_be_pending';end if;
 new.kind:=coalesce(new.document->>'kind','idea');new.received_at:=clock_timestamp();return new;
end $$;
create function private.mixology_review_submission(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb,p_target_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.mixology_submissions;e public.mixology_submission_decisions;c public.cocktails;r public.mixology_recipes;actor uuid:=auth.uid();fingerprint text;
begin
  if actor is null then raise exception 'moderation_forbidden' using errcode='42501';end if;
  select * into s from public.mixology_submissions where id=p_submission for update;
  if s.id is null or not private.is_workspace_member(s.workspace_id) then raise exception 'moderation_forbidden' using errcode='42501';end if;
  if p_operation is null or p_decision is null or p_reason is null or p_decision not in ('accepted','rejected','reopened','redacted') or p_reason not in ('development','duplicate','off_topic','needs_work','privacy','other') then raise exception 'invalid_moderation';end if;
  fingerprint:=md5((jsonb_build_object('revision',p_revision,'decision',p_decision,'reason',p_reason,'variant',p_variant,'recipe',p_recipe)||case when p_target_version is null then '{}'::jsonb else jsonb_build_object('target',p_target_version) end)::text);
  select * into e from public.mixology_submission_decisions where id=p_operation;
  if found then
    if e.submission_id<>s.id or e.created_by<>actor or e.request_fingerprint<>fingerprint then raise exception 'moderation_retry_mismatch';end if;
    return jsonb_build_object('submission',to_jsonb(s),'decision',to_jsonb(e));
  end if;
  if s.revision<>p_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  if s.redacted_at is not null then raise exception 'submission_text_removed';end if;
  if p_decision='accepted' then
    if s.status<>'pending' then raise exception 'only_pending_can_be_accepted';end if;
    if s.kind='variation' and p_target_version is null then raise exception 'variation_parent_required';end if;
    if p_target_version is not null and not exists(select 1 from public.mixology_versions where id=p_target_version and workspace_id=s.workspace_id) then raise exception 'review_target_unavailable' using errcode='42501';end if;
    if s.kind='feedback' then
      if p_recipe is not null or p_variant is not null then raise exception 'feedback_is_not_recipe';end if;
      update public.mixology_submissions set status='accepted',reviewed_version_id=p_target_version where id=s.id;
    else
    if p_variant is null or p_variant not in ('alcoholic','alcohol_free') or not private.mixology_valid_document(p_recipe) then raise exception 'invalid_import_recipe';end if;
    perform 1 from public.workspaces where id=s.workspace_id for update;
    if exists(select 1 from public.cocktails where workspace_id=s.workspace_id and lower(name)=lower(trim(p_recipe->>'name'))) then raise exception 'submission_name_exists';end if;
    insert into public.cocktails(workspace_id,name,cocktail_type,ingredients,method,glassware,garnish,notes,tested,rating,created_by)
      values(s.workspace_id,trim(p_recipe->>'name'),'cheese_louise',
        coalesce((select string_agg(concat_ws(' ',nullif(a->>'quantity',''),nullif(a->>'unit',''),a->>'name'),E'\n' order by n) from jsonb_array_elements(p_recipe->'ingredients') with ordinality t(a,n)),''),
        coalesce((select string_agg(a->>'text',E'\n' order by n) from jsonb_array_elements(p_recipe->'steps') with ordinality t(a,n)),''),p_recipe->>'glassware',p_recipe->>'garnish',p_recipe->>'notes',false,null,actor) returning * into c;
    insert into public.mixology_recipes(workspace_id,cocktail_id,variant,document,legacy_evidence,projection_updated_at,created_by,updated_by)
      values(s.workspace_id,c.id,p_variant,p_recipe,'{}',c.updated_at,actor,actor) returning * into r;
    update public.mixology_submissions set status='accepted',imported_cocktail_id=c.id,imported_recipe_id=r.id,imported_variant=p_variant,reviewed_version_id=p_target_version where id=s.id;
    end if;
  elsif p_decision='rejected' then
    if p_target_version is not null then raise exception 'target_only_on_acceptance';end if;
    if s.status<>'pending' or p_recipe is not null or p_variant is not null then raise exception 'invalid_rejection';end if;
    update public.mixology_submissions set status='rejected' where id=s.id;
  elsif p_decision='reopened' then
    if p_target_version is not null then raise exception 'target_only_on_acceptance';end if;
    if s.status<>'rejected' or p_recipe is not null or p_variant is not null then raise exception 'invalid_reopen';end if;
    update public.mixology_submissions set status='pending' where id=s.id;
  else
    if p_target_version is not null or p_recipe is not null or p_variant is not null then raise exception 'invalid_redaction';end if;
    update public.mixology_submissions set document='{}',redacted_at=clock_timestamp() where id=s.id;
  end if;
  update public.mixology_submissions set revision=revision+1,moderated_by=actor,moderated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.mixology_submission_decisions(id,workspace_id,submission_id,source_revision,decision,reason,request_fingerprint,created_by,imported_cocktail_id,imported_recipe_id,reviewed_version_id)
    values(p_operation,s.workspace_id,s.id,p_revision,p_decision,p_reason,fingerprint,actor,s.imported_cocktail_id,s.imported_recipe_id,s.reviewed_version_id) returning * into e;
  return jsonb_build_object('submission',to_jsonb(s),'decision',to_jsonb(e));
end $$;
revoke all on function private.mixology_review_submission(uuid,uuid,bigint,text,text,text,jsonb,uuid) from public,anon,service_role;
grant execute on function private.mixology_review_submission(uuid,uuid,bigint,text,text,text,jsonb,uuid) to authenticated;
-- Existing clients still use the same invoker wrapper; new target links require the new RPC.
create or replace function private.mixology_moderate_submission(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin return private.mixology_review_submission(p_operation,p_submission,p_revision,p_decision,p_reason,p_variant,p_recipe,null);end $$;
create function public.mixology_submission_review(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb,p_target_version uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.mixology_review_submission(p_operation,p_submission,p_revision,p_decision,p_reason,p_variant,p_recipe,p_target_version);
$$;
revoke all on function public.mixology_submission_review(uuid,uuid,bigint,text,text,text,jsonb,uuid) from public,anon,service_role;
grant execute on function public.mixology_submission_review(uuid,uuid,bigint,text,text,text,jsonb,uuid) to authenticated;
commit;
