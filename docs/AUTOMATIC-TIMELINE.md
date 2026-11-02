# Automatic timeline — first working slice

## Architecture assessment

HQ is a buildless static PWA, deployed by GitHub Pages. `app.js` owns authenticated Supabase state. Existing discovery functions already use server-side TMDB credentials. `watch-along.js` stores local drafts and synchronizes confirmed traits through the shared trait service. `recording-hub.js` stores per-workspace recording sessions and manual timelines locally. `recording-bingo.js` displays imported website card results independently of movie trait selections.

This change was developed from a fresh current-main checkout (`hq-auto-timeline`), leaving the older, modified `movie-finder` checkout intact. It reuses the existing movie selection, landscape recording desk, Watch Along notes, movie trait IDs, session timer, marker persistence and Bingo results. It does not change authentication, private keys or existing storage.

## Implemented

- An evidence-first timeline opens when a movie is selected in Recording. Saved synopsis becomes one untimed plot-outline item; notes and manual timeline entries retain their original source text. No invented scene order or timestamps.
- Authorized SRT/WebVTT import with millisecond offsets, explicit voice labels, sound descriptions, strict timing checks and duplicate-import detection. Two-minute caption windows are explicitly labeled excerpts, not inferred film scenes. No subtitle downloading or streaming access.
- Versioned documents containing stable movie/scene IDs, separate raw source records, four independent evidence/timing/review/source fields, per-host notes, character references, nullable timing and revision numbers. Validation rejects unsupported exact timing.
- Add, delete, duplicate, reorder, merge and paragraph split. Unknown split/merged timing stays unknown. Manual corrections become unverified rather than silently inheriting source verification. User confirmation is independent of evidence status.
- Immediate device-local save, twenty revision snapshots, undo, JSON recovery export, quota warnings and stale-tab write rejection. Pending text remains in memory on save failure. An additional edit retries storage after quota issues; download recovery before closing if still unsaved.
- Selected-scene notes and Pick Up Here bookmark alongside the recording workspace. Existing recording markers gain stable scene ID and separate movie time while retaining HQ elapsed time. No automatic advancement from the session clock.
- Download/copy a plain-text Jenny rundown for Samsung Notes; confirmed movie tropes remain separate from actual Bingo results. No direct Samsung Notes integration.

## Configuration and limits

No new credentials, dependencies, database changes or network calls are required for this slice. Timeline data is **device-local**, not synchronized to Jenny’s phone or backed up to Supabase. A JSON download is a recovery artifact; automatic recovery-file import is not implemented. Recovery can also use the stored revision history before the tab is closed. First creation takes a snapshot of current notes; later Watch Along edits are still visible in the established notes panel but do not silently rewrite scene notes.

This is not the completed production specification. AI extraction/grouping, selective AI regeneration, generated prompts and trope candidate mapping are not connected. Caption excerpts preserve dialogue; they are not generated scene summaries. Timeline selection currently happens in Recording rather than initiating ingestion from every Movie Radar selection. Full browser-offline availability still depends on the existing PWA cache; the timeline itself has no network dependency after loading.

Metadata research: [TMDB movie details](https://developer.themoviedb.org/reference/movie-details) supports lookup by stable movie ID and appended detail endpoints; reuse HQ’s existing server token and validate returned identity before enrichment. [OMDb](https://www.omdbapi.com/) supports IMDb-ID/title/year lookup and full plot, requires an API key, and states CC BY-NC 4.0 licensing. Do not add it to a monetized podcast workflow without confirming appropriate rights. Neither source establishes a timestamped scene sequence. No authenticated provider call or commercial license was claimed or tested.

## Next production gate

1. Add normalized timeline/source/scene tables and revision history through a Supabase migration, with the existing `private.is_workspace_member(workspace_id)` authorization predicate and workspace-consistent movie references. Verify member/nonmember access and compare-and-swap revisions against an isolated test database before deploying.
2. Add an authenticated generation service with schema-validated extraction, input source IDs and quoted evidence anchors. Reject events without support and timestamps not anchored in captions. Treat model output as draft; use field ownership and revisions to protect corrections. Keep AI outside the recording interaction path.
3. Add licensed metadata refresh and explicit title/year/cut resolution. Keep provider region and verified date attached to streaming availability.
4. Add recovery-file import validation and a guided conflict resolution view, authorized Bingo read integration where available, keyboard/manual review and a full practice recording.

## Validation

November 2, 2026: 115/115 Node tests passed. The full browser fixture suite passed at 360, 768, 1024 and 1440 pixels using installed Edge with bundled Playwright. Initial Chromium launch failures were environmental; a note-field accessible-name issue discovered by the browser test was fixed. An existing Tools-menu focus assertion failed once and passed on rerun. The layout expectation now explicitly checks timeline/notes side by side and Bingo below, matching this specification. No production deployment has been made.

Predeployment follow-up: GitHub Actions run 41477901831 passed all production steps, including Chromium HQ/cocktail/songwriting fixtures and songwriting readiness/auth checks. Further recovery cases identified rejected stale-tab text and storage-read-denied text missing from the in-memory recovery draft. The controller now retains both in memory, keeps conflicted drafts from replacing the newer stored revision, and makes the retained edits available in the JSON recovery download. Two additional regressions check the downloaded content and unchanged persistent state.

Run `node --test tests/*.test.mjs` and the existing `node scripts/hq-browser-smoke.mjs` with Playwright available. New Node cases cover malformed captions, offsets, unknown timing, preserved notes, immutable caption ingestion, duplicate handling, evidence validation, scene operations, revision recovery, quota failure, concurrent tabs, export and workspace isolation. The browser runner now exercises actual caption-file upload and note preservation in Recording at its four existing viewport widths with synthetic data. No live movie records, user notes, captions or recordings are modified by these tests.
