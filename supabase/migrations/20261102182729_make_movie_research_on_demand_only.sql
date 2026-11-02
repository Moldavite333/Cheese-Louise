create or replace function public.request_movie_research(p_movie_id uuid,p_workspace_id uuid,p_input_hash text,p_force boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.movie_research_briefs;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('research:'||p_workspace_id::text));
 if not exists(select 1 from public.movies where id=p_movie_id and workspace_id=p_workspace_id and status<>'passed') then return false; end if;
 select * into r from public.movie_research_briefs where movie_id=p_movie_id for update;
 if found then
  if r.status='generating' and r.started_at>now()-interval '8 minutes' then return false; end if;
  if r.status='queued' then if p_force and r.error_code in ('on_demand_only','provider_busy','api_credit_required','provider_key_rejected','provider_access_denied','provider_rate_limited') then update public.movie_research_briefs set retry_after=null,error_code=null where movie_id=p_movie_id; return true; end if; return false; end if;
  if r.retry_after>now() and not(p_force and coalesce(r.error_code,'') in ('on_demand_only','provider_busy','api_credit_required','provider_key_rejected','provider_access_denied','provider_rate_limited')) then return false; end if;
  if r.attempts>=6 and r.started_at>now()-interval '1 day' then
   update public.movie_research_briefs set status='error',error_code='daily_attempt_limit',retry_after=r.started_at+interval '1 day' where movie_id=p_movie_id;
   return false;
  end if;
  if r.status in ('ready','limited') and r.input_hash=p_input_hash and not p_force and r.completed_at>now()-interval '30 days' then return false; end if;
  if r.updated_at>now()-interval '30 minutes' and p_force and coalesce(r.error_code,'') not in ('on_demand_only','provider_busy','api_credit_required','provider_key_rejected','provider_access_denied','provider_rate_limited') then return false; end if;
  update public.movie_research_briefs set input_hash=p_input_hash,status='queued',lease_token=null,error_code=null,retry_after=null,attempts=case when r.started_at<now()-interval '1 day' then 0 else attempts end,updated_at=now() where movie_id=p_movie_id;
 else
  insert into public.movie_research_briefs(movie_id,workspace_id,input_hash) values(p_movie_id,p_workspace_id,p_input_hash);
 end if;
 return true;
end $$;

create or replace function public.claim_requested_movie_research(p_workspace_id uuid,p_movie_id uuid)
returns setof public.movie_research_briefs language plpgsql security invoker set search_path='' as $$
declare candidate uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('research:'||p_workspace_id::text));
 if exists(select 1 from public.movie_research_briefs where workspace_id=p_workspace_id and status='generating' and started_at>now()-interval '8 minutes') then return; end if;
 -- Bounded spend: at most 40 starts per hour per workspace. Cached reads are free.
 if (select count(*) from public.movie_research_runs where workspace_id=p_workspace_id and started_at>now()-interval '1 hour')>=40 then return; end if;
 select movie_id into candidate from public.movie_research_briefs
 where workspace_id=p_workspace_id and movie_id=p_movie_id and (status='queued' or (status='generating' and started_at<=now()-interval '8 minutes')) and attempts<6 and (retry_after is null or retry_after<=now())
 order by updated_at limit 1 for update skip locked;
 if candidate is null then return; end if;
 insert into public.movie_research_runs(workspace_id,movie_id) values(p_workspace_id,candidate);
 return query update public.movie_research_briefs set status='generating',lease_token=gen_random_uuid(),started_at=now(),updated_at=now(),attempts=attempts+1 where movie_id=candidate returning *;
end $$;

revoke all on function public.request_movie_research(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.claim_requested_movie_research(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_movie_research(uuid,uuid,text,boolean) to service_role;
grant execute on function public.claim_requested_movie_research(uuid,uuid) to service_role;


revoke all on function public.claim_movie_research(uuid) from service_role;
update public.movie_research_briefs set status='error',error_code='on_demand_only',retry_after=null,lease_token=null
where status='queued' or (status='error' and error_code in ('provider_busy','api_credit_required','provider_key_rejected','provider_access_denied','provider_rate_limited'));
