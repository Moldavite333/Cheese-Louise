# Mixology Stage 1 — local implementation review

This records the Stage 1 checkpoint. Stage 2 has since been added locally; see `MIXOLOGY-STAGE2.md` for the current research/bartender scope and deployment boundary.

Base: `86d6771d29cacdf40b163024566b0c29decdd175` (current audited main).
This isolated checkout preserves the older `movie-finder` checkout and its unfinished work.

## Implemented behavior

- A recipe-centered studio reached from saved cocktail Edit, a linked episode, a saved movie, or New cocktail / recent drafts in the bar.
- Named ingredient rows with separate quantity/unit fields, ordered steps, serving yield, glassware, garnish, and notes. Imported ambiguous text remains verbatim.
- Browser recovery scoped to workspace, signed-in host, cocktail and variant; debounced shared saves use expected revisions. Storage/network failures are visible and drafts can be exported.
- Same-account tabs cannot silently replace each other's browser recovery. Cross-device/host conflicts retain the local text and require deliberate resolution.
- Immutable saved versions, ingredient/step differences, full specifications, restore-as-draft and local edit undo.
- Independent alcoholic/alcohol-free draft and version histories. No generated or inherited alcohol-free testing claims.
- Per-host comments, optional make-again answers/chips, version-specific evidence, and corrections restricted to the original host. Corrections retain previous observations. This stage does not infer taste profiles.
- Existing canonical cocktail IDs and episode references are preserved. Snapshots update the alcoholic recipe's legacy projection for existing HQ consumers; autosave does not rewrite that projection.
- Legacy tested/rating/source metadata remains identified as legacy, with unknown host/version. It is never converted into invented host feedback.

## Database contract and deployment boundary

`supabase/migrations/20261109195426_mixology_stage1.sql` was created with the Supabase CLI. It is **not applied to production**. No hosted database was written to, and no frontend was deployed.

The additive migration creates `mixology_recipes`, `mixology_versions`, `mixology_tastings` and `mixology_movie_links`. Existing records are imported lazily on first editing; applying the migration itself does not backfill or rewrite recipes. Exact movie/cocktail/workspace relationships use composite foreign keys. New records are private to workspace members; only a host can author/correct their own tasting. Public API functions use caller permissions (`SECURITY INVOKER`), explicit grants and RLS, with no service key in the browser.

Versions cannot be updated or deleted through the authenticated API. Drafts use compare-and-swap revisions. Checkpoint and tasting operations accept stable IDs so retries do not duplicate records. A newer legacy-editor write blocks projection replacement rather than silently losing it.

The existing production-document policy is not reused or modified by this stage. Its separately audited workspace-comparison issue still needs its own authorized correction.

## Review / validation

Use the pinned tools in `package.json` and `pnpm-lock.yaml`:

```
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm exec playwright install chromium
pnpm test:mixology-browser
node scripts/cocktail-browser-smoke.mjs
node scripts/hq-browser-smoke.mjs
```

The database tests apply the actual migration to PGlite (isolated PostgreSQL/WASM), with fictional accounts, effective `authenticated`/`anon` roles and RLS. The assembled browser tests use that same real SQL behind a local fixture adapter. Every non-local browser request is blocked; the fixture does not log into or write to production. Browser tests generate review screenshots in ignored `artifacts/`.

These checks are not a substitute for staging tests against deployed Supabase Auth/PostgREST, a backup/restore exercise, or a real Nick/Jenny session. None of those deployment-stage checks is claimed complete.

### Observed validation results

- All **193 Node tests passed**, including the original 171 regressions and new draft/model/SQL checks.
- New assembled browser checks passed at **390 px and 1440 px**: edits, saved versions/comparison, two-host feedback, conflict resolution, offline reload/retry, preserving unfinished episode outlines, standalone creation and independent counterparts.
- Existing cocktail browser checks passed at **390 px and 1440 px**.
- Existing assembled HQ browser checks passed at **360, 768, 1024 and 1440 px**.
- Phone history and desktop recipe screenshots were inspected. No horizontal overflow was observed in the tested views.
- Browser fixture requests to non-local services were blocked. The migration was exercised only in isolated PostgreSQL/WASM, not against the hosted database.

Review screenshots: `artifacts/mixology-recipe-390.png`, `artifacts/mixology-recipe-1440.png`, `artifacts/mixology-history-390.png` and `artifacts/mixology-history-1440.png`. All display fictional test recipes/feedback.

## Before any release

1. Review this change and authorize staging setup separately.
2. Apply the exact migration to staging; verify grants and effective member/nonmember sessions through PostgREST, cross-device refresh, and recovery.
3. Reconcile legacy projection changes and source-name uniqueness using staging fixtures. A canonical name collision must not discard the current draft.
4. Verify desktop/mobile layouts and a complete two-host pilot, including untested counterpart status and failed requests.
5. Review backup, rollback and deployment separately before touching production.

For frontend rollback, restore the previous script/style assembly while retaining the new tables and histories. Do not drop the tables as a routine rollback: that would destroy saved versions and tasting evidence. A legacy projection can be recovered from its retained imported version using restore-as-draft and a deliberate checkpoint.

## Deferred scope

Conversational editing, research generation, learned preference summaries, approvals, version-pinned recording/publication packets, smart batching, public publishing, photos and submissions remain later stages. No paid services, reminders, recurring research or public actions were enabled.
