-- Stage 1 only. Additive and lazy: no existing recipe is rewritten by this migration.
-- Apply to staging and review before separately authorizing any production migration.
begin;

create function private.mixology_valid_document(d jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare r jsonb; k text; seen text[];
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>131072
    or d->>'schemaVersion' is distinct from '1' or jsonb_typeof(d->'name') is distinct from 'string'
    or length(trim(d->>'name')) not between 1 and 160 or jsonb_typeof(d->'servings') is distinct from 'number'
    or (d->>'servings')::numeric<=0 or (d->>'servings')::numeric>1000 then return false; end if;
  foreach k in array array['glassware','garnish','notes'] loop
    if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>(case when k='notes' then 10000 else 1000 end) then return false; end if;
  end loop;
  foreach k in array array['ingredients','steps'] loop
    if jsonb_typeof(d->k) is distinct from 'array' or jsonb_array_length(d->k)>100 then return false; end if;
    seen:='{}';
    for r in select value from jsonb_array_elements(d->k) loop
      if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'id') is distinct from 'string'
        or (r->>'id') !~ '^[A-Za-z0-9_-]{1,80}$' or r->>'id'=any(seen) then return false; end if;
      seen:=array_append(seen,r->>'id');
      if k='ingredients' then
        if jsonb_typeof(r->'name') is distinct from 'string' or length(trim(r->>'name')) not between 1 and 1000
          or jsonb_typeof(r->'quantity') is distinct from 'string' or length(r->>'quantity')>32
          or jsonb_typeof(r->'unit') is distinct from 'string' or length(r->>'unit')>40 then return false; end if;
        if r->>'quantity'<>'' and (r->>'quantity') !~ '^(\d+(\.\d+)?|\d+/\d+|\d+ \d+/\d+)$' then return false; end if;
        if r->>'quantity' like '%/%' and split_part(r->>'quantity','/',2)::numeric=0 then return false; end if;
      else
        if jsonb_typeof(r->'text') is distinct from 'string' or length(trim(r->>'text')) not between 1 and 4000 then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.mixology_valid_document(jsonb) from public;
grant usage on schema private to authenticated;
grant execute on function private.mixology_valid_document(jsonb) to authenticated;

create unique index if not exists cocktails_id_workspace_mixology_key on public.cocktails(id,workspace_id);
create unique index if not exists movies_id_workspace_mixology_key on public.movies(id,workspace_id);
create table public.mixology_movie_links (
  workspace_id uuid not null references public.workspaces(id),
  cocktail_id uuid not null, movie_id uuid not null,
  primary key(workspace_id,cocktail_id,movie_id),
  foreign key(cocktail_id,workspace_id) references public.cocktails(id,workspace_id),
  foreign key(movie_id,workspace_id) references public.movies(id,workspace_id)
);
alter table public.mixology_movie_links enable row level security;
create policy mixology_movie_links_read on public.mixology_movie_links for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_movie_links_add on public.mixology_movie_links for insert to authenticated with check(private.is_workspace_member(workspace_id));
revoke all on public.mixology_movie_links from anon,authenticated;
grant select,insert on public.mixology_movie_links to authenticated;
create table public.mixology_recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  cocktail_id uuid not null,
  variant text not null check(variant in ('alcoholic','alcohol_free')),
  document jsonb not null check(private.mixology_valid_document(document)),
  revision bigint not null default 1 check(revision>0),
  legacy_evidence jsonb not null default '{}'::jsonb,
  projection_updated_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,cocktail_id,variant), unique(id,workspace_id),
  foreign key(cocktail_id,workspace_id) references public.cocktails(id,workspace_id)
);
create table public.mixology_versions (
  id uuid primary key,
  workspace_id uuid not null,
  recipe_id uuid not null,
  version_number integer not null check(version_number>0),
  document jsonb not null check(private.mixology_valid_document(document)),
  source_revision bigint not null,
  origin text not null check(origin in ('legacy','saved')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(recipe_id,version_number), unique(id,workspace_id),
  foreign key(recipe_id,workspace_id) references public.mixology_recipes(id,workspace_id)
);
create table public.mixology_tastings (
  id uuid primary key,
  workspace_id uuid not null,
  version_id uuid not null,
  host_id uuid not null default auth.uid() references auth.users(id),
  make_again text check(make_again in ('yes','maybe','no')),
  flags text[] not null default '{}' check(flags <@ array['too_sweet','too_tart','too_bitter','too_strong','just_right','too_much_effort']::text[]),
  comment text not null default '' check(length(comment)<=4000),
  previous_observations jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(make_again is not null or cardinality(flags)>0 or length(trim(comment))>0),
  foreign key(version_id,workspace_id) references public.mixology_versions(id,workspace_id)
);
create index mixology_tastings_version_idx on public.mixology_tastings(version_id);

alter table public.mixology_recipes enable row level security;
alter table public.mixology_versions enable row level security;
alter table public.mixology_tastings enable row level security;
create policy mixology_recipes_read on public.mixology_recipes for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_recipes_add on public.mixology_recipes for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid() and updated_by=auth.uid());
create policy mixology_recipes_edit on public.mixology_recipes for update to authenticated using(private.is_workspace_member(workspace_id)) with check(private.is_workspace_member(workspace_id) and updated_by=auth.uid());
create policy mixology_versions_read on public.mixology_versions for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_versions_add on public.mixology_versions for insert to authenticated with check(private.is_workspace_member(workspace_id) and created_by=auth.uid());
create policy mixology_tastings_read on public.mixology_tastings for select to authenticated using(private.is_workspace_member(workspace_id));
create policy mixology_tastings_add on public.mixology_tastings for insert to authenticated with check(private.is_workspace_member(workspace_id) and host_id=auth.uid());
create policy mixology_tastings_edit on public.mixology_tastings for update to authenticated using(private.is_workspace_member(workspace_id) and host_id=auth.uid()) with check(private.is_workspace_member(workspace_id) and host_id=auth.uid());
revoke all on public.mixology_recipes,public.mixology_versions,public.mixology_tastings from anon,authenticated;
grant select,insert,update on public.mixology_recipes,public.mixology_tastings to authenticated;
grant select,insert on public.mixology_versions to authenticated;

