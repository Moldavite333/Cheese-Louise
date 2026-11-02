# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 7

## Integration increment
Verified `main` at `39c672fda42466c400c63cde7846de3eb3cbafc5`; PRs #51–#56 were open draft changes, individually tested but not collectively tested. This branch consolidates their sources for joint regression review, **without merging or deploying**.

### Implemented on this branch
- All source and tests from six draft PRs are assembled in one review candidate.
- Resolved overlapping `recording-hub.js` edits: local session history/restore and REAPER marker CSV export now coexist in the same Recording → Edit view.
- Merged the two sets of `tests/production.test.mjs` changes; added an end-to-end restore-then-export regression test.
- Merged all `index.html` script additions and refreshed cache-busting for discovery, exact-title search, year-aware recommendations, and the recording desk.
- Preserved prediction-versus-verified Cheese Grating separation and read-only legacy discrepancy warnings; no historical scores rewritten.

### Gates before release
1. Run full Node tests, JS syntax, Chromium responsive smoke, cocktail and Grit regression checks on this combined branch. Independent PR CI is insufficient.
2. Import a real marker CSV in REAPER and align HQ time to RØDECaster time; repeat imports can duplicate markers. Official guide: https://dlx.reaper.fm/userguide/
3. Verify saved `A Christmas Village` (2018, TMDB 558815) appears via exact-title search in the authenticated workspace. Backend live search still unverified.
4. Verify score displays and filters use checked traits; audit any remaining downstream raw `movies.cheese_score` readers before data correction.
5. **Deploy `recommend-romantiverse` Supabase Edge Function before the updated static client** if release is approved; test compatibility with old and new requests: https://supabase.com/docs/guides/functions/deploy
6. Test session reset/restore/reload and storage failures on Nick/Jenny devices; history is browser-local, not shared backup.

### Not completed
- No production data changes, Supabase deployment, or main merge.
- No authenticated real-device or REAPER GUI verification.
- No cross-device collaboration or comprehensive streaming catalog coverage changes.

### Next increment
Resolve combined CI findings; stage backend-first rollout and device validation. Then tackle no-loss cross-device sync and catalog completeness. Avoid opening further isolated feature PRs until the integration queue is resolved.
