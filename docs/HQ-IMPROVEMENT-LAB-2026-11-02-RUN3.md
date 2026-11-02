# Cheese Louise HQ Improvement Lab — 2026-11-02, third increment

## Baseline reviewed
- Main includes merged landscape Record desk and Bingo square/line separation (PR #50), movie timeline (#48), compact traits (#47), live Cheese Grating tally (#46), and Yes/Save-to-Bingo feed (#45).
- Draft PR #51 adds REAPER marker CSV; draft PR #52 archives/restores previous browser-local recording sessions. Both remain unmerged. This branch does not modify recording files.
- Inspected Movie Radar recommendation client, recommend-romantiverse Edge Function, ranking engine, and regression tests.

## Defect chosen: identity across release years
Observed on main: Recommendation intake passed plain exclude_titles to the server and filtered saved results by normalized title alone. A saved 2018 movie therefore suppressed a distinct 2026 movie with the same title, despite different TMDB IDs and release years. Historical batches also retained title-only exclusions.

## Code committed on this branch
- Normalized title + verified four-digit year identity for recommendation intake, with TMDB ID exclusion precedence.
- New exclude_title_years and exclude_unknown_titles contract. Edge Function continues to accept legacy exclude_titles from older clients.
- Unknown-year saved titles conservatively exclude matching titles across years; unknown-year candidates are treated as possible duplicates of known-year titles until verified.
- Year-qualified history persists by workspace without deleting old history; old history IDs still prevent repeat suggestions.
- Favorite seeds deduplicated by title+year when known.
- Added regressions for same-year duplicate, distinct-year remake, missing year, TMDB ID precedence, and client request contract.
- Client cache-busted. No database schema, permission, Bingo, recording or branding changes.

## Verification status
- Source changes committed. GitHub Actions CI to be checked after draft PR creation.
- No authenticated live TMDB recommendation call, Edge Function deployment, or Nick/Jenny device test in this run. Not deployed.
- TMDB documents unique movie IDs and release dates in search results, and a search-then-details workflow: https://developer.themoviedb.org/docs/search-and-query-for-details . Regional dates can vary: https://developer.themoviedb.org/docs/region-support .

## Next priorities
1. Confirm regression checks and Edge Function compatibility; server must deploy before new client to avoid ignored exclusion fields.
2. Reproduce A Christmas Village (2018) against live search-romantiverse with filters reset; capture raw result and filter decisions, no invented TMDB ID.
3. Cross-device Watch Along and recording sync with versioned workspace data, offline conflict handling, and no-loss migration.
4. Integrate PRs #51 and #52, then validate REAPER import and on-device recovery.
5. Consolidated postproduction packet: rundown, credits, cocktail, marked Bingo squares vs completed lines, and editor markers.

Approved: Cheese Grating, Nick/Jenny shared workspace, no Horror discovery, landscape-first recording, Bingo website authoritative for marks.