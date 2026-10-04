-- Cheese Louise v1.17 — Romantiverse Trait Art
-- Adds canonical art metadata to Cheese Traits and a workspace-scoped public art bucket.

alter table public.cheese_traits
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists image_prompt text,
  add column if not exists image_status text not null default 'missing',
  add column if not exists image_style_version text not null default 'romantiverse-v1',
  add column if not exists image_source text not null default 'generated',
  add column if not exists image_seed text,
  add column if not exists image_updated_at timestamptz;

alter table public.cheese_traits drop constraint if exists cheese_traits_image_status_check;
alter table public.cheese_traits add constraint cheese_traits_image_status_check
  check (image_status in ('missing','generating','ready','error','custom'));

alter table public.cheese_traits drop constraint if exists cheese_traits_image_source_check;
alter table public.cheese_traits add constraint cheese_traits_image_source_check
  check (image_source in ('generated','reference','custom'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'trait-art',
  'trait-art',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Trait art members can upload" on storage.objects;
create policy "Trait art members can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='trait-art'
  and array_length(storage.foldername(name),1)>=1
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Trait art members can update" on storage.objects;
create policy "Trait art members can update"
on storage.objects for update to authenticated
using (
  bucket_id='trait-art'
  and array_length(storage.foldername(name),1)>=1
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id='trait-art'
  and array_length(storage.foldername(name),1)>=1
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Trait art members can delete" on storage.objects;
create policy "Trait art members can delete"
on storage.objects for delete to authenticated
using (
  bucket_id='trait-art'
  and array_length(storage.foldername(name),1)>=1
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

update public.cheese_traits
set
  image_prompt = coalesce(
    image_prompt,
    'Cheese Louise Romantiverse trait icon: ' || name || '. Category: ' || category || '. Vintage mid-century cheese-wrapper illustration, cream background, deep forest-green outlines, warm red accents, gold highlights, simple centered symbolic icon, lightly distressed print texture, no text.'
  ),
  image_style_version = coalesce(image_style_version,'romantiverse-v1')
where image_prompt is null or image_style_version is null;
