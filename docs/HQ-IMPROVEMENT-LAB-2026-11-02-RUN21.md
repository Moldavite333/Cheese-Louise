# Cheese Louise HQ — Production Studio Lab, Run 21
**Date:** 2026-11-02 (America/Denver)
**Review branch:** `lab/hq-six-pr-integration-20261102-run7` — [Draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)

## High-impact increment: scene-at-a-glance storyboard

Inspected the existing `automatic-timeline.js`, `automatic-timeline.css`, `recording-hub.js`, the storyboard tests, and the Run 20 roadmap. The storyboard already supported scene order, full details, host notes, Next/Previous, and keyboard navigation. This increment does **not** duplicate those features.

### Changes implemented on draft branch
1. Scene cards now display a compact **one-line event** while the full summary remains available in the selected scene detail.
2. Distinct **Nick** and **Jenny** note indicators improve scanning.
3. Scene cards show a **linked-trope count** only when a scene was manually linked to a movie-confirmed trope. Synopsis predictions and unknown trope IDs do not receive a confirmed badge. This is not a Bingo-square or winner count.
4. The storyboard shows **Up next: [scene title]** without generating scene text or assuming movie timestamps.
5. CSS supports small screens and wraps crowded indicators rather than clipping them; existing card selection and keyboard navigation remain.
6. Refreshed storyboard asset cache keys, added two Node regression tests.

**Files:** `automatic-timeline.js`, `automatic-timeline.css`, `tests/automatic-timeline.test.mjs`, `index.html`.

### Test and review status
- JS source parsed successfully during code transformation; code and tests committed on the review branch.
- Initial CI on `54fccafe` ran **192/193 tests** and found a mistaken test fixture selection: the fixture already contained a Watch Along observations scene between the synopsis and the newly added scene. The test was corrected to select the actual preceding scene. No production behavior was changed to accommodate that test.
- Corrected test commit: `6877646`; asset-version commit: `8baa467`.
- **Full CI on the final code head must be checked before claiming a pass.** [Current code-head workflow](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41550208077).
- No authenticated live laptop/phone test, REAPER import, Supabase deployment, PR merge, or production deployment was performed.

### Research and design guardrails
- [W3C WAI carousel guidance](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) supports explicit Next/Previous navigation, predictable keyboard focus, and no automatic movement. Our scene strip is a manually navigated sequence, not an auto-rotating slideshow.
- [REAPER 7 user guide](https://dlx.reaper.fm/userguide/) confirms marker import through the Region/Marker Manager, but HQ's exported CSV still requires actual REAPER GUI and RØDECaster timebase validation.
- [Riverside clip-marker guidance](https://support.riverside.fm/hc/en-us/articles/14046222713117-Can-I-redact-censor-or-bleep-out-parts-of-the-recording) describes the M shortcut for marking a moment; HQ's existing guarded M shortcut remains untouched.

## Prioritized roadmap across the six departments
**P0 — release integrity (all six):** Exact-head green CI; authenticated Nick laptop/Jenny phone; cross-tab conflict and crash recovery; Supabase backend-first compatibility; confirm normal rundown generates without AI charges; actual REAPER marker import/timebase test. Keep PR #57 draft until verified.

**P1 — two-host note integrity (preproduction/recording):** Specify conflict-safe, opt-in Supabase synchronization for scene notes and episode rundowns, preserving authorship, revision IDs, offline recovery and non-destructive merge. Do not silently replace browser-local drafts. Test simultaneous edits from both devices, offline reconnection, and same-scene conflicts before migration.

**P2 — movie discovery:** Establish a fixed difficult-title benchmark across Hallmark/Lifetime/MarVista/Reel One, including `A Christmas Village`, same-title different-year titles, missing credits, and manually entered titles. Record exact-title recall, source URLs, dates, and actual errors before adding another API. Do not invent streaming availability.

**P3 — authoritative Bingo handoff:** Secure, read-only per-episode snapshot of real marked squares, winning lines and winners. Keep confirmed versus predicted tropes and Cheese Grating separate. No Bingo gameplay on mic.

**P4 — postproduction:** REAPER-compatible marker/EDL export with user-supplied recording time, scene movie time, cut suggestions, and verified audio-analysis status clearly separated.

**P5 — publishing and feedback:** One episode record supplies show notes, verified credits, clip checklist, and manually approved social copy. Avoid duplicate data entry, autopublishing and unsupported analytics.

### Codex acceptance tests for the next increment
- Both hosts edit different scene notes on separate devices; neither note disappears.
- Two edits to the same field surface a conflict and preserve both versions; no last-write-wins silent overwrite.
- Offline notes remain recoverable, with explicit sync status and stable scene IDs.
- Recording continues if sync is unavailable, and no new AI/API dependency is introduced.
- Previously verified trope and Bingo records are never changed by synchronization.
