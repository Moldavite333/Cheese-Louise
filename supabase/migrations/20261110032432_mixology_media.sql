-- Prepared locally only. Creates a private bucket when separately authorized for staging.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mixology-photos','mixology-photos',false,5242880,array['image/jpeg'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='mixology-photos' and (public is distinct from false or file_size_limit is distinct from 5242880 or allowed_mime_types is distinct from array['image/jpeg'])) then
    raise exception 'Existing mixology photo bucket configuration needs review';
  end if;
end $$;
create function private.mixology_photo_path_allowed(path text) returns boolean language plpgsql stable set search_path='' as $$
declare parts text[];
begin
  parts:=string_to_array(path,'/');
  if array_length(parts,1)<>3 or parts[3] !~ '^[0-9a-f-]{36}\.jpg$' then return false;end if;
  perform (replace(parts[3],'.jpg',''))::uuid;
  return exists(select 1 from public.mixology_versions where id=parts[2]::uuid and workspace_id=parts[1]::uuid and private.is_workspace_member(workspace_id));
exception when others then return false;
end $$;
revoke all on function private.mixology_photo_path_allowed(text) from public;
grant execute on function private.mixology_photo_path_allowed(text) to authenticated;
create policy mixology_photos_read on storage.objects for select to authenticated
using(bucket_id='mixology-photos' and private.mixology_photo_path_allowed(name));
create policy mixology_photos_upload on storage.objects for insert to authenticated
with check(bucket_id='mixology-photos' and owner_id=auth.uid()::text and private.mixology_photo_path_allowed(name));
-- No update/delete policies are added: originals cannot be silently overwritten.
create function private.mixology_valid_media(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;
begin
  if jsonb_typeof(d) is distinct from 'object' or d->'schemaVersion' is distinct from '1'::jsonb or octet_length(d::text)>8192 then return false;end if;
  foreach k in array array['altText','caption','credit','permissionNote'] loop
    if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>2000 then return false;end if;
  end loop;
  if length(trim(d->>'altText')) not between 1 and 500 or length(trim(d->>'credit')) not between 1 and 300 or length(trim(d->>'permissionNote')) not between 1 and 1000 then return false;end if;
  foreach k in array array['rightsAttested','realPhotoAttested','hidden'] loop
    if jsonb_typeof(d->k) is distinct from 'boolean' then return false;end if;
  end loop;
  if d->>'hidden'='false' and (d->>'rightsAttested'<>'true' or d->>'realPhotoAttested'<>'true') then return false;end if;
  if exists(select 1 from jsonb_object_keys(d) as key where key not in ('schemaVersion','altText','caption','credit','permissionNote','rightsAttested','realPhotoAttested','hidden')) then return false;end if;
  return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_media(jsonb) from public;
grant execute on function private.mixology_valid_media(jsonb) to authenticated;
create table public.mixology_media (
  id uuid primary key,workspace_id uuid not null,version_id uuid not null,
  object_path text not null unique,digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  width integer not null check(width between 320 and 2400),height integer not null check(height between 320 and 2400),
  byte_size integer not null check(byte_size between 1 and 5242880),
  document jsonb not null check(private.mixology_valid_media(document)),revision bigint not null default 1 check(revision>0),
  created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
  unique(id,workspace_id),foreign key(version_id,workspace_id) references public.mixology_versions(id,workspace_id)
);
alter table public.mixology_media enable row level security;
revoke all on public.mixology_media from public,anon,authenticated;
grant select,insert,update on public.mixology_media to authenticated;
create policy mixology_media_read on public.mixology_media for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_media_add on public.mixology_media for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid() and updated_by=auth.uid());
create policy mixology_media_edit on public.mixology_media for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create index mixology_media_version_time on public.mixology_media(version_id,created_at desc);
create function private.mixology_media_guard() returns trigger language plpgsql set search_path='' as $$
declare obj storage.objects;
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.workspace_id<>old.workspace_id or new.version_id<>old.version_id or new.object_path<>old.object_path or new.digest<>old.digest
      or new.width<>old.width or new.height<>old.height or new.byte_size<>old.byte_size or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'media_identity_immutable';end if;
    if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
  else
    if new.revision<>1 then raise exception 'draft_conflict' using errcode='40001';end if;
    new.object_path:=new.workspace_id::text||'/'||new.version_id::text||'/'||new.id::text||'.jpg';
    select * into obj from storage.objects where bucket_id='mixology-photos' and name=new.object_path and owner_id=auth.uid()::text;
    if obj.id is null or obj.metadata->>'mimetype' is distinct from 'image/jpeg' or obj.metadata->>'size' is null then raise exception 'photo_object_unavailable';end if;
    new.byte_size:=(obj.metadata->>'size')::integer;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
  end if;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.mixology_media_guard() from public;
create trigger mixology_media_guard before insert or update on public.mixology_media for each row execute function private.mixology_media_guard();
create function public.mixology_media_register(p_id uuid,p_version uuid,p_digest text,p_width integer,p_height integer,p_document jsonb) returns public.mixology_media language plpgsql security invoker set search_path='' as $$
declare v public.mixology_versions;r public.mixology_media;
begin
  select * into v from public.mixology_versions where id=p_version;if v.id is null then raise exception 'version_unavailable';end if;
  select * into r from public.mixology_media where id=p_id;
  if r.id is not null then
    if r.version_id<>p_version or r.digest<>p_digest or r.created_by<>auth.uid() or r.document<>p_document then raise exception 'media_retry_mismatch';end if;return r;
  end if;
  insert into public.mixology_media(id,workspace_id,version_id,object_path,digest,width,height,byte_size,document)
    values(p_id,v.workspace_id,v.id,'pending',p_digest,p_width,p_height,1,p_document) returning * into r;
  return r;
end $$;
create function public.mixology_media_save(p_id uuid,p_revision bigint,p_document jsonb) returns public.mixology_media language plpgsql security invoker set search_path='' as $$
declare r public.mixology_media;
begin
  update public.mixology_media set document=p_document,revision=revision+1 where id=p_id and revision=p_revision returning * into r;
  if r.id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;
end $$;
revoke all on function public.mixology_media_register(uuid,uuid,text,integer,integer,jsonb),public.mixology_media_save(uuid,bigint,jsonb) from public,anon;
grant execute on function public.mixology_media_register(uuid,uuid,text,integer,integer,jsonb),public.mixology_media_save(uuid,bigint,jsonb) to authenticated;
commit;
