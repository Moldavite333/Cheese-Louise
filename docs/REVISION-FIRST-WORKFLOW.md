# Revision-first episode workflow — November 4, 2026

Review candidate based on main `7475cd402a6ba937be59cb9bae81929566be763b`.
Issues inspected: #62, #66, #67, #68, #93, #94. Existing draft PR #57 overlaps recording recovery/format work and remains a separate, unmerged integration candidate. This change does not establish its compatibility with #57.

## Changes

- `automatic-timeline.js`: group continuous same-scene/same-field typing into one undo delta; break on blur, other actions, field/scene changes, or a 1.5-second idle gap. Persist every input immediately without redrawing the textarea. Keep the existing 20-action history, including across reload. Preserve rejected drafts in memory on storage conflicts/failure.
- `timeline-core.js`: import both committed manual beats and unsaved legacy drafts once into canonical scenes. Keep original raw data in a source backup, deduplicate by time/text, retain stable existing scene IDs and deletion tombstones. Legacy storage is retained.
- `recording-hub.js`: retire the duplicate manual editor and mutation APIs. If the scene module is unavailable, show recovery guidance instead of another timeline. New sessions use the approved format; existing unversioned sessions keep v1 indices, lap names, timestamps and markers. Current v2 cue resolves by stable section ID.
- `episode-format.js`: one definition for recording cues and rundown headings. New sessions: 20-second cold open, theme cue, welcome/banter, cocktail, movie discussion, five-minute Cheese Grating/Bingo reveal, closing. Optional Horror-fied is supported in the format model and absent by default; there is no new format editor.
- `watch-along.js`: combine canonical chronological scenes, separate Nick/Jenny/shared notes, movie credits, episode-linked cocktail recipe, discussion prompts, checked movie tropes and the approved ending. Never invent Bingo winners or independent verification. Multiple episodes for the same movie remain an existing ambiguity: the first linked episode supplies cocktail data.
- Keep one saved editable rundown in the existing Watch Along draft. Recording opens that same text inline in one click. Timeline copy/download uses the same rundown. Automatic note/trait refresh does not overwrite user edits (including deliberately empty text) or ask for rebuild on every input. Explicit rebuild retains the previous text for Undo, including after reload.
- Detect stale same-field rundown writes on the same browser origin. Keep the rejected text in memory; leave the other tab's stored text intact. Storage failure also retains the rundown draft in memory. Copy/export before closing a conflicted or unsaved tab. This is best-effort detection, not an atomic lock.
- Recovery-file import validates schema/movie identity, confirms replacement, preserves old source references for Undo, and leaves audio/Bingo untouched. Damaged JSON can be downloaded before validated restoration. Ordinary restoration is undoable; damaged-data restoration downloads the original raw data instead of creating a valid-document undo entry.
- Marker notes can be edited; deleted markers can be restored from a persisted 20-entry stack without changing their recording timestamps. Quick marker is available in the sticky recording controls. Scene controls have at least 44px height; the detail heading wraps on phones.
- Refresh asset cache keys.

## Revision audit of the touched workflow

| Data | Edit / remove / reorder | Undo / recovery | Persistence |
|---|---|---|---|
| Scenes and separate host notes | Existing inline editor, visible delete, move earlier/later | Grouped text undo, delete/reorder undo, JSON recovery | Device-local, revision conflict warning |
| Legacy manual beats/drafts | Imported into the scene editor | Original raw backup retained | Original legacy data retained; import marker prevents repeats |
| Episode rundown | Inline in Recording and Watch Along; text can be freely rearranged | Undo explicit rebuild; copy/export unsaved conflict draft | Same device-local draft key, best-effort same-field guard |
| Recording markers | Edit note / remove | Persisted deletion undo; original clock retained | Existing local session storage |
| Verified movie metadata, original audio, Bingo authority | Not removed by timeline mutations | Not modified by this change | Existing systems remain authoritative |

This is a focused workflow audit, not certification that every entity in all six HQ departments has revision history.

## Validation

- `node --test tests/*.test.mjs`: **161 passed, 0 failed**.
- Syntax check of all root browser scripts: passed. `git diff --check`: passed.
- Assembled browser fixtures: Chrome at 360×960, 768×960, 1024×960, 1366×768 and 1440×960. Tests cover all existing HQ routes, delete/cancel/undo, bookmarks, separate notes, typing focus/caret, paragraph undo, inline rundown handoff, explicit rebuild/undo, viewport overflow, and real same-origin two-tab stale-edit/delete/undo rejection. The rejected draft remains exportable while the newer stored version survives. Fixture authentication/data only; no live user records.
- Node regressions cover quota/read failure, reload persistence, stale-tab deletion/undo, research tombstones, one-time legacy migration, recoverable malformed data, old/new recording formats, marker revisions, cocktail content, and independent-device local-storage isolation.
- One browser attempt failed an existing navigation keyboard-focus assertion before reaching the new conflict test; the final rerun passed all five widths, including the two-tab conflict scenario. Test-only browser-context and duplicate-dialog-handler failures were also corrected. Earlier implementation failures were corrected before final validation.

## Deployment and unresolved requirements

Public read-only health check: 78 assets passed; main regression and Pages deployment succeeded for `7475cd4`. Served scripts differ from this review candidate; `episode-format.js` returns 404. These changes are **not deployed**.

**#62 remains open:** no authoritative shared timeline revision registry, membership-checked note RPC, cloud structural editor lease or authenticated device conflict reconciliation has been implemented. Two independent devices remain isolated. Existing UI explicitly instructs one editing device per movie. Same-origin localStorage compare-before-write cannot guarantee atomic concurrency across simultaneously writing tabs.

Real Nick/Jenny phone/laptop editing, offline reconnect against a shared backend, Safari/IME keyboards, RØDECaster/REAPER clock alignment and a recording rehearsal remain unverified. The recording session layer on main still lacks the interrupted-clock and comprehensive tab guards being developed in #57. Do not mistake a successful fixture reload for verified audio continuity.

Keep the PR draft. Integrate/review against #57 and complete shared structural-note safety, staging and authenticated rehearsal before release. No production data writes, database migration, merge or deployment was performed.

