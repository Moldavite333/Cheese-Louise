# Mixology Lab 2.0 — build and release status

Previous local checkpoint: November 10, 2026, 03:09 hourly run (10:09 UTC trigger; America/Denver). Continue from this file during hourly build runs. Preserve existing uncommitted work in this checkout.

## Deployment request update

The user subsequently requested deployment. See [the deployment handoff](MIXOLOGY-DEPLOYMENT.md) for current authorization, verified target/access, release sequence and blockers. Historical no-deploy statements below describe the earlier local-build scope; the new request authorizes deployment work. Release PR #103 is now merged and GitHub Pages deployment succeeded at source commit 6ae390e5eb8b7a6d6208c7b4e1169d1e2130fd0e. All 11 migrations are applied; Supabase sign-in is verified. The 19 new public assets match the tested source and live anonymous phone/desktop checks passed. Read MIXOLOGY-HOSTED-ROLLOUT.md first. Historical pending-auth/local-only statements below are superseded. Paid generation and public intake remain disabled; local backlog and real-host acceptance remain open.

## Authorization and specification

The user authorizes completing the local implementation and tests now, superseding earlier read-only/stop-before-code instructions. Do not request renewed code permission. Deployment/publication, hosted migrations, paid API usage and external-service changes still require separate explicit approval. The hourly schedule is active and should pause only when all authorized local implementation and verification are actually complete; remaining staging/host/release checks must be reported separately.

Use the approved blueprint and optimization review retrieved from ChatGPT conversation `6af1fa24-1cf0-83e8-b338-9bb2aa7d43d4`. The attachment was recovered this run from the Windows preview path returned by `read_thread` and preserved verbatim as `MIXOLOGY-OPTIMIZATION-REVIEW.txt`. The master handoff exposes M01–M20, but long cached messages truncate at 20,000 characters and the original question/choice wording is still absent. Do not invent missing question wording. Preserve Q3=C, Q18=B, Q19=C; either host approves; one shared canonical identity; independent alcoholic/alcohol-free recipes and tasting/approval; real photos only; no listener competitions; spoiler-free movie connections; provenance; explainable individual taste evidence; practical accessible workflows; existing HQ functionality.

## Completed local increments

- Existing Stage 1/2 work was preserved and initially passed 225 tests. It provides canonical/versioned recipes, manual editing, shared autosave/local recovery, conflicts, separate host tasting, independent counterparts, source-backed concept/research flows, reviewed bartender operations and conservative taste evidence. See `MIXOLOGY-STAGE1.md` and `MIXOLOGY-STAGE2.md` for actual limitations. The paid bartender is disabled; model/cocktail quality is not verified by fixture tests.
- Exact-version either-host approval and withdrawal; immutable attributed decisions; no inferred tasting or approval inheritance. See `MIXOLOGY-PREPARATION-APPROVAL.md`.
- Persistent preparation/checklists/components, separate active/passive estimates and episode/version plans; reviewed source-bearing segment notes; immutable private recording packets, real text downloads, current-approval gating and preserved episode outlines. See `MIXOLOGY-PRODUCTION.md`.
- Real-photo upload/library implementation with explicit rights/real-photo attestations, local re-encoding/metadata stripping, private signed previews, version association, revisioned shared credit details, retries and rights withdrawal. See `MIXOLOGY-MEDIA.md`.
- Shared recipe/promotional drafts, exact-photo-revision spoiler/source review, approved counterpart gates, immutable public-field snapshots, sandboxed previews and portable local HTML/text exports. Current recipe approvals and photo rights are rechecked on export; private notes/IDs and signed URLs are excluded. See `MIXOLOGY-PUBLICATION.md`.

Current full Node suite: **305 passed**. New and existing assembled browser checks use fictional data, blocked/mocked external requests and isolated PostgreSQL. No actual tasting, model-quality validation, hosted migration or production deployment has occurred. Real photographs were not available/needed for format-transport fixture tests; the gallery still requires actual host-provided drink photos in real use.

