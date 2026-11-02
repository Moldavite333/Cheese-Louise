# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 16

## Current verified integration baseline
- Inspected PR #57, its branch at `16ecda800c40ea4b99910c704788641f620b7381`, the Run 15 handoff, recording-hub.js, test harness, and GitHub Actions.
- **Resolved previous uncertainty:** GitHub Actions run [41496400320](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41496400320) completed successfully **on the exact Run 15 head**. Its job logs report **162 Node tests passed, 0 failed**; browser script syntax, assembled Chromium HQ, cocktail desktop/mobile, and Grit checks all succeeded. Run [41496285687](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41496285687) also passed on the merge commit. The previous statement that current-head CI was unverified is superseded for Run 15.
- PR #57 remained **draft, open and mergeable** when reviewed; no evidence of deployment or authenticated real-device sign-off.

## Highest-impact new increment: show-format alignment with preserved history
The current Recording desk still defaulted to six segments: Opening & banter, Cheesy Concoctions, Movie & tropes, **mandatory Horror-fied**, Cheese Grating & Bingo (7 minutes), Closing. This contradicted Nick and Jenny's approved sequence and overloaded the ending.

Implemented on the **existing draft PR #57 branch**:
1. New sessions now have seven identified sections: Cold open (20s), Theme (30s), Welcome & banter (3m), Cheesy Concoctions (5m), Movie review & discussion (30m), Bingo & Cheese Grating (5m), Closing (1m). Target total: **44m50s**. These are guidance, not enforced limits.
2. The cold-open cue encourages a natural, unscripted Romantiverse joke/question. The movie cue follows chronology; Bingo is a five-minute **end reveal**, distinguishing marked squares from winning lines, with no on-mic gameplay.
3. `segmentPlan:'approved-v2'` is saved on new sessions. Old sessions lacking that field retain the original six-section plan, names, lap indices, archived history, and REAPER export semantics. **No historical session migration or data rewrite.**
4. Recording UI, Next/Previous, segment timing and REAPER export select the session's own plan. The active plan's target duration displays in HH:MM:SS, including the 20-second cold open.
5. Refreshed recording-hub.js cache key in index.html.
6. Updated the completed-session test from six to seven laps and added tests for approved section order, five-minute Bingo, no mandatory Horror-fied, legacy lap labels and export.

## Research and design rationale
- [Riverside: recording markers](https://support.riverside.com/hc/en-us/articles/5286816799645-Add-markers-while-recording) confirms quick, in-context markers and the M shortcut as a useful reference; HQ already implements these and this run does not duplicate that work.
- [REAPER User Guide, §9.9](https://dlx.reaper.fm/userguide/) documents Region/Marker Manager CSV import/export. Session-specific plan selection is important to preserve exported section boundaries and names.
- No new network permissions, licensed-content ingestion, backend tables, or personal data transfers. Browser-local recording data is still **not cross-device backup**.

## Verification state and release gates
- The **162/162 successful tests apply only to Run 15 head `16ecda8`**, not to the new show-format commits. New changes were committed to PR #57; current-head Actions did **not** appear in the available run list at log time. Do not claim the new head is CI green.
- P0 Codex/CI acceptance: run `node --test tests/*.test.mjs`, `node --check recording-hub.js`, `node scripts/hq-browser-smoke.mjs` and complete workflow on the latest PR head. Check the seven-lap completion/previous/re-finish path; legacy six-lap completion; restore and REAPER CSV; phone 360px/desktop 1440px overflow and keyboard focus; interrupted timer and stale-tab safety.
- P0 staging: authenticated Nick laptop/Jenny phone workflow, two-tab race, real REAPER marker import, saved-title `A Christmas Village`, Supabase backend-first year-aware recommendation rollout and rollback. **No merge or deployment until these are verified.**
- P1: workspace-scoped, versioned, conflict-safe Watch Along notes and episode sessions (no last-write-wins timer sync).
- P1: authoritative Bingo marked-square vs winning-line import; source/date/region-aware movie availability.
- P2: editor-ready show notes and publishing handoff based on confirmed episode metadata and verified recording evidence.

## Status
**Code modified and committed on review branch only. Tests added but not yet run on the new head.** No main merge, production deployment, production data change, or claim of live integration.
