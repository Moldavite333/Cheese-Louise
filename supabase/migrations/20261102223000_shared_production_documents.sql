create table if not exists public.production_documents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  document_type text not null check (document_type in ('watch_along','recording','timeline','bingo')),
  document jsonb not null default '{}'::jsonb check (jsonb_typeof(document) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,movie_id,document_type)
);

alter table public.production_documents enable row level security;

create policy production_documents_member_all
on public.production_documents
for all
to authenticated
using (private.is_workspace_member(workspace_id)
  and exists (select 1 from public.movies m where m.id = movie_id and m.workspace_id = workspace_id))
with check (private.is_workspace_member(workspace_id)
  and exists (select 1 from public.movies m where m.id = movie_id and m.workspace_id = workspace_id));

grant select, insert, update, delete on public.production_documents to authenticated;
grant all on public.production_documents to service_role;
