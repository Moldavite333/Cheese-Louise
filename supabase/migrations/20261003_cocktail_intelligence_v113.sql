alter table public.cocktails
  add column if not exists source_name text,
  add column if not exists source_id text,
  add column if not exists source_url text,
  add column if not exists source_category text,
  add column if not exists source_image_url text,
  add column if not exists iba_official boolean not null default false,
  add column if not exists iba_category text,
  add column if not exists imported_at timestamptz;

create unique index if not exists cocktails_workspace_source_unique
  on public.cocktails(workspace_id, source_name, source_id)
  where source_id is not null;
