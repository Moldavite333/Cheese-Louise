-- Local preparation only. Apply to staging only after separate authorization.
begin;
create unique index if not exists episodes_id_workspace_mixology_key on public.episodes(id,workspace_id);
create unique index if not exists mixology_approvals_id_workspace_key on public.mixology_approvals(id,workspace_id);
create function private.mixology_valid_preparation(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb; k text; ids text[]:='{}';
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>65536 or d->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(d->'servings') is distinct from 'number' or (d->>'servings')::numeric<=0 or (d->>'servings')::numeric>1000
    or jsonb_typeof(d->'reviewed') is distinct from 'boolean'
    or jsonb_typeof(d->'tasks') is distinct from 'array' or jsonb_array_length(d->'tasks')>50
    or jsonb_typeof(d->'sources') is distinct from 'array' or jsonb_array_length(d->'sources')>20 then return false;end if;
  foreach k in array array['connection','history','talkingPoints'] loop
    if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>4000 then return false;end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(d) as key where key not in ('schemaVersion','servings','reviewed','tasks','sources','connection','history','talkingPoints')) then return false;end if;
  for r in select value from jsonb_array_elements(d->'tasks') loop
    if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or r->>'id'=any(ids)
      or jsonb_typeof(r->'text') is distinct from 'string' or length(trim(r->>'text')) not between 1 and 2000
      or coalesce(r->>'stage','') not in ('shopping','make_ahead','waiting','assembly')
      or jsonb_typeof(r->'storage') is distinct from 'string' or length(r->>'storage')>2000
      or jsonb_typeof(r->'done') is distinct from 'boolean' then return false;end if;
    ids:=array_append(ids,r->>'id');
    foreach k in array array['activeMinutes','passiveMinutes'] loop
      if not r ? k then return false;end if;
      if r->k<>'null'::jsonb and (jsonb_typeof(r->k)<>'number' or (r->>k)::numeric<0 or (r->>k)::numeric>10080) then return false;end if;
    end loop;
    if exists(select 1 from jsonb_object_keys(r) as key where key not in ('id','text','stage','storage','done','activeMinutes','passiveMinutes')) then return false;end if;
  end loop;
  ids:='{}';
  for r in select value from jsonb_array_elements(d->'sources') loop
    if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or r->>'id'=any(ids)
      or jsonb_typeof(r->'title') is distinct from 'string' or length(trim(r->>'title')) not between 1 and 200
      or jsonb_typeof(r->'url') is distinct from 'string' or length(r->>'url')>2000 or (r->>'url') !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$'
      or jsonb_typeof(r->'retrievedOn') is distinct from 'string' or (r->>'retrievedOn') !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((r->>'retrievedOn')::date,'YYYY-MM-DD')<>r->>'retrievedOn' then return false;end if;
    ids:=array_append(ids,r->>'id');
    if exists(select 1 from jsonb_object_keys(r) as key where key not in ('id','title','url','retrievedOn')) then return false;end if;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_preparation(jsonb) from public;
grant execute on function private.mixology_valid_preparation(jsonb) to authenticated;

create table public.mixology_preparations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  version_id uuid not null, episode_id uuid,
  document jsonb not null check(private.mixology_valid_preparation(document)),
  revision bigint not null default 1 check(revision>0),
  updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
  unique nulls not distinct(version_id,episode_id),unique(id,workspace_id),
  foreign key(version_id,workspace_id) references public.mixology_versions(id,workspace_id),
  foreign key(episode_id,workspace_id) references public.episodes(id,workspace_id)
);
alter table public.mixology_preparations enable row level security;
revoke all on public.mixology_preparations from public,anon,authenticated;
grant select,insert,update on public.mixology_preparations to authenticated;
create policy mixology_preparation_read on public.mixology_preparations for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_preparation_add on public.mixology_preparations for insert to authenticated with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create policy mixology_preparation_edit on public.mixology_preparations for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create function private.mixology_preparation_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.workspace_id<>old.workspace_id or new.version_id<>old.version_id or new.episode_id is distinct from old.episode_id then raise exception 'preparation_identity_immutable';end if;
    if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
    -- Text edits invalidate an earlier spoiler/source review even through direct table writes.
    if new.document->>'connection' is distinct from old.document->>'connection' or new.document->>'history' is distinct from old.document->>'history'
      or new.document->>'talkingPoints' is distinct from old.document->>'talkingPoints' or new.document->'sources' is distinct from old.document->'sources' then
      new.document:=jsonb_set(new.document,'{reviewed}','false');
    end if;
  else
    if new.revision<>1 then raise exception 'draft_conflict' using errcode='40001';end if;
    new.document:=jsonb_set(new.document,'{reviewed}','false');
  end if;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function private.mixology_preparation_guard() from public;
create trigger mixology_preparation_guard before insert or update on public.mixology_preparations for each row execute function private.mixology_preparation_guard();

create function public.mixology_preparation_open(p_version uuid,p_episode uuid) returns public.mixology_preparations language plpgsql security invoker set search_path='' as $$
declare v public.mixology_versions;r public.mixology_preparations;
begin
  select * into v from public.mixology_versions where id=p_version;
  if v.id is null then raise exception 'version_unavailable';end if;
  if p_episode is not null and not exists(select 1 from public.episodes where id=p_episode and workspace_id=v.workspace_id) then raise exception 'episode_unavailable';end if;
  insert into public.mixology_preparations(workspace_id,version_id,episode_id,document)
  values(v.workspace_id,v.id,p_episode,jsonb_build_object('schemaVersion',1,'servings',v.document->'servings','tasks','[]'::jsonb,'sources','[]'::jsonb,'connection','','history','','talkingPoints','','reviewed',false))
  on conflict(version_id,episode_id) do nothing;
  select * into r from public.mixology_preparations where version_id=v.id and episode_id is not distinct from p_episode;
  return r;
