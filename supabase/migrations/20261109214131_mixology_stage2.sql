-- Local review only. Additive shared workshop state and bounded AI request accounting.
begin;
create function private.mixology_valid_workshop(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare m jsonb; v jsonb;
begin
  if jsonb_typeof(d) is distinct from 'object' or d->>'schemaVersion' is distinct from '1' or octet_length(d::text)>131072
    or jsonb_typeof(d->'brief') is distinct from 'string' or length(d->>'brief')>2000
    or jsonb_typeof(d->'input') is distinct from 'string' or length(d->>'input')>2000
    or jsonb_typeof(d->'messages') is distinct from 'array' or jsonb_array_length(d->'messages')>40
    or jsonb_typeof(d->'concepts') is distinct from 'array' or jsonb_array_length(d->'concepts')>5
    or jsonb_typeof(d->'ignoredTastings') is distinct from 'array' or jsonb_array_length(d->'ignoredTastings')>100 then return false;end if;
  for m in select value from jsonb_array_elements(d->'messages') loop
    if jsonb_typeof(m) is distinct from 'object' or coalesce(m->>'id','') !~* '^[0-9a-f-]{36}$'
      or coalesce(m->>'role','') not in ('user','assistant','note') or jsonb_typeof(m->'text') is distinct from 'string' or length(m->>'text')>3000
      or jsonb_typeof(m->'createdAt') is distinct from 'string' then return false;end if;
  end loop;
  for v in select value from jsonb_array_elements(d->'ignoredTastings') loop
    if trim(both '"' from v::text) !~* '^[0-9a-f-]{36}$' then return false;end if;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_workshop(jsonb) from public;
grant execute on function private.mixology_valid_workshop(jsonb) to authenticated;
create table public.mixology_workshops (
  recipe_id uuid primary key,workspace_id uuid not null,
  document jsonb not null default '{"schemaVersion":1,"brief":"","input":"","concepts":[],"research":null,"pending":null,"messages":[],"ignoredTastings":[]}'::jsonb check(private.mixology_valid_workshop(document)),
  revision bigint not null default 1 check(revision>0),
  updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default now(),
  foreign key(recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id)
);
alter table public.mixology_workshops enable row level security;
create policy mixology_workshops_read on public.mixology_workshops for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_workshops_add on public.mixology_workshops for insert to authenticated with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create policy mixology_workshops_edit on public.mixology_workshops for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
revoke all on public.mixology_workshops from anon,authenticated;
grant select,insert,update on public.mixology_workshops to authenticated;
create table public.mixology_conversation_log (
  id uuid primary key,recipe_id uuid not null,workspace_id uuid not null,
  reporter_id uuid not null default auth.uid() references auth.users(id),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8192 and payload->>'id'=id::text and coalesce(payload->>'role','') in ('user','assistant','note') and jsonb_typeof(payload->'text')='string' and length(payload->>'text')<=3000),recorded_at timestamptz not null default now(),
  foreign key(recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id)
);
create index mixology_conversation_log_recipe_idx on public.mixology_conversation_log(recipe_id,recorded_at);
alter table public.mixology_conversation_log enable row level security;
create policy mixology_conversation_read on public.mixology_conversation_log for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_conversation_add on public.mixology_conversation_log for insert to authenticated with check(private.is_workspace_member(workspace_id) and reporter_id=auth.uid() and payload->>'actorId'=auth.uid()::text);
revoke all on public.mixology_conversation_log from anon,authenticated;
grant select,insert on public.mixology_conversation_log to authenticated;
create table public.mixology_research_log (
  id uuid primary key default gen_random_uuid(),recipe_id uuid not null,workspace_id uuid not null,
  reporter_id uuid not null default auth.uid() references auth.users(id),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),recorded_at timestamptz not null default now(),
  foreign key(recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id)
);
create index mixology_research_log_recipe_idx on public.mixology_research_log(recipe_id,recorded_at);
alter table public.mixology_research_log enable row level security;
create policy mixology_research_read on public.mixology_research_log for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_research_add on public.mixology_research_log for insert to authenticated with check(private.is_workspace_member(workspace_id) and reporter_id=auth.uid());
revoke all on public.mixology_research_log from anon,authenticated;
grant select,insert on public.mixology_research_log to authenticated;
create function private.mixology_workshop_guard() returns trigger language plpgsql set search_path='' as $$
declare m jsonb;old_message public.mixology_conversation_log;
begin
  if tg_op='UPDATE' then
    if new.recipe_id<>old.recipe_id or new.workspace_id<>old.workspace_id then raise exception 'Workshop identity is immutable';end if;
    if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
  end if;
  for m in select value from jsonb_array_elements(new.document->'messages') loop
    select * into old_message from public.mixology_conversation_log where id=(m->>'id')::uuid;
    if found then
      if old_message.recipe_id<>new.recipe_id or old_message.payload<>m then raise exception 'Original conversation messages are immutable';end if;
    else
      if m->>'actorId' is distinct from auth.uid()::text then raise exception 'Message attribution mismatch';end if;
      insert into public.mixology_conversation_log(id,recipe_id,workspace_id,payload) values((m->>'id')::uuid,new.recipe_id,new.workspace_id,m);
    end if;
  end loop;
  if jsonb_typeof(new.document->'research')='object' and (tg_op='INSERT' or new.document->'research' is distinct from old.document->'research') then
    insert into public.mixology_research_log(recipe_id,workspace_id,payload) values(new.recipe_id,new.workspace_id,new.document->'research');
  end if;
  new.updated_at:=now();return new;
