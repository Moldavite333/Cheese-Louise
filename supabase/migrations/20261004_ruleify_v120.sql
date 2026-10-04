-- Cheese Louise v1.20 — Ruleify™
-- Preserve the rough observation and structured metadata beside the official rule.

alter table public.romantiverse_rules
  add column if not exists category text,
  add column if not exists source_observation text,
  add column if not exists ruleify_metadata jsonb not null default '{}'::jsonb;

alter table public.romantiverse_rules
  drop constraint if exists romantiverse_rules_ruleify_metadata_object;

alter table public.romantiverse_rules
  add constraint romantiverse_rules_ruleify_metadata_object
  check (jsonb_typeof(ruleify_metadata) = 'object');
