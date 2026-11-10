# Mixology deployment handoff — November 10, 2026

The user explicitly requested deployment ("lets get this deployed"). This supersedes the earlier no-deploy/no-hosted-migration restriction for this release. It does not authorize paid model activation, destructive production-data operations, or changing the site audience.

## Verified target and access

- Source: https://github.com/Moldavite333/Cheese-Louise, default branch main.
- Live HQ: https://moldavite333.github.io/Cheese-Louise/ returned HTTP 200.
- Local and remote HEAD both 86d6771d29cacdf40b163024566b0c29decdd175 at inspection.
- Current local branch feat/mixology-stage1 contains preserved uncommitted implementation. No source was pushed.
- Git dry-run push succeeded. Public repository metadata reports GitHub Pages enabled; exact Pages source/branch settings have not been authenticated/verified (anonymous Pages API returned 404).
- Existing app targets Supabase project wgvsnmukiaobcbyqhkkt.
- Supabase CLI whoami returned AccessTokenRequiredError. Connector list_projects requires a nonempty link_id not supplied by the available connection. No hosted inspection or mutation succeeded.

## Release sequence after authentication

1. Inspect authenticated Pages settings, Supabase project identity, current schema, migration history, existing security advisors and backup/restore availability. Reconcile old HQ migration history before applying anything; do not blindly push every repository migration.
2. Resolve or explicitly assess the known production-document policy finding, older/redacted submission queue limitation and intermittent caret/media conflict checks. Prior fixture reruns do not establish fixes.
3. Compare the 11 prepared Mixology migrations against the actual schema. Verify a recoverable backup, then apply only reconciled pending changes, preserving existing data. If a staging environment already exists, use it first; creating billed infrastructure needs separate approval.
4. Verify actual member/nonmember authorization, PostgREST RPCs, independent approval, autosave/conflicts and private Storage behavior. Use dedicated test records with clear provenance; never invent taste results.
5. Keep paid bartender and public listener/proof integration disabled. Public submission deployment requires verified gateway/origin/quota configuration and Deno Edge runtime checks; it must not be enabled incidentally.
6. Prepare a versioned source commit, run required checks and publish through verified existing Pages configuration only after backend readiness. Verify deployed assets, sign-in and critical HQ/Mixology paths.
7. Roll back frontend to the preceding commit if needed; retain new tables, versions and histories. Do not drop tables as rollback. Record deployed SHA, migration results and verification evidence here.

## Checks in this deployment attempt

- Fresh Node test suite: 305 passed, zero failed (artifacts/deployment-node-tests.txt).
- git diff --check passed (line-ending warnings only).
- Fresh HQ browser fixture passed phone, tablet, small laptop and desktop; mocked authentication/data, no live records accessed.
- Keyboard accessibility fixture result is recorded in the current build checkpoint after completion.

Deployment has not occurred. Supabase authentication is the current access blocker. User was asked to complete local CLI browser sign-in, keeping tokens out of chat. No paid call, hosted migration, production-data write, push or Pages publication occurred in this attempt.

Keyboard follow-up: reproduced the desktop failure with diagnostic evidence that setSelectionRange(3,8) ran on a disconnected, inactive input. Updated the test to resolve the current input, focus/select and render atomically in one browser task; assertion remains unchanged. Corrected keyboard suite passed at 390/1440px. No application focus behavior changed; the separate media-conflict intermittency remains unresolved. Phone output was visually inspected.

## Supabase access and backend rollout update
Sign-in is verified; all 11 reconciled migrations are now applied. See MIXOLOGY-HOSTED-ROLLOUT.md for exact hosted checks, unchanged legacy data, disabled integrations and recovery limitations. PR #103 is awaiting frontend release checks. Earlier authentication blockers above are historical.

Frontend release is now published and verified: PR #103, application merge 6ae390e5eb8b7a6d6208c7b4e1169d1e2130fd0e, successful Pages run 42810110952, 19 matching assets, phone/desktop anonymous startup and visual inspection passed. Paid bartender generation and public listener intake remain disabled; see hosted rollout notes for outstanding checks.
