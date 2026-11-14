create table public.website_events (
 id uuid primary key,
 visitor uuid not null,
 session_id uuid not null,
 host text not null check (host in ('website','bingo')),
 event text not null check (event in ('page_view','bingo_card_started','episode_link_clicked')),
 source text not null check (length(source)<=80),
 campaign text not null check (length(campaign)<=100),
 occurred_at timestamptz not null default now()
);
alter table public.website_events enable row level security;
revoke all on public.website_events from anon, authenticated;
create index website_events_time_idx on public.website_events(occurred_at);
create index website_events_session_idx on public.website_events(session_id,occurred_at);

create table public.website_trope_suggestions (
 id uuid primary key default gen_random_uuid(),
 trope text not null check (length(trope) between 3 and 160),
 movie text not null check (length(movie)<=120),
 received_at timestamptz not null default now()
);
alter table public.website_trope_suggestions enable row level security;
revoke all on public.website_trope_suggestions from anon, authenticated;

create function public.record_website_event(p_id uuid,p_visitor uuid,p_session uuid,p_host text,p_event text,p_source text,p_campaign text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (p_event='bingo_card_started' and p_host<>'bingo') or (p_event='episode_link_clicked' and p_host<>'website') then return; end if;
 if (select count(*) from public.website_events where session_id=p_session and occurred_at>now()-interval '10 minutes')>=100 then return; end if;
 insert into public.website_events(id,visitor,session_id,host,event,source,campaign)
 values(p_id,p_visitor,p_session,p_host,p_event,left(coalesce(p_source,'direct'),80),left(coalesce(p_campaign,''),100))
 on conflict(id) do nothing;
end $$;
revoke all on function public.record_website_event(uuid,uuid,uuid,text,text,text,text) from public,authenticated;
grant execute on function public.record_website_event(uuid,uuid,uuid,text,text,text,text) to anon;

create function public.submit_website_trope(p_trope text,p_movie text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('cheese-louise-trope-suggestions'));
 if (select count(*) from public.website_trope_suggestions where received_at > now()-interval '1 hour')>=40 then
  raise exception 'Suggestion inbox is busy';
 end if;
 if exists(select 1 from public.website_trope_suggestions where trope=trim(p_trope) and movie=trim(coalesce(p_movie,'')) and received_at>now()-interval '1 day') then return; end if;
 insert into public.website_trope_suggestions(trope,movie) values(trim(p_trope),trim(coalesce(p_movie,'')));
end $$;
revoke all on function public.submit_website_trope(text,text) from public,authenticated;
grant execute on function public.submit_website_trope(text,text) to anon;

create function public.website_traffic_report(p_workspace uuid,p_days integer)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare
 today_start timestamptz := date_trunc('day',now(),'America/Denver');
begin
 if p_workspace is distinct from 'a6e5e1d8-72a9-4c78-adc6-29b41e26c61f'::uuid or not exists(
   select 1 from public.workspace_members where workspace_id=p_workspace and user_id=auth.uid()
 ) then raise exception 'Cheese Louise HQ access required' using errcode='42501'; end if;
 if p_days is null or p_days not in (7,30) then raise exception 'Choose 7 or 30 days'; end if;
 return (
  with recent as (
   select * from public.website_events where occurred_at >= (today_start at time zone 'America/Denver' - make_interval(days=>p_days-1)) at time zone 'America/Denver'
  ), visits as (
   select distinct on(session_id) session_id,source,campaign from recent where event='page_view' order by session_id,occurred_at,id
  )
  select jsonb_build_object(
   'visitors',(select count(distinct visitor) from recent where event='page_view'),
   'sessions',(select count(*) from visits),
   'views',(select count(*) from recent where event='page_view'),
   'cards',(select count(*) from recent where event='bingo_card_started'),
   'clicks',(select count(*) from recent where event='episode_link_clicked'),
   'previousVisitors',(select count(distinct visitor) from public.website_events
      where event='page_view'
       and occurred_at >= (today_start at time zone 'America/Denver' - make_interval(days=>2*p_days-1)) at time zone 'America/Denver'
       and occurred_at < (today_start at time zone 'America/Denver' - make_interval(days=>p_days-1)) at time zone 'America/Denver'),
   'hosts',coalesce((select jsonb_object_agg(host,visitors) from
     (select host,count(distinct visitor) visitors from recent where event='page_view' group by host) h),'{}'::jsonb),
   'sources',coalesce((select jsonb_agg(to_jsonb(s) order by sessions desc,source) from
     (select source,campaign,count(*) sessions from visits group by 1,2 order by 3 desc,1,2 limit 8) s),'[]'::jsonb),
   'suggestions',coalesce((select jsonb_agg(to_jsonb(t) order by received_at desc) from
     (select trope,movie,received_at from public.website_trope_suggestions order by received_at desc limit 20) t),'[]'::jsonb)
  )
 );
end $$;
revoke all on function public.website_traffic_report(uuid,integer) from public,anon;
grant execute on function public.website_traffic_report(uuid,integer) to authenticated;