create function private.mixology_guard() returns trigger language plpgsql set search_path='' as $$
begin
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
end $$;
revoke all on function private.mixology_guard() from public;
create trigger mixology_recipe_guard before update or delete on public.mixology_recipes for each row execute function private.mixology_guard();
create trigger mixology_version_guard before update or delete on public.mixology_versions for each row execute function private.mixology_guard();
create trigger mixology_tasting_guard before update or delete on public.mixology_tastings for each row execute function private.mixology_guard();

create function private.mixology_new_tasting() returns trigger language plpgsql set search_path='' as $$
declare d jsonb;
begin
  select document into d from public.mixology_versions where id=new.version_id and workspace_id=new.workspace_id;
  if d is null or jsonb_array_length(d->'ingredients')=0 or jsonb_array_length(d->'steps')=0 then raise exception 'Save ingredients and preparation before recording a tasting';end if;
  new.previous_observations:='[]'::jsonb;new.created_at:=now();new.updated_at:=now();new.revision:=1;
  return new;
end $$;
revoke all on function private.mixology_new_tasting() from public;
create trigger mixology_tasting_insert_guard before insert on public.mixology_tastings for each row execute function private.mixology_new_tasting();

create function public.mixology_start(p_workspace uuid,p_cocktail uuid,p_variant text,p_document jsonb)
returns public.mixology_recipes language plpgsql security invoker set search_path='' as $$
declare c public.cocktails; r public.mixology_recipes; d jsonb; existed boolean;
begin
  if auth.uid() is null or not private.is_workspace_member(p_workspace) then raise exception 'workspace_forbidden' using errcode='42501'; end if;
  select * into c from public.cocktails where id=p_cocktail and workspace_id=p_workspace for update;
  existed:=found;
  if not existed then
    if p_variant<>'alcoholic' or not private.mixology_valid_document(p_document) then raise exception 'Invalid new recipe'; end if;
    insert into public.cocktails(id,workspace_id,name,cocktail_type,created_by)
      values(p_cocktail,p_workspace,p_document->>'name','cheese_louise',auth.uid()) returning * into c;
  end if;
  select * into r from public.mixology_recipes where workspace_id=p_workspace and cocktail_id=p_cocktail and variant=p_variant;
  if found then return r; end if;
  if existed and p_variant='alcoholic' then
    d:=jsonb_build_object('schemaVersion',1,'name',c.name,'servings',1,
      'ingredients',coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',line,'quantity','','unit','') order by n) from regexp_split_to_table(coalesce(c.ingredients,''),E'\r?\n') with ordinality as t(line,n) where length(trim(line))>0),'[]'::jsonb),
      'steps',coalesce((select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'text',line) order by n) from regexp_split_to_table(coalesce(c.method,''),E'\r?\n') with ordinality as t(line,n) where length(trim(line))>0),'[]'::jsonb),
      'glassware',coalesce(c.glassware,''),'garnish',coalesce(c.garnish,''),'notes',coalesce(c.notes,''));
  else d:=p_document; end if;
  insert into public.mixology_recipes(workspace_id,cocktail_id,variant,document,projection_updated_at,legacy_evidence)
    values(p_workspace,p_cocktail,p_variant,d,c.updated_at,case when existed and p_variant='alcoholic' then jsonb_build_object('tested',c.tested,'rating',c.rating,'source_name',c.source_name,'source_id',c.source_id,'source_url',c.source_url,'attribution','Host and tasted version unknown') else '{}'::jsonb end)
    on conflict(workspace_id,cocktail_id,variant) do nothing returning * into r;
  if not found then select * into r from public.mixology_recipes where workspace_id=p_workspace and cocktail_id=p_cocktail and variant=p_variant;return r;end if;
  if existed and p_variant='alcoholic' then
    insert into public.mixology_versions(id,workspace_id,recipe_id,version_number,document,source_revision,origin)
      values(gen_random_uuid(),p_workspace,r.id,1,d,1,'legacy');
  end if;
  return r;
