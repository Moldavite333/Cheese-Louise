# Mixology preparation and approval checkpoint — November 9, 2026

This is a historical checkpoint. Persistent preparation and approved-version recording packets have since been implemented and tested locally; see [MIXOLOGY-PRODUCTION.md](MIXOLOGY-PRODUCTION.md) for current capabilities, verification and remaining work.

The current user request authorizes local implementation and tests across the planned stages. Earlier read-only instructions and local documents' requests to stop before further code work are historical; they do not require renewed permission for development. Deployment, hosted migrations, paid calls and external-service changes remain unauthorized.

## Verified repository and preserved work

This checkout is `mixology-stage1`, with origin `Moldavite333/Cheese-Louise`, based on `86d6771` (exact movie title search). Stage 1/2 files were already present as uncommitted work when this continuation began. They were retained, and the initial full Node suite passed 225 tests before this increment. This does not establish that the checkout matches today's remote production head; no fetch, push, deployment or hosted database write was performed.

The referenced ChatGPT conversation supplied the architecture and optimization handoff, including either-host approval, one canonical shared identity, independent counterparts, real photography and noncompetitive moderated submissions. `/mnt/data/Pasted text(2).txt` is absent from this Windows environment. The cached conversation omits attachment contents and truncates the later handoff. The requested Q3=C, Q18=B, Q19=C remain constraints; this increment does not reinterpret their missing question wording.

## Implemented in this continuation

- `mixology-prep.js`: pure scaling of explicit quantities, including simple and mixed fractions. Keeps original units, identities, order and source recipe intact. Ambiguous legacy text is explicitly unscaled. Derived amounts do not become a new recipe version.
- Preparation panel: shopping quantities, original assembly steps and garnish, plus ingredient-specific guidance for carbonation, fresh citrus, bitters/seasoning, dilution and garnish counts. No storage life, elapsed time, flavor outcome or readiness score is invented.
- Episode shortcut: opens preparation for the selected canonical cocktail; returning retains unfinished episode fields. It does not overwrite a recording outline or create a second recipe.
- Exact-version approval: either workspace host can approve or withdraw approval from the selected saved version without ratings or a tasting form. Approval never creates tasting evidence and never carries to a later version or the counterpart.
- Approval history: immutable attributed decisions; server timestamps; stable retry IDs; explicit unavailable-storage state. Both hosts see the history. Empty ingredient/step recipes cannot be approved.
- Prepared additive migration: `supabase/migrations/20261110010030_mixology_approval.sql`. The CLI generated its UTC filename; the user-facing checkpoint date is Denver time. It is unapplied to hosted databases. RLS, explicit grants, invoker RPC, actor validation and composite workspace references follow the existing canonical model. No existing policies or data are replaced.

Approval status is shown for a selected saved version in Taste. Preparation explicitly uses the current working draft. These are different views; preparing a draft does not mean that draft is approved. Actual recipe taste, model quality and a real two-host session remain unverified.

## Verification

`node --test tests/*.test.mjs`: **229 passed**, including fraction/ambiguous scaling and actual PostgreSQL/WASM approval permissions, idempotency, attribution, nonmember/anonymous rejection, immutable decisions, later-draft separation and independent counterpart checks.

Browser fixtures block external requests and use fictional data. The updated Mixology suite covers preparation at 390/1440 px, invalid servings, approvals and withdrawals by both hosts, a later saved version with no inherited approval, editing/recovery and the episode-return flow. Research/bartender flows passed at both widths with fake provider responses. Existing cocktail checks passed at both widths and assembled HQ checks passed at 360/768/1024/1440 px. Phone and desktop preparation screenshots were visually inspected; an ambiguous legacy quantity label was clarified after inspection.

The runtime's `npm` command was unavailable and the `pnpm` wrapper tried an out-of-workspace metadata write. Tests were run directly with the installed Node runtime and existing pinned dependencies. Playwright used the already installed browser under the user's `AppData/Local/ms-playwright`; the isolated localhost checks required the execution sandbox override. No dependencies were installed and no paid providers were called.

## Remaining implementation

This checkpoint is not completion of Mixology Lab 2.0. Remaining work includes persistent preparation components with host-entered active/passive timing and checklists; approved-version recording packets; photography upload/library and rights/credit records; recipe-page and promotional drafts with explicit spoiler review and source provenance; and listener intake/moderation with privacy and abuse controls. The current preparation panel does not claim those capabilities. Photography must use actual drink photos; no synthetic photography was produced.

No reminder, inventory integration, external research automation, public intake, photo bucket or publishing endpoint was activated. The existing bartender remains disabled unless its separately documented server configuration and a provider budget are explicitly authorized.

Before release, separately authorize a staging environment and apply Stage 1, Stage 2, then approval migrations there. Verify actual Auth/PostgREST sessions, cross-device conflict/retry behavior and backup/recovery. Review the previously documented production-document policy issue independently. Production migration, deployment/publication and any paid provider activation require explicit approval. Local development remains authorized without another approval gate.

References used while preparing access controls: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [CLI changelog](https://supabase.com/changelog). SQL was verified locally, not against the hosted service.
