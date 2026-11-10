-- Private recipe/promotional review drafts only. No public routes or publication state.
begin;
create function private.mixology_valid_publication(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;r jsonb;ids text[]:='{}';
begin
  if jsonb_typeof(d) is distinct from 'object' or d->'schemaVersion' is distinct from '1'::jsonb or octet_length(d::text)>32768
    or jsonb_typeof(d->'reviewed') is distinct from 'boolean' or jsonb_typeof(d->'sources') is distinct from 'array' or jsonb_array_length(d->'sources')>20 then return false;end if;
  foreach k in array array['intro','movieConnection','socialCaption','episodeBlurb'] loop
    if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>4000 then return false;end if;
  end loop;
  foreach k in array array['photoId','counterpartVersionId'] loop
    if not d ? k then return false;end if;
    if d->k<>'null'::jsonb then perform (d->>k)::uuid;end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(d) as key where key not in ('schemaVersion','intro','movieConnection','socialCaption','episodeBlurb','sources','photoId','counterpartVersionId','reviewed')) then return false;end if;
  for r in select value from jsonb_array_elements(d->'sources') loop
    if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or r->>'id'=any(ids)
      or jsonb_typeof(r->'title') is distinct from 'string' or length(trim(r->>'title')) not between 1 and 200
      or jsonb_typeof(r->'url') is distinct from 'string' or length(r->>'url')>2000
      or r->>'url' !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$'
      or r->>'url' ~* '([?&](token|access_token|apikey|api_key|authorization|signature|key|sig|auth|auth_token|client_secret|password|session|jwt|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)=|/storage/v1/object/sign/)'
      or jsonb_typeof(r->'retrievedOn') is distinct from 'string' or r->>'retrievedOn' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((r->>'retrievedOn')::date,'YYYY-MM-DD')<>r->>'retrievedOn' then return false;end if;
    ids:=array_append(ids,r->>'id');
    if exists(select 1 from jsonb_object_keys(r) as key where key not in ('id','title','url','retrievedOn')) then return false;end if;
  end loop;return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_publication(jsonb) from public;
grant execute on function private.mixology_valid_publication(jsonb) to authenticated;
create table public.mixology_publication_drafts (
  version_id uuid primary key,workspace_id uuid not null,
  document jsonb not null check(private.mixology_valid_publication(document)),revision bigint not null default 1 check(revision>0),reviewed_photo_revision bigint,
  updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
  unique(version_id,workspace_id),foreign key(version_id,workspace_id) references public.mixology_versions(id,workspace_id)
);
alter table public.mixology_publication_drafts enable row level security;
revoke all on public.mixology_publication_drafts from public,anon,authenticated;
grant select,insert,update on public.mixology_publication_drafts to authenticated;
create policy mixology_publication_read on public.mixology_publication_drafts for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_publication_add on public.mixology_publication_drafts for insert to authenticated with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create policy mixology_publication_edit on public.mixology_publication_drafts for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create function private.mixology_publication_guard() returns trigger language plpgsql set search_path='' as $$
declare photo_revision bigint;
begin
  if tg_op='UPDATE' then
    if new.version_id<>old.version_id or new.workspace_id<>old.workspace_id then raise exception 'publication_identity_immutable';end if;
    if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
    if new.document-'reviewed' is distinct from old.document-'reviewed' then new.document:=jsonb_set(new.document,'{reviewed}','false');end if;
  else
    if new.revision<>1 then raise exception 'draft_conflict' using errcode='40001';end if;
    new.document:=jsonb_set(new.document,'{reviewed}','false');
  end if;
  if new.document->>'reviewed'='true' then
    if tg_op='UPDATE' and old.document->>'reviewed'='true' then new.reviewed_photo_revision:=old.reviewed_photo_revision;
    else
      select revision into photo_revision from public.mixology_media where id=(new.document->>'photoId')::uuid and workspace_id=new.workspace_id and version_id=new.version_id for update;
      if new.reviewed_photo_revision is distinct from photo_revision then raise exception 'public_photo_review_stale';end if;
    end if;
  else new.reviewed_photo_revision:=null;end if;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.mixology_publication_guard() from public;
create trigger mixology_publication_guard before insert or update on public.mixology_publication_drafts for each row execute function private.mixology_publication_guard();
create function public.mixology_publication_open(p_version uuid) returns public.mixology_publication_drafts language plpgsql security invoker set search_path='' as $$
declare v public.mixology_versions;r public.mixology_publication_drafts;
begin
  select * into v from public.mixology_versions where id=p_version;if v.id is null then raise exception 'version_unavailable';end if;
  insert into public.mixology_publication_drafts(version_id,workspace_id,document) values(v.id,v.workspace_id,'{"schemaVersion":1,"intro":"","movieConnection":"","socialCaption":"","episodeBlurb":"","sources":[],"photoId":null,"counterpartVersionId":null,"reviewed":false}') on conflict(version_id) do nothing;
  select * into r from public.mixology_publication_drafts where version_id=v.id;return r;
end $$;
create function public.mixology_publication_save(p_version uuid,p_revision bigint,p_document jsonb) returns public.mixology_publication_drafts language plpgsql security invoker set search_path='' as $$
declare r public.mixology_publication_drafts;
begin
  update public.mixology_publication_drafts set document=p_document,revision=revision+1 where version_id=p_version and revision=p_revision returning * into r;
  if r.version_id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;
