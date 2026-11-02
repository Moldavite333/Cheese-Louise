begin;
-- Run in a transaction against HQ; the final rollback removes every fixture.
do $test$
declare
  wid uuid; actor uuid; mid uuid; movie_name text;
begin
  select p.workspace_id,p.published_by into wid,actor
  from public.published_bingo_cards p where p.published_by is not null limit 1;
  if wid is null then raise exception 'A workspace already connected to public Bingo is required'; end if;
  movie_name:='Bingo sync regression '||gen_random_uuid()::text;
  insert into public.movies(workspace_id,title,created_by,season,holiday,status)
    values(wid,movie_name,actor,'Winter','Christmas','radar') returning id into mid;
  if exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'Unapproved movie leaked into Bingo'; end if;
  insert into public.movie_votes(workspace_id,movie_id,user_id,vote) values(wid,mid,actor,'maybe');
  if exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'Maybe vote must not opt a movie into Bingo'; end if;
  update public.movie_votes set vote='yes' where movie_id=mid and user_id=actor;
  if not exists(select 1 from public.published_movie_posters() p where p.title=movie_name and p.season='Christmas') then
    raise exception 'Yes vote did not automatically add the movie'; end if;
  update public.movie_votes set vote='no' where movie_id=mid and user_id=actor;
  if exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'No vote alone must not opt a movie into Bingo'; end if;
  insert into public.movie_bookmarks(workspace_id,movie_id,user_id) values(wid,mid,actor);
  if not exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'Save did not automatically add the movie'; end if;
  -- Yes plus Save still produces one row.
  update public.movie_votes set vote='yes' where movie_id=mid and user_id=actor;
  if (select count(*) from public.published_movie_posters() p where p.title=movie_name)<>1 then
    raise exception 'Save plus Yes duplicated the movie'; end if;
  -- Unsave does not remove a movie while a Yes vote remains.
  delete from public.movie_bookmarks where movie_id=mid and user_id=actor;
  if not exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'Unsave ignored the remaining Yes vote'; end if;
  update public.movies set season='Horror' where id=mid;
  if exists(select 1 from public.published_movie_posters() p where p.title=movie_name) then
    raise exception 'Explicit Horror classification entered the romance game'; end if;
  -- The API schema itself cannot carry private production fields.
  if exists(
    select 1 from public.published_movie_posters() p
    where to_jsonb(p) ?| array['workspace_id','movie_id','user_id','notes','votes','summary','bookmarks']
  ) then raise exception 'Private HQ data exposed'; end if;
end
$test$;
rollback;