- Moderated listener intake and private host queue, bounded/verified abuse boundary, optional consented credit, local curation recovery, either-host attributable decisions, exact-once untested canonical import and explicit original-text redaction. The public form and Edge handler remain unconfigured/disabled. See `MIXOLOGY-SUBMISSIONS.md`.

## Latest verified checkpoint

Hourly run 10:09 UTC November 10: added optional manual source-backed trend observations inside Research. General and movie-linked records share a canonical workspace collection; movie links use actual same-workspace IDs. Notes distinguish recipe examples/reports/datasets, source support, limitations, practical/spoiler-free relevance, known publication/retrieval dates and optional next-check dates. Due labels mean “check again,” not popularity or taste evidence. No trend facts/statistics are prefilled. Selected-concept research links can be copied with their actual prior fetch dates; support statements and human review remain unconfirmed. See `MIXOLOGY-TRENDS.md`.

Reused the existing autosave/browser-recovery/CAS buffer. Added either-host attributed review, edit-clears-review, immutable source revision history, archive filtering and explicit keyset paging. Invalid/future evidence dates, known signed/credential links and cross-workspace movie references are rejected. Lost review acknowledgment offers explicit shared-state recovery rather than assuming success. These observations do not alter recipes, publication, bartender prompts/rankings or host taste histories. Automatic broad trend collection/provider integration is **not implemented** by this increment; it is a manual evidence/freshness workflow.

Full Node suite: **305 passed** (`artifacts/tests-trend-review.txt`). New SQL/core tests cover evidence requirements, uncertainty/due semantics, permissions, attribution, stale saves, review invalidation, history protection, movie relevance and paging. Trend browser checks pass at 390/1440px through actual isolated SQL with fictional hosts, including offline saves, a committed-but-lost review, shared recovery, source history/reload, movie relevance, archive and movie filters. Stage 2 browser checks also pass for selected-research link reuse, retained dates, deduplication and no automatic support/review claims. Phone review and desktop viewport output were visually inspected; artifacts use `mixology-trend-{review,movie,viewport}-{390,1440}.png`.

The integrated regression run passed trend/research, listener handoff/photo/feedback/variation/idea flows and phone accessibility, then reproduced the existing desktop caret assertion (selection expected 3–8, observed at end). Added connected/active element fields to the existing fixture diagnostic; three isolated accessibility reruns passed both widths without an application focus change. Do **not** call this fixed. Subsequent editor, preparation, media, publication, HQ assembly and cocktail regressions all passed. Earlier media-conflict intermittency also remains open. The final trend browser rerun passed after revision-history response guards and larger link/summary targets.

Prepared **unapplied** migration `20261110101303_mixology_trend_review.sql`; added browser package/CI checks. No new dependency, hosted migration/advisor, deployment, external scheduler/provider change, paid call or production data write occurred. There is no live trend dataset or host-quality/tasting validation in these fixture results.

## Next authorized work

1. Finish acceptance hardening: fix/reliably characterize the intermittent keyboard caret and media-conflict browser assertions using the existing diagnostics. Preserve actual user focus/caret rather than simply relaxing expected results.
2. Implement safe browsing/recovery for older and redacted listener submissions beyond the newest-50 queue limit. Reuse explicit paging patterns where practical; keep private original text and source consent protected.
3. Complete cross-workflow keyboard/source/provenance review and reconcile the manual M12 workflow with the approved scope. It does not implement automatic broad trend collection or feed the bartender automatically; do not describe those as completed. Basic contextual photography guidance already exists and should be refined only for a verified usability gap.
4. Confirm original Q3/Q18/Q19 option wording when available. Real sources/photos, host taste/usability, hosted Auth/PostgREST/storage/proof gateway, Edge-runtime performance, concurrent sessions and backup/rollback remain staging/release checks needing separate authorization. Keep the hourly build active while authorized local fixes/checks remain.

## Prepared migrations and release gates

The following files exist locally only, in order:

