# Cheese Louise HQ Improvement Lab — running progress log

This log tracks **reviewable incremental work**. Do not conflate a draft PR with a deployed change. Never write private production records, merge or deploy automatically from this review.

## 2026-11-01, 20:54 MST — REAPER postproduction marker handoff

**Baseline inspected:** `Moldavite333/Cheese-Louise` main at `39c672f`. Recent merged work already supplied a movie timeline (#48), movie-specific Grit songwriting (#49), and a landscape Record desk with live website Bingo card and completed-line highlights (#50). Do not re-propose those features. The main HQ regression workflow and Pages deployment for `39c672f` were successful.

**Gap confirmed:** Recording's Edit tab had a generic six-column editing CSV and copyable lap/marker list, but no CSV compatible with REAPER's Region/Marker Manager. The existing sheet is useful for human review but cannot be directly imported as REAPER markers.

**Change proposed in `lab/reaper-editing-markers-20261101`:** A separate pure REAPER CSV generator exports segment boundaries, live editing markers, and the completed recording endpoint as five-column `#,Name,Start,End,Length` rows with `M1` IDs, `m:ss.mmm` timestamps, stable chronological ordering and CSV escaping. The Edit tab adds **Download REAPER markers** while retaining **Download CSV** and **Copy editing sheet**. Output is derived from the selected movie's existing recording session and never modifies session data. An empty session prompts the producer to start timing or mark a moment.

**Operational constraint:** HQ's timer is not electronically synchronized to the RØDECaster or REAPER. Producers must align the HQ timer with recorded audio before relying on timestamps. REAPER's **Import regions/markers (merge existing)** preserves existing project markers; repeat imports may create duplicates. The feature is not a replacement for audio-backed DAW markers.

**Tests:** Three portable generator tests cover the REAPER header, millisecond timing, escaping, ordering, completed recording and empty/invalid inputs. An additional recording integration test checks the download control, generated CSV and absence of session writes. Portable tests passed locally. GitHub Actions HQ red-team regression checks passed on PR #51 (syntax, all Node tests, assembled HQ browser smoke, cocktail browser smoke, deployed songwriting readiness, and songwriting browser smoke): https://github.com/Moldavite333/Cheese-Louise/actions/runs/41385832041 . A real REAPER GUI import and clock alignment check remain unverified.

**Evidence and reference:** REAPER manual's Region/Marker Manager import/export support: https://dlz.reaper.fm/userguide/ReaperUserGuide734e.pdf ; community-documented native CSV example: https://gist.github.com/X-Raym/509dbbf06a32819f2dbda085a54f3d45 .

### Next priority candidates (not implemented)

1. **Cross-device production state:** Watch Along drafts, movie timelines, linked Bingo square notes and recording sessions remain browser-local. Design authenticated workspace-scoped storage, offline conflict resolution and no-loss migration before writing production tables.
2. **Catalog coverage:** Investigate missing `A Christmas Village` and Hallmark/Lifetime/MarVista/Reel One omissions with source-provenance, exact-title/year and deduplication fixtures. Avoid inventing release metadata.
3. **Episode identity:** Recording is keyed to a movie rather than an episode, so re-recordings of the same movie overwrite one session unless exported. Design episode binding and session history before changing keys.
4. **Final production packet:** After shared state and episode identity are settled, package rundown, credits, marked Bingo squares vs winning lines, edit markers, clips, cocktail and QC tasks into one handoff without redundant note copies.

Keep the current notes-first landscape layout, Nick/Jenny-only HQ access, no-Horror exclusion, confirmed Cheese Traits, Cheese Grating, and human control over Bingo marking.

## 2026-11-02 — Run 14: same-browser recording conflict detection

**Reviewed:** Run 13 checkpoint recovery and draft PR #57. **Implemented on review branch:** compare-before-write protection and same-origin `storage` event detection for HQ recording state. A tab that observes another tab's production-workspace edit becomes read-only, preserving unsaved marker text and preventing stale timer checkpoints, timeline edits, markers and session changes. Three regression tests added. This is not atomic locking or phone/laptop synchronization.

**Verification:** GitHub Actions for the new head had not been observed at the time of writing; prior Run 13 green CI does not validate this change. **No merge or deployment.** Full detail: [Run 14](HQ-IMPROVEMENT-LAB-2026-11-02-RUN14.md). Next: current-head CI, authenticated two-tab verification, then versioned cross-device synchronization and staged release gates.

## 2026-11-02 — Runs 15–16: timeline integration, approved show format, current integration baseline

PR #57 integrated the evidence-first movie timeline and automatic movie research from newer `main`, retaining recording-session history, REAPER export, interrupted-timer recovery and same-browser conflict detection. New sessions now follow the seven-section ~45-minute approved format, with a ~20-second cold open and five-minute Bingo/Cheese Grating ending; historical sessions keep original lap names. **Run 16's exact merge commit passed 177/177 Node tests and configured browser checks.** The research backend, authenticated devices and REAPER GUI were not live-verified. Full logs: [Run 15](HQ-IMPROVEMENT-LAB-2026-11-02-RUN15.md) and [Run 16](HQ-IMPROVEMENT-LAB-2026-11-02-RUN16.md).

## 2026-11-02 — Run 17: recording marker integrity

**Implemented on the same draft branch:** The Mark moment button now requires an active HQ timer, matching the `M` shortcut; paused and pre-start calls preserve unsaved notes. A failed local-storage write retains the note and in-memory marker; retry uses a stable marker ID so neither manual retry nor a checkpoint creates duplicate markers. The recording timestamp, category and note cannot be overwritten by automatic timeline scene metadata. Four Node regressions were added, and four executable targeted V8 runtime checks passed.

**Verification boundary:** The full current-head GitHub Actions workflow has not run yet; the earlier 177-test pass does not validate Run 17. GitHub currently reports the draft PR mergeable and zero commits behind `main`. No main merge, production deployment, backend migration or real-device test. [Run 17 full log and prioritized acceptance matrix](HQ-IMPROVEMENT-LAB-2026-11-02-RUN17.md).

**Next:** Run full current-head CI; validate on Nick's laptop, Jenny's phone, two tabs, and actual REAPER import before any release. Then implement versioned shared episode state rather than another local-only recording feature.
