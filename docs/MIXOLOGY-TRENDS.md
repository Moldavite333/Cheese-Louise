# Source-backed trend review — local implementation

Prepared migration: `20261110101303_mixology_trend_review.sql`. It is unapplied to hosted databases. This is an optional **manual source-review and freshness workflow** inside Research, not an automatic broad trend collector, popularity tracker or personal taste model. No scheduler, provider, service setting or paid API was activated.

## Host workflow

The collapsed “Trend observations & source review” section keeps private shared observations across the workspace. A general observation can be reused while developing different drinks; a movie-specific observation references the existing movie ID and requires explicit practical/spoiler-free relevance before a host confirms review. It does not create a second movie record, alter recipes, approve drinks or infer Nick/Jenny preferences.

Each observation records what a source showed, its basis (example/report/dataset), limitations, practical application, optional observation date and optional next-check date. Up to eight sources carry a title, public HTTPS link, publication date when known, retrieval/check date and a short statement of what that source supports. A recipe example is explicitly not evidence of broad popularity. No confidence percentages, market statistics or trend facts are prefilled.

The selected-concept research shortcut copies only existing validated links, titles and their actual prior fetch dates. It deduplicates links, leaves source-support statements empty and does not confirm human review or pretend to perform a fresh fetch. Hosts must inspect what each source supports and supply limitations before checking the review box. Source URLs open only on explicit user action, in a new tab with no referrer. This module makes no outbound source requests.

A review is attributed to the authenticated host and actual server time. Editing evidence clears it. Dates are calendar dates compared in UTC; impossible/future observation, publication and retrieval dates are refused. The optional next-check date can be in the future or past. “Review due” means the host should revisit sources; it is not a measure of popularity, quality, evidence strength or freshness certainty. Missing next-check dates remain explicitly unknown. There is no reminder notification or background research job.

## Reuse and persistence

The new panel reuses the existing revision-aware draft buffer, scoped browser recovery, shared compare-and-swap saves, conflict decisions and private export patterns. General/movie observations are canonical workspace records rather than duplicate per-recipe arrays. The existing cocktail research/bartender workshop and taste evidence are unchanged. Trend observations are not automatically fed into the bartender or ranking model; hosts can use their source review while editing or discussing a recipe.

Incomplete drafts may be saved. Explicit review requires a title, observation, limitations, at least one source with a public link/retrieval date/support statement, and movie relevance when linked to a movie. A failed or lost review acknowledgment never marks the local note reviewed by assumption: the host can load the actual shared record. Local edits survive offline saves and version conflicts; a private JSON export is available. Memory-only drafts warn before switching observations when browser recovery has failed.

Every persisted revision is appended to private workspace-readable source history with the actual editor/time. Users cannot edit/delete that history or insert invented old revisions: an insertion must match the current parent revision/document/actor/time, whose unique history row is already authored atomically by the save trigger. The parent identity and movie context are immutable. Notes can be archived and shown again through an explicit archive filter.

The list uses a 20-row `(updated_at,id)` keyset cursor, with a “More observations” action rather than silently treating the newest page as the entire collection. History uses revision cursors. Refresh is needed to include concurrent changes that move records ahead of a browsing cursor. There are no invented total counts or statistical dashboards.

## Verification and boundaries

`tests/mixology-trends.test.mjs` verifies public URL/date validation, missing evidence and uncertainty, due-date semantics, shared saves and stale rejection, either-host attributed review, review clearing, immutable/nonforgeable revision history, same-workspace movie references and required relevance, paging/archive filtering, and nonmember/anonymous/intake-service isolation. The full Node suite is **305 passing tests**.

`scripts/mixology-trends-browser-smoke.mjs` exercises actual isolated SQL with two fictional hosts at 390/1440px: creating/reviewing, due labels, separate-host conflicts, loading shared edits, offline retry, a committed-but-lost review acknowledgment, source history, reload recovery, movie relevance validation, archiving and movie filters. The existing Stage 2 browser also exercises copied selected-research links, preserved retrieval dates, deduplication and absence of automatic review/support claims with a fake source provider. Screenshots use `artifacts/mixology-trend-{review,movie,viewport}-{390,1440}.png` and contain explicitly fictional sources, not actual researched trend claims.

Tables and RPCs use explicit authenticated grants, workspace RLS and invoker functions. No new definer capability was introduced. The public listener intake service is not granted access. Known credential/signed-link patterns and encoded query keys are rejected; this is not a guarantee that a user cannot type sensitive text into private notes. Private recovery exports are not publication artifacts. No public export or publication endpoint was added for these observations.

## Remaining checks and release

Real source quality, actual human research habits, practical effort and movie relevance need a real host pilot. The feature does not implement automatic continuing collection or prove that a recorded source is accurate or independently corroborated. Any further provider/background integration must be separately designed and verified; external-service changes or paid usage need approval.

Hosted Auth/PostgREST grants, real multi-device conflicts, backups/retention and a hosted advisor pass still need an approved staging environment. This run used PostgreSQL/WASM, mocked auth/transports and fictional source pages. Existing caret-position and media-conflict intermittencies remain acceptance issues even when later reruns pass. No deployment, hosted migration, real trend dataset, paid call or external service change occurred.

Official references inspected: [database functions](https://supabase.com/docs/guides/database/functions), [changelog](https://supabase.com/changelog). The Markdown index was unreadable through the browser tool; the HTML index was inspected. Only local `migration new` was run with the pinned CLI.
