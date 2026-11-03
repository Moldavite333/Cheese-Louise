# Cheese Louise HQ — Production Studio Lab, Run 22
**Review date:** 2026-11-02 (America/Denver)
**Branch:** `lab/hq-six-pr-integration-20261102-run7` · [draft PR #57](https://github.com/Moldavite333/Cheese-Louise/pull/57)

## P0 finding: production schema contradicts uncapped Cheese Grating

Read-only inspection of the **actual Cheese Louise Supabase project** found:
- `public.movies.movies_cheese_score_check` enforces `cheese_score >= 0 AND cheese_score <= 100`.
- `public.movie_traits` has an INSERT/DELETE trigger that calls `public.recompute_movie_cheese_score(uuid)`, which writes the **full SUM** of linked `cheese_traits.points` to `movies.cheese_score`.
- The trigger does not handle updates to `cheese_traits.points`.
- Among existing linked-trait records, **one movie** currently has a verified-trait sum **over 100 (105)** and a discrepancy against the stored legacy score (**16 points**). The maximum stored movie score is **89**. This is a read-only aggregate; no production records were edited.

**Consequence:** Adding/removing a checked trope for a movie whose verified total exceeds 100 can fail when the recompute function attempts to write a value rejected by the old check. The UI already correctly treats Cheese Grating as an uncapped total and flags legacy discrepancies. Do **not** solve this by clamping the total, silently rewriting historical scores, or treating stored legacy scores as verified.

### Review-branch implementation
- Added `supabase/migrations/20261103010000_uncap_cheese_grating.sql` to replace the 0–100 constraint with a nonnegative-only constraint. This migration contains **no data updates** and has **not been applied to Supabase**.
- Added `tests/cheese-grating-schema.test.mjs` to assert the migration removes the upper limit and does not rewrite legacy records. This is source-contract coverage, **not a database integration test**.
- Preserve the existing read-only `cheese-grating-integrity.js` audit and uncapped UI tests.

### Codex staging acceptance tests — REQUIRED BEFORE DEPLOYMENT
1. Apply migration to isolated staging; assert `movies_cheese_score_check` is nonnegative-only.
2. Create a disposable staging movie with verified traits totaling **140**; insert and delete a checked trait; assert stored score matches the full sum and no constraint error occurs.
3. Assert a negative score is still rejected.
4. Assert existing legacy stored scores and `movie_traits` are byte-for-byte unchanged by the migration itself.
5. Test trait **point edits** separately: determine whether automatic recomputation is desired; preserve an audit trail and do not silently rewrite legacy provenance. Add a reviewed trigger/backfill only after explicit design and data review.
6. Test RLS: unauthorized/anonymous clients cannot mutate production scoring data.
7. Confirm new static client and backend migrations are deployed in a coordinated, backward-compatible order. Keep PR #57 draft until authenticated laptop/phone and REAPER checks pass.

## P1: practical two-host synchronization — no new paid AI, no unnecessary realtime

The existing storyboard uses browser-local `cheeseLouise:timeline:v1:<workspace>:<movie>` state, and Watch Along uses browser-local `cheeseLouise:watchAlong:<workspace>:draft:<movie>`. The recording desk is also local-first. **Nick's laptop and Jenny's phone are not yet authoritative shared note storage.** The Supabase project already has authenticated `workspaces` and `workspace_members` (two members); `episodes` exists but currently has no rows. Reuse those foundations.

### Codex implementation slice A: shared scene notes only
- Create a **reviewed migration** for `production_scene_notes` (workspace_id, movie_id, scene_id, field [nick_notes/jenny_notes/shared_notes], body, revision, updated_by, updated_at). Unique key: workspace + movie + scene + field. Stable existing scene IDs; do not duplicate the storyboard.
- Enforce RLS using existing workspace membership; anonymous users have no read/write access. Use a server-validated compare-and-swap mutation (`expected_revision`) so concurrent edits to the **same field** cannot silently overwrite each other.
- Nick and Jenny may edit different fields concurrently; each retains explicit last-editor attribution. When the same field conflicts, keep the local draft and show both versions for manual resolution.
- Keep a local pending-change queue for offline operation; show `Saved on device`, `Syncing`, `Saved to HQ`, `Offline`, and `Conflict` accurately. A successful localStorage write is not cloud synchronization.
- Initial version: sync on blur / explicit save, fetch latest on entry and on return to foreground; **no continuous realtime requirement**. Use a low-frequency refresh only if justified. Do not synchronize the HQ recording timer as though it were audio time.
- Before first cloud import, offer a JSON recovery download and a per-field comparison. Never silently replace the local storyboard or rundown. Do not upload private notes to any AI service.
- Leave current `movie_traits`, Bingo results, Cheese Grating, and recording markers untouched. Roll out behind a workspace-scoped feature flag with reversible opt-out.

### Acceptance tests
- Two authenticated hosts edit **different** scene fields on separate devices: both survive refresh.
- Both edit the **same** field from the same revision: one update succeeds, the other receives a conflict with both texts recoverable.
- Phone goes offline, edits a note, reconnects: pending draft remains visible until explicit conflict-free acknowledgment.
- Expired session and rejected RLS writes preserve local drafts; no false `Saved to HQ` status.
- Anonymous or nonmember requests cannot read or mutate notes.
- A second browser tab cannot silently overwrite newer state.
- A 25-scene movie remains keyboard-usable at 360/768/1024/1440 px, and the storyboard stays the primary recording view.
- No new AI/API credits or paid infrastructure are required.

## Six-department prioritized roadmap

**P0 — Scoring/release integrity:** Stage and verify the uncapped-score migration, resolve legacy score provenance separately, exact-head CI, Supabase backend-first rollout, authenticated device recovery, actual REAPER marker import.

**P1 — Preproduction/recording:** Implement shared per-scene note sync as above; keep the one-click editable rundown and compact storyboard; then extend conflict-safe sync to rundown fields, never to an uncontrolled whole-document overwrite.

**P2 — Discovery:** Run a fixed difficult-title benchmark for Hallmark/Lifetime/MarVista/Reel One, including `A Christmas Village`, same-name different-year titles and missing credits. Measure recall, dated source evidence and manual fallback before adding providers.

**P3 — Bingo:** Read-only, authenticated handoff of actual game snapshots (marked squares, completed lines, winners), separate from verified movie tropes and predicted suggestions. Five-minute end reveal only.

**P4 — Postproduction:** Keep REAPER marker export, add source/timebase labels and verified-versus-suggested cut provenance; validate import in the actual DAW.

**P5 — Publishing/learning:** Reuse the episode record for credits, cocktail, chapters, show notes, clip review, approval and lightweight analytics. No autopublishing or duplicated entry.

### Research references
- [Supabase RLS and database tests](https://supabase.com/docs/guides/database/postgres/row-level-security) — membership-scoped policies and allow/deny tests.
- [Supabase Realtime options](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — Broadcast versus simpler Postgres Changes; neither is necessary for the initial save-and-refresh sync.
- [W3C carousel accessibility](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) — predictable manual navigation and focus.
- [REAPER user guide](https://dlx.reaper.fm/userguide/) — Region/Marker Manager import and practical DAW verification.

**Release status:** Draft review branch only. No production schema change, score backfill, PR merge, deployment, cross-device validation, or REAPER GUI test. Application runtime code was not changed in this run; one schema migration, one static regression test, and this progress document were added.
