create table if not exists public.romantiverse_bingo_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  card_number integer not null,
  name text not null,
  seed_code text,
  squares jsonb not null default '[]'::jsonb,
  locked_indices integer[] not null default '{}'::integer[],
  marked_indices integer[] not null default '{12}'::integer[],
  excluded_trait_ids uuid[] not null default '{}'::uuid[],
  include_categories text[] not null default '{}'::text[],
  exclude_categories text[] not null default '{}'::text[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint romantiverse_bingo_cards_number_positive check (card_number > 0),
  constraint romantiverse_bingo_cards_squares_array check (jsonb_typeof(squares) = 'array'),
  unique (workspace_id, card_number)
);

create index if not exists romantiverse_bingo_cards_workspace_created_idx
  on public.romantiverse_bingo_cards (workspace_id, created_at desc);

alter table public.romantiverse_bingo_cards enable row level security;

drop policy if exists "workspace members manage bingo cards" on public.romantiverse_bingo_cards;
create policy "workspace members manage bingo cards"
  on public.romantiverse_bingo_cards
  for all
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.romantiverse_bingo_cards to authenticated;
grant all on public.romantiverse_bingo_cards to service_role;
