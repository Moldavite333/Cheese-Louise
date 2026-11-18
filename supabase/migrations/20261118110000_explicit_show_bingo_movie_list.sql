alter table public.movies add column if not exists show_bingo_listed_at timestamptz;

create or replace function public.show_bingo_movies()
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
    m.show_bingo_listed_at
  from public.movies m
  where btrim(m.title)<>''
    -- Only workspaces already intentionally connected to public Bingo participate.
    and exists (
      select 1 from public.published_bingo_cards p
      where p.workspace_id=m.workspace_id
    )
    and m.show_bingo_listed_at is not null
    -- Preserve the romance-only public game without guessing genre from titles.
    and lower(coalesce(m.season,''))<>'horror'
    and lower(coalesce(m.source_metadata->>'collection',''))<>'horror'
    and lower(coalesce(m.source_metadata->>'movie_collection',''))<>'horror'
    and not coalesce((m.source_metadata->'genre_ids') @> '[27]'::jsonb,false)
  order by m.show_bingo_listed_at desc,m.title,m.id
  limit 3000
$$;
revoke all on function public.show_bingo_movies() from public;
grant execute on function public.show_bingo_movies() to anon,authenticated;