end $$;
revoke all on function public.mixology_publication_open(uuid),public.mixology_publication_save(uuid,bigint,jsonb) from public,anon;
grant execute on function public.mixology_publication_open(uuid),public.mixology_publication_save(uuid,bigint,jsonb) to authenticated;
create function public.mixology_publication_review(p_version uuid,p_revision bigint,p_photo_revision bigint,p_reviewed boolean) returns public.mixology_publication_drafts language plpgsql security invoker set search_path='' as $$
declare r public.mixology_publication_drafts;
begin
  update public.mixology_publication_drafts set document=jsonb_set(document,'{reviewed}',to_jsonb(p_reviewed)),reviewed_photo_revision=p_photo_revision,revision=revision+1
  where version_id=p_version and revision=p_revision returning * into r;
  if r.version_id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;
end $$;
revoke all on function public.mixology_publication_review(uuid,bigint,bigint,boolean) from public,anon;
grant execute on function public.mixology_publication_review(uuid,bigint,bigint,boolean) to authenticated;

create function private.mixology_public_recipe(d jsonb) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('name',d->'name','servings',d->'servings','glassware',d->'glassware','garnish',d->'garnish',
    'ingredients',(select coalesce(jsonb_agg(jsonb_build_object('name',r->'name','quantity',r->'quantity','unit',r->'unit') order by n),'[]') from jsonb_array_elements(d->'ingredients') with ordinality a(r,n)),
    'steps',(select coalesce(jsonb_agg(r->'text' order by n),'[]') from jsonb_array_elements(d->'steps') with ordinality a(r,n)))
$$;
revoke all on function private.mixology_public_recipe(jsonb) from public;
grant execute on function private.mixology_public_recipe(jsonb) to authenticated;
create table public.mixology_publication_snapshots (
  id uuid primary key,workspace_id uuid not null,version_id uuid not null,draft_revision bigint not null,
  counterpart_version_id uuid,photo_id uuid not null,photo_revision bigint not null,document jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default clock_timestamp(),
  foreign key(version_id,workspace_id) references public.mixology_publication_drafts(version_id,workspace_id),
  foreign key(counterpart_version_id,workspace_id) references public.mixology_versions(id,workspace_id),
  foreign key(photo_id,workspace_id) references public.mixology_media(id,workspace_id)
);
alter table public.mixology_publication_snapshots enable row level security;
revoke all on public.mixology_publication_snapshots from public,anon,authenticated;
grant select,insert on public.mixology_publication_snapshots to authenticated;
create policy mixology_publication_snapshot_read on public.mixology_publication_snapshots for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_publication_snapshot_add on public.mixology_publication_snapshots for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid());
create index mixology_publication_snapshot_version on public.mixology_publication_snapshots(version_id,created_at desc);
create function private.mixology_publication_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
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
  if d.reviewed_photo_revision is distinct from m.revision then raise exception 'public_photo_review_stale';end if;
  new.counterpart_version_id:=c.id;new.photo_id:=m.id;new.photo_revision:=m.revision;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
  new.document:=jsonb_build_object('schemaVersion',1,'recipe',private.mixology_public_recipe(v.document),'variant',r.variant,
    'counterpart',case when c.id is null then null else jsonb_build_object('recipe',private.mixology_public_recipe(c.document),'variant',cr.variant) end,
    'copy',d.document-'photoId'-'counterpartVersionId'-'reviewed',
    'photo',jsonb_build_object('altText',m.document->'altText','caption',m.document->'caption','credit',m.document->'credit'));
  return new;
end $$;
revoke all on function private.mixology_publication_snapshot_guard() from public;
create trigger mixology_publication_snapshot_guard before insert on public.mixology_publication_snapshots for each row execute function private.mixology_publication_snapshot_guard();
create function public.mixology_publication_snapshot(p_id uuid,p_version uuid,p_revision bigint) returns public.mixology_publication_snapshots language plpgsql security invoker set search_path='' as $$
declare d public.mixology_publication_drafts;r public.mixology_publication_snapshots;
begin
  select * into d from public.mixology_publication_drafts where version_id=p_version;if d.version_id is null then raise exception 'publication_unavailable';end if;
  select * into r from public.mixology_publication_snapshots where id=p_id;
  if r.id is not null then
    if r.version_id<>p_version or r.draft_revision<>p_revision or r.created_by<>auth.uid() then raise exception 'publication_retry_mismatch';end if;return r;
  end if;
  insert into public.mixology_publication_snapshots(id,workspace_id,version_id,draft_revision,photo_id,photo_revision,document)
    values(p_id,d.workspace_id,p_version,p_revision,'00000000-0000-0000-0000-000000000000',0,'{}') returning * into r;
  return r;
end $$;
create function public.mixology_publication_export(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  return jsonb_build_object('snapshot',s,'photoPath',m.object_path);
end $$;
revoke all on function public.mixology_publication_snapshot(uuid,uuid,bigint),public.mixology_publication_export(uuid) from public,anon;
grant execute on function public.mixology_publication_snapshot(uuid,uuid,bigint),public.mixology_publication_export(uuid) to authenticated;
commit;
