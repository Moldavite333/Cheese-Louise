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
