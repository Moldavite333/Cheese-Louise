# Cheese Louise HQ — Production Studio Lab, Run 19
**Date:** 2026-11-02 (America/Denver)
**Branch:** `lab/hq-six-pr-integration-20261102-run7` · [Draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)
**Scope:** Reconcile current main with the recording integration; no production merge, backend deployment, schema execution, paid AI request, or real user-data mutation.

## Decision and outcome
Nick's current priority is an at-a-glance **visual movie storyboard**, not a new AI provider or an expensive automatic scene reconstruction engine. The latest `main` also added an editable, shareable Watch Along rundown and strictly on-demand movie research. Preserve both while keeping the draft's safe recording sessions, timer recovery, REAPER markers, year-aware recommendations, and Cheese Grating provenance.

**Implemented on the draft PR branch:** a two-parent merge commit `6df46f998f67ac6c6edd11386043b479e262c662` incorporates main `0f8ff4f0da600d8b0885b8e0b22d46db05e5dac1`. This resolves the prior GitHub merge conflict without modifying `main`.

A three-tree comparison against the shared base identified **three true file conflicts**, all reviewed and resolved:
1. `recording-hub.js`: retain the draft's recording guards, timer recovery, seven-section show format, marker handling and storyboard integration. The draft already includes main's scene-context and duplicate legacy-panel suppression.
2. `tests/production.test.mjs`: preserve all draft recording regressions **and** add main's test for editable Watch Along rundown persistence and explicit regeneration.
3. `index.html`: retain the draft's script dependencies/cache keys, use main's new on-demand movie-research client loaded in main's established order, and refresh cache keys for editable Watch Along and main's layout CSS.

The remaining 40 draft-only changed files were retained; 11 main-only changes were retained; common files with identical blobs were not duplicated. Main's research Edge Function and both new SQL migration files are included in the review tree, **not deployed**.

## Verified current code-head CI
- **GitHub Actions:** [run 41533240297](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41533240297), exact merge commit `6df46f998`, completed successfully 2026-11-02 22:00:12 UTC.
- **Node:** 189/189 tests passed; 0 failures.
- **Syntax:** all browser JavaScript checks passed.
- **Assembled Chromium HQ:** synthetic, mocked-auth/data browser fixtures passed at phone, tablet, small laptop, and desktop widths.
- **Other checks:** cocktail mobile/desktop and Grit browser workflows passed.
- **GitHub PR status after merge:** mergeable; zero commits behind main as of the check. PR remains **draft**.
- No real Nick/Jenny notes or sessions, live Bingo room, paid research, RØDECaster recording, or REAPER GUI import were exercised. Do not infer live-device or deployment readiness from CI.

## Workflow research
- [W3C WAI-ARIA carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/): visible Previous/Next controls, predictable keyboard focus, and avoiding unexpected automatic movement. The storyboard is manually navigated and uses arrow/Home/End controls.
- [Riverside recording markers](https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording): active-take markers and the M shortcut support fast edit references. HQ's recording timestamps must remain independent of movie-scene times.

## Codex-ready next implementation and acceptance
**P0 — release gates before merging PR #57:**
1. Verify the PR still contains main's on-demand-only `movie-research.js`, `handler.mjs`, migrations and tests; assert standard storyboard and rundown use make **zero paid AI calls**.
2. Stage backend-first recommendation changes with backwards-compatible `recommend-romantiverse` deployment; verify exact-title/year exclusion with *A Christmas Village* and another same-title/different-year fixture before any client release.
3. In an authenticated test workspace, exercise Nick's laptop and Jenny's phone; prove notes, markers, scene selection, and score provenance are not silently lost. LocalStorage is not cross-device synchronization.
4. In two tabs, verify stale-tab conflict warning and unsaved marker recovery. Close/reopen mid-recording and reconcile the timer against a real RØDECaster take; no phantom elapsed time.
5. Import generated marker CSV into an actual REAPER project and verify timestamp/timebase alignment and scene-link annotations.
6. Confirm the latest PR head's full workflow is green after any further code changes. **Do not merge or deploy until the above are verified.**

**P1 — eliminate one remaining production disconnect:** The new editable `watch-along.js` rundown is stored in `draft.rundownText`, but `recording-hub.js` currently builds recording cues from `outlineItems` and `notes`; manual rundown edits are not explicitly consumed by the recording desk. Codex should inspect the intended separation and, if confirmed, expose a **read-only Saved Rundown** alongside the visual storyboard with explicit `Update from Watch Along` only while paused. Do not replace the visual storyboard, duplicate notes, overwrite a recording snapshot mid-take, or trigger AI. Add tests for edited text, missing text fallback, paused refresh, and resumed session preservation.

**P2 — two-host reliability:** Design conflict-safe shared episode data and sync for Nick/Jenny, preserving provenance and offline edits. First prove current local-only limitations and choose a small safe Supabase contract; avoid an uncontrolled migration.

**P3 — after a real recording:** Offer an optional collapsed read-only storyboard glance layout (scene title, one-line summary, Nick/Jenny note indicators, confirmed tropes, next scene), preserving existing detail editing. Check WAI keyboard/focus behavior at 360/768/1024/1440 px.

**P4 — remaining departments:** Discovery recall benchmark and manual fallback; authoritative Bingo marked squares versus winning lines; verified REAPER editing handoff; episode metadata and publishing checklist from the same episode record.

## Release boundary
The merge is on a **draft integration branch only**. No change to `main`, public HQ, Supabase production, Bingo scores, or live episodes was made in this run. Do not claim otherwise.
