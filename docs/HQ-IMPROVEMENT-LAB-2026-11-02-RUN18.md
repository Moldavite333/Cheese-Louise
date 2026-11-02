# Cheese Louise HQ — Production Studio Lab, Run 18
**Date:** 2026-11-02 (America/Denver)  
**Branch:** `lab/hq-six-pr-integration-20261102-run7` · [Draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)  
**Scope:** Evidence-first visual movie storyboard and stale CI assertion correction. No production data, paid API, database migration, merge, or deployment.

## User decision superseding earlier AI expansion
Nick clarified that the core problem is not missing AI credits or an advanced automated research engine. The actual recording friction is that the movie timeline is a string of text rather than an at-a-glance chronological storyboard. Prioritize a scene rail and focused detail pane; keep TMDB/Supabase as-is, no local installation, and no paid AI dependency.

## Repository audit
- `automatic-timeline.js` already creates an evidence-first, editable scene document with selected scene, source links, timestamps, separate Nick/Jenny notes, caption imports, research merge, bookmark, undo, and export.
- `automatic-timeline.css` previously rendered a narrow vertical list beside a dense editor, not a visual filmstrip.
- `recording-hub.js` still renders a second **Manual talk order** panel below the evidence-first timeline; keep for compatibility until a safe migration/consolidation is designed.
- `timeline-core.js` explicitly warns that untimed synopsis and notes do not establish chronological order. Do not turn source snippets into verified scene boundaries.
- Previous Run 17 current-head Actions run [41516539552](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41516539552) failed **180 passed / 1 failed**: `tests/timeline-integration-contract.test.mjs` still asserted the old spread-based marker insertion even though Run 17 intentionally whitelisted fields. The test also contained stale inline/old session guard patterns.

## Implemented on review branch
1. Changed evidence-first timeline scene navigation into a horizontal, scrollable **Movie storyboard** rail with selectable cards, scene index, movie timestamp or **Time unknown**, short escaped preview, review status, and Nick/Jenny note indicators. Full text stays in the selected scene detail pane.
2. Responsive CSS uses touch-friendly filmstrip cards on mobile and a one-column scene rail over detail view on laptop, reducing nested scrolling and preserving existing edit controls.
3. On selection, preserve the rail's scroll position and restore focus when selection came from keyboard; scroll the selected card into view.
4. Limit preview DOM text to 160 characters without changing the saved scene or the detailed editor.
5. Updated asset cache keys in `index.html`.
6. Added `tests/timeline-storyboard.test.mjs` with three tests for scene cards, note persistence/selection, and responsive filmstrip wiring.
7. Corrected `tests/timeline-integration-contract.test.mjs` to assert the **current guarded marker implementation** instead of the intentionally removed unsafe object spread and old guard layout.

## Verification (be precise)
- **Passed:** V8 syntax compilation of `automatic-timeline.js` and `timeline-core.js`.
- **Passed:** Executed actual timeline engine/controller in an isolated V8 harness: two cards from synopsis + notes, one selected card, timestamp-unknown cue, escaped preview, host note edit, scene selection, local persistence, and redraw.
- **Passed:** Additional HTML-escaping smoke with hostile synopsis: escaped tags, no raw markup.
- **Passed:** Static contract checks against the exact latest `recording-hub.js`: guard, interrupted timer, inactive timer, stable marker ID, whitelisted movie time, and authoritative HQ recording time.
- **Not yet verified:** New-head official Node/Chromium CI, authenticated laptop/phone usability, mobile horizontal scroll, actual REAPER marker import, backend deployment. GitHub connector file commits do not themselves establish a new Actions run.
- **No claim of live deployment.** PR remains draft.

## Acceptance criteria for Codex / release QA
1. On a laptop, a 20-scene movie shows a horizontal rail without turning the page into 20 paragraphs; click scene 12 and its full notes appear beneath, with one selected card.
2. On Jenny's phone, swipe horizontally through scenes; after tapping a distant card, it stays visible. Focus and tab order remain usable with keyboard/screen reader.
3. Show Nick/Jenny note badges only when corresponding notes exist; full notes remain separate and editable. Existing scene IDs, evidence labels, manual edits, export, and recording markers survive refresh.
4. Unknown movie time is **Time unknown**, never fabricated. Synopsis and research beats remain drafts until human review.
5. No AI or paid API call is required for scene navigation or rendering.
6. Full CI on latest head passes, and two-tab/storage failure tests still preserve edits. Verify the official test count only from that run.
7. Existing legacy Manual talk order remains functional until an explicit, lossless migration is tested.

## Updated priority roadmap
| Priority | Department | Next action | Release acceptance |
|---|---|---|---|
| P0 | Recording / QA | Full current-head CI, laptop/phone two-tab tests, REAPER marker import and staging gates | No lost notes, false timestamps, marker drift, or stale-tab overwrite |
| P1 | Preproduction / Recording | Consolidate the duplicate Manual talk order into a collapsed legacy panel or safely migrate into storyboard; add read-only glance mode | One obvious movie timeline, no duplicated edits, full backward compatibility |
| P2 | Preproduction | Conflict-safe shared episode notes for Nick's laptop and Jenny's phone | Offline edits and revisions never silently overwrite another host |
| P3 | Discovery | Measure TMDB recall for Hallmark/Lifetime/MarVista/Reel One and improve exact-title/year fallback | Known titles found or manually entered with provenance; no paid AI needed |
| P4 | Bingo | Display authoritative read-only marked squares, winning lines and winners | Never confuse marked squares with completed Bingo lines or predicted tropes |
| P5 | Postproduction | Validate edit decision list and REAPER markers against real RØDECaster audio | Suggestions labeled unverified until listening confirms them |
| P6 | Publishing | Generate metadata and checklist from same episode record | No duplicated data entry, explicit publish action |

## Relevant professional workflows
- [Descript: storyboard view and adjustable timeline](https://help.descript.com/hc/en-us/articles/10164575118989-Auto-scrolling) — scenes are navigable visual units, with hideable panels.
- [Riverside: recording markers](https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording) — markers only during an active take, with optional comments.

**Next engineering rule:** Do not spend another sprint on AI credits until the visual timeline and reliable two-host workflow are verified in a real recording.
