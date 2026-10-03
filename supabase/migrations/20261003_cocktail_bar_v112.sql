-- Cheese Louise v1.12 — Cocktail Bar
create table if not exists public.cocktails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cocktail_type text not null default 'original' check (cocktail_type in ('original','cheese_louise')),
  parent_cocktail_id uuid null references public.cocktails(id) on delete set null,
  base_spirit text,
  style text,
  flavor_tags text[] not null default '{}',
  season text,
  holiday text,
  ingredients text not null default '',
  garnish text,
  glassware text,
  method text,
  notes text,
  batchable boolean not null default false,
  strength text check (strength is null or strength in ('light','medium','strong')),
  tested boolean not null default false,
  rating integer check (rating is null or rating between 1 and 5),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cocktails_workspace_name_unique
  on public.cocktails (workspace_id, lower(name));
create index if not exists cocktails_workspace_type_idx
  on public.cocktails (workspace_id, cocktail_type);
create index if not exists cocktails_parent_idx
  on public.cocktails (parent_cocktail_id);

alter table public.cocktails enable row level security;
drop policy if exists cocktails_member_all on public.cocktails;
create policy cocktails_member_all on public.cocktails
  for all
  using ((select private.is_workspace_member(cocktails.workspace_id)))
  with check ((select private.is_workspace_member(cocktails.workspace_id)));

alter table public.episodes add column if not exists cocktail_id uuid null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'episodes_cocktail_id_fkey'
      and conrelid = 'public.episodes'::regclass
  ) then
    alter table public.episodes
      add constraint episodes_cocktail_id_fkey
      foreign key (cocktail_id) references public.cocktails(id) on delete set null;
  end if;
end $$;

with starter(name, base_spirit, style, flavor_tags, ingredients, garnish, glassware, method, batchable, strength) as (
  values
  ('Old Fashioned','Whiskey','Spirit-forward',array['spirit-forward','bitter','warming','classic','bourbon'], '2 oz bourbon or rye\n1/4 oz demerara syrup\n2 dashes Angostura bitters', 'Orange peel', 'Rocks glass', 'Stir with ice, strain over one large cube, express orange peel.', false, 'strong'),
  ('Manhattan','Whiskey','Spirit-forward',array['spirit-forward','elegant','bitter','warming','classic'], '2 oz rye whiskey\n1 oz sweet vermouth\n2 dashes Angostura bitters', 'Brandied cherry', 'Coupe', 'Stir with ice and strain into a chilled coupe.', false, 'strong'),
  ('Negroni','Gin','Bitter',array['bitter','herbal','spirit-forward','elegant','classic'], '1 oz gin\n1 oz Campari\n1 oz sweet vermouth', 'Orange peel', 'Rocks glass', 'Stir with ice and strain over fresh ice.', false, 'strong'),
  ('French 75','Gin','Sparkling',array['sparkling','elegant','citrus','celebratory','light','romantic'], '1 oz gin\n1/2 oz lemon juice\n1/2 oz simple syrup\n2 oz sparkling wine', 'Lemon twist', 'Flute or coupe', 'Shake gin, lemon, and syrup with ice. Strain and top with sparkling wine.', false, 'medium'),
  ('Daiquiri','Rum','Sour',array['rum','citrus','refreshing','tropical','classic'], '2 oz white rum\n1 oz lime juice\n3/4 oz simple syrup', 'Lime wheel', 'Coupe', 'Shake hard with ice and strain into a chilled coupe.', false, 'medium'),
  ('Margarita','Tequila','Sour',array['tequila','citrus','refreshing','playful','summer'], '2 oz tequila\n1 oz lime juice\n3/4 oz orange liqueur\n1/4 oz agave syrup', 'Lime wheel; optional salt rim', 'Coupe or rocks glass', 'Shake with ice and strain; serve up or over fresh ice.', false, 'medium'),
  ('Whiskey Sour','Whiskey','Sour',array['bourbon','citrus','warming','classic','sweet-tart'], '2 oz bourbon\n3/4 oz lemon juice\n3/4 oz simple syrup\nOptional egg white', 'Lemon peel or cherry', 'Rocks glass', 'Shake; if using egg white, dry shake first. Strain over fresh ice.', false, 'medium'),
  ('Sidecar','Brandy','Sour',array['brandy','citrus','elegant','warming','classic'], '2 oz cognac\n3/4 oz orange liqueur\n3/4 oz lemon juice', 'Orange twist', 'Coupe', 'Shake with ice and strain into a chilled coupe.', false, 'medium'),
  ('Moscow Mule','Vodka','Highball',array['ginger','citrus','refreshing','spicy','highball'], '2 oz vodka\n1/2 oz lime juice\n4 oz ginger beer', 'Lime wheel', 'Mule mug or highball', 'Build over ice and top with ginger beer.', true, 'medium'),
  ('Tom Collins','Gin','Highball',array['gin','citrus','refreshing','light','highball','summer'], '2 oz gin\n1 oz lemon juice\n3/4 oz simple syrup\n2 oz soda water', 'Lemon wheel and cherry', 'Collins glass', 'Shake gin, lemon, and syrup; strain over ice and top with soda.', true, 'light'),
  ('Mai Tai','Rum','Tiki',array['rum','tropical','citrus','nutty','tiki','summer'], '2 oz aged rum\n3/4 oz lime juice\n1/2 oz orange curaçao\n1/2 oz orgeat\n1/4 oz simple syrup', 'Mint bouquet and lime shell', 'Rocks glass', 'Shake with crushed ice and pour unstrained.', false, 'strong'),
  ('Espresso Martini','Vodka','Dessert',array['coffee','dessert','dark','sweet','elegant','night'], '1 1/2 oz vodka\n1 oz espresso\n3/4 oz coffee liqueur\n1/4 oz simple syrup', 'Coffee beans', 'Coupe', 'Shake very hard with ice and double strain.', false, 'medium'),
  ('Hot Toddy','Whiskey','Hot',array['warming','hot','cozy','winter','honey','bourbon'], '2 oz whiskey\n3/4 oz lemon juice\n1/2 oz honey syrup\n3 oz hot water', 'Lemon wheel and cinnamon stick', 'Mug', 'Build in a warm mug and stir.', true, 'medium'),
  ('Champagne Cocktail','Sparkling Wine','Sparkling',array['sparkling','elegant','celebratory','romantic','classic'], '1 sugar cube\n2 dashes Angostura bitters\n4 oz sparkling wine', 'Lemon twist', 'Flute', 'Soak sugar cube with bitters, add to flute, and top with sparkling wine.', false, 'light')
)
insert into public.cocktails (
  workspace_id, name, cocktail_type, base_spirit, style, flavor_tags,
  ingredients, garnish, glassware, method, batchable, strength
)
select w.id, s.name, 'original', s.base_spirit, s.style, s.flavor_tags,
       s.ingredients, s.garnish, s.glassware, s.method, s.batchable, s.strength
from public.workspaces w
cross join starter s
on conflict do nothing;
