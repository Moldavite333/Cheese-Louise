# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 13

## Review of prior work and implementation
- Inspected current draft integration PR #57, Run 12 log, `recording-hub.js`, `tests/production.test.mjs`, and existing recording/archive/REAPER flows.
- Previous Run 12: 140/140 Node tests, keyboard marker shortcut and combined browser checks passed. The six-PR integration remains **draft, not merged or deployed**.
- New defect: a persisted `runningSince` timestamp was used as `Date.now() - runningSince` after a browser restart. An interrupted HQ page could therefore show hours of fabricated recording time, corrupting later marker timestamps and REAPER alignment. The RØDECaster is the source of truth for recorded audio.

## Highest-impact incremental change — interrupted timer reconciliation
**Implemented on the existing PR #57 branch (not production):**
1. Add a persisted checkpoint when starting a timer, every 5 seconds while visible, on the transition to hidden, and on pagehide if still visible. Do not rely on unload or assume mobile lifecycle events always fire.
2. On a fresh page load with a persisted running timer, enter **pending recovery** without modifying the saved session. Freeze the displayed elapsed time at the last persisted checkpoint (or at the prior elapsed value when an older session has no checkpoint).
3. Show a compact, accessible `role="alert"` banner with two deliberate choices: **Pause at checkpoint** (discard unverified gap) or **Continue counting gap** (only after confirming RØDECaster recorded continuously). Explain that another HQ tab may still be recording and that audio/marker alignment must be checked.
4. Block editing actions and keyboard marker shortcuts until the interrupted timer is reconciled. Preserve existing markers and unsaved marker text. Keep normal in-tab recording behavior and never silently pause when a user switches apps.
5. Clear checkpoints when explicitly pausing or finishing; retain all previous session history, movie-switch protection, and REAPER export behavior.
6. No backend, schema, movie, Bingo, or production-data changes. Checkpoints are local browser state, **not** a cross-device sync solution.

**Regression tests added:** crash/reload with one-hour gap and marker preservation; explicit continuous-recording choice and legacy checkpoint-less recovery; hidden/pagehide persistence without background inflation. Existing recording/marker tests remain in the same suite.

## Research and feasibility
- Chrome's Page Lifecycle guidance recommends saving on `visibilitychange` to hidden and cautions that `pagehide`/unload may not fire on mobile: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- MDN documents hidden-tab timer throttling: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- REAPER marker import remains a manual, clock-aligned postproduction step: https://dlx.reaper.fm/userguide/
- The browser clock is **not** the RØDECaster's recording clock. This feature prevents silent elapsed-time inflation on restart; it does not prove audio timestamps, account for device clock changes, or resolve concurrent edits across two tabs/devices.

## Acceptance and release criteria
1. Active in-tab timer and quick M marker continue to work; checkpoint writes do not redraw the recording desk or lose notes.
2. Reload/crash with a persisted running timer displays a frozen, bounded checkpoint and requires explicit reconciliation; no data mutation merely by opening HQ.
3. **Pause at checkpoint** retains markers and verified elapsed time without counting a long browser-closed gap; **Continue counting gap** requires confirmation.
4. Typing or clicking markers before reconciliation cannot clear the draft or alter the session.
5. Hidden-tab and pagehide checkpoints survive simulated reload; older sessions without checkpoints conservatively retain prior elapsed time.
6. Full Node tests, assembled Chromium HQ, mobile/desktop cocktail and Grit regressions must pass. Authenticated phone/laptop and actual REAPER import remain manual release gates.
7. Do not merge/deploy PR #57 without staged backend-first year-aware recommendation rollout and a rollback plan.

## Next prioritized work (six departments)
1. **P0 — Release & QA:** Complete CI, staging backend/client compatibility, authenticated Nick/Jenny device tests, *A Christmas Village* saved-title search, real REAPER import, and rollback rehearsal. No auto-deployment.
2. **P1 — Recording & preproduction:** Add explicit conflict detection for two HQ tabs and then versioned shared Watch Along/recording synchronization. Do not claim browser-local checkpoints solve cross-device data loss.
3. **P1 — Discovery:** Build source/date-aware metadata and streaming-availability verification matrix; audit Hallmark, Lifetime, MarVista and Reel One coverage and ranking.
4. **P1 — Bingo:** Verify that marked squares, winning lines, winners and confirmed Cheese Grating are distinct in the final five-minute reveal.
5. **P2 — UX and rundown:** Stage approved cold open/theme/welcome/cocktail/discussion/Bingo format with migration-safe segment IDs and a landscape-first view; avoid breaking existing lap history.
6. **P2 — Postproduction and publishing:** Source-labelled edit decisions, verified timestamps and chapters, REAPER alignment, show notes and a compact publishing checklist.

## Verification status
Implementation and three new tests committed to PR #57 review branch. **First complete code-and-test CI run 41478171466 passed: 143/143 Node tests, browser JavaScript syntax, assembled Chromium HQ, mobile/desktop cocktail and Grit checks.** Follow-up UI polish disables recording controls during reconciliation, styles the accessible banner for landscape/mobile, and refreshes JS/CSS cache versions; the final head must be checked again before calling the full branch green. No merge, deployment, production data mutation, or authenticated real-device verification.
