# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 12

## Prior work and release state
- Reviewed Run 11 and open draft integration PR #57. Do not duplicate the six integrated PRs or the previous Cheese Grating provenance, saved-title visibility, recording-session archive, REAPER export, or active-timer movie-switch protections.
- PR #57 remains an integration candidate, not a production release. No production schema, records, Edge Functions, or deployed client were changed in this run.
- Authenticated Nick/Jenny phone/laptop testing, staging rollout, actual REAPER marker import, and *A Christmas Village* live search remain unverified.

## Highest-impact safe increment: one-key editing markers
**Problem:** During a two-host conversation, moving to a marker button interrupts the flow and makes the recording desk feel like a notes app. The existing marker button is still needed on mobile and for accessibility.

**Implemented in the existing PR #57 branch:**
- Press **M** while the HQ recording timer is running and the Record desk is active to insert a timestamped **Funny / Clip** (or selected category) marker. The existing Mark moment button remains available.
- The shortcut ignores input, textarea, select, button, contenteditable, modal/dialog targets, modified keys, repeated keys, composition events, prevented events, paused/finished sessions, and non-recording views.
- A compact on-screen hint explains the shortcut. The marker button advertises `aria-keyshortcuts="M"`.
- Uses the existing `clProduction.mark()` path, existing local-first persistence, marker categories, edit sheet and REAPER export. No new database tables, APIs or duplicate marker implementations.

**Tests added:** One regression test checks active recording timestamp, button/hint, blocked editable and dialog contexts, key modifiers, repeats, paused state and other views. The isolated test harness now supports keydown registration. Existing marker and REAPER export tests remain in place.

**CI:** An initial run (https://github.com/Moldavite333/Cheese-Louise/actions/runs/41471535333) had 139 passes and one new-test failure because the mocked view had not been rendered before checking its hint. This was a **test setup error**, not a production code error; the test now explicitly renders the view. **Verified:** final code + log head `13875fc` passed **140/140 Node regression tests**, browser JavaScript syntax, assembled Chromium HQ, mobile/desktop cocktail tests, deployed songwriting readiness, and Grit browser tests in [GitHub Actions run 41471744868](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41471744868). This is CI verification only, not authenticated device or real REAPER import verification.

## Research and technical rationale
- Riverside supports in-studio markers with optional comments and documents an **M** keyboard shortcut: https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording
- REAPER's Region/Marker Manager imports and exports marker lists; HQ's CSV still requires manual import and clock alignment: https://dlx.reaper.fm/userguide/
- W3C WCAG 2.2 requires keyboard operation without traps and meaningful focus behavior. A shortcut must never hijack text entry; a visible button remains available: https://www.w3.org/TR/WCAG22/

## Acceptance criteria
1. On desktop, while a session is actively recording, pressing unmodified M outside editable controls creates **exactly one** timestamped marker using the selected marker category.
2. Typing M into the marker note or another text field never creates a marker. Modified/repeated M, open dialogs, and paused/finished or non-recording views do not create markers.
3. Mobile/touch retains the Mark moment button; the shortcut never replaces it.
4. Existing recording history, movie switching protection, REAPER CSV export, and Cheese Grating regression tests pass.
5. Actual Nick/Jenny devices and REAPER import still require manual validation; do not merge/deploy solely on isolated CI.

## Prioritized next work across six departments
1. **P0 Release/QA:** Finish combined PR #57 CI, authenticated landscape/phone smoke, real REAPER marker import, backend-first year-aware recommendation rollout staging, rollback rehearsals. Never auto-merge or deploy.
2. **P1 Recording/preproduction:** Detect interrupted or stale local timer sessions after mobile browser termination. Do not silently count hours away as recorded audio; design a recover/verify-against-recorder flow with tests for tab reload, crash, bfcache and multi-tab edits. Then build conflict-safe shared Watch Along/recording state without overwriting Nick or Jenny.
3. **P1 Discovery:** Reproduce *A Christmas Village* exact saved search; add coverage/metadata-source matrix for Hallmark, Lifetime, MarVista, Reel One and streaming catalogs.
4. **P1 Bingo:** Confirm distinct marked squares, completed winning lines, actual winners and confirmed Cheese Grating in the final five-minute reveal; no AI predictions as observed traits.
5. **P2 Studio UX:** Preserve current segment indices until a migration exists; align future rundown with the approved 20-second cold open, theme, welcome/banter, cocktail, discussion, Bingo/Cheese Grating ending without clutter.
6. **P2 Postproduction/publishing:** Verified edit decision list, REAPER marker offsets, chapter candidates, show notes and small publishing checklist; distinguish user-recorded markers from unverified AI suggestions.