end $$;
create function public.mixology_preparation_save(p_plan uuid,p_revision bigint,p_document jsonb) returns public.mixology_preparations language plpgsql security invoker set search_path='' as $$
declare r public.mixology_preparations;
begin
  update public.mixology_preparations set document=p_document,revision=revision+1 where id=p_plan and revision=p_revision returning * into r;
  if r.id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;
end $$;
revoke all on function public.mixology_preparation_open(uuid,uuid),public.mixology_preparation_save(uuid,bigint,jsonb) from public,anon;
grant execute on function public.mixology_preparation_open(uuid,uuid),public.mixology_preparation_save(uuid,bigint,jsonb) to authenticated;

-- Freeze the actual authorized inputs at packet creation; this is a private recording artifact, not a publication.
create or replace function private.mixology_approval_guard() returns trigger language plpgsql set search_path='' as $$
declare v public.mixology_versions;
begin
  if new.host_id is distinct from auth.uid() then raise exception 'approval_attribution';end if;
  select * into v from public.mixology_versions where id=new.version_id and workspace_id=new.workspace_id;
  if v.id is null then raise exception 'version_unavailable';end if;
  perform 1 from public.mixology_recipes where id=v.recipe_id for update;
  if new.decision='approved' and (jsonb_array_length(v.document->'ingredients')=0 or jsonb_array_length(v.document->'steps')=0) then raise exception 'complete_recipe_before_approval';end if;
  new.created_at:=clock_timestamp();return new;
end $$;
create table public.mixology_recording_packets (
  id uuid primary key, workspace_id uuid not null,preparation_id uuid not null,preparation_revision bigint not null,
  approval_id uuid not null,document jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default clock_timestamp(),
  foreign key(preparation_id,workspace_id) references public.mixology_preparations(id,workspace_id),
  foreign key(approval_id,workspace_id) references public.mixology_approvals(id,workspace_id)
);
alter table public.mixology_recording_packets enable row level security;
revoke all on public.mixology_recording_packets from public,anon,authenticated;
grant select,insert on public.mixology_recording_packets to authenticated;
create policy mixology_packet_read on public.mixology_recording_packets for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_packet_add on public.mixology_recording_packets for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid());
create index mixology_packet_preparation_idx on public.mixology_recording_packets(preparation_id,created_at desc);
create function private.mixology_packet_guard() returns trigger language plpgsql set search_path='' as $$
declare p public.mixology_preparations;v public.mixology_versions;a public.mixology_approvals;observations jsonb;
begin
  select * into p from public.mixology_preparations where id=new.preparation_id and workspace_id=new.workspace_id for update;
  if p.id is null then raise exception 'preparation_unavailable';end if;
  if p.revision<>new.preparation_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  if p.document->>'reviewed'<>'true' then raise exception 'review_segment_first';end if;
  select * into v from public.mixology_versions where id=p.version_id;
  perform 1 from public.mixology_recipes where id=v.recipe_id for update;
  select * into a from public.mixology_approvals where version_id=v.id order by created_at desc,id desc limit 1;
  if a.id is null or a.decision<>'approved' then raise exception 'version_not_approved';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'hostId',host_id,'makeAgain',make_again,'flags',flags,'comment',comment,'revision',revision) order by created_at,id),'[]'::jsonb) into observations
    from public.mixology_tastings where version_id=v.id;
  new.approval_id:=a.id;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
  new.document:=jsonb_build_object('schemaVersion',1,'versionId',v.id,'versionNumber',v.version_number,'recipeId',v.recipe_id,'recipe',v.document,'episodeId',p.episode_id,'preparation',p.document,'observations',observations);
  return new;
end $$;
revoke all on function private.mixology_packet_guard() from public;
create trigger mixology_packet_guard before insert on public.mixology_recording_packets for each row execute function private.mixology_packet_guard();
create function public.mixology_packet_create(p_id uuid,p_plan uuid,p_revision bigint) returns public.mixology_recording_packets language plpgsql security invoker set search_path='' as $$
declare p public.mixology_preparations;r public.mixology_recording_packets;
begin
  select * into p from public.mixology_preparations where id=p_plan;
  if p.id is null then raise exception 'preparation_unavailable';end if;
  select * into r from public.mixology_recording_packets where id=p_id;
  if r.id is not null then
    if r.preparation_id<>p_plan or r.preparation_revision<>p_revision or r.created_by<>auth.uid() then raise exception 'packet_retry_mismatch';end if;return r;
  end if;
  insert into public.mixology_recording_packets(id,workspace_id,preparation_id,preparation_revision,approval_id,document)
    values(p_id,p.workspace_id,p.id,p_revision,'00000000-0000-0000-0000-000000000000','{}') returning * into r;
  return r;
end $$;
revoke all on function public.mixology_packet_create(uuid,uuid,bigint) from public,anon;
grant execute on function public.mixology_packet_create(uuid,uuid,bigint) to authenticated;
commit;
