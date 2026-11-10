begin;
alter table public.mixology_media alter column object_path drop not null;
alter table public.mixology_media add column listener_submission_id uuid;
alter table public.mixology_media add column listener_revision bigint;
alter table public.mixology_media add column listener_review_confirmed boolean not null default false;
alter table public.mixology_media add column listener_reviewed_by uuid references auth.users(id);
alter table public.mixology_media add column listener_reviewed_at timestamptz;
alter table public.mixology_media add foreign key(listener_submission_id,workspace_id) references public.mixology_submissions(id,workspace_id);
alter table public.mixology_media add unique(listener_submission_id);
alter table public.mixology_media add constraint mixology_media_origin check(
 (listener_submission_id is null and object_path is not null and listener_revision is null and not listener_review_confirmed and listener_reviewed_by is null and listener_reviewed_at is null)
 or (listener_submission_id is not null and object_path is null and listener_revision is not null and listener_review_confirmed and listener_reviewed_by is not null and listener_reviewed_at is not null));
create function private.mixology_listener_source_current(p_source uuid,p_version uuid,p_digest text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.mixology_submissions s join private.mixology_listener_photos p on p.submission_id=s.id and p.workspace_id=s.workspace_id
 where s.id=p_source and private.is_workspace_member(s.workspace_id) and s.kind='photo' and s.status='accepted' and s.redacted_at is null and s.reviewed_version_id=p_version
 and s.document->'photo'->>'reusePermission'='true' and s.document->'photo'->>'rightsAttested'='true' and s.document->'photo'->>'realPhotoAttested'='true' and p.digest=p_digest);
$$;
revoke all on function private.mixology_listener_source_current(uuid,uuid,text) from public,anon,service_role;
grant execute on function private.mixology_listener_source_current(uuid,uuid,text) to authenticated;
create or replace function private.mixology_media_guard() returns trigger language plpgsql set search_path='' as $$
declare obj storage.objects;s public.mixology_submissions;p private.mixology_listener_photos;expected_credit text;
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.workspace_id<>old.workspace_id or new.version_id<>old.version_id or new.object_path is distinct from old.object_path or new.digest<>old.digest
      or new.width<>old.width or new.height<>old.height or new.byte_size<>old.byte_size or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'media_identity_immutable';end if;
    if new.listener_submission_id is distinct from old.listener_submission_id or new.listener_revision is distinct from old.listener_revision or new.listener_review_confirmed is distinct from old.listener_review_confirmed or new.listener_reviewed_by is distinct from old.listener_reviewed_by or new.listener_reviewed_at is distinct from old.listener_reviewed_at then raise exception 'media_identity_immutable';end if;
    if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
  else
    if new.revision<>1 then raise exception 'draft_conflict' using errcode='40001';end if;
    if new.listener_submission_id is null then
    new.object_path:=new.workspace_id::text||'/'||new.version_id::text||'/'||new.id::text||'.jpg';
    select * into obj from storage.objects where bucket_id='mixology-photos' and name=new.object_path and owner_id=auth.uid()::text;
    if obj.id is null or obj.metadata->>'mimetype' is distinct from 'image/jpeg' or obj.metadata->>'size' is null then raise exception 'photo_object_unavailable';end if;
    new.byte_size:=(obj.metadata->>'size')::integer;
    else
      if new.listener_review_confirmed is distinct from true then raise exception 'review_listener_photo_first';end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mixology-listener-media:'||new.listener_submission_id::text,0));
      select * into s from public.mixology_submissions where id=new.listener_submission_id;
      select * into p from private.mixology_listener_photos where submission_id=s.id;
      if s.workspace_id is distinct from new.workspace_id or not private.mixology_listener_source_current(s.id,new.version_id,p.digest) then raise exception 'listener_photo_not_reusable';end if;
      new.object_path:=null;new.listener_revision:=s.revision;new.listener_reviewed_by:=auth.uid();new.listener_reviewed_at:=clock_timestamp();new.digest:=p.digest;new.width:=p.width;new.height:=p.height;new.byte_size:=p.byte_size;
    end if;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
  end if;
  if new.listener_submission_id is not null and new.document->>'hidden'='false' then
    if not private.mixology_listener_source_current(new.listener_submission_id,new.version_id,new.digest) then raise exception 'listener_photo_not_reusable';end if;
    select * into s from public.mixology_submissions where id=new.listener_submission_id;expected_credit:=case when s.document->>'mayCredit'='true' and length(trim(s.document->>'credit'))>0 then s.document->>'credit' else 'Listener photograph (anonymous)' end;
    if new.document->>'credit' is distinct from expected_credit then raise exception 'listener_photo_credit_required';end if;
  end if;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
