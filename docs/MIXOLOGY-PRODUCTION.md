# Shared preparation and recording packets — November 9, 2026

The real-photo library has since been implemented locally. See [MIXOLOGY-MEDIA.md](MIXOLOGY-MEDIA.md) and the current [build status](MIXOLOGY-BUILD-STATUS.md) for updated verification and remaining work.

This is the current local development checkpoint, following `MIXOLOGY-PREPARATION-APPROVAL.md`. The hourly build schedule remains active. Local implementation and tests are authorized; deployment, publication, hosted migrations, paid calls and external-service changes remain outside that authorization.

## Implemented

Preparation now has a shared plan attached to an immutable recipe version and an optional existing episode ID. A standalone rehearsal has its own plan. Different versions, episodes and alcohol-free counterparts do not inherit checked tasks or review status. The existing canonical cocktail, recipe, movie and episode records remain authoritative; no second live recipe is introduced.

The preparation panel supports:

- Host-entered shopping, make-ahead/component, waiting and recording-day tasks.
- Independent hands-on and passive minutes, with blank timing explicitly unknown.
- Optional component/storage instructions, recorded as host input rather than generated shelf-life guidance.
- Shared target servings and derived ingredient quantities from the selected saved recipe, with ingredient-specific batch caveats. Ambiguous legacy lines stay explicitly unscaled.
- A contextual stage summary with accessible progress elements and text counts. Time sums are entered estimates, not elapsed time or recording/safety readiness scores.
- Local recovery, debounced shared saving, explicit sync status, stale-revision rejection, undo, export, and deliberate conflict resolution.
- A separate collapsed working-draft scaling preview. Unsaved recipe changes do not alter the selected saved version or its production plan.

The Cheesy Concoction section stores optional movie connection, history/preparation context and discussion points. Sources have a title, HTTPS URL and host-entered retrieval date. A host explicitly reviews the segment for spoilers and factual support. Text or source edits clear that review both in the UI and in the database trigger. There is no fabricated movie connection, source, historical claim or tasting result. Source entries are not automatically fetched or verified.

Saving a private recording packet checks the preparation revision, review flag and latest approval for that exact version. The database freezes the recipe, plan, attributable tasting observations and approval reference at creation; a client cannot supply replacement snapshot content. Approval changes and packet creation serialize on the recipe row, including direct approval inserts. Later edits or withdrawal do not rewrite earlier packets. Withdrawal blocks new packets; historical packets are clearly labeled approval-at-creation and instruct the hosts to check HQ before recording.

Packets can be previewed and downloaded as private text containing the base recipe, scaled preparation quantities/caveats, tasks, optional segment notes, recorded tasting observations and provenance. Missing tasting remains explicit; approval never manufactures a tasted result. Downloads do not publish content or modify an episode outline. Long packet previews are optional, and disclosure state survives relevant panel rerenders.

## Files and data boundary

- `mixology-production-core.js`: pure plan validation, stage summaries and recording text.
- `mixology-production.js`: shared preparation, recovery/conflict UX, segment review, packet creation and local downloads.
- `mixology-studio.js` / `.css`, `index.html`: scoped integration and cache versions. Existing episode entry/return behavior is retained.
- `supabase/migrations/20261110030632_mixology_production.sql`: CLI-generated, additive and **unapplied to hosted databases**. Adds `mixology_preparations`, `mixology_recording_packets`, validators, guards and invoker RPCs. Explicit authenticated grants and membership RLS protect all new tables. Composite workspace references reject mismatched versions/episodes. No anonymous access or client packet update/delete grants.
- `tests/mixology-production.test.mjs` and `scripts/mixology-production-browser-smoke.mjs`: real local PostgreSQL/WASM and assembled browser coverage. The package script and regression workflow include the new browser suite.

The existing workspace membership model represents the hosts. Public listeners must not be added as workspace members to implement submissions. The later intake/moderation stage needs its own restricted boundary.

## Verification

- **239 automated tests passed**, including ten production-plan/packet checks, existing recipe/workshop/database regressions and the broader HQ logic suite.
- New assembled browser flow passed at **390 and 1440 px**: two-host edits, checklist sharing, stale-save conflict/recovery, offline reload/retry, segment/source review, immutable packets, real Chromium text downloads, approval-withdrawal blocking, episode-plan separation and unfinished-outline preservation.
- Existing Mixology editor/approval/recovery checks passed at **390 and 1440 px**. Research/bartender and cocktail browser regressions passed at both widths. Assembled HQ passed at **360, 768, 1024 and 1440 px**.
- No horizontal overflow was observed in the tested production views. Phone and desktop overview/segment screenshots were inspected. Browser tests use fictional accounts, recipes and source entries; external requests are blocked or mocked.
- All new/modified browser JavaScript passed syntax checks. No hosted data, real model calls or actual host tasting sessions were used.

Reproduce from this checkout with the existing pinned dependencies:

```text
node --test tests/*.test.mjs
node scripts/mixology-production-browser-smoke.mjs
node scripts/mixology-browser-smoke.mjs
node scripts/mixology-stage2-browser-smoke.mjs
node scripts/cocktail-browser-smoke.mjs
node scripts/hq-browser-smoke.mjs
```

On this machine, the installed Playwright browsers are under `C:/Users/nkesler/AppData/Local/ms-playwright`; the restricted execution sandbox needed a localhost override. Tests did not require dependency installation or provider activation. Review screenshots are regenerated under ignored `artifacts/mixology-production-*.png`.

## Remaining work and release gates

The next implementation stage is actual-drink photo upload/library with rights/credit records, followed by source-backed recipe/promotional drafts and moderated listener intake. No synthetic drink images were generated. Public pages, posting, storage buckets, listener endpoints, reminders and inventory integrations were not activated by this stage.

The earlier referenced attachment remains absent from this Windows environment. Its unavailable wording must not be guessed. Known approved choices Q3=C, Q18=B, Q19=C, either-host approval, real photos, independent counterparts and one shared record remain constraints.

Production readiness still requires an explicitly authorized staging environment, actual Supabase Auth/PostgREST/grant checks, real separate-device host testing, backup/restore/rollback checks and a tasting/usability pilot. Apply the prepared Stage 1, Stage 2, approval and production migrations in that order only after staging authorization. The separately documented existing production-document policy issue remains outside this increment. No additional permission is needed to continue local implementation; hosted rollout and paid-provider activation require separate approval.
