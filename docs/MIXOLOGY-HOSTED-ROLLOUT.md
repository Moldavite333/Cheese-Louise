# Hosted rollout verification — November 10, 2026

Supabase sign-in is now verified. The release schema is applied to the existing Cheese Louise project `wgvsnmukiaobcbyqhkkt`. GitHub Pages is confirmed to publish the `main` branch at the repository root. PR #103 contains the frontend release; publication is pending its regression checks.

## Verified backend results

- Reconstructed an ignored release-only runner from all 29 actual hosted migration entries plus the 11 new Mixology migrations. Dry run selected exactly those 11; no old history was repaired, reverted or reapplied.
- All 11 migrations applied successfully, producing 18 new public Mixology tables, each with RLS, and a private `mixology-photos` bucket.
- Full-schema rollback-only preflight passed on the actual hosted database. Rollback-only hosted-member tests passed for new draft/save/checkpoint, stale-save rejection, independent alcoholic/alcohol-free records and no inherited tasting/approval. Nonmember reads/writes were denied. No synthetic test record, taste or approval remains.
- Actual anonymous HTTP requests to recipes, submissions and media returned 401. The deployed protected bartender rejects unsigned requests with 401. No Mixology enabled flag existed; the paid provider remains disabled. Public intake was not deployed or enabled.
- All 17 preexisting cocktail rows compare exactly to the pre-release recovery snapshot; the existing episode collection remains unchanged (zero rows at inspection).
- Security advisors show the same four existing warnings before and after, with no new notices: the intentionally public poster function, signed-in helper functions, and disabled leaked-password protection. The separately documented existing production-document policy workspace-comparison defect remains unchanged.

## Recovery and limits

A private, ignored local snapshot contains the existing recipe/episode rows, migration statements, function definitions, policies, indexes and bucket metadata. It is a targeted logical recovery copy, **not a full database/Auth/Storage backup or a tested disaster recovery plan**. Hosted backups listing returned no existing backups and PITR disabled. The standard schema dump could not run because Docker/Podman is absent. No infrastructure or backup subscription was enabled.

For frontend rollback, restore main to source before this release (`86d6771d29cacdf40b163024566b0c29decdd175`) using a reviewed revert. Retain the new database tables/histories; do not drop them as routine rollback. Revisit a full backup/restore plan separately before relying on the new workspace for irreplaceable production material.

Real-host taste/usability, actual drink photographs, real authenticated browser/storage round trips and cross-device use remain acceptance checks. Automatic trend collection, paid bartender generation and live public submissions are not delivered/enabled by this rollout. Older/redacted moderation queue browsing and the historical intermittent media-conflict fixture remain local backlog. These limitations do not become completed features because deployment succeeds.

## Frontend publication verified
PR #103 passed every GitHub regression check (run 42809540258) and merged as 6ae390e5eb8b7a6d6208c7b4e1169d1e2130fd0e. GitHub Pages run 42810110952 succeeded. All 19 Mixology script/style/shared-contract assets fetched from the live site match the tested source (normalized line endings). Live anonymous browsers at 390/1440px loaded all required assets without page errors or horizontal overflow; sign-in screenshots were visually inspected. This verifies anonymous startup, not real-host authenticated interaction. No real taste/photo evidence was invented. Documentation-only follow-up commits do not change this verified application source.
