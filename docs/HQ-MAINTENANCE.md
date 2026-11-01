# HQ hourly health and production review

Scope: Cheese Louise HQ only, https://moldavite333.github.io/Cheese-Louise/, repository `Moldavite333/Cheese-Louise`. Preserve the current layout, personal movie taste and production data.

Current show format: Rules of the Romantiverse and Ruleify have been removed at the user's request. Do not restore these features, navigation entries, or prompts in episode templates, launch checklists, Producer Desk, or Bingo artwork. Keep Show Lab, Podcast 101, Cheese Traits, Cheese Grating, and Bingo available.

## Hourly checks

1. Run `node scripts/hq-health.mjs` to fetch the deployed page and its local script/style dependencies. Confirm successful responses, correct content types and no HTML error page masquerading as JavaScript.
2. Inspect the latest GitHub Pages deployment and regression workflow for the current commit. Report new failed runs with links and the failing step.
3. Run `node --test tests/*.test.mjs` and syntax checks for changed browser scripts. Run `node scripts/hq-browser-smoke.mjs` when the existing Playwright environment is available. The portable local helper `scripts/.local-smoke.mjs` is checkout-specific and is not tracked.
4. Exercise fixture-based Movie Radar, search, recommendations, saved/recommended image loading, fresh-batch replacement, filter controls, Watch Along, rundown, Recording, episode planning, Calendar, and unsaved-edit protection at the supported four screen sizes.
5. Treat the no-horror policy as permanent: genre ID 27, mixed Horror/Romance, named Horror genres, explicit horror keywords and clear horror descriptions must be excluded. Check Krampus titles even when the provider labels them Comedy or Fantasy: a live test exposed this real tagging gap. A friendly ghost or magical wish alone is not horror. Search with unknown genre classification must not be recommended as a safe result. Tests in `tests/horror-policy.test.mjs` cover the server pipeline.
6. When credentials are already available through an authorized session or connector, make bounded read-only live search/recommendation calls. Check poster URLs and an exclusion-based fresh batch. Do not extract browser session tokens or put credentials in files/logs. Clearly distinguish live results from fixtures.

The scheduled review must not publish, deploy, merge, change authentication/access, write to production tables, or alter votes, episodes, schedules, Watch Along notes or recordings. A failed test is a finding, not authorization to rewrite user records. Prepare focused proposals with concrete evidence and validation before any future production change.

Keep healthy unchanged runs quiet. Notify on new failures, meaningful reviewable improvement proposals, or required user action; avoid repeated alerts for unchanged failures. Maintain only local diagnostic artifacts and a local review log. Local runs depend on the computer being on and the desktop app running.

## Production priorities

- Reliability first: movie discovery quality, no horror, loaded posters, no repeated batches, preserved notes and editing markers.
- Review Watch Along → ordered rundown → Recording → editing/release planning as one production workflow. Fix misleading links or missing handoffs before adding more screens.
- Prepare a reviewable plan for editable rundown preview and native sharing while preserving talking-point order. Inspect existing work before duplicating it.
- Review shared draft/session persistence and explicit movie-to-episode binding. These require a data-model design and must not be silently changed by the hourly monitor.
- Improve release readiness using actual episode status, credits, cocktail, recording and schedule information; do not invent completion state.
- Expand recommendation coverage using real metadata and shared votes. Preserve quirky/magical romance; distinguish genre evidence from verified scenes.
- Keep reducing duplicate controls and global overrides when a concrete change justifies it. Preserve the layout the user approved.

## Baseline

The current no-horror change is validated against mixed genres, stored metadata, horror keywords, late-enrichment genre corrections, and unknown classifications. See `HQ-REDTEAM.md` for earlier fixes and remaining limitations. Public availability and fixture tests do not establish that authenticated cross-device saving, email recovery or shared storage work end to end.