create function public.mixology_listener_photo_link(p_id uuid,p_submission uuid,p_revision bigint,p_alt text,p_caption text,p_confirmed boolean) returns public.mixology_media language plpgsql security invoker set search_path='' as $$
declare s public.mixology_submissions;m public.mixology_media;p private.mixology_listener_photos;d jsonb;
begin
 if p_id is null or p_confirmed is distinct from true then raise exception 'review_listener_photo_first';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mixology-listener-media:'||p_submission::text,0));
 select * into s from public.mixology_submissions where id=p_submission;
 if s.id is null then raise exception 'listener_photo_unavailable';end if;
 select * into p from private.mixology_listener_photos where submission_id=s.id;
 if not private.mixology_listener_source_current(s.id,s.reviewed_version_id,p.digest) then raise exception 'listener_photo_not_reusable';end if;
 if s.revision is distinct from p_revision then raise exception 'draft_conflict' using errcode='40001';end if;
 d:=jsonb_build_object('schemaVersion',1,'altText',p_alt,'caption',p_caption,'credit',case when s.document->>'mayCredit'='true' and length(trim(s.document->>'credit'))>0 then s.document->>'credit' else 'Listener photograph (anonymous)' end,
 'permissionNote','Listener permitted reuse; host reviewed the actual photo, rights and spoilers.','rightsAttested',true,'realPhotoAttested',true,'hidden',false);
 select * into m from public.mixology_media where id=p_id;
 if m.id is not null then
  if m.listener_submission_id is distinct from s.id or m.listener_revision is distinct from p_revision or m.created_by<>auth.uid() or m.document<>d then raise exception 'media_retry_mismatch';end if;return m;
 end if;
 if exists(select 1 from public.mixology_media where listener_submission_id=s.id) then raise exception 'listener_photo_already_linked';end if;
 insert into public.mixology_media(id,workspace_id,version_id,object_path,digest,width,height,byte_size,document,listener_submission_id,listener_review_confirmed)
 values(p_id,s.workspace_id,s.reviewed_version_id,null,p.digest,p.width,p.height,p.byte_size,d,s.id,true) returning * into m;
 return m;
