# Mixology Lab acceptance audit — November 10, 2026

This is a source/code/fixture audit, not host acceptance or a claim of full completion. The current authorization permits local implementation; deployment, hosted migrations, paid calls and external service changes remain gated.

## Specification provenance

The referenced ChatGPT conversation `6af1fa24-1cf0-83e8-b338-9bb2aa7d43d4` was reread through `read_thread` on this run. The cached master handoff explicitly enumerates M01–M20 and starts the staged implementation instructions, but each long message is capped at 20,000 characters. It does not expose the original multiple-choice wording for Q3=C, Q18=B, Q19=C. Preserve those corrections without guessing their meanings.

The actual attached `Pasted text(2).txt` became readable through its returned Windows preview path. Its full independent optimization instructions are preserved verbatim in `MIXOLOGY-OPTIMIZATION-REVIEW.txt`. The historical read-only directions in that source are superseded by the user's explicit local build authorization. Those instructions are an input to this audit, not a completed independent-review report.

## Approved requirement coverage

“Local” below means source plus isolated tests, with fixtures rather than real taste/provider/host results. File references are relative to the repository.

| Requirement | Current implementation/evidence | Limit or remaining work |
|---|---|---|
| M01 Starting experience | Library/movie/episode entry; `mixology-studio.js`, `mixology-tools.js`; editor and research browsers | Suggestions are deliberate tool actions; no background paid generation |
| M02 Five concepts | Five distinct structural directions; research/core tests and stage2 browser | Real host flavor quality still untested |
| M03 Two-stage research | Initial concept summaries, selected-only deep lookup; `mixology-research.js` | Provider coverage is bounded and failures visible; not exhaustive web research |
| M04 Creative ingredients | Editable structured recipe and substitutions through reviewed bartender proposal | Optional home-bar inventory not implemented; do not add mandatory inventory setup |
| M05 Collaboration | Shared conversation, validated proposal preview/apply/undo, direct edits and revisions | Paid model disabled; live quality/transport requires approved staging/provider pilot |
| M06 Independent tasting | Exact-version separate-host comments/chips/make-again; corrections retain evidence | No physical tasting or real-host preference validation; do not infer from legacy ratings |
| M07 Either-host approval | Exact-version attributed approval/withdrawal with no mandatory rating | Hosted Auth/PostgREST check remains |
| M08 Promotion package | Whitelisted recipe page/print HTML with real-photo copy and social/show-note drafts | Local review exports only; explicit separately authorized publication needed |
| M09 Real photographs | Private photo library, attestations, metadata stripping, revisioned rights and existing contextual glass/garnish/light/crop guidance in `mixology-media.js` | Basic guidance already exists; real host photography/usability validation still needed |
| M10 Naming | Editable name, selected source search, duplicate canonical name protection | Search cannot prove name availability or absolute originality |
| M11 Shared library | Existing searchable canonical library; studio/recent drafts; movie/episode links | Cross-device real-host pilot remains |
| M12 Trends | Manual shared source-review/freshness workflow, dated evidence/limitations, movie relevance, source history and review due labels; `MIXOLOGY-TRENDS.md` | No automatic broad trend collector/provider integration or automatic model input is implemented; real source/host validation remains |
| M13 Preparation | Persistent tasks/components, checklist, shopping groups and active/passive estimates | Reminders optional and not activated; unknown duration stays unknown |
| M14 Recording | Version-bound segment review, private immutable approved recording packets | No live recording companion added; real-host packet rehearsal remains |
| M15 Scaling | Parsed numeric quantities, practical units and carbonation/seasoning/dilution guidance; `mixology-prep.js` | Imported ambiguous lines stay verbatim; no claimed validated large-batch taste |
| M16 Alcohol-free | Independent counterpart data/version/tasting/approval; public alcoholic exports require approved counterpart | Actual AF balance must be developed/tasted independently by hosts |
| M17 Originality | Selected comparable sources and explicit differences; no originality percentages | Limited provider searches do not establish legal/name/originality guarantees |
| M18 Listener participation | Private idea/feedback/variation/photo intake, verified version links, abuse/privacy controls, once-only untested recipe imports, bounded private photo quarantine and physical image redaction; `MIXOLOGY-LISTENER-PHOTOS.md` | Explicit reviewed, source-linked handoff now implemented; current consent is rechecked on preview/export. No automatic public gallery or posting. |
| M19 One shared record | Canonical cocktail/variant/version references reused by episode preparation | Hosted migration/backup/rollback and old-consumer staging regression gates remain |
| M20 Contextual workspace | Direct editor plus research, bartender, taste, prep, photos and recipe/promo tools | Broad keyboard/screen-reader/manual accessibility acceptance remains; focus hardening below is a targeted increment |

## Workflow and accessibility increment

`mixology-accessibility.js` wraps rendering only while a Mixology surface is present. It restores identified controls and text selections after rerenders, keeps textarea labels independent of saved text, gives the current tool panel a named region, relates toggle buttons to the panel, and focuses the workspace heading on entry. Normal grouped buttons retain native Tab/Enter semantics rather than pretending to be an ARIA tab widget. Focused elements remain below the sticky header and, on phones, above the fixed HQ navigation. Other HQ surfaces retain their own navigation behavior.

Listener selection commits only after its history arrives and ignores older out-of-order responses. Selection completion focuses the review heading. Pending moderation prevents queue/filter/back actions both through disabled controls and function guards, preserving the operation's context until the result arrives. Original text is never interpreted as an instruction.

The isolated accessibility browser suite checks shipped unconfigured intake makes no intake/proof request even after permission is checked; keyboard studio entry/tool use; named region; caret recovery; phone focus visibility; reordered listener selection responses; preservation of an edited later selection; and disabled/function-guarded pending moderation at 390 and 1440px. It is not WCAG certification or a screen-reader study.

## Verified test checkpoint

Latest checkpoint: all 305 Node tests passed. Trend/source and selected-research link-reuse browser checks pass at phone/desktop widths, including movie context and lost-review recovery. Listener regressions passed. The integrated batch reproduced the existing desktop caret assertion; connected/active diagnostics were added and three subsequent isolated reruns passed without an application focus fix. Remaining editor/production/media/publication/HQ/cocktail checks passed. Keep caret/media intermittencies open. Source-review mobile/desktop output was visually inspected. No hosted migration, deployment, real trend dataset or host tasting was performed.

## Remaining local work, in order

1. Finish intermittent caret/media acceptance issues and older/redacted listener queue browsing. Manual source-review/freshness is implemented; see `MIXOLOGY-TRENDS.md` for its explicit non-automatic scope.
2. Evaluate the already implemented contextual photo guide for readability and usefulness; avoid duplicating its current glass/garnish/lighting/crop advice. Keep optional tools optional and do not activate external schedulers/providers.
3. Finish journey/keyboard/accessibility regression coverage and resolve the intermittent photo conflict-recovery browser failure. Record observed results rather than relabeling reruns as a proven fix.
4. Reconcile any unavailable original decision wording when supplied. Exercise real hosts, real recipes/photos, real Auth/storage/proof gateway, cross-device retries and backup/rollback in a separately approved staging pilot.

All release gates in `MIXOLOGY-BUILD-STATUS.md` and per-feature documents continue to apply. Keep the hourly build active while this authorized local work remains.
