# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 15

## Review and release blocker
- Reviewed PR #57 at head `e418dce084` (draft, unmergeable), Run 14, and current `main` at `16bca8831b`.
- `main` advanced by exactly one commit after PR #57 branched: the evidence-first automatic timeline feature (#58). Its changes overlap `index.html` and `recording-hub.js`, explaining the merge conflict. The Run 14 tab-safety implementation must not be replaced with the older main recording desk.
- The main timeline adds licensed/authorized caption import, evidence labels, separate host notes, scene bookmarks and Samsung Notes rundown export. It stores data locally and does not provide phone/laptop sync.

## Integration change
- Merge `main` into the existing PR #57 review branch, preserving its recording recovery, multi-tab conflict guard, REAPER export, session archive, and prediction/verified Cheese Grating protections.
- Add the timeline files and the updated browser smoke harness from `main` without modification; insert its timeline CSS and scripts into the PR HTML in dependency order.
- Integrate `clAutomaticTimeline.html` above the existing manual talk order; retain the legacy editor instead of silently migrating or deleting existing beats.
- Attach the selected timeline scene ID and movie time to new recording markers while retaining their original HQ recording clock, type, and note.
- Add `tests/timeline-integration-contract.test.mjs` to check script order, timeline coexistence and scene-linked marker safety. This is a static integration contract; it does **not** substitute for full Node or real-browser tests.
- Bump only affected asset cache keys. No schema changes, credential changes, production data writes, backend deployment, or main merge.

## Verification and release gates
- Verify the PR head contains both parents (the existing PR branch and `main`) and GitHub no longer reports a merge conflict.
- **Full current-head Node and browser CI remains required.** Previous 143/143 tests cover the old PR head, while the separate timeline branch reported 115/115 tests; neither proves this combined head is green.
- Run authenticated laptop/phone and two-tab checks, verify actual REAPER import, confirm saved-title search for *A Christmas Village*, and coordinate backend-first recommendation deployment with rollback.
- Confirm the timeline's source/rights labels, recoverability, storage quota, and marker/movie-time vs recording-time distinction. Do not claim cross-device sync.

## Next priorities
1. P0: Obtain CI for this exact merge head, resolve failures, complete staged/authenticated release tests.
2. P1: Versioned shared episode/session storage with workspace-scoped RLS and explicit conflict resolution; preserve local backups and never auto-merge simultaneous timer edits.
3. P1: Source/date-aware streaming catalog verification across Hallmark, Lifetime, MarVista and Reel One.
4. P1: Authoritative Bingo results import and verified Cheese Grating in the five-minute ending.
5. P2: Migration-safe segment template for 20-second cold open, theme, welcome, cocktail, discussion and Bingo reveal; preserve existing lap history.

## Codex-ready release acceptance matrix

**P0 — integration QA (run on the exact merge head; no deployment):**
1. Run `node --test tests/*.test.mjs` and `node scripts/hq-browser-smoke.mjs` with the project's documented Playwright browser setup. Capture test count, failures, commit SHA and Actions URL. Do not reuse earlier branch counts.
2. On desktop widths 1024/1440 and mobile widths 360/768, open Recording. The evidence-first timeline must appear above the existing manual talk order; Nick/Jenny notes, movie scene navigation, timer, and Bingo must remain reachable without horizontal overflow.
3. Import an authorized WebVTT/SRT fixture. Confirm captions are labeled navigation excerpts, timestamps are source-supported, and scene selection survives a redraw. Record a marker and verify `scene_id`, `movie_time_ms`, HQ `atMs`, type and note. Legacy markers without scene fields must still render and export to REAPER.
4. Open two tabs on the same workspace, start a timer and add a marker in tab A, then attempt a stale write in tab B. Tab B must not overwrite A; its unfinished marker text must survive. Reload after a simulated interruption: no fabricated gap without explicit reconciliation.
5. Test denied/quota-exceeded localStorage: timeline recovery download includes unsaved Nick/Jenny text; persistent records remain unchanged. Check keyboard focus, accessible labels and screen-reader status messages for conflicts.
6. Test authorized/unauthorized account access and phone/laptop behavior. Browser-local timeline and session data must be explicitly described as **not synced**. Do not assume Jenny's phone sees Nick's laptop notes.
7. Verify the exact saved-title `A Christmas Village` (2018, TMDB 558815), historical Cheese Grating discrepancy labels, no predicted-to-verified promotion, and authoritative Bingo marked-square/winning-line separation.
8. Deploy the recommendation Edge Function to an isolated staging environment **before** its new client, verify year-aware identity and old-client compatibility, then test REAPER import and rollback. No production write, migration, or main merge until sign-off.

**P1 — next Codex implementation after P0 passes:** Introduce workspace-scoped, authenticated `episode_documents` and `episode_revisions` with immutable revision IDs, optimistic concurrency (expected revision), Supabase RLS using the existing workspace-membership predicate, idempotent append-only recording markers, per-host note ownership, and explicit conflict-copy recovery. Start with Watch Along/timeline notes; do **not** put live timers under last-write-wins replication. Preserve device-local backup and offline edit queues. Test two authenticated hosts editing separate notes, concurrent edits to one note, offline reconnect, revoked membership, duplicate marker retries, and cross-workspace isolation. Treat authorized subtitle text as sensitive licensed input: no automatic external upload or public sharing.

**P1/P2 — product roadmap, without duplicating implemented work:** Discovery source/region/date provenance and coverage metrics; authoritative Bingo import and five-minute Cheese Grating reveal; migration-safe episode segment IDs for cold open (~20s), theme, welcome/banter, cocktail, discussion, Bingo reveal and closing (Horror-fied optional, not mandatory); REAPER EDL/chapters with source-labelled suggested cuts; and publishing checklist/feedback. Keep the Recording desk landscape-first and prioritize conversation over dashboards.
