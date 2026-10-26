-- Read-only, opt-in artwork projection. Only movies with a deliberately published
-- public Bingo card can appear; private HQ notes, votes, users and workspaces never do.
create or replace function public.published_movie_posters()
returns table (
  title text,
  release_year integer,
  season text,
  poster_url text,
  poster_locked boolean,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.id)
    left(m.title,250)::text,
    case
      when (m.source_metadata->>'year') ~ '^(19|20)[0-9]{2}$'
        then (m.source_metadata->>'year')::integer
      when m.premiere_date is not null
        then extract(year from m.premiere_date)::integer
      else null::integer
    end,
    case
      when lower(coalesce(m.season,'')) in ('christmas','winter') then 'Christmas'
      when lower(coalesce(m.season,'')) in ('fall','autumn') then 'Fall'
      else 'Unspecified'
    end::text,
    case
      when m.poster_url ~ '^https://image[.]tmdb[.]org/t/p/(w[0-9]+|original)/[A-Za-z0-9_.-]+$'
        or m.poster_url ~ '^https://upload[.]wikimedia[.]org/wikipedia/commons/[A-Za-z0-9_./%-]+$'
      then m.poster_url
      else null::text
    end,
    coalesce(m.source_metadata->>'poster_locked'='true',false),
    p.published_at
  from public.published_bingo_cards p
  join public.movies m on m.id=p.movie_id
  where p.movie_id is not null
  order by m.id,p.published_at desc
  limit 100
$$;
revoke all on function public.published_movie_posters() from public;
grant execute on function public.published_movie_posters() to anon,authenticated;
