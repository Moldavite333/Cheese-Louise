-- Shared, generated research is separate from movies and host-authored notes.
create table public.movie_research_briefs (
 movie_id uuid primary key references public.movies(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 input_hash text not null,
 status text not null default 'queued' check(status in ('queued','generating','ready','limited','error')),
 report jsonb not null default '{}'::jsonb check(jsonb_typeof(report)='object'),
 lease_token uuid,
 started_at timestamptz,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 retry_after timestamptz,
 error_code text,
 attempts integer not null default 0 check(attempts>=0)
);
create index movie_research_queue_idx on public.movie_research_briefs(workspace_id,status,updated_at);
alter table public.movie_research_briefs enable row level security;
create policy "members read movie research" on public.movie_research_briefs for select to authenticated
using (private.is_workspace_member(workspace_id) and exists(select 1 from public.movies m where m.id=movie_id and m.workspace_id=movie_research_briefs.workspace_id));
revoke all on public.movie_research_briefs from anon,authenticated;
grant select on public.movie_research_briefs to authenticated;
grant all on public.movie_research_briefs to service_role;

create table public.movie_research_versions (
 id uuid primary key default gen_random_uuid(),
 movie_id uuid not null references public.movies(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 report jsonb not null check(jsonb_typeof(report)='object'),
 created_at timestamptz not null default now()
);
create index movie_research_versions_movie_idx on public.movie_research_versions(movie_id,created_at desc);
alter table public.movie_research_versions enable row level security;
create policy "members read prior movie research" on public.movie_research_versions for select to authenticated
using (private.is_workspace_member(workspace_id) and exists(select 1 from public.movies m where m.id=movie_id and m.workspace_id=movie_research_versions.workspace_id));
revoke all on public.movie_research_versions from anon,authenticated;
grant select on public.movie_research_versions to authenticated;
grant all on public.movie_research_versions to service_role;

create table public.movie_research_runs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 movie_id uuid not null references public.movies(id) on delete cascade,
 started_at timestamptz not null default now()
);
create index movie_research_runs_workspace_time_idx on public.movie_research_runs(workspace_id,started_at);
alter table public.movie_research_runs enable row level security;
create policy "backend manages research usage" on public.movie_research_runs for all to service_role using(true) with check(true);
revoke all on public.movie_research_runs from anon,authenticated;
grant all on public.movie_research_runs to service_role;

-- Invoker functions are restricted to the backend role. No browser may enqueue
-- arbitrary work or modify generated reports directly.
create function public.request_movie_research(p_movie_id uuid,p_workspace_id uuid,p_input_hash text,p_force boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.movie_research_briefs;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('research:'||p_workspace_id::text));
 if not exists(select 1 from public.movies where id=p_movie_id and workspace_id=p_workspace_id and status<>'passed') then return false; end if;
 select * into r from public.movie_research_briefs where movie_id=p_movie_id for update;
 if found then
  if r.status='generating' and r.started_at>now()-interval '8 minutes' then return false; end if;
  if r.status='queued' then return false; end if;
  if r.retry_after>now() then return false; end if;
  if r.attempts>=6 and r.started_at>now()-interval '1 day' then
   update public.movie_research_briefs set status='error',error_code='daily_attempt_limit',retry_after=r.started_at+interval '1 day' where movie_id=p_movie_id;
   return false;
  end if;
  if r.status in ('ready','limited') and r.input_hash=p_input_hash and not p_force and r.completed_at>now()-interval '30 days' then return false; end if;
  if r.updated_at>now()-interval '30 minutes' and p_force then return false; end if;
  update public.movie_research_briefs set input_hash=p_input_hash,status='queued',lease_token=null,error_code=null,retry_after=null,attempts=case when r.started_at<now()-interval '1 day' then 0 else attempts end,updated_at=now() where movie_id=p_movie_id;
 else
  insert into public.movie_research_briefs(movie_id,workspace_id,input_hash) values(p_movie_id,p_workspace_id,p_input_hash);
 end if;
 return true;
end $$;

create function public.claim_movie_research(p_workspace_id uuid)
returns setof public.movie_research_briefs language plpgsql security invoker set search_path='' as $$
declare candidate uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('research:'||p_workspace_id::text));
 if exists(select 1 from public.movie_research_briefs where workspace_id=p_workspace_id and status='generating' and started_at>now()-interval '8 minutes') then return; end if;
 -- Bounded spend: at most 40 starts per hour per workspace. Cached reads are free.
 if (select count(*) from public.movie_research_runs where workspace_id=p_workspace_id and started_at>now()-interval '1 hour')>=40 then return; end if;
 select movie_id into candidate from public.movie_research_briefs
 where workspace_id=p_workspace_id and (status='queued' or (status='generating' and started_at<=now()-interval '8 minutes')) and attempts<6
 order by updated_at limit 1 for update skip locked;
 if candidate is null then return; end if;
 insert into public.movie_research_runs(workspace_id,movie_id) values(p_workspace_id,candidate);
 return query update public.movie_research_briefs set status='generating',lease_token=gen_random_uuid(),started_at=now(),updated_at=now(),attempts=attempts+1 where movie_id=candidate returning *;
end $$;

revoke all on function public.request_movie_research(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.claim_movie_research(uuid) from public,anon,authenticated;
grant execute on function public.request_movie_research(uuid,uuid,text,boolean) to service_role;
grant execute on function public.claim_movie_research(uuid) to service_role;
