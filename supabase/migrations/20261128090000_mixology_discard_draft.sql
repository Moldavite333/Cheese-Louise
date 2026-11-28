create or replace function private.mixology_discard_draft(p_workspace uuid, p_cocktail uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_workspace_member(p_workspace) then
    raise exception 'workspace_forbidden' using errcode = '42501';
  end if;

  perform 1 from public.cocktails
    where id = p_cocktail and workspace_id = p_workspace and cocktail_type = 'cheese_louise'
    for update;
  if not found then
    return false;
  end if;

  perform 1 from public.mixology_recipes
    where cocktail_id = p_cocktail and workspace_id = p_workspace for update;

  if exists (select 1 from public.episodes where cocktail_id = p_cocktail)
    or exists (select 1 from public.cocktails where parent_cocktail_id = p_cocktail)
    or exists (select 1 from public.mixology_versions v join public.mixology_recipes r on r.id = v.recipe_id
               where r.cocktail_id = p_cocktail and r.workspace_id = p_workspace)
  then
    raise exception 'This recipe is linked or has a saved version.';
  end if;

  delete from public.mixology_movie_links where workspace_id = p_workspace and cocktail_id = p_cocktail;
  delete from public.mixology_recipes where workspace_id = p_workspace and cocktail_id = p_cocktail;
  delete from public.cocktails where workspace_id = p_workspace and id = p_cocktail;
  return true;
end;
$$;

revoke all on function private.mixology_discard_draft(uuid, uuid) from public, anon;
grant execute on function private.mixology_discard_draft(uuid, uuid) to authenticated;

create or replace function public.mixology_discard_draft(p_workspace uuid, p_cocktail uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.mixology_discard_draft(p_workspace, p_cocktail);
$$;

revoke all on function public.mixology_discard_draft(uuid, uuid) from public, anon;
grant execute on function public.mixology_discard_draft(uuid, uuid) to authenticated;
