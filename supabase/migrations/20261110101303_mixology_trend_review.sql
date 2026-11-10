begin;
create function private.mixology_trend_date(v text) returns boolean language plpgsql immutable set search_path='' as $$
begin return v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(v::date,'YYYY-MM-DD')=v;exception when others then return false;end $$;
create function private.mixology_valid_trend(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;s jsonb;begin
 if jsonb_typeof(d) is distinct from 'object' or d->'schemaVersion' is distinct from '1'::jsonb or octet_length(d::text)>65536 or jsonb_typeof(d->'reviewed') is distinct from 'boolean'
  or coalesce(d->>'basis','') not in ('example','report','data') or coalesce(d->>'status','') not in ('active','archived') or jsonb_typeof(d->'sources') is distinct from 'array' or jsonb_array_length(d->'sources')>8 then return false;end if;
 foreach k in array array['title','observation','limitations','application','observedOn','reviewAfter'] loop if jsonb_typeof(d->k) is distinct from 'string' then return false;end if;end loop;
 if length(d->>'title')>160 or length(d->>'observation')>3000 or length(d->>'limitations')>2000 or length(d->>'application')>2000 then return false;end if;
 foreach k in array array['observedOn','reviewAfter'] loop if d->>k<>'' and not private.mixology_trend_date(d->>k) then return false;end if;end loop;
 if exists(select 1 from jsonb_object_keys(d) as key where key not in ('schemaVersion','title','observation','basis','limitations','application','observedOn','reviewAfter','status','sources','reviewed')) then return false;end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(d->'sources') x)<>jsonb_array_length(d->'sources') then return false;end if;
 for s in select * from jsonb_array_elements(d->'sources') loop
  if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false;end if;
  foreach k in array array['title','url','supports','publishedOn','retrievedOn'] loop if jsonb_typeof(s->k) is distinct from 'string' then return false;end if;end loop;
  if length(s->>'title')>200 or length(s->>'url')>2000 or length(s->>'supports')>1000 then return false;end if;
  if s->>'url'<>'' and ((s->>'url') !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#][^[:space:]]*)?$' or (s->>'url') ~ '[?&][^=&#]*%' or (s->>'url') ~* '([?&](token|access_token|apikey|api_key|authorization|signature|key|sig|auth|auth_token|client_secret|password|session|jwt|x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+)=|/storage/v1/object/sign/)') then return false;end if;
  foreach k in array array['publishedOn','retrievedOn'] loop if s->>k<>'' and not private.mixology_trend_date(s->>k) then return false;end if;end loop;
  if exists(select 1 from jsonb_object_keys(s) as key where key not in ('id','title','url','publishedOn','retrievedOn','supports')) then return false;end if;
 end loop;return true;
exception when others then return false;end $$;
revoke all on function private.mixology_trend_date(text),private.mixology_valid_trend(jsonb) from public;
grant execute on function private.mixology_trend_date(text),private.mixology_valid_trend(jsonb) to authenticated;
create table public.mixology_trend_notes (
 id uuid primary key,workspace_id uuid not null references public.workspaces(id),movie_id uuid,document jsonb not null check(private.mixology_valid_trend(document)),revision bigint not null default 1 check(revision>0),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 reviewed_by uuid references auth.users(id),reviewed_at timestamptz,reviewed_revision bigint,unique(id,workspace_id),foreign key(movie_id,workspace_id) references public.movies(id,workspace_id)
);
alter table public.mixology_trend_notes enable row level security;
revoke all on public.mixology_trend_notes from public,anon,authenticated,service_role;
grant select,insert,update on public.mixology_trend_notes to authenticated;
create policy mixology_trends_read on public.mixology_trend_notes for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_trends_add on public.mixology_trend_notes for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid() and updated_by=auth.uid());
create policy mixology_trends_edit on public.mixology_trend_notes for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create index mixology_trends_cursor on public.mixology_trend_notes(workspace_id,updated_at desc,id desc);
create table public.mixology_trend_history (
 note_id uuid not null,workspace_id uuid not null,revision bigint not null,document jsonb not null,recorded_by uuid not null,recorded_at timestamptz not null,
 primary key(note_id,revision),foreign key(note_id,workspace_id) references public.mixology_trend_notes(id,workspace_id)
);
alter table public.mixology_trend_history enable row level security;
revoke all on public.mixology_trend_history from public,anon,authenticated;
grant select,insert on public.mixology_trend_history to authenticated;
create policy mixology_trends_history_read on public.mixology_trend_history for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_trends_history_add on public.mixology_trend_history for insert to authenticated with check(private.is_workspace_member(workspace_id) and recorded_by=auth.uid());
create function private.mixology_trend_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare s jsonb;k text;today text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD');begin
 if not private.mixology_valid_trend(new.document) then raise exception 'invalid_trend_note';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.movie_id is distinct from old.movie_id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'trend_identity_immutable';end if;
  if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001';end if;
 else
  if new.revision<>1 then raise exception 'draft_conflict' using errcode='40001';end if;new.created_by:=auth.uid();new.created_at:=clock_timestamp();
 end if;
 if new.document->>'observedOn'>today then raise exception 'trend_future_source_date';end if;
 for s in select * from jsonb_array_elements(new.document->'sources') loop
  foreach k in array array['retrievedOn','publishedOn'] loop if s->>k>today then raise exception 'trend_future_source_date';end if;end loop;
 end loop;
 if new.document->>'reviewed'='true' then
  if length(trim(new.document->>'title'))=0 or length(trim(new.document->>'observation'))=0 or length(trim(new.document->>'limitations'))=0 or jsonb_array_length(new.document->'sources')=0 or (new.movie_id is not null and length(trim(new.document->>'application'))=0)
   or exists(select 1 from jsonb_array_elements(new.document->'sources') x where length(trim(x->>'title'))=0 or length(x->>'url')=0 or length(x->>'retrievedOn')=0 or length(trim(x->>'supports'))=0) then raise exception 'trend_review_incomplete';end if;
  if tg_op='UPDATE' and old.document->>'reviewed'='true' then
   if new.document<>old.document then raise exception 'trend_review_must_be_renewed';end if;new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;new.reviewed_revision:=new.revision;
  else new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();new.reviewed_revision:=new.revision;end if;
 else new.reviewed_by:=null;new.reviewed_at:=null;new.reviewed_revision:=null;end if;
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
create trigger mixology_trend_guard before insert or update on public.mixology_trend_notes for each row execute function private.mixology_trend_guard();
create function private.mixology_trend_history_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare n public.mixology_trend_notes;begin
 select * into n from public.mixology_trend_notes where id=new.note_id;
 if n.id is null or new.workspace_id<>n.workspace_id or new.revision<>n.revision or new.document<>n.document or new.recorded_by<>n.updated_by or new.recorded_by<>auth.uid() or new.recorded_at<>n.updated_at then raise exception 'trend_history_server_authored';end if;return new;
