# Reviewed listener photo handoff — local implementation

Prepared migration: `20261110090800_mixology_listener_photo_handoff.sql`, after all nine earlier Mixology migrations. It is **unapplied** to hosted databases. No service, provider, public endpoint or deployment was changed.

## Host workflow

After keeping a listener photo privately against an exact recipe version, either host can link it to that version's existing photo library only if the original submission permits public reuse. Private-review-only photos do not expose this action and the database refuses promotion. The host curates public alt text/caption, then explicitly confirms review of the actual drink photograph, reuse permission, credit and spoilers. This is a distinct media-review action; it does not approve a recipe, invent tasting feedback or publish anything.

The link preserves the submission identity/revision, exact version, reviewing host/time, source image digest/dimensions and consented credit. The database supplies those values rather than trusting client identity fields. Anonymous credit is used when the listener did not permit a name. Active linked-photo credit cannot be replaced with another name; the editor makes this field read-only. Original comments and private permission notes are not copied into public media fields. Editing the proposed public text clears the checkbox so a changed caption is reviewed again.

The existing library opens directly from the linked entry. Normal photo editing, recipe/public-copy review, immutable snapshots and local HTML/promo downloads continue to apply. Alcoholic recipe exports still require an independently approved alcohol-free counterpart. Source references and permission notes never enter the public artifact whitelist.

## One retained image and current-consent checks

A source-linked media row has no Storage object path. It references the already server-cleaned private image; this operation does not upload, duplicate or re-encode a second stored copy. A workspace-authorized invoker RPC reads bytes only while the source remains accepted, unredacted and reuse-permitted, and the media remains eligible. Ordinary host uploads continue through the existing guarded private Storage path.

The same source checks run when a new publication snapshot is made and on **every** later export, including promo text. Linked-image export uses the guarded byte RPC and rechecks the publication record after preparing the browser's local JPEG copy. Host media-rights withdrawal still increments the media revision and blocks prior snapshots as before.

Source redaction deletes the private image and original text, hides linked media, clears its active rights flags and replaces current library alt/caption/credit/permission fields with withdrawal placeholders. New byte reads, new snapshots, relinking and old-snapshot exports are blocked. Immutable audit/snapshot metadata remains, and previously rendered previews, screenshots, downloads, backups or content manually posted elsewhere cannot be remotely erased. The UI's photo-redaction confirmation states that earlier copies and archived metadata may remain. No code posts content publicly.

Promotion, direct source-linked inserts and source updates use a shared transaction advisory lock. The existing checked moderator acquires it **before** its source-row lock, matching promotion's source/FK ordering. This avoids broad queue UPDATE grants or a new definer capability solely to obtain a row lock. The old capability still checks actual `auth.uid()` and workspace membership before changing data. Fresh source guards remain mandatory independently of locking. Real concurrent sessions and hosted PostgREST behavior still need an approved staging test; the isolated database fixture is not a multi-session lock-stress test.

## Verification

`tests/mixology-listener-handoff.test.mjs` covers refusal without source reuse permission or explicit host review, immutable provenance/credit, exact version, stable retry/no duplicate, no copied Storage object, host/nonmember/anonymous boundaries, public-field exclusion, approval gates, source redaction, blocked old exports/reactivation, and unchanged ordinary host-photo registration. The full Node suite is **297 passing tests**.

`scripts/mixology-listener-handoff-browser-smoke.mjs` uses the real local intake handler, codec and SQL with a fake proof provider at 390/1440px. It verifies a committed-but-lost link response, preserved credit, a single source-backed library entry, a read-only credit field, an actual downloaded HTML review copy with embedded cleaned JPEG and no private source fields, and refusal after source redaction. Screenshots use `mixology-listener-handoff-{review,library,publication}-{390,1440}.png` plus the linked queue view. They contain blank **FORMAT TEST ONLY** decoder fixtures, not actual drink photographs or host taste results. Phone review and desktop library screenshots were visually inspected.

## Limits and release gates

Source-backed library images still count against the bounded private review store (200 photos / 64 MiB of JPEG bytes per workspace). Retaining a library image means retaining its source; redacting to free space also withdraws that image from future use. No retention cron or migration to another store was activated. Production volume/retention/backup handling and any later Storage adaptation need explicit release review.

The SQL and browser tests use isolated PostgreSQL/WASM and mocked authentication/transports. Hosted Auth/PostgREST grants, private-schema exposure, real multi-session lock/retry behavior, real photos/hosts, backups and Edge-runtime codec performance remain unverified staging gates. The earlier intermittent caret-position and media-conflict regressions remain open even when a later batch passes. Deployment, hosted migrations, public activation/publication, paid calls and external-service configuration still require separate approval.

Current official references inspected: [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog). The Markdown index could not be parsed by the browser tool, so the HTML index was used. Only local `migration new` was run with the pinned CLI; no CLI hosted mutation command was used.
