-- Additive, local preparation only. No hosted database has been migrated.
begin;
create table public.mixology_approvals (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  version_id uuid not null,
  decision text not null check(decision in ('approved','withdrawn')),
  host_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(version_id,workspace_id) references public.mixology_versions(id,workspace_id)
);
alter table public.mixology_approvals enable row level security;
revoke all on public.mixology_approvals from public,anon,authenticated;
grant select,insert on public.mixology_approvals to authenticated;
create policy mixology_approvals_read on public.mixology_approvals for select to authenticated
using(private.is_workspace_member(workspace_id));
create policy mixology_approvals_add on public.mixology_approvals for insert to authenticated
with check(private.is_workspace_member(workspace_id) and host_id=auth.uid());
create index mixology_approvals_version_time on public.mixology_approvals(version_id,created_at desc);

create function private.mixology_approval_guard() returns trigger
language plpgsql set search_path='' as $$
declare d jsonb;
begin
  if new.host_id is distinct from auth.uid() then raise exception 'approval_attribution'; end if;
  select document into d from public.mixology_versions where id=new.version_id and workspace_id=new.workspace_id;
  if d is null then raise exception 'version_unavailable'; end if;
  if new.decision='approved' and (jsonb_array_length(d->'ingredients')=0 or jsonb_array_length(d->'steps')=0) then
    raise exception 'complete_recipe_before_approval';
  end if;
  new.created_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.mixology_approval_guard() from public;
create trigger mixology_approval_guard before insert on public.mixology_approvals
for each row execute function private.mixology_approval_guard();

create function public.mixology_decide(p_id uuid,p_version uuid,p_decision text) returns public.mixology_approvals
language plpgsql security invoker set search_path='' as $$
declare v public.mixology_versions; a public.mixology_approvals;
begin
  select * into v from public.mixology_versions where id=p_version;
  if v.id is null then raise exception 'version_unavailable'; end if;
  -- Serialize approval/withdrawal decisions for the same recipe version.
  perform 1 from public.mixology_recipes where id=v.recipe_id for update;
  select * into a from public.mixology_approvals where id=p_id;
  if a.id is not null then
    if a.version_id<>p_version or a.decision<>p_decision or a.host_id<>auth.uid() then raise exception 'approval_retry_mismatch'; end if;
    return a;
  end if;
  insert into public.mixology_approvals(id,workspace_id,version_id,decision)
  values(p_id,v.workspace_id,v.id,p_decision) returning * into a;
  return a;
end $$;
revoke all on function public.mixology_decide(uuid,uuid,text) from public,anon;
grant execute on function public.mixology_decide(uuid,uuid,text) to authenticated;
commit;