end $$;
create function public.mixology_listener_media_bytes(p_media uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('base64',p.jpeg,'width',p.width,'height',p.height,'digest',p.digest) from public.mixology_media m join private.mixology_listener_photos p on p.submission_id=m.listener_submission_id and p.workspace_id=m.workspace_id
 where m.id=p_media and m.document->>'hidden'='false' and m.document->>'rightsAttested'='true' and m.document->>'realPhotoAttested'='true'
 and private.mixology_listener_source_current(m.listener_submission_id,m.version_id,m.digest);
$$;
revoke all on function public.mixology_listener_photo_link(uuid,uuid,bigint,text,text,boolean),public.mixology_listener_media_bytes(uuid) from public,anon,service_role;
grant execute on function public.mixology_listener_photo_link(uuid,uuid,bigint,text,text,boolean),public.mixology_listener_media_bytes(uuid) to authenticated;
-- Shared lock ordering: promotion takes this lock before reading source state; source updates
-- take it before changing state. Row SELECT FOR UPDATE would require broad raw-queue UPDATE grants.
create function private.mixology_listener_media_lock() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='photo' then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mixology-listener-media:'||new.id::text,0));end if;return new;
end $$;
revoke all on function private.mixology_listener_media_lock() from public;
create trigger mixology_listener_media_lock before update on public.mixology_submissions for each row execute function private.mixology_listener_media_lock();
-- Invoker trigger runs inside the already checked moderation transaction. No new definer capability.
create function private.mixology_redacted_media_hide() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.redacted_at is not null and old.redacted_at is null then
  update public.mixology_media set document=document||'{"hidden":true,"rightsAttested":false,"realPhotoAttested":false,"altText":"Listener photo withdrawn","caption":"","credit":"Listener photograph (withdrawn)","permissionNote":"Source removed. Future reuse is blocked."}'::jsonb,revision=revision+1 where listener_submission_id=new.id;
 end if;return new;
end $$;
revoke all on function private.mixology_redacted_media_hide() from public;
create trigger mixology_redacted_media_hide after update on public.mixology_submissions for each row execute function private.mixology_redacted_media_hide();
create or replace function private.mixology_publication_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
declare d public.mixology_publication_drafts;v public.mixology_versions;c public.mixology_versions;r public.mixology_recipes;cr public.mixology_recipes;m public.mixology_media;decision text;
begin
  select * into d from public.mixology_publication_drafts where version_id=new.version_id and workspace_id=new.workspace_id for update;
  if d.version_id is null then raise exception 'publication_unavailable';end if;
  if d.revision<>new.draft_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  if d.document->>'reviewed'<>'true' then raise exception 'review_public_copy_first';end if;
  select * into v from public.mixology_versions where id=d.version_id;
  select * into r from public.mixology_recipes where id=v.recipe_id;
  select * into c from public.mixology_versions where id=(d.document->>'counterpartVersionId')::uuid;
  if d.document->>'counterpartVersionId' is not null and c.id is null then raise exception 'counterpart_unavailable';end if;
  select * into cr from public.mixology_recipes where id=c.recipe_id;
  if r.variant='alcoholic' and c.id is null then raise exception 'approved_counterpart_required';end if;
  if c.id is not null and (cr.workspace_id<>r.workspace_id or cr.cocktail_id<>r.cocktail_id or cr.variant=r.variant) then raise exception 'counterpart_mismatch';end if;
  perform 1 from public.mixology_recipes where id in (r.id,cr.id) order by id for update;
  select a.decision into decision from public.mixology_approvals a where version_id=v.id order by created_at desc,id desc limit 1;
  if decision is distinct from 'approved' then raise exception 'version_not_approved';end if;
  if c.id is not null then
    select a.decision into decision from public.mixology_approvals a where version_id=c.id order by created_at desc,id desc limit 1;
    if decision is distinct from 'approved' then raise exception 'counterpart_not_approved';end if;
  end if;
  select * into m from public.mixology_media where id=(d.document->>'photoId')::uuid and workspace_id=r.workspace_id and version_id=v.id for update;
  if m.id is null or m.document->>'hidden'<>'false' or m.document->>'rightsAttested'<>'true' or m.document->>'realPhotoAttested'<>'true' then raise exception 'eligible_real_photo_required';end if;
  if m.listener_submission_id is not null and not private.mixology_listener_source_current(m.listener_submission_id,m.version_id,m.digest) then raise exception 'listener_photo_not_reusable';end if;
  if d.reviewed_photo_revision is distinct from m.revision then raise exception 'public_photo_review_stale';end if;
  new.counterpart_version_id:=c.id;new.photo_id:=m.id;new.photo_revision:=m.revision;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
  new.document:=jsonb_build_object('schemaVersion',1,'recipe',private.mixology_public_recipe(v.document),'variant',r.variant,
    'counterpart',case when c.id is null then null else jsonb_build_object('recipe',private.mixology_public_recipe(c.document),'variant',cr.variant) end,
    'copy',d.document-'photoId'-'counterpartVersionId'-'reviewed',
    'photo',jsonb_build_object('altText',m.document->'altText','caption',m.document->'caption','credit',m.document->'credit'));
  return new;
end $$;
create or replace function public.mixology_publication_export(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.mixology_publication_snapshots;m public.mixology_media;v public.mixology_versions;decision text;vid uuid;
begin
  select * into s from public.mixology_publication_snapshots where id=p_id;if s.id is null then raise exception 'publication_unavailable';end if;
  perform 1 from public.mixology_recipes where id in (select recipe_id from public.mixology_versions where id in(s.version_id,s.counterpart_version_id)) order by id for update;
  foreach vid in array array[s.version_id,s.counterpart_version_id] loop
    if vid is null then continue;end if;
    select a.decision into decision from public.mixology_approvals a where version_id=vid order by created_at desc,id desc limit 1;
    if decision is distinct from 'approved' then raise exception 'publication_approval_changed';end if;
  end loop;
  select * into m from public.mixology_media where id=s.photo_id for update;
  if m.revision<>s.photo_revision or m.document->>'hidden'<>'false' or m.document->>'rightsAttested'<>'true' or m.document->>'realPhotoAttested'<>'true' then raise exception 'publication_photo_changed';end if;
  if m.listener_submission_id is not null and not private.mixology_listener_source_current(m.listener_submission_id,m.version_id,m.digest) then raise exception 'listener_photo_not_reusable';end if;
  return jsonb_build_object('snapshot',s,'photoPath',m.object_path,'photoId',m.id,'listenerPhoto',m.listener_submission_id is not null);
end $$;

create or replace function private.mixology_review_submission(p_operation uuid,p_submission uuid,p_revision bigint,p_decision text,p_reason text,p_variant text,p_recipe jsonb,p_target_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.mixology_submissions;e public.mixology_submission_decisions;c public.cocktails;r public.mixology_recipes;actor uuid:=auth.uid();fingerprint text;
begin
  if actor is null then raise exception 'moderation_forbidden' using errcode='42501';end if;
  -- Same advisory-before-row/FK order as promotion avoids a source/media lock inversion.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mixology-listener-media:'||p_submission::text,0));
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
