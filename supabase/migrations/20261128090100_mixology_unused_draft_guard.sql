CREATE OR REPLACE FUNCTION private.mixology_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op='DELETE' and tg_table_name='mixology_recipes'
     and current_user = (select pg_get_userbyid(proowner) from pg_catalog.pg_proc
                         where oid = 'private.mixology_discard_draft(uuid,uuid)'::regprocedure)
     and not exists (select 1 from public.mixology_versions where recipe_id=old.id)
  then
    return old;
  end if;
  if tg_op='DELETE' or tg_table_name='mixology_versions' then raise exception 'Recipe history cannot be overwritten or deleted'; end if;
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.created_at<>old.created_at then raise exception 'Identity is immutable'; end if;
  if tg_table_name='mixology_recipes' then
    if new.cocktail_id<>old.cocktail_id or new.variant<>old.variant or new.created_by<>old.created_by or new.legacy_evidence<>old.legacy_evidence then raise exception 'Recipe identity is immutable'; end if;
    if new.updated_by is distinct from auth.uid() then raise exception 'Wrong author'; end if;
  else
    if new.version_id<>old.version_id or new.host_id<>old.host_id then raise exception 'Tasting identity is immutable'; end if;
    new.previous_observations:=old.previous_observations||jsonb_build_array(jsonb_build_object('revision',old.revision,'comment',old.comment,'make_again',old.make_again,'flags',old.flags,'updated_at',old.updated_at));
  end if;
  if new.revision<>old.revision+1 then raise exception 'draft_conflict' using errcode='40001'; end if;
  new.updated_at:=now();return new;
end $function$
