-- Cheese Louise v1.32 — adaptive Cheese Master
-- Additive schema for data-driven recognition, explainable evidence, and feedback learning.

alter table public.cheese_traits
  add column if not exists recognition jsonb not null default '{}'::jsonb;

alter table public.movie_traits
  add column if not exists selection_source text not null default 'manual',
  add column if not exists confidence numeric,
  add column if not exists evidence jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='movie_traits_selection_source_check'
  ) then
    alter table public.movie_traits
      add constraint movie_traits_selection_source_check
      check (selection_source in ('manual','cheese_master','imported'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='movie_traits_confidence_check'
  ) then
    alter table public.movie_traits
      add constraint movie_traits_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
end $$;

alter table public.movies
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.trait_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  tmdb_id bigint,
  trait_id uuid not null references public.cheese_traits(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accepted','rejected','manual_added','manual_removed')),
  source_text text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trait_feedback_workspace_trait_idx
  on public.trait_feedback(workspace_id,trait_id,created_at desc);
create index if not exists trait_feedback_movie_idx
  on public.trait_feedback(movie_id,created_at desc) where movie_id is not null;

alter table public.trait_feedback enable row level security;

drop policy if exists "Workspace members can manage trait feedback" on public.trait_feedback;
create policy "Workspace members can manage trait feedback"
on public.trait_feedback
for all
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

grant select,insert,update,delete on public.trait_feedback to authenticated;
grant all on public.trait_feedback to service_role;
