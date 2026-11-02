# Cheese Louise HQ — Production Studio Lab, Run 17
**Date:** 2026-11-02 (America/Denver)  
**Branch:** `lab/hq-six-pr-integration-20261102-run7` · [Draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)  
**Scope:** Recording marker integrity; no schema, production-data, Supabase, deployment, or main-branch changes.

## Review of prior work
Runs 7–16 integrated REAPER export, recording history, timer crash recovery, same-browser stale-tab guard, evidence-first timeline, movie research, and the approved ~45-minute seven-section format. Run 16 verified **177/177** Node tests on its earlier integration head. That result does **not** verify Run 17.

## Highest-impact issue found
The visible **Mark moment** button could add an editing marker while the HQ timer was stopped, unlike the guarded `M` shortcut. Such markers could have misleading recording timestamps. The handler cleared the marker note before storage confirmed the save, risking loss of a producer's unsaved text. In addition, automatic timeline metadata was spread after recording fields and could overwrite the authoritative recording time/category/note if its return contract changed.

Professional reference: [Riverside: add markers while recording](https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording). Riverside gates marker creation to an active recording, accepts the `M` shortcut, and allows optional comments. REAPER's [user guide](https://dlx.reaper.fm/userguide/) remains the downstream reference for real marker-import validation.

## Implemented (review branch only)
1. Disabled **Mark moment** while the HQ timer is stopped, finished, or awaiting interrupted-session recovery. Direct handler calls are also rejected without clearing the note. The existing `M` shortcut behavior is unchanged.
2. Propagated the local-storage save result through `save()` and `update()`. The input clears **only after confirmed persistence**.
3. If a write fails, keep the draft and the marker in in-memory recovery. A subsequent click retries the same marker (stable `markerId`), retaining its original recording timestamp; it does not insert a duplicate. This also covers a checkpoint saving the marker between failure and manual retry.
4. Explicitly whitelist timeline `scene_id` and `movie_time_ms` before constructing the marker; the HQ recording `atMs`, category, and note remain authoritative.
5. Updated the recording script cache key and added four regression tests in `tests/production.test.mjs`.

## Verification
- **Passed:** Four targeted, executable V8 runtime checks against the exact updated `recording-hub.js` source: inactive/paused guard; failed-save retry; checkpoint/retry idempotence; scene metadata isolation.
- **Added, not yet CI-verified:** Four Node regression tests for those cases.
- **GitHub:** PR #57 remains draft. Compare reports zero commits behind `main` as of this run; GitHub reports mergeable.
- **Not verified:** Full current-head GitHub Actions, authenticated Nick/Jenny laptop/phone sessions, actual REAPER GUI import, live Supabase research and recommendation backend. Connector-authored commits have not yet produced a PR workflow run for this head. Do not quote Run 16's 177 tests as Run 17's test count.

## Codex-ready next release gate (P0)
1. Run `node --test tests/production.test.mjs` and the full configured CI suite on the **latest** PR head. Investigate failures before merging.
2. In two real browser tabs, start a recording, add markers, simulate a second tab edit, verify stale-tab read-only behavior, draft preservation, and successful REAPER export.
3. On Nick's laptop and Jenny's phone, verify the approved cold open → theme → banter → cocktail → movie discussion → five-minute Bingo/Cheese Grating → closing sequence. Reload during a running timer; compare recovery choices against the actual RØDECaster audio.
4. Import exported CSV in REAPER with a short reference recording; compare at least three marker positions against the waveform, including one after pause/resume. Do not assume HQ time and audio time are aligned without a deliberate start/sync procedure.
5. Verify authenticated movie search for *A Christmas Village*, year-aware deduplication, sources and timestamps, and backend-first Supabase function rollout in staging. No production migration until approved.

## Prioritized six-department roadmap (avoid duplicate implementation)
| Priority | Department | Next incremental deliverable | Acceptance |
|---|---|---|---|
| P0 | Recording / release | CI + real-device + REAPER staging gate for PR #57 | Current-head suite green; no marker drift, missing notes, or stale-tab overwrite |
| P1 | Preproduction / Recording | Versioned shared episode record with conflict-safe Nick/Jenny synchronization | Offline edit replay, revision conflicts, distinct host notes, no silent overwrite |
| P2 | Discovery | Source-backed catalog coverage audit for Hallmark/Lifetime/MarVista/Reel One | Exact-title/year matches, verified credits, dated availability evidence, measured recall |
| P3 | Bingo | Read-only authoritative game-result snapshot into HQ | Marked squares distinct from completed lines and winners; verified tropes separate from predictions |
| P4 | Postproduction | Export validated edit decision list, chapter suggestions and REAPER marker offsets | Every suggested cut labeled unverified until reviewed against actual audio |
| P5 | Publishing | Episode metadata, social draft and release checklist from one episode object | No duplicate entry; source/rights/privacy flags; publish only by explicit action |

**Preserved:** Cheese Grating terminology, evidence labels, two-host unscripted conversation, no compulsory Horrorfied, no live Bingo mic play, existing archives and prior REAPER labels. **No deployment or merge performed.**
