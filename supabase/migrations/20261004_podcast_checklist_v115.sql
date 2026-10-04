create table if not exists public.podcast_checklist_progress (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_key text not null,
  completed boolean not null default false,
  owner_id uuid null references auth.users(id) on delete set null,
  due_date date null,
  notes text null,
  completed_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, task_key)
);

alter table public.podcast_checklist_progress enable row level security;

drop policy if exists podcast_checklist_progress_member_all on public.podcast_checklist_progress;
create policy podcast_checklist_progress_member_all
on public.podcast_checklist_progress
for all
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.podcast_checklist_progress to authenticated;
grant all on public.podcast_checklist_progress to service_role;

create index if not exists podcast_checklist_progress_workspace_completed_idx
  on public.podcast_checklist_progress(workspace_id, completed);
