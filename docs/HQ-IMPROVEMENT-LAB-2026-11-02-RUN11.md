# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 11

## Baseline and verified release state
- Reviewed Run 10 and current open **draft** integration PR #57; previous fixes cover REAPER export, recording history, title/year identity, saved-title visibility, predicted/verified Cheese Grating separation, and legacy score provenance. Do not reopen these as duplicate proposals.
- The branch is **not merged or deployed**. The production Cheese Louise Supabase project still lists `recommend-romantiverse` as active version 9, last updated **2026-11-01 01:52 UTC**. Read-only inspection confirms its deployed recommendation code excludes by normalized title, unlike the year-aware branch change. **Backend-first coordinated release remains mandatory.**
- Existing local recording history is browser-local; there is no verified cloud sync or recorder-clock synchronization.

## Highest-impact new finding: accidental recording interruption
- In `recording-hub.js`, changing the movie dropdown while the HQ timer was running silently stopped the timer, saved the elapsed time, and switched to another movie. A stray selection in the recording desk could interrupt a live take without warning.
- **Implemented on PR #57's existing integration branch:** block movie changes during an active take, show a clear instruction to pause first, and redraw the original selection. Re-selecting the current movie is a no-op. Paused sessions can still be switched and remain intact.
- **Regression added:** start timer, advance, add marker, attempt movie switch, assert original session and timer unchanged, marker retained, warning shown, dropdown restored; then pause and confirm normal switch preserves elapsed time and marker.
- This is a narrow reliability correction, not a new recording workflow or a database change. It does not affect REAPER exports or archived sessions.

## Research applied
- Riverside's documented recording workflow uses in-session markers with optional comments that appear in the editor, supporting HQ's low-friction marker + postproduction handoff design: https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording
- REAPER User Guide 7.84, Region/Marker Manager section: import merge and import replace are distinct; a repeat merge can duplicate markers. HQ should keep its explicit merge/duplicate warning and require a real REAPER GUI import before release: https://dlx.reaper.fm/userguide/
- W3C WCAG 2.2 calls for keyboard accessibility, visible focus, and non-color-only status communication; retain textual warnings and test dropdown behavior with keyboard and touch: https://www.w3.org/TR/WCAG22/

## Verification and remaining release gates
- **Verified on code head `e04c126`: 139/139 Node regression tests passed, zero failures; browser script syntax, assembled Chromium HQ, mobile/desktop cocktail, and Grit songwriting checks passed.** [GitHub Actions run 41460606183](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41460606183). An intermediate run failed because the older session-switch test expected the now-prohibited silent auto-pause; that test was updated to explicitly pause before switching, then the entire workflow passed.
- **Not verified:** authenticated Nick/Jenny device flow, actual RØDECaster/REAPER clock alignment and import, live exact-title search for *A Christmas Village*, full staging rollout, or cross-device synchronization.
- No production Supabase writes, schema changes, function deployments, or main-branch merges.

## Evolving prioritized roadmap (six departments)
1. **Release safety / recording (P0):** finish PR #57 integration CI, authenticated landscape/phone keyboard-touch checks, active-timer protection, REAPER GUI import, backend-first rollout contract, and no-loss rollback plan. Do not merge/deploy automatically.
2. **Preproduction + recording (P1):** design conflict-safe, per-episode Nick/Jenny Watch Along and recording-session synchronization with device-local recovery, idempotent updates, and explicit version/provenance. No overwriting either host's notes. Validate offline edits and reconnect collisions before rollout.
3. **Discovery (P1):** reproduce *A Christmas Village* saved-title visibility in authenticated HQ; add coverage matrix across Hallmark/Lifetime/MarVista/Reel One and streaming catalogs with sourced dates, verified credits, title/year/provider IDs, and missing-result diagnostics.
4. **Bingo (P1):** end-of-show results should distinguish **marked squares**, **completed winning lines**, **player winners**, and **confirmed Cheese Grating**; never turn a Bingo mark or predicted trope into verified movie evidence. Test Nick and Jenny's distinct cards.
5. **Studio UX (P2):** compare the existing six-segment desk to the approved ~20-second cold open, theme, banter, cocktail, movie discussion, five-minute Bingo/Cheese Grating reveal. Preserve legacy session segment indices until a migration plan exists; use landscape and mobile usability tests to reduce cognitive load.
6. **Postproduction + publishing (P2):** maintain REAPER edit-marker export and clear source provenance, then build verified episode metadata, edit decisions, show-note drafts and a small publish checklist. No claims of AI audio analysis without actual audio input.

## Next incremental task
After CI and device checks, prioritize an explicit **release readiness checklist** and staging/rollback test for PR #57. Only after safe integration should the lab implement cross-device data sync; avoid another standalone feature branch.


### Codex-ready release acceptance matrix (not yet executed on real devices)
1. **Recording:** Start a take on Movie A, add a marker, attempt dropdown switch to Movie B. Require a warning, unchanged timer/markers, and Movie A still selected. Pause and switch; require Movie A's elapsed time and markers to remain recoverable after reload.
2. **Search:** Authenticated exact search for *A Christmas Village* (2018) must return the saved movie with **Open saved movie**; a filtered exact match must be visibly labeled, not silently omitted. Same title/different year must remain a distinct identity.
3. **Scoring:** Add a recommended movie and preview synopsis tropes. No `movie_traits` writes until Nick or Jenny individually confirms observed traits. Compare verified Cheese Grating to the checked-trait sum; legacy raw values remain preserved for audit.
4. **Bingo:** Link Nick and Jenny's separate cards; verify marked squares, completed lines and winners are distinct, and the free center is not counted as an observed square. No Bingo action may confirm movie traits.
5. **Postproduction:** Archive, restore, export REAPER CSV, import into a test REAPER project, align the HQ timer to the recorder timeline, and verify marker names/times. Warn before a duplicate merge import.
6. **Rollout:** Verify the year-aware recommendation function on staging first; then deploy the client. Preserve a rollback to the previous function/client versions and never rewrite production Cheese Grating history automatically.