end $$;

create function public.mixology_save(p_recipe uuid,p_revision bigint,p_document jsonb)
returns public.mixology_recipes language plpgsql security invoker set search_path='' as $$
declare r public.mixology_recipes;
begin
  update public.mixology_recipes set document=p_document,revision=revision+1,updated_by=auth.uid()
    where id=p_recipe and revision=p_revision returning * into r;
  if not found then raise exception 'draft_conflict' using errcode='40001';end if;
  return r;
end $$;

create function public.mixology_checkpoint(p_recipe uuid,p_revision bigint,p_version uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.mixology_recipes; v public.mixology_versions; c public.cocktails; stamp timestamptz;
begin
  select * into r from public.mixology_recipes where id=p_recipe for update;
  if not found then raise exception 'recipe_unavailable' using errcode='42501';end if;
  select * into v from public.mixology_versions where id=p_version;
  if found then
    if v.recipe_id<>r.id or v.created_by<>auth.uid() then raise exception 'version_identity_conflict';end if;
    return jsonb_build_object('recipe',to_jsonb(r),'version',to_jsonb(v));
  end if;
  if r.revision<>p_revision then raise exception 'draft_conflict' using errcode='40001';end if;
  if r.variant='alcoholic' then
    select * into c from public.cocktails where id=r.cocktail_id and workspace_id=r.workspace_id for update;
    if c.updated_at is distinct from r.projection_updated_at then raise exception 'legacy_changed: A legacy editor changed this cocktail. Your draft is safe; reconcile before saving a version.' using errcode='40001';end if;
    update public.cocktails set name=r.document->>'name',
      ingredients=coalesce((select string_agg(trim(concat_ws(' ',x->>'quantity',x->>'unit',x->>'name')),E'\n' order by n) from jsonb_array_elements(r.document->'ingredients') with ordinality t(x,n)),''),
      method=coalesce((select string_agg(x->>'text',E'\n' order by n) from jsonb_array_elements(r.document->'steps') with ordinality t(x,n)),''),
      glassware=r.document->>'glassware',garnish=r.document->>'garnish',notes=r.document->>'notes',tested=false,rating=null,updated_at=clock_timestamp()
      where id=r.cocktail_id and workspace_id=r.workspace_id returning updated_at into stamp;
  else stamp:=r.projection_updated_at;end if;
  insert into public.mixology_versions(id,workspace_id,recipe_id,version_number,document,source_revision,origin)
    values(p_version,r.workspace_id,r.id,(select coalesce(max(version_number),0)+1 from public.mixology_versions where recipe_id=r.id),r.document,r.revision,'saved') returning * into v;
  update public.mixology_recipes set projection_updated_at=stamp,revision=revision+1,updated_by=auth.uid() where id=r.id returning * into r;
  return jsonb_build_object('recipe',to_jsonb(r),'version',to_jsonb(v));
end $$;

create function public.mixology_feedback(p_id uuid,p_version uuid,p_revision bigint,p_again text,p_flags text[],p_comment text)
returns public.mixology_tastings language plpgsql security invoker set search_path='' as $$
declare v public.mixology_versions;t public.mixology_tastings;
begin
  select * into v from public.mixology_versions where id=p_version;
  if not found then raise exception 'version_unavailable' using errcode='42501';end if;
  if jsonb_array_length(v.document->'ingredients')=0 or jsonb_array_length(v.document->'steps')=0 then raise exception 'Save ingredients and preparation before recording a tasting';end if;
  if p_revision=0 then
    insert into public.mixology_tastings(id,workspace_id,version_id,make_again,flags,comment)
      values(p_id,v.workspace_id,v.id,p_again,p_flags,p_comment) on conflict(id) do nothing returning * into t;
    if not found then
      select * into t from public.mixology_tastings where id=p_id and host_id=auth.uid() and version_id=v.id;
      if not found then raise exception 'tasting_identity_conflict';end if;
    end if;
  else
    update public.mixology_tastings set make_again=p_again,flags=p_flags,comment=p_comment,revision=revision+1
      where id=p_id and version_id=v.id and host_id=auth.uid() and revision=p_revision returning * into t;
    if not found then raise exception 'draft_conflict' using errcode='40001';end if;
  end if;
  return t;
end $$;

revoke all on function public.mixology_start(uuid,uuid,text,jsonb),public.mixology_save(uuid,bigint,jsonb),public.mixology_checkpoint(uuid,bigint,uuid),public.mixology_feedback(uuid,uuid,bigint,text,text[],text) from public,anon;
grant execute on function public.mixology_start(uuid,uuid,text,jsonb),public.mixology_save(uuid,bigint,jsonb),public.mixology_checkpoint(uuid,bigint,uuid),public.mixology_feedback(uuid,uuid,bigint,text,text[],text) to authenticated;
commit;
