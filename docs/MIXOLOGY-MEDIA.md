# Real-photo library checkpoint — November 9, 2026

Recipe/promotional review drafts have since been implemented locally; see [MIXOLOGY-PUBLICATION.md](MIXOLOGY-PUBLICATION.md) and the current [build status](MIXOLOGY-BUILD-STATUS.md).

This follows the completed local preparation/recording stage in `MIXOLOGY-PRODUCTION.md`. See `MIXOLOGY-BUILD-STATUS.md` for the current backlog and authorization boundary. The full Lab 2.0 build is not finished.

## Implemented

The Photos tool shares the existing canonical cocktail and saved recipe-version identities. Each photograph belongs to the exact recipe version photographed. A later version or alcohol-free counterpart starts without inherited photos. Nick and Jenny share photo records and can correct credit/caption details with revision checking.

Uploads require descriptive alt text, photo credit, an ownership/permission note, and separate real-photo/rights attestations. Active-library eligibility requires both attestations. These are human statements, not an AI detector or independent rights verification. Withdrawing either attestation hides a photo from active reuse. Hidden records remain available to hosts for correction/audit; hiding does not delete bytes.

The browser accepts still JPEG/PNG/WebP inputs up to 12 MB, checks format signatures and rejects animated PNG/WebP, decodes the image, and prepares a JPEG copy capped at 2400 pixels on the long edge and 5 MB. Each dimension must remain at least 320 pixels. Re-encoding removes camera metadata, and the original filename is not uploaded or recorded. Camera originals remain on the user's device. A client-computed SHA-256 digest gives retries a stable processed-file identity; it is not an independent server-side image-authenticity measurement.

The private library displays caption/credit, version, dimensions and permission notes. Five-minute signed previews are kept in memory, never in database records or browser recovery. Preview failures have an explicit refresh path. Real-drink photography guidance uses the selected version's glassware and garnish. No synthetic cocktail images or public photo publishing were added.

After a successful upload, the empty upload form collapses so saved photos remain easy to reach. Opening an existing photo's details moves focus to its editor. The first upload and recovered unfinished forms remain directly accessible.

Upload text survives reload, but the actual file must be selected again after reload. Failed uploads keep the current processed file/details in memory. A stable upload identity and metadata-registration retry handle a lost registration response without overwriting an object or creating another photo record. Metadata edits use the shared draft store for local recovery, debounced revision-checked saves, conflicts, export and deliberate copy selection.

## Storage and access controls

`supabase/migrations/20261110032432_mixology_media.sql` was generated with the installed CLI and remains unapplied to hosted services. It prepares:

- A private `mixology-photos` bucket accepting JPEG copies up to 5 MB. An existing bucket with conflicting settings aborts the migration instead of being reused silently.
- Workspace/version/UUID object paths. Authenticated membership and the version's workspace must match; an uploader cannot forge another owner's ID.
- Workspace-scoped `mixology_media` metadata, explicit grants/RLS, immutable object identity, revision-checked edits and invoker registration/save RPCs.
- Registration that requires an existing private object owned by the caller and reads its byte size from Storage metadata. Another host can edit an already registered photo's credit without changing its original uploader.
- No new object update/delete policies, public read policy, service key in the browser, or public bucket. Metadata correction cannot silently overwrite image bytes.

The frontend uses the existing signed-in Supabase client. No new API key, bucket, hosted policy or external service was activated during development. Failed registration can leave a retained private object for a safe retry; administrative orphan/retention cleanup is not implemented. Do not delete such objects automatically as a recovery action. The UI currently loads the newest 50 photo metadata records for the selected version and reports the loaded count.

## Verification

The full automated suite has **247 passing tests**. New checks include active-photo eligibility, dimensions, format mismatch and animated WebP rejection, a conflicting public bucket, private Storage RLS, ownership checks, same-ID registration retry, revision conflicts, immutable object identity and rights withdrawal.

`scripts/mixology-media-browser-smoke.mjs` passed at **390 and 1440 px**. It exercises invalid-file rejection, form recovery, actual Chromium JPEG decoding/re-encoding, removal of a synthetic EXIF marker, a lost-registration-response retry, signed private preview loading, absence of signed URLs in browser recovery, shared credit conflicts, hiding after rights withdrawal, and no inherited photos on a later saved version. Screenshots contain an unmistakably blank format-test fixture and fictional credits, not an actual drink photo or generated product photography.

Storage transport/signing is mocked around isolated PostgreSQL/WASM policies. These tests do not establish hosted Supabase Storage compatibility, photographic quality or real-world photo rights. No real photographs, production records or paid APIs were accessed. Existing editor/approval, preparation/recording, research/bartender and cocktail browser regressions passed at both widths. Existing assembled HQ checks cover phone, tablet, laptop and desktop widths. New script syntax checks and diff whitespace checks passed.

Use `node scripts/mixology-media-browser-smoke.mjs` or the package script `test:mixology-media-browser`; the regression workflow includes it. Review images are generated under ignored `artifacts/mixology-media-390.png` and `artifacts/mixology-media-1440.png`.

Before release, separately authorize staging and verify actual Storage ownership metadata, bucket settings, all existing Storage policies in combination, signed URL expiry, mobile camera-file behavior, upload failures, and two-device editing. No claim is made that those hosted/real-host checks have occurred.

References: [Storage access controls](https://supabase.com/docs/guides/storage/security/access-control), [upload API](https://supabase.com/docs/reference/javascript/storage-from-upload), [signed preview API](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl).