1. `20261109195426_mixology_stage1.sql`
2. `20261109214131_mixology_stage2.sql`
3. `20261110010030_mixology_approval.sql`
4. `20261110030632_mixology_production.sql`
5. `20261110032432_mixology_media.sql`
6. `20261110040815_mixology_publication.sql`
7. `20261110051652_mixology_submissions.sql`
8. `20261110071142_mixology_listener_feedback_variations.sql`
9. `20261110081351_mixology_listener_photos.sql`
10. `20261110090800_mixology_listener_photo_handoff.sql`
11. `20261110101303_mixology_trend_review.sql`

Do not apply them to hosted databases under the current authorization. A separately authorized staging pilot must verify real Auth/PostgREST grants and RLS, existing Storage policy composition, Storage API behavior/ownership, cross-device conflicts and retries, backup/restore/rollback, photos and host usability/taste. Keep the separately documented existing production-document policy issue visible in release review without silently changing unrelated HQ behavior.

## Local checks

```text
node --test tests/*.test.mjs
node scripts/mixology-browser-smoke.mjs
node scripts/mixology-production-browser-smoke.mjs
node scripts/mixology-media-browser-smoke.mjs
node scripts/mixology-publication-browser-smoke.mjs
node scripts/mixology-accessibility-browser-smoke.mjs
node scripts/mixology-trends-browser-smoke.mjs
node scripts/mixology-listener-handoff-browser-smoke.mjs
node scripts/mixology-listener-photos-browser-smoke.mjs
node scripts/mixology-listener-types-browser-smoke.mjs
node scripts/mixology-submissions-browser-smoke.mjs
node scripts/mixology-stage2-browser-smoke.mjs
node scripts/cocktail-browser-smoke.mjs
node scripts/hq-browser-smoke.mjs
```

Installed dependencies are already present. On this machine set `PLAYWRIGHT_BROWSERS_PATH=C:/Users/nkesler/AppData/Local/ms-playwright` for the installed Chromium. Local browser fixtures need localhost permission outside the execution sandbox. No new dependency installation or paid-provider activation is needed for these checks. Screenshots and test logs are under ignored `artifacts/`; inspect real rendered output when changing UI.


## Deployment-attempt verification
Fresh Node suite: 305 passed. Fresh HQ fixtures passed four viewport sizes. Desktop caret failure was characterized: trace shows selection applied to a disconnected input. The test now resolves the current input and sets selection plus render in one browser task, retaining the exact caret assertion; corrected accessibility suite passed 390/1440px. No application focus change. See MIXOLOGY-DEPLOYMENT.md for access blocker and release sequence. Deployment remains pending Supabase sign-in; no hosted changes or source push occurred.

## 11:17 UTC continuation
Read the deployment handoff and retained the existing Supabase sign-in request without repeating it. Updated the hourly build prompt to recognize the user's subsequent deployment authorization and the actual local acceptance priorities, preserving its hourly cadence and active status. The schedule continues local build work; it does not claim deployment readiness or completion. Targeted isolated media browser check passed at 390/1440px (format-only pixels, no real photos or live data). This did not reproduce or prove a fix for the historical media-conflict intermittency. No application changes, hosted migration, source push, paid request or publication in this continuation. Older/redacted listener queue browsing and release checks remain outstanding. Supabase authentication remains pending.

## Backend rollout after verified sign-in
The subsequent user deployment request is being executed. All 11 reconciled migrations applied, hosted-role rollback tests passed, all 18 new public tables have RLS, photo bucket is private, anonymous HTTP access is denied, and 17 existing cocktail rows are unchanged. No new security advisor notices. Bartender endpoint deployed protected and paid-disabled; public listener intake remains undeployed/disabled. See MIXOLOGY-HOSTED-ROLLOUT.md for recovery-copy limits and outstanding checks. Frontend release PR #103 is awaiting CI. Do not repeat the superseded Supabase sign-in request.

