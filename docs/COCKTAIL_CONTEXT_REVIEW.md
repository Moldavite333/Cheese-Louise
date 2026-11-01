# Cocktail context regression review — November 1, 2026

This focused correction builds on production commit `764d59d`, preserving its complete 7,151-recipe catalog, source hydration, family diversity, ingredient matching and rotation. No database, saved recipe or Android changes.

## Defects corrected

- Movie synopsis, overview and description now contribute when summary is absent, consistently across fingerprint, title/story and season scoring.
- Pineapple no longer acquires apple/orchard/fall ingredient signals. Cocoa and floral story settings contribute their appropriate signals.
- Generic title words cannot earn the strong distinctive-name bonus; Christmas remains intact during word normalization.
- Recently used, renamed Cheese Louise recipes penalize reuse of their underlying original cocktail too.
- Generated versions are invalidated after relevant movie, library or recent-use changes. Regeneration uses the current context, and viewing suggestions never saves recipes automatically.

## Verification

- All 89 Node tests passed, including 12 added context regressions and existing complete-catalog coverage.
- The real assembled interface passed mocked-authentication browser checks at phone, tablet, small laptop and desktop sizes. Cocktail-specific checks passed at 390 and 1440 pixels: movie reranking, matching details, editable single variation, three distinct bases, metadata invalidation and regeneration, no unintended saves, no script errors or horizontal overflow.
- Reviewed phone and desktop screenshots. Tests use fictional workspace data and do not access private user records.
- A separate eight-context review scored every one of the 7,151 catalog recipes for each movie and produced eight different first choices. This measures diversity for those fixtures, not a guarantee that every real movie should receive a different winner.

The two browser checks run in the production regression workflow. A changed first choice alone is not proof of a good recommendation: the existing quality thresholds and source-linked recipe details remain in place.
