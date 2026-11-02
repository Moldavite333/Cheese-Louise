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
