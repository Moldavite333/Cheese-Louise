-- Local quarantine only. Explicitly separate from public media and host taste evidence.
begin;
create or replace function private.mixology_valid_submission_v2(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if d->'schemaVersion'='1'::jsonb then return private.mixology_valid_submission_v1(d);end if;
  if octet_length(d::text)>16384 or d->'schemaVersion' is distinct from '2'::jsonb or jsonb_typeof(d->'kind') is distinct from 'string'
    or d->>'kind' not in ('idea','feedback','variation') or jsonb_typeof(d->'reference') is distinct from 'string'
    or length(d->>'reference')>240 or (d->>'kind'<>'idea' and length(trim(d->>'reference'))=0)
    or (d->>'kind'='feedback' and (d->>'ingredients'<>'' or d->>'method'<>'')) then return false;end if;
  return private.mixology_valid_submission_v1((d-'kind'-'reference')||'{"schemaVersion":1}'::jsonb);
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_submission_v2(jsonb) from public;
grant execute on function private.mixology_valid_submission_v2(jsonb) to authenticated,service_role;
create or replace function private.mixology_valid_submission(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb:=d->'photo';k text;
begin
 if d->'schemaVersion' is distinct from '3'::jsonb then return private.mixology_valid_submission_v2(d);end if;
 if octet_length(d::text)>16384 or d->>'kind' is distinct from 'photo' or jsonb_typeof(p) is distinct from 'object'
  or p->'realPhotoAttested' is distinct from 'true'::jsonb or p->'rightsAttested' is distinct from 'true'::jsonb
  or jsonb_typeof(p->'reusePermission') is distinct from 'boolean' then return false;end if;
 foreach k in array array['altText','caption','permissionNote'] loop if jsonb_typeof(p->k) is distinct from 'string' then return false;end if;end loop;
 if length(trim(p->>'altText')) not between 1 and 500 or length(p->>'caption')>1000 or length(trim(p->>'permissionNote')) not between 1 and 1000
  or exists(select 1 from jsonb_object_keys(p) as key where key not in ('altText','caption','permissionNote','realPhotoAttested','rightsAttested','reusePermission')) then return false;end if;
 return private.mixology_valid_submission_v2((d-'photo')||'{"schemaVersion":2,"kind":"feedback"}'::jsonb);
exception when others then return false;
end $$;
alter table public.mixology_submissions drop constraint mixology_submissions_kind_check;
alter table public.mixology_submissions add constraint mixology_submissions_kind_check check(kind in ('idea','feedback','variation','photo'));
alter table public.mixology_submissions drop constraint mixology_submission_import_shape;
alter table public.mixology_submissions add constraint mixology_submission_import_shape check(
 (status='accepted' and ((kind in ('feedback','photo') and imported_cocktail_id is null and imported_recipe_id is null and imported_variant is null)
  or (kind in ('idea','variation') and imported_cocktail_id is not null and imported_recipe_id is not null and imported_variant in ('alcoholic','alcohol_free'))))
 or (status<>'accepted' and imported_cocktail_id is null and imported_recipe_id is null and imported_variant is null and reviewed_version_id is null));
create table private.mixology_listener_photos (
 submission_id uuid primary key,workspace_id uuid not null,jpeg text not null check(length(jpeg)<=699052 and jpeg ~ '^/9j/[A-Za-z0-9+/]*={0,2}$'),
 width integer not null check(width between 320 and 1600),height integer not null check(height between 320 and 1600),
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),byte_size integer not null check(byte_size between 100 and 524288),
 foreign key(submission_id,workspace_id) references public.mixology_submissions(id,workspace_id)
);
alter table private.mixology_listener_photos enable row level security;
revoke all on private.mixology_listener_photos from public,anon,authenticated,service_role;
grant select on private.mixology_listener_photos to authenticated;
grant select,insert on private.mixology_listener_photos to service_role;
create policy listener_photo_host_read on private.mixology_listener_photos for select to authenticated using(
 private.is_workspace_member(workspace_id) and exists(select 1 from public.mixology_submissions s where s.id=submission_id and s.workspace_id=mixology_listener_photos.workspace_id and s.redacted_at is null));
create function public.mixology_listener_photo_read(p_submission uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('base64',jpeg,'width',width,'height',height,'digest',digest) from private.mixology_listener_photos where submission_id=p_submission;
$$;
revoke all on function public.mixology_listener_photo_read(uuid) from public,anon,service_role;
grant execute on function public.mixology_listener_photo_read(uuid) to authenticated;
create function public.mixology_listener_photo_finish(p_workspace uuid,p_request uuid,p_lease uuid,p_digest text,p_document jsonb,p_valid boolean,p_photo jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r private.mixology_submission_requests;result jsonb;image bytea;bytes integer;
begin
 perform 1 from private.mixology_submission_limits where workspace_id=p_workspace and bucket='global-day' for update;
 select * into r from private.mixology_submission_requests where workspace_id=p_workspace and request_id=p_request for update;
 if p_lease is null or p_digest is null or r.request_id is null or r.lease_token<>p_lease or r.payload_digest<>p_digest then raise exception 'intake_reservation_unavailable';end if;
 if r.status='received' then return jsonb_build_object('status','received');end if;
 if r.status<>'reserved' or p_valid is distinct from true or p_document->>'kind' is distinct from 'photo' or not private.mixology_valid_submission(p_document) then raise exception 'invalid_photo';end if;
 if jsonb_typeof(p_photo) is distinct from 'object' or jsonb_typeof(p_photo->'digest') is distinct from 'string' or jsonb_typeof(p_photo->'width') is distinct from 'number' or jsonb_typeof(p_photo->'height') is distinct from 'number' or exists(select 1 from jsonb_object_keys(p_photo) as key where key not in ('base64','width','height','digest')) or jsonb_typeof(p_photo->'base64') is distinct from 'string' or length(p_photo->>'base64')>699052
  or (p_photo->>'base64') !~ '^/9j/[A-Za-z0-9+/]*={0,2}$' or (p_photo->>'digest') !~ '^[0-9a-f]{64}$'
  or (p_photo->>'width') !~ '^[0-9]{3,4}$' or (p_photo->>'height') !~ '^[0-9]{3,4}$' then raise exception 'invalid_photo';end if;
 image:=decode(p_photo->>'base64','base64');bytes:=octet_length(image);
 if bytes not between 100 and 524288 or (p_photo->>'width')::integer not between 320 and 1600 or (p_photo->>'height')::integer not between 320 and 1600 then raise exception 'invalid_photo';end if;
 -- Serialize the bounded review store across concurrent verified uploads.

 if not exists(select 1 from public.mixology_submissions where workspace_id=p_workspace and request_digest=p_digest and redacted_at is null) and (
  (select count(*) from private.mixology_listener_photos where workspace_id=p_workspace)>=200 or (select coalesce(sum(byte_size),0) from private.mixology_listener_photos where workspace_id=p_workspace)+bytes>67108864) then raise exception 'photo_review_store_full';end if;
 result:=public.mixology_submission_finish(p_workspace,p_request,p_lease,p_digest,p_document,true);
 select * into r from private.mixology_submission_requests where workspace_id=p_workspace and request_id=p_request;
 insert into private.mixology_listener_photos(submission_id,workspace_id,jpeg,width,height,digest,byte_size)
 values(r.submission_id,p_workspace,p_photo->>'base64',(p_photo->>'width')::integer,(p_photo->>'height')::integer,p_photo->>'digest',bytes) on conflict do nothing;
 return result;
end $$;
revoke all on function public.mixology_listener_photo_finish(uuid,uuid,uuid,text,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.mixology_listener_photo_finish(uuid,uuid,uuid,text,jsonb,boolean,jsonb) to service_role;
create or replace function private.mixology_review_submission(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb,p_target_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
    if s.kind in ('variation','photo') and p_target_version is null then raise exception 'variation_parent_required';end if;
    if p_target_version is not null and not exists(select 1 from public.mixology_versions where id=p_target_version and workspace_id=s.workspace_id) then raise exception 'review_target_unavailable' using errcode='42501';end if;
    if s.kind='photo' and not exists(select 1 from private.mixology_listener_photos where submission_id=s.id) then raise exception 'photo_unavailable';end if;
    if s.kind in ('feedback','photo') then
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
    delete from private.mixology_listener_photos where submission_id=s.id;
  end if;
  update public.mixology_submissions set revision=revision+1,moderated_by=actor,moderated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.mixology_submission_decisions(id,workspace_id,submission_id,source_revision,decision,reason,request_fingerprint,created_by,imported_cocktail_id,imported_recipe_id,reviewed_version_id)
    values(p_operation,s.workspace_id,s.id,p_revision,p_decision,p_reason,fingerprint,actor,s.imported_cocktail_id,s.imported_recipe_id,s.reviewed_version_id) returning * into e;
  return jsonb_build_object('submission',to_jsonb(s),'decision',to_jsonb(e));
end $$;
commit;
