# Cheese Louise HQ — Production Studio Lab, Run 20
**Date:** 2026-11-02 (America/Denver)  
**Review branch:** `lab/hq-six-pr-integration-20261102-run7` — [Draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)  
**Focus:** Prevent lost manually edited episode rundowns and make the approved recording copy available without competing with the visual storyboard.

## Verified code inspection and discovery
- `watch-along.js` already saved an editable `draft.rundownText`, but automatic calls after editing notes or traits unconditionally regenerated it. This silently erased manual edits despite the interface saying rebuilding was deliberate.
- `recording-hub.js` used `outlineItems` and `notes`, not the saved editable rundown. The saved recording snapshot had no `rundownText` field.
- The default Watch Along template still contained `HORROR-FIED / BINGO`, contradicting the approved show sequence (20-second cold open, theme, welcome, cocktail, movie discussion, five-minute Bingo/Cheese Grating, closing).
- The visual storyboard is already implemented and must remain primary; do not replace it with a large rundown panel.
- The app's recording storage is browser-local; no claim of shared Nick/Jenny notes or cloud backup is justified.

## Implemented on draft branch (not main)
1. **Preserve edited rundowns:** Add `rundownGeneratedText` baseline. Automatic updates refresh only untouched/generated copies; custom and legacy saved text is preserved. Explicit **Rebuild from notes** confirms replacement.
2. **Correct the template:** Align deterministic rundown headings to the approved seven-section format; remove mandatory Horror-fied and keep the Bingo/Cheese Grating reveal together.
3. **Recording handoff:** Include `savedRundownText` in recording snapshots and show it in a collapsed, read-only reference below the regular recording notes. Preserve the visual scene storyboard as the main navigator.
4. **Live-take safety:** Once recording work exists, the displayed saved rundown stays frozen until an explicit paused **Update from Watch Along**. Direct attempts to refresh during a running or recovery-pending session are rejected.
5. **Regression coverage:** Add tests for manual-edit preservation, explicit rebuild, approved template, live rundown freezing and paused-only refresh.

**Changed:** `watch-along.js`, `recording-hub.js`, `tests/production.test.mjs`. No new API, schema, dependency, local install or paid AI call. No main merge, deployment, production-data mutation or Supabase migration.

## Verification and release boundary
- Review branch code commits: `eb28e2a`, `e0bedfe`, `3e6ffc5`.
- **GitHub Actions [run 41541959393](https://github.com/Moldavite333/Cheese-Louise/actions/runs/41541959393) completed successfully** on exact code commit `3e6ffc5`: **191/191 Node tests passed**, 0 failures; browser JavaScript syntax, assembled HQ Chromium checks, cocktail mobile/desktop checks, and Grit songwriting browser checks all passed. The subsequent documentation-only commit should be checked separately.
- No actual Nick/Jenny cross-device workflow, live Bingo room, RØDECaster session, REAPER import, or deployed website was tested.
- Keep PR #57 draft until full CI, backend-first recommendation compatibility, authenticated device tests, and REAPER GUI import have been verified.

## Prioritized next work — six departments
**P0 — integration release gates (all departments):** Confirm full workflow CI on exact head; backend-first `recommend-romantiverse` compatibility; authenticated laptop/phone state; no paid AI calls for normal rundown; cross-tab recovery and real REAPER CSV import. Do not merge or deploy without verified evidence.

**P1 — preproduction/recording (next user-facing value):** Add a compact *scene-at-a-glance* view for the existing storyboard: scene title, one-line event, host-note indicators, verified trope chips, and next scene. No parallel timeline store or automatic AI. Test 360/768/1024/1440px, keyboard focus, stale note updates, 20+ scenes, and one-click next-scene access.

**P2 — two-host data integrity:** Design a conflict-safe Supabase episode-note sync contract for Nick/Jenny. Keep per-host authorship, revision numbers, offline conflict warnings, and non-destructive merges. Do not ship a migration without authenticated staging and rollback tests.

**P3 — discovery:** Build a fixed benchmark of difficult Hallmark/Lifetime/MarVista/Reel One titles including `A Christmas Village`; measure exact-title/year recall, verified credits and source timestamps, same-title different-year handling, and manual fallback. Avoid new paid APIs and invented availability.

**P4 — Bingo/postproduction:** Read-only authoritative Bingo import with actual marked squares versus winning lines and winners, never inferred from synopsis. REAPER export must keep recording time separate from movie time and distinguish user markers from AI suggestions.

**P5 — publishing/learning:** Build a single-episode checklist with source-backed credits, release date, clips, approved social copy and useful feedback metrics. No automated publishing, no duplicated data entry, no unverified claims.

## Professional workflow/accessibility references
- [W3C WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) — secondary long-form notes should remain collapsed and keyboard-operable rather than occupying the recording surface.
- [REAPER 7 User Guide, Region/Marker Manager](https://dlx.reaper.fm/userguide/) — CSV marker import is supported; import-merge can duplicate markers, so actual DAW validation is still necessary.

**Next Codex acceptance criteria:** A user can edit the rundown, add another Watch Note, and retain the custom text. Only an explicitly confirmed rebuild replaces it. Recording shows a read-only copy, does not change that copy mid-take, and refreshes it after pause. The storyboard, timer, markers and Bingo are unaffected.
