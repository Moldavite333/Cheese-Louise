# Listener feedback and variations — local increment

Prepared migration: `20261110071142_mixology_listener_feedback_variations.sql`, after the original submissions migration. It has not been applied to a hosted database. Public endpoint/site-key metadata remains empty; the Edge handler still requires explicit server enablement. No provider or service was activated.

The public form now distinguishes a new idea, feedback, and a variation. Feedback/variations require a bounded plain-text public recipe/episode reference. Public users cannot choose HQ IDs, enumerate private recipes, supply a host identity, or claim testing/approval. The contract rejects extra routing fields. Version 1 idea documents remain valid; version 2 adds only the type and textual reference. Credit remains opt-in. Feedback contains comments rather than hidden recipe-field content.

The host queue labels each type. For feedback and variations, hosts can confirm a saved version from the latest 100 workspace versions; nothing matches a name automatically. The selected version is locally recoverable and sent as part of a stable moderation operation. Feedback may deliberately remain unresolved/unlinked. A variation requires an exact same-workspace parent version before acceptance, including at the SQL boundary.

Keeping feedback is a private, attributed moderation decision. It creates no recipe, host tasting, learned host preference, approval, user account or public post. A variation creates a separate canonical **untested** development recipe and retains the exact parent-version link in the submission and immutable moderation audit. It never updates its parent recipe or invents an alcohol-free counterpart/version/approval. The new recipe can then be edited and physically tested in the existing studio. Listener references and original wording remain marked unverified; a host-selected exact version is separately recorded.

Both acceptance paths retain compare-and-swap revisions, permission checks and idempotent operation IDs. Original moderation API receipts remain retryable after the prepared upgrade: null-target operations keep the previous request fingerprint. Redaction removes original text and retains type, audit, verified version link and any imported recipe. Imported notes, other devices' browser recovery and earlier downloads still require separate review for private text. No automatic public reuse or photo permission is implied.

## Security and evidence

No table or schema becomes public. Existing RLS/grants still restrict reads to workspace members and deny direct host queue/audit writes. The new public RPC is invoker-only. Its private capability checks the real `auth.uid()`, workspace membership and target workspace under a fixed empty search path. The old private moderator now delegates with invoker rights to that checked capability. Service credentials remain confined to the disabled Edge intake, never the public form.

`tests/mixology-listener-types.test.mjs` verifies type/reference/size/routing validation, feedback isolation, exact parent linking, cross-workspace/nonmember/anonymous denial, stale/retry behavior, untested independent AF variation imports, parent preservation, redaction, and compatibility with an original accepted operation across the actual additive migration. The existing handler tests exercise the shared intake boundary with a fake proof provider. The new browser suite uses the actual local handler and isolated SQL to exercise feedback/variation form behavior, host version-choice recovery, a committed-but-lost acceptance response, and independent variation import at 390/1440px.

The full local Node suite is 281 passing tests. Browser artifacts contain fictional source text and blank transport fixtures, never real listener submissions or taste results. Hosted Auth/PostgREST grants/schema exposure, gateway/proof behavior, real host usability and any production advisors still require an approved staging environment; there is no running local Supabase stack for CLI advisors. This run used isolated PostgreSQL/WASM rather than a hosted database.

## Remaining scope and release

Private listener photo intake/moderation has since been added; see `MIXOLOGY-LISTENER-PHOTOS.md`. Consent-preserving handoff into host publication media is still missing. Do not label that integration complete. Keep uploads, metadata stripping, bounded decoder verification, real-photo/rights permission, moderation and abuse/privacy controls together when implementing that path. Optional credit permission does not authorize publishing a listener photograph.

Review and approve backend migrations plus staging checks before deploying the new frontend/contract. Separate release approval is still required for public activation, CAPTCHA configuration, hosted migrations, deployment/publication, paid calls or external service changes.

Reviewed official guidance: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [RLS and private capabilities](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog). The Markdown changelog endpoint could not be parsed by the browser tool; the HTML index was inspected instead. No Flutter/Dart API is used in this repository.
