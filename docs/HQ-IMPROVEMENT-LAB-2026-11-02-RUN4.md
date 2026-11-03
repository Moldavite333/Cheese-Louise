# HQ Improvement Lab — 2026-11-02, run 4

## Verified baseline
- Main branch has assembled HQ Movie Radar, Watch Along, Recording, Bingo and production views.
- Draft PR #51: REAPER marker export (not merged).
- Draft PR #52: browser-local recording session history (not merged).
- Draft PR #53: year-aware recommendation deduplication (not merged; requires backend-first rollout).
- These PRs are independent. This run deliberately avoids overlapping their modified files except the static index script reference.

## Highest-impact incremental problem
Romantiverse Search returned only unsaved results that passed the current Radar filters. A user searching an exact title could receive an apparent zero-result state even when the backend had returned the title, because the movie was already saved or a year/studio/season/vote filter excluded it.

## Proposed implementation (draft PR; not merged/deployed)
- Identify exact title matches by accent-insensitive, punctuation-insensitive, article-insensitive title key.
- Show already-saved exact matches with an **Open saved movie** action, without re-adding a duplicate.
- Surface unsaved exact matches outside the active Radar filters in a clearly labeled section; other external results still obey those filters.
- Preserve the global horror exclusion and all existing filters. No database writes, new credentials, or Edge Function deployments.
- Cache-bust the changed client script.
- Add three Node regression cases: saved title navigation, filtered exact title, horror exclusion.

## Evidence and limits
- The movie *A Christmas Village* (2018) is independently documented: IMDb tt9047392, directed by Justin G. Dyck, starring Madeline Leon and Neil Paterson; see https://www.imdb.com/title/tt9047392 and https://www.rottentomatoes.com/m/a_christmas_village .
- Live Supabase project wgvsnmukiaobcbyqhkkt has an active `search-romantiverse` Edge Function (v4), JWT-protected. The code path and filters were inspected, but the actual authenticated user query and live TMDB result for this title were not reproduced.
- The fix does **not** claim to recover a movie that the backend never returns. A separate authenticated test should distinguish absent backend data from a filtered or already-saved result.

## Verification and release gates
- Node: `node --test tests/radar-filters.test.mjs`, then full `node --test tests/*.test.mjs`.
- Browser: search for an already-saved exact title; verify navigation; search with year/studio filter excluding the exact result; confirm visible, labeled exception; verify horror never leaks.
- Recheck at 360, 768, 1024 and 1440 px; confirm the extra card doesn't crowd the recording layout.
- Live test with Nick/Jenny accounts after review, without modifying real production data.
- Draft branch only. Do not auto-merge or deploy.

## Next highest priorities
1. Authenticated reproduction of missing *A Christmas Village* (2018) at the backend, including TMDB identity, search response, client filters, and saved status.
2. Expand catalog completeness beyond finite Hallmark collections, with verified producer/network provenance and no fabricated metadata.
3. Design shared Watch Along and recording-session persistence with conflict resolution and no-loss migration; do not confuse movie-keyed recording with episode-keyed sessions.
4. Integrate PRs #51/#52 carefully and release PR #53 backend-first.

## Running decision record
- Runs 1–3 remain documented in their respective PR branches and descriptions (#51, #52, #53).
- Run 4: exact-title visibility is the new scoped improvement; no existing feature was rebuilt.
