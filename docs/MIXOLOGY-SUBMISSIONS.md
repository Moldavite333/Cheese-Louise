# Listener intake and private moderation — local implementation

No endpoint has been deployed or enabled. `mixology-submit.html` ships with empty endpoint/site-key metadata and makes no provider requests in that state. The private HQ library has a separate Listener submissions workspace; no listener receives a host account or workspace membership.

The typed feedback and variation extension is now implemented locally; see `MIXOLOGY-LISTENER-TYPES.md` for exact behavior, tests and compatibility. Private listener photo intake/moderation is now implemented locally; see `MIXOLOGY-LISTENER-PHOTOS.md`. Photo-to-publication-library reuse remains unfinished.

## Verified behavior

- Strict bounded plain-data contract, permission required, optional credit erased without opt-in, honeypot and public HTTPS source validation. Submitted URLs are never fetched. All source text is escaped and treated as untrusted data.
- Intake is disabled unless every server setting is explicitly present. POST requires the configured exact Origin, a verified Turnstile hostname/action, and a configured trusted gateway address header. Daily HMAC network keys replace raw addresses; the proof provider receives no recipe text or raw network address from the handler.
- Database leases reserve verification before provider work. Failed attempts count toward subject/day and workspace/minute/day limits; replayed accepted IDs and simultaneous requests do not repeat provider verification. Content HMAC deduplicates nonredacted ideas. Request/limit metadata older than 48 hours is pruned during subsequent intake, not by a scheduled job.
- Hosts can curate local recovery drafts, accept once into a new canonical untested recipe, reject, reopen rejected entries, or explicitly redact original text. Acceptance creates no tasting, saved version, approval, counterpart or public post. Alcohol-free-only imports remain independent.
- Either host can moderate. Revisions reject stale decisions; operation IDs support lost-response retries. Raw queue and audit tables have no anonymous access and no direct host write grants. The private fixed-search-path definer helper checks actual authenticated membership before atomic import/audit changes; its public RPC wrapper uses invoker rights.
- Redaction retains the immutable moderation audit and imported canonical recipe. It cannot erase already-imported notes, previous downloads or another device's browser recovery; the UI states that limitation. There is no automatic raw-submission retention deletion or notification service.

## Local evidence

`tests/mixology-submissions.test.mjs` and `tests/mixology-submission-handler.test.mjs` cover contract/privacy, isolated PostgreSQL grants/RLS and authenticated moderation, quota/retry behavior, handler/proof failures, independent untested import, and redaction. Browser fixtures exercise real local handler/SQL with a fake proof transport at 390/1440px: escaped hostile text, separate-host stale decisions, a committed-but-lost response, one import, reject/reopen and explicit redaction. They are not a real gateway/CAPTCHA/provider or hosted Auth/PostgREST test.

## Activation requires separate release approval

Prepare an approved staging deployment, apply the prepared migrations only with authorization, and verify real grants, Auth/PostgREST and private schema exposure. The public-only function needs JWT gateway verification disabled for that function; it does not grant anonymous database access. Do not change gateway configuration for existing HQ functions.

Set server-side `MIXOLOGY_SUBMISSIONS_ENABLED=true`, exact `MIXOLOGY_SUBMISSIONS_ALLOWED_ORIGIN`, `MIXOLOGY_SUBMISSIONS_WORKSPACE_ID`, a random secret of at least 32 characters in `MIXOLOGY_SUBMISSIONS_HASH_SECRET`, `MIXOLOGY_SUBMISSIONS_CAPTCHA_SECRET`, and `MIXOLOGY_SUBMISSIONS_TRUSTED_IP_HEADER` (`x-forwarded-for` or `cf-connecting-ip`), plus the normal Supabase URL/service-role credentials. Never put secrets in browser metadata. Configure the public endpoint and public Turnstile site key only after staging verification.

Verify the selected gateway overwrites/strips spoofed address headers; choosing a header name does not establish trust. Verify the actual allowed host/action, proof expiry/replay, rate limits under concurrency, provider/network failures, CORS, logging privacy, deletion/retention policy and host moderation usability. Approve any external CAPTCHA/service configuration and costs separately. Photo intake additionally requires explicit `MIXOLOGY_SUBMISSIONS_PHOTOS_ENABLED=true` and verified codec/runtime support. No competition, public gallery or automatic publication is part of intake.
