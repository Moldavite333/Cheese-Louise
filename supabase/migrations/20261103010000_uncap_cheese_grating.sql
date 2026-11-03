-- Cheese Louise HQ: Cheese Grating is a sum of verified trope points, not a 0–100 rating.
-- Review-branch schema fix only. Do not deploy before staging validation.
-- No movie scores or trait rows are modified by this migration.
begin;

alter table public.movies
  drop constraint if exists movies_cheese_score_check;

alter table public.movies
  add constraint movies_cheese_score_check
  check (cheese_score >= 0);

commit;

-- Follow-up required (separate reviewed operation):
-- Existing stored cheese_score values can differ from sums of checked movie_traits.
-- Do not silently backfill legacy records or change historical provenance.
-- The current movie_traits trigger handles INSERT/DELETE but not cheese_traits.points
-- changes; plan an explicit audited reconciliation and trigger contract.
