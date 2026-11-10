# Recipe and promotional review drafts — November 9, 2026

This increment implements private recipe-page and promotional drafts. Nothing is deployed, posted, published, migrated on a hosted database, or charged to a paid API. See `MIXOLOGY-BUILD-STATUS.md` for remaining authorized work.

## Implemented workflow

The Recipe & promo tool keeps one shared public-copy draft per immutable recipe version. Hosts enter an introduction, spoiler-free movie connection, social caption, episode/show-note copy and public source links with retrieval dates. The caption helper uses only the recipe name/yield and explicitly public notes. It does not call an AI service or invent flavor outcomes, history or trends.

Drafts have local recovery, revision-checked autosave, undo, retry, export and deliberate conflict resolution. Either host can edit and review. Editing copy, sources or selections clears review. The review RPC checks the exact photo metadata revision displayed to the host: a concurrent photo caption/credit change requires renewed review rather than being silently included.

A saved review snapshot requires approval of the exact main version, an independently approved alcohol-free counterpart for an alcoholic main recipe, an eligible real photo of that main version, and explicit public-copy review. A counterpart must be the opposite variant of the same canonical cocktail. An alcohol-free main recipe may stand alone.

The database builds and freezes the public-field snapshot. Private recipe notes, ingredient/step IDs, tasting comments, permission notes, profile/contact data and signed preview links are excluded from generated content. Private foreign keys remain on the snapshot row for provenance but do not enter HTML or promotional text. Clients cannot replace snapshot contents or rewrite saved snapshots.

## Review artifacts

Saved copies offer a sandboxed preview, portable recipe HTML and promotional text downloads. The responsive page contains the main recipe and chosen counterpart, an embedded real-photo JPEG copy, caption/credit, reviewed public copy and sources. Export re-encodes the private photo to remove metadata and embeds a local data URI. No temporary signed URL, original filename or auth token is embedded.

The page includes alt text, mobile stacking, focus styles, source links, a visible Not published banner and `noindex,nofollow`. Basic Schema.org Recipe data uses actual names, yields, ingredients and steps; Cheese Louise is the publisher, not an invented original recipe author. It does not fabricate nutrition, ratings, durations, trend metrics, publication dates or hosted page/image URLs. Search indexing and rich-result eligibility are not claimed; release-specific URLs/metadata require separate publishing work.

Every export checks current approval of both recipe versions and the photo's metadata revision/rights. Recipe HTML checks again after loading the photo. Withdrawal or changed photo metadata blocks fresh export from old snapshots. Earlier local downloads cannot be revoked, and the page instructs hosts to check HQ again before posting. There is no public route, social-posting action, live website mutation or episode-outline replacement.

## Files and data boundary

- `mixology-publication-core.js`: bounded public-copy/source validation and escaped HTML/text generation. Known signed/credential-bearing URLs are rejected, including Supabase signed paths, common auth fields and cloud signature parameters. Only local JPEG data URIs enter recipe artifacts.
- `mixology-publication.js`: shared editor, source/photo/counterpart choices, exact-photo-revision review, snapshots, sandboxed preview and local downloads through the existing authenticated client.
- `supabase/migrations/20261110040815_mixology_publication.sql`: CLI-generated and **unapplied to hosted services**. Private draft/snapshot tables use membership RLS, explicit grants, composite workspace references, invoker RPCs, CAS guards and immutable server-built snapshots. Ordered recipe locks and photo locks protect current approval/rights checks.
- `tests/mixology-publication.test.mjs` and `scripts/mixology-publication-browser-smoke.mjs`: SQL/browser coverage, included in the package scripts and regression workflow.

## Verification

The complete Node suite has **257 passing tests**, including ten new checks covering hostile text escaping, signed credential URL rejection, exclusion of private content/IDs and invented metrics, review/CAS behavior, independent counterpart approval and same-variant rejection, immutable/idempotent snapshots, photo review races, approval/rights withdrawal, and anonymous/nonmember isolation.

New browser flows passed at **390 and 1440 px**: real HTML/text downloads, embedded private-photo copies, both recipe variants, source display, deterministic caption composition, offline recovery, two-host conflicts, review invalidation and blocked exports after approval/photo changes. Downloaded HTML was checked for absence of private recipe/tasting/permission text, host IDs, recipe-version IDs and signed tokens. Workspace, iframe and exported pages had no horizontal overflow in the tested fixtures. Phone and desktop recipe-page screenshots were visually inspected.

Existing editor/approval, preparation/recording, photo and research/bartender browser regressions passed at both widths. Cocktail checks passed at both widths; HQ checks cover phone/tablet/laptop/desktop. Browser syntax and diff whitespace checks passed. Storage transport/signing and source/photo content are fictional fixtures around real isolated PostgreSQL/WASM policies. No actual cocktail photography, online source verification, tasting, paid model call or production data access occurred.

Reproduce with `node --test tests/*.test.mjs` and `node scripts/mixology-publication-browser-smoke.mjs` using existing pinned dependencies and the installed Playwright browsers. Generated local review artifacts are under ignored `artifacts/recipe-review-*` and `artifacts/mixology-publication-*`.

## Remaining work

Moderated listener submissions and the complete cross-stage acceptance/accessibility audit remain authorized local work. The original attachment remains unavailable; do not invent missing choices. Actual Auth/PostgREST/Storage behavior, existing hosted policy composition, two-device host usability, photo rights/quality, tasting, model quality, backup/restore and rollback still need separately authorized staging/host trials. Deployment, publication and paid-provider activation require separate explicit approval.

References consulted: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage download API](https://supabase.com/docs/reference/javascript/storage-from-download), [Schema.org Recipe](https://schema.org/Recipe).