end $$;
create trigger mixology_trend_history_guard before insert on public.mixology_trend_history for each row execute function private.mixology_trend_history_guard();
create function private.mixology_trend_archive() returns trigger language plpgsql security invoker set search_path='' as $$
begin insert into public.mixology_trend_history values(new.id,new.workspace_id,new.revision,new.document,new.updated_by,new.updated_at);return new;end $$;
create trigger mixology_trend_archive after insert or update on public.mixology_trend_notes for each row execute function private.mixology_trend_archive();
revoke all on function private.mixology_trend_guard(),private.mixology_trend_history_guard(),private.mixology_trend_archive() from public;
create function public.mixology_trend_start(p_id uuid,p_workspace uuid,p_movie uuid,p_document jsonb) returns public.mixology_trend_notes language plpgsql security invoker set search_path='' as $$
declare r public.mixology_trend_notes;begin
 select * into r from public.mixology_trend_notes where id=p_id;
 if r.id is not null then if r.workspace_id<>p_workspace or r.movie_id is distinct from p_movie then raise exception 'trend_identity_mismatch';end if;return r;end if;
 insert into public.mixology_trend_notes(id,workspace_id,movie_id,document) values(p_id,p_workspace,p_movie,p_document) returning * into r;return r;
end $$;
create function public.mixology_trend_save(p_id uuid,p_revision bigint,p_document jsonb) returns public.mixology_trend_notes language plpgsql security invoker set search_path='' as $$
declare r public.mixology_trend_notes;begin
 update public.mixology_trend_notes set document=p_document,revision=revision+1 where id=p_id and revision=p_revision returning * into r;
 if r.id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;end $$;
create function public.mixology_trend_review(p_id uuid,p_revision bigint,p_reviewed boolean) returns public.mixology_trend_notes language plpgsql security invoker set search_path='' as $$
declare r public.mixology_trend_notes;begin
 update public.mixology_trend_notes set document=jsonb_set(document,'{reviewed}',to_jsonb(p_reviewed)),revision=revision+1 where id=p_id and revision=p_revision returning * into r;
 if r.id is null then raise exception 'draft_conflict' using errcode='40001';end if;return r;end $$;
create function public.mixology_trend_list(p_workspace uuid,p_movie uuid,p_archived boolean,p_before_time timestamptz,p_before_id uuid) returns setof public.mixology_trend_notes language sql stable security invoker set search_path='' as $$
 select * from public.mixology_trend_notes where workspace_id=p_workspace and (p_movie is null or movie_id=p_movie) and (p_archived or document->>'status'='active')
 and (p_before_time is null or (updated_at,id)<(p_before_time,p_before_id)) order by updated_at desc,id desc limit 20;
$$;
revoke all on function public.mixology_trend_start(uuid,uuid,uuid,jsonb),public.mixology_trend_save(uuid,bigint,jsonb),public.mixology_trend_review(uuid,bigint,boolean),public.mixology_trend_list(uuid,uuid,boolean,timestamptz,uuid) from public,anon,service_role;
grant execute on function public.mixology_trend_start(uuid,uuid,uuid,jsonb),public.mixology_trend_save(uuid,bigint,jsonb),public.mixology_trend_review(uuid,bigint,boolean),public.mixology_trend_list(uuid,uuid,boolean,timestamptz,uuid) to authenticated;
commit;
