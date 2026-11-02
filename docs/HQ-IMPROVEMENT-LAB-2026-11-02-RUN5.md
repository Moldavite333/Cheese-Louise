# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 5

## Cumulative progress (review-only; no merges or production deployment)
- PR #51: REAPER marker CSV export (draft, unmerged).
- PR #52: browser-local recording session history and restore (draft, unmerged).
- PR #53: year-aware recommendation deduplication (draft; Edge Function deployment must precede client).
- PR #54: show exact-title search results when already saved or excluded by Radar filters (draft, unmerged).
- **This run:** prevent predicted trope suggestions from contaminating the verified Cheese Grating when a discovery is voted on. Show the full, uncapped predicted total separately and label it explicitly.

## Evidence and why this matters
- Live Cheese Louise Supabase **read-only** query confirmed that **A Christmas Village** (2018, TMDB movie ID **558815**) is already present in `public.movies` (created October 31, 2026). This strongly supports a saved-title visibility problem rather than total catalog absence for that specific movie. The precise live authenticated client behavior remains unverified; PR #54 addresses the likely client-side issue.
- `movie-discovery.js` previously used `Math.min(100, ...)` for suggested trope points and labeled them "Estimated Cheese Rating".
- More importantly, `voteDiscoveredMovie` inserted a movie with no confirmed traits and then **wrote its guessed score to `movies.cheese_score`**. That can misrepresent a movie's official Cheese Grating, which must be derived from selected/confirmed traits. The shared `movie-trait-sync.js` already correctly sums selected trait points without a 100-point cap.
- The previous prediction cap was also misleading when a film has >100 possible suggested trope points.

## Changes in this branch
1. `discoveryEstimate`: calculate the full suggested sum without a 100-point ceiling.
2. `discoveryCard`: label as **Predicted Cheese Grating** and state that checked traits determine the official tally.
3. `voteDiscoveredMovie`: remove the write that promoted a metadata prediction into `movies.cheese_score`; preserve voting and saved-movie flow.
4. Add `tests/discovery-grating.test.mjs` for >100 predicted totals, vote-save invariants, and explicit trait-confirmation behavior.

## Safety and scope
- No changes to Supabase tables, RLS, backend functions, existing saved movies, votes, recording sessions, Bingo, or private production data.
- No migration or retroactive correction to previously saved guessed scores; those would require a separately reviewed provenance-aware audit.
- No attempt to deploy or merge. Review PR and GitHub Actions results first.
- This branch touches `movie-discovery.js`, which is separate from the core files changed by PRs #51–54, but final integration still requires regression testing.

## Acceptance criteria
- A candidate with suggested trope values 75 and 65 displays **Predicted Cheese Grating 140**, not 100.
- Clicking Yes on a new candidate saves the movie with official `cheese_score=0` and does not write guessed points to `movies.cheese_score` or `movie_traits`.
- Clicking **Add + confirm traits** still persists the two selected trait rows; the existing shared trait-sync path computes the verified tally.
- Browser and Node tests pass; no regression to discovery, horror exclusion, voting, search, or recording.
- On actual Nick/Jenny devices, confirm that a saved title can be found and opened when PR #54 is integrated.

## Next prioritized work
1. Integrate/review PR #54 and test *A Christmas Village* on the live authenticated HQ with saved-title handling.
2. Audit existing `cheese_score` rows against confirmed `movie_traits` **read-only** before proposing any data cleanup.
3. Build safe cross-device Watch Along and recording sync with conflict/version controls; browser-local drafts remain a loss risk.
4. Broaden Hallmark discovery beyond the hardcoded 2024–2026 collection lists, and validate Lifetime/MarVista/Reel One coverage against sourced catalog fixtures.
5. Resolve draft PR integration order, including backend-first deployment of #53.

## Research
- TMDB search/discovery documentation: https://developer.themoviedb.org/reference/discover-movie
- A Christmas Village source identity: https://www.themoviedb.org/movie/558815 and https://www.peacocktv.com/
- REAPER marker workflow: https://reaper.blog/2017/02/dialog-edit-with-regions/

Verification status is recorded in the PR / Actions; no live authenticated movie search was executed in this run.
