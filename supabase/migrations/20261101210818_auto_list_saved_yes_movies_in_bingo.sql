-- A saved movie or a Yes vote opts its public movie metadata into Bingo.
-- Preserve the existing six-column API; never return HQ IDs, notes, or votes.
create or replace function public.published_movie_posters()
returns table (
  title text, release_year integer, season text, poster_url text,
  poster_locked boolean, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    left(m.title,250)::text,
    case
      when (m.source_metadata->>'year') ~ '^(19|20)[0-9]{2}$'
        then (m.source_metadata->>'year')::integer
      when m.premiere_date is not null
        then extract(year from m.premiere_date)::integer
      else null::integer
    end,
    case
      when lower(coalesce(m.holiday,''))='christmas'
        or lower(coalesce(m.season,'')) in ('christmas','winter') then 'Christmas'
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
    published.last_published
  from public.movies m
  left join lateral (
    select max(p.published_at) as last_published
    from public.published_bingo_cards p
    where p.movie_id=m.id and p.workspace_id=m.workspace_id
  ) published on true
  where btrim(m.title)<>''
    -- Only workspaces already intentionally connected to public Bingo participate.
    and exists (
      select 1 from public.published_bingo_cards p
      where p.workspace_id=m.workspace_id
    )
    and (
      published.last_published is not null
      or exists (
        select 1 from public.movie_votes v
        where v.movie_id=m.id and v.workspace_id=m.workspace_id and v.vote='yes'
      )
      or exists (
        select 1 from public.movie_bookmarks b
        where b.movie_id=m.id and b.workspace_id=m.workspace_id
      )
    )
    -- Preserve the romance-only public game without guessing genre from titles.
    and lower(coalesce(m.season,''))<>'horror'
    and lower(coalesce(m.source_metadata->>'collection',''))<>'horror'
    and lower(coalesce(m.source_metadata->>'movie_collection',''))<>'horror'
    and not coalesce((m.source_metadata->'genre_ids') @> '[27]'::jsonb,false)
  order by m.title,m.id
  limit 3000
$$;
revoke all on function public.published_movie_posters() from public;
grant execute on function public.published_movie_posters() to anon,authenticated;