## 12:40 UTC continuation and user movie-flow correction
Both post-merge main CI runs and Pages publication succeeded for the original release. Local queue hardening adds 50-row timestamp/UUID keyset paging, active queues excluding removed text, a removed-content audit queue, failed-load retention and immediate local text recovery cleanup when shared redaction is discovered. SQL fixture preserves timestamp microseconds. Queue/removed/failed-load/new-arrival/privacy browser checks passed 390/1440; moderation, keyboard and listener-photo handoff regressions passed; Node suite 305 passed. These queue edits remain local and are not part of the movie-only deployment correction.
The user then reported blank spaces and missing movie-based recommendations. See MIXOLOGY-MOVIE-RECOMMENDATIONS.md: a movie picker now opens an automatic recommendations-first screen, reuses canonical/shared work, shows visible ingredients and real match reasons, and defers blank recipe editing. Movie fixture tests pass 390/1440; no paid provider, hosted migration or data rewrite is involved. Movie correction release verification is in progress.

## Approved-answer reconciliation after direct user feedback
The original master handoff was reread through read_thread, including all recoverable turns. Its authoritative M01–M20 table is preserved verbatim in MIXOLOGY-APPROVED-DECISIONS.md. The cached source still does not expose original Q3/Q18/Q19 option wording; preserve their corrected letters without inventing meanings. The user explicitly reaffirmed their answers. Prioritize the approved primary experience, not more secondary form/backend features.
Current movie correction PR #104 addresses automatic movie entry/recommendations, visible source ingredients/matcher evidence, selected-only deep research, canonical reuse and direct editing. It has 306 passing local Node tests plus phone/desktop movie/research checks. Release CI first exposed the historical photo focus race (caption text could land in alt text), now corrected with a deterministic frame-hold regression. The next CI exposed an obsolete manual-Research-click expectation and an overly broad toolbar selector; automatic movie-context source-review coverage and scoped toolbar visibility now pass locally. Current head 42f3adf is undergoing full release checks. No correction is published until those pass.
Do not equate this movie-start correction with completion of the approved product. M05 live conversational bartender remains disabled; M12 has manual evidence review, not ongoing automatic broad collection; M16 has independent records/approvals, not proven balanced/tasted counterparts for every drink; M02/M10 source directions and editable names are not proof of fully developed original recipes/names. Taste-learning evidence is conservative but real host quality and authenticated host browser/storage acceptance remain outstanding. Restoring saved movie context when reopening through every library route needs a focused follow-up; the explicit movie route is covered. Keep these gaps visible, use the approved checklist, and keep paid calls/intake disabled under existing restrictions.

## Movie-first correction deployed
PR #104 merged as 100c57f74a1f629122870023f2c68f02c0274595 after full regression run 42822615070 passed all steps. Pages run 42826536689 succeeded. The correction implements the recovered M01–M03 starting flow: same-workspace movie picker, automatic source-backed directions for empty workshops, ingredients/match evidence visible, selected-only deep research, shared canonical reuse and direct editing access. Existing recommendations are retained rather than automatically replaced. The photo-focus application race is corrected and deterministically tested; movie-specific source-review controls remain accessible. No new migration, paid AI flag, public intake or source-data rewrite was involved. Main-branch post-merge CI is a duplicate verification run, separate from the completed PR checks. Separate queue edits and this checkpoint remain local and uncommitted. The broader approved-product gaps listed above remain open.

## 13:42 UTC continuation — return to saved development
Implemented unique saved-movie context restoration when reopening canonical recipes from the library, including independent variant context and explicit movie/episode priority. Multiple or failed association reads do not silently pick a film or run standalone discovery. Return navigation remains separate. See MIXOLOGY-MOVIE-CONTEXT.md. New context browser tests passed 390/1440; editor, movie, research/conversation, preparation and keyboard regressions passed; Node suite 306 passed. Phone ambiguity/context output was visually inspected. No schema or paid-provider change.
The original movie-correction post-merge main CI run 42826537317 failed during recent-draft reopening: an asynchronous redraw collapsed the open disclosure before the saved-draft click. Preserved the actual same-scope DOM disclosure state across redraws and added a deterministic forced-redraw assertion before opening the draft; strengthened Stage 2 tests pass both widths. This is an application-state fix, not merely a rerun. A reviewable release branch will carry the context/reopening fix; unrelated queue changes remain local.
