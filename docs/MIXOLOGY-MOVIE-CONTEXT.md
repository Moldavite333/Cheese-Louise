# Saved movie context and draft reopening — November 10, 2026

This increment follows the approved M01/M11/M19/M20 workflows and the optimization review's return-to-development journey. It preserves the canonical recipe and restores context rather than generating a replacement record.

## Changes

- Opening a recipe directly from the library/recent drafts now reads its current same-workspace movie associations. Exactly one loaded movie is restored as inspiration independently of return navigation.
- Alcoholic and alcohol-free variants resolve the same canonical cocktail association while retaining their own recipe/version/approval data.
- Existing movie/episode entry has priority. Multiple movie links are not resolved by choosing an arbitrary first row. The UI explains that the intended saved movie must be opened for recommendations.
- Failed or unavailable association reads retain manual editing but prevent silent standalone discovery. Recipe text and existing directions are preserved. Explicit movie entry resolves ambiguity using the same canonical cocktail.
- Existing accounts/workspace/request guards cover the additional asynchronous association read.
- The Recent recipe drafts disclosure retains its open state through same-account/workspace redraws. This corrects the post-merge CI failure in run 42826537317: the list collapsed between opening its summary and choosing a saved draft. The regression now forces a redraw and asserts the list remains open before clicking.

## Verification

306 Node tests passed. Isolated context browser checks passed at 390/1440px for unique association restoration, counterpart context, ambiguity, failed reads and explicit canonical reuse. Existing movie, editor, research/conversation, preparation and keyboard regressions passed during implementation; the strengthened draft-reopening test passed both widths. Context/ambiguity phone output was visually inspected. Fixtures are fictional; they do not establish host taste, paid-model quality or live authenticated browser/storage acceptance.

No migration, paid provider call, new external configuration or production-data rewrite is involved. Separate listener queue edits remain unpublished. Deployment evidence must be appended to the current build checkpoint if this increment is released.

PR validation run 42828585396 reached the keyboard check and exposed a stale-element identity assertion: the focused element still had the correct Taste action, while the pre-redraw reference compared unequal. The assertion now forces a redraw and queries the current selected Taste button in the same browser operation, checking actual focus, action and aria-pressed=true. It preserves a strict user-facing focus requirement instead of comparing a detached node. Corrected keyboard/context checks passed at both widths; no application focus change was made for this fixture correction.