end $$;
revoke all on function private.mixology_workshop_guard() from public;
create trigger mixology_workshop_guard before insert or update on public.mixology_workshops for each row execute function private.mixology_workshop_guard();
create function public.mixology_workshop_open(p_recipe uuid) returns public.mixology_workshops language plpgsql security invoker set search_path='' as $$
declare r public.mixology_recipes;w public.mixology_workshops;
begin
  select * into r from public.mixology_recipes where id=p_recipe;if not found then raise exception 'recipe_unavailable' using errcode='42501';end if;
  insert into public.mixology_workshops(recipe_id,workspace_id) values(r.id,r.workspace_id) on conflict(recipe_id) do nothing;
  select * into w from public.mixology_workshops where recipe_id=r.id;return w;
end $$;
create function public.mixology_workshop_save(p_recipe uuid,p_revision bigint,p_document jsonb) returns public.mixology_workshops language plpgsql security invoker set search_path='' as $$
declare w public.mixology_workshops;
begin
  update public.mixology_workshops set document=p_document,revision=revision+1,updated_by=auth.uid() where recipe_id=p_recipe and revision=p_revision returning * into w;
  if not found then raise exception 'draft_conflict' using errcode='40001';end if;return w;
end $$;
revoke all on function public.mixology_workshop_open(uuid),public.mixology_workshop_save(uuid,bigint,jsonb) from public,anon;
grant execute on function public.mixology_workshop_open(uuid),public.mixology_workshop_save(uuid,bigint,jsonb) to authenticated;

alter table public.mixology_tastings drop constraint mixology_tastings_flags_check;
alter table public.mixology_tastings add constraint mixology_tastings_flags_check check(flags <@ array['too_sweet','not_sweet_enough','too_tart','not_tart_enough','too_bitter','too_strong','just_right','too_much_effort']::text[]);

create table public.mixology_bartender_requests (
  id uuid primary key,workspace_id uuid not null,recipe_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
  recipe_revision bigint not null,status text not null default 'running' check(status in ('running','complete','failed')),
  lease_token uuid not null,
  response jsonb check(response is null or octet_length(response::text)<=131072),
  foreign key(recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id)
);
create index mixology_bartender_requests_budget_idx on public.mixology_bartender_requests(workspace_id,created_at);
alter table public.mixology_bartender_requests enable row level security;
create policy mixology_bartender_requests_read on public.mixology_bartender_requests for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_bartender_requests_add on public.mixology_bartender_requests for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid());
revoke all on public.mixology_bartender_requests from anon,authenticated;
grant select,insert on public.mixology_bartender_requests to authenticated;
grant select,update on public.mixology_bartender_requests to service_role;
create function private.mixology_request_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.created_at:=now();new.status:='running';new.response:=null;return new;end if;
  if current_user<>'service_role' or old.status<>'running' or new.status not in ('complete','failed')
    or new.id<>old.id or new.recipe_id<>old.recipe_id or new.workspace_id<>old.workspace_id or new.created_by<>old.created_by
    or new.created_at<>old.created_at or new.recipe_revision<>old.recipe_revision or new.lease_token<>old.lease_token then raise exception 'Request accounting is immutable';end if;
  return new;
end $$;
revoke all on function private.mixology_request_guard() from public;
create trigger mixology_request_guard before insert or update on public.mixology_bartender_requests for each row execute function private.mixology_request_guard();
create function public.mixology_claim_bartender(p_recipe uuid,p_request uuid,p_revision bigint,p_lease uuid) returns public.mixology_bartender_requests language plpgsql security invoker set search_path='' as $$
declare r public.mixology_recipes;q public.mixology_bartender_requests;
begin
  select * into r from public.mixology_recipes where id=p_recipe for update;if not found then raise exception 'recipe_unavailable' using errcode='42501';end if;
  select * into q from public.mixology_bartender_requests where id=p_request;
  if found then if q.recipe_id<>r.id or q.created_by<>auth.uid() then raise exception 'request_identity_conflict';end if;return q;end if;
  if r.revision<>p_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  -- Serialize the workspace budget across different recipes too.
  perform pg_advisory_xact_lock(hashtextextended(r.workspace_id::text,72941));
  if (select count(*) from public.mixology_bartender_requests where workspace_id=r.workspace_id and created_at>now()-interval '24 hours')>=20 then raise exception 'bartender_daily_limit';end if;
  if exists(select 1 from public.mixology_bartender_requests where workspace_id=r.workspace_id and created_at>now()-interval '15 seconds') then raise exception 'bartender_rate_limited';end if;
  insert into public.mixology_bartender_requests(id,workspace_id,recipe_id,recipe_revision,lease_token) values(p_request,r.workspace_id,r.id,r.revision,p_lease) returning * into q;return q;
end $$;
revoke all on function public.mixology_claim_bartender(uuid,uuid,bigint,uuid) from public,anon;
grant execute on function public.mixology_claim_bartender(uuid,uuid,bigint,uuid) to authenticated;
commit;
