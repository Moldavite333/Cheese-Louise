# Cheese Louise HQ Improvement Lab — November 2, 2026 — Run 6

## Cumulative review queue
- #51 REAPER marker CSV export — draft.
- #52 recording session history and restore — draft.
- #53 year-aware movie deduplication — draft; deploy recommendation Edge Function before the client.
- #54 exact-title saved/filtered visibility — draft; authenticated verification pending.
- #55 prevent new predicted scores from becoming official Cheese Grating — draft.
- **#56 this run:** read-only legacy score integrity and accurate display based on checked traits.

## Verified problem and incremental choice
The previous run's read-only production audit found 16 of 32 saved movies with stored cheese_score values different from the sums of their checked movie_traits. 15 had positive stored scores and no checked traits; A Christmas Village (2018) was stored at 23 with no checked traits. PR #55 prevents one source of future contamination but does not correct historical presentation. The current main branch's cheese-traits.js loaded score directly from movies.cheese_score, so those historical values still appeared to be confirmed.

## Implementation on review branch
1. Add pure cheese-grating-integrity.js to compute confirmed point totals from unique checked trait IDs and current trait definitions. Track original stored score separately, flag mismatches and missing definitions, never cap the total.
2. Change the Movie Radar loaded view to use the checked total as its displayed Cheese Grating, with subtle review labels for discrepancies.
3. Add an explanation in the movie detail/modal showing the preserved stored value and confirmed tally. If a selected trait definition is missing, mark the tally partial.
4. Add five deterministic regression tests for legacy 23-vs-0, uncapped 140, unknown traits, null stored scores, and no mutation.
5. Preserve the original database value. **No UPDATE, DELETE, migration, RLS change, production deployment, or bulk correction.**

## Acceptance criteria
- A Christmas Village-style fixture with stored 23 and zero selected traits displays confirmed 0 and a review note; stored 23 is unchanged.
- Two confirmed traits worth 75+65 display 140 (not 100).
- Missing definitions produce an incomplete warning, not a false claim of full verification.
- Radar filtering uses confirmed score rather than historical guesses.
- Voting, saved status, Bingo, recording, and recommendation paths remain unaffected.
- Node and browser regression suites pass. Live Nick/Jenny device and authenticated HQ checks remain outstanding.

## Integration and rollout
Review #55 and #56 together; they touch different core JS files. Deploy both before treating the displayed verified score as authoritative. Check legacy mismatches manually before any data cleanup. The client-only score correction does not reconcile movies.cheese_score in the database or every downstream export that may read that column directly.

## Production-workflow research
Podcast production checklists emphasize clear evidence and reliable handoffs between recording, editing, and publishing. The same provenance principle applies to scoring: confirmed watch-along observations must remain distinct from predicted metadata. See https://checkflow.io/templates/creative-design/podcast-production-checklist and https://podgreenroom.com/articles/hand-off-podcast-editing-to-a-va.

## Next prioritized work
1. Integrate and regression-test draft PRs #51–56, avoiding overlapping index.html and recording-hub.js changes; backend-first for #53.
2. Authenticated search verification for A Christmas Village and source completeness across Hallmark, Lifetime, MarVista and Reel One.
3. Design cross-device Watch Along and recording-session sync with revision controls and no-loss local migration.
4. Add provenance-aware backend reconciliation only after the legacy score audit is reviewed and a rollback plan exists.
