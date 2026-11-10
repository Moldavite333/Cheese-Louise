# Private listener photograph review — local increment

`20261110081351_mixology_listener_photos.sql` was generated with the installed Supabase CLI and remains **unapplied** to hosted databases. This builds on typed listener submissions. Nothing was deployed, publicly published, enabled, or written to an external service.

## Actual workflow

A separately enabled photo option accepts JPEG/PNG files up to 8 MB and 24 megapixels. The browser checks declared dimensions/animation restrictions, decodes the image and prepares a JPEG no larger than 1600 pixels per side and 512 KiB. It strips the original filename and camera metadata before submission. The original camera file never enters the intake payload. The prepared image stays in browser memory only; it is not written to localStorage and must be reselected after a reload.

Photo-specific alt text, permission note, real-photograph attestation and rights-to-private-review attestation are required. Optional public reuse permission is separate and defaults false. Credit is still opt-in. There is no AI authenticity detector; actual images and the listener's claims require human review. Inputs and captions are untrusted data and are escaped.

The existing exact-origin/proof/quota boundary runs before server image decoding. Photo intake also requires `MIXOLOGY_SUBMISSIONS_PHOTOS_ENABLED=true` and the server sanitizer adapter. A valid proof alone cannot store a photograph: a real bounded JPEG decoder (`jpeg-js@0.4.4`) must accept it, and a fresh encode receives only pixels, not EXIF/comments. Server decoding is strict, capped at 2.56 megapixels and 64 MiB of decoder allocation; output remains at most 512 KiB. The dependency and lockfile are pinned. The shared sanitizer is executed in Node fixture tests; the Deno npm-import adapter still needs approved Edge-runtime staging validation, including CPU/memory behavior.

After server cleaning, one atomic database operation records the private submission and sanitized image. Request identity includes the image content, and lost-response receipts do not decode or insert it again. A failed proof never reaches the decoder. Existing text-only submissions retain their 20,000-byte request bound; the photo envelope is capped at 750,000 bytes.

Hosts see the photo, alt text/caption, consented credit, permission note and explicit private-only/public-reuse label in the existing moderation queue. Keeping a photo requires choosing an exact saved recipe version in the same workspace. It is an attributed private moderation decision, not a recipe approval, a host tasting, a public post or an import into the host photo library. Existing reject/reopen/revision/retry behavior applies.

Explicit redaction removes the stored review-image bytes and original text in the same transaction while retaining the moderation audit, type and version link. An old accepted receipt cannot restore the deleted image. It cannot erase another device's existing preview, screenshots/downloads, or database backups; retention/backup erasure remains a release concern. Public reuse permission alone never triggers reuse or publication.

## Storage decision and bounds

This quarantine uses a private database table, **not** the public recipe-photo bucket. Only bounded server-cleaned JPEG base64 is stored; raw camera bytes and filenames are not stored. This keeps submission plus image atomic, avoids orphaned public-upload URLs, and requires no anonymous Storage access or new external service. The table has RLS, no anonymous grants, no direct host write grants, and an invoker read RPC restricted by workspace membership and nonredacted source state. The existing narrow private moderation capability checks the actual authenticated host before writes or deletion.

This trades additional database/backup volume for a simple bounded private review store. Each workspace is capped at 200 photos and 64 MiB of JPEG bytes (base64 overhead is additional). Source-attempt and proof quotas still apply. The cap is serialized in the database; full stores refuse new photos rather than evict existing material. Rejection retains a photo for review; redaction releases its space. No retention cron or cleanup service was silently activated. Production activation must review these bounds, backup/privacy handling and whether the expected volume calls for a separately approved private Storage implementation.

## Verified evidence and limits

`tests/mixology-listener-photos.test.mjs` uses the actual pinned codec, local handler and isolated PostgreSQL. It covers required permissions, private-only consent, corrupt/oversized JPEG rejection, server metadata removal, separately disabled photo intake, proof-before-decoder behavior, idempotence, host/nonmember/anonymous access, exact-version keeping, no taste/approval creation, physical image redaction, no restoration through old receipts and the 200-photo hard cap.

`scripts/mixology-listener-photos-browser-smoke.mjs` passes at 390/1440px using actual local codec/SQL with a fake proof provider: SVG rejection, local metadata removal, filename exclusion, image preview, private-only consent, committed-but-lost response, stable retry, version verification, no host media import, redaction and no image persistence in localStorage. Images are intentionally blank **FORMAT TEST ONLY** decoder fixtures, not real drink photographs, generated assets or claimed listener/tasting results. Screenshots use `artifacts/mixology-listener-photo-{form,review}-{390,1440}.png`.

The real photo library, model quality, actual drink taste, real gateway/CAPTCHA, hosted Auth/PostgREST, advisors, Edge-runtime performance and real hosts are not validated by these fixtures. Existing release gates remain. No paid call was made.

## Remaining work

- The explicit consent/provenance-preserving handoff has now been implemented locally; see `MIXOLOGY-LISTENER-HANDOFF.md`. Keeping alone is still private review; linking requires a separate explicit host action and does not publish.
- Add contextual photography/styling guidance and source-backed trend freshness review.
- Resolve the intermittent existing caret-position and media-conflict browser assertions during acceptance hardening. A later passing rerun is not a proven fix.
- Review source retention, current reuse rights, spoiler checks and separate host approval before any public use. Public activation, hosted migrations, service configuration, paid usage and deployment require separate explicit approval.

References inspected: [jpeg-js options and license](https://github.com/jpeg-js/jpeg-js), [Supabase private access controls](https://supabase.com/docs/guides/storage/security/access-control), [Supabase changelog](https://supabase.com/changelog). The Markdown changelog endpoint was not readable through the browser tool; its HTML index was used instead. The observed Flutter breaking change does not apply to this JavaScript repository.
