# Movie-first recommendations correction — November 10, 2026

The user reported that the deployed workspace looked like blank fields and asked where movie-based recommendations were. The earlier movie-details Develop cocktail action existed, but discovery required finding a separate Research tab/button. This was a verified starting-flow gap.

## Changed

- The Mixology entry now offers a same-workspace saved-movie selector and Develop for this movie. Selection survives HQ redraws and is isolated to the signed-in workspace/account.
- Movie entry opens a recommendations-first screen and automatically runs the existing source-backed five-direction discovery when the shared workshop has no directions/research yet. Existing shared recommendations and recipe identity are reused; they are not silently regenerated.
- Blank recipe inputs and the empty recipe sidebar are omitted from this initial movie screen. Optional brief refinement is collapsed. Recommendations display source foundation, visible ingredients and the existing match engine's specific flavor overlap. Broad matches are explicitly identified rather than inventing a thematic connection. No synopsis or plot ending is displayed by the new entry.
- The movie-details action follows the same automatic flow. Returning from a movie picker returns to the library; returning from movie details retains that origin. Double-start requests are guarded.
- Existing manual recipe editing, selected-only deep source research and deliberate import remain. Recommendations are catalog foundations/directions, not claimed original tested recipes. Paid AI remains disabled. No schema migration or external configuration is required.
- Script/style cache keys changed so existing HQ visitors receive the correction.

## Verification

The new isolated movie browser check passed at 390/1440px: same-workspace picker, automatic five distinct source-backed directions, no blank name editor in the recommendation screen, visible movie context, persistent canonical link/reuse, no page errors. Phone/desktop recommendation screenshots were inspected. Existing editor and research regressions passed during implementation; final CI evidence belongs in the rollout checkpoint.

Fixture films and recommendations establish workflow behavior, not real-host taste, originality or preference quality. Actual host review remains authoritative. If fewer than five distinct source-backed choices are available, the existing discovery reports that limit instead of inventing slots.
