# Revision-first editing audit (November 4, 2026)

Issues: #67, #68, #62. Incremental safety patch; not a completed shared-editing rollout.

| Department / entity | Create / view | Edit / remove | Undo / restore | Order / autosave / sync |
| --- | --- | --- | --- | --- |
| Discovery movies | Existing library and Radar | Existing movie controls; canonical verified data must remain separate | Broader audit pending | Shared movie state; outside this patch |
| Preproduction scenes and host notes | Existing storyboard | Visible scene/card Delete and Edit; host fields inline | 20 mutation deltas persist on device; deleted scene snapshot retained until Undo | Stable IDs; move controls; local autosave; no cloud sync |
| Recording rundown and markers | Existing session/rundown and marker controls | Broader revision audit pending | Original markers and times retained when scenes are removed | Session storage separate; no timeline-sync claim |
| Bingo cards/results | Existing import/results | Authoritative results separate from scene links | Not changed | No writes from timeline |
| Postproduction editing sheet | Existing recording export | Broader revision audit pending | Export preserves recording references | No shared-editing claim |
| Publishing episodes | Existing episode state | Broader revision audit pending | Version-history audit pending | No change in this patch |

## Behavior and compatibility

Scene IDs and the v1 timeline key remain unchanged. Removal stores the scene in optional `deleted_scenes` in the same document. Research refresh skips tombstoned research beats by origin ID or normalized title/summary. Undo removes that tombstone and restores the original scene, notes, order and bookmark. Original recording markers (including merged aliases), audio and Bingo remain untouched; removed scenes' markers remain recoverable by Undo. No automatic marker reassignment is performed.

Navigation and bookmarks persist without consuming the 20-change undo budget. Undo is visible in the footer, including an empty timeline. Confirm removal for notes or linked markers, including markers using merged scene aliases. Existing CSS keeps buttons at least 44px; native buttons support keyboard activation and Delete labels include scene titles.

Timeline/host notes are explicitly device-local in the UI. Use one editing device per movie. There is no cross-device structural write or note-sync endpoint enabled here. Same-browser stale revisions and deleted storage reject writes while retaining the rejected draft for recovery download. LocalStorage read/write is not an atomic multi-tab lock; simultaneous writes remain a limitation. Do not enable Nick/Jenny cloud editing until #62's authenticated transactional timeline/note revisions, typed conflicts and feature flag pass database and two-device tests. Recovery-file import is not implemented.

## Validation and release gate

150 Node tests passed, including six new behavioral regressions: delete/reload/undo, navigation undo budget, marker confirmation/cancel, stale undo, missing storage and research resurrection. No network dependencies or paid calls added. Full browser/mobile/screen-reader rehearsal and two-device testing have not been performed for this patch. Existing browser smoke suite remains the CI gate; browser tooling is absent in this local checkout. No production deployment is requested by this patch. Keep the PR unmerged until the issue release gates and manual rehearsal pass.

The tombstones retain full deleted scene content and add local-storage cost; quota failures retain in-memory drafts and show recovery instructions. No new render-time network work is introduced. Broad department audit and shared synchronization remain open.
