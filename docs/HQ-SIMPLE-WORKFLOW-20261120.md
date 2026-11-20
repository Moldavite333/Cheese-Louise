# Cheese Louise HQ — Simplification & episode publishing contract
Status: **active redesign, incremental rollout**. Owner: Nick and Jenny. Approved 2026-11-20.

## Product goal
Two hosts should be able to complete one episode without working out which of dozens of boxes, tabs, draft makers and notes editors to use. One primary action at a time, no duplicate data entry, and no implicit object creation. Buzzsprout remains the authoritative episode publication scheduler. HQ becomes the one place to prepare, approve, and observe the release across the public website and Bingo.

## User-facing production journey (ordered)
1. **Find** — Type exact title or browse Coming Soon > Top Recommendations > Discovery; select a title/year identity. A search must never create a record.
2. **Prepare** — Watch/record notes, confirmed tropes, each host's own Bingo card, choose and finalize one shared cocktail. Existing saved recipe is canonical; versions/approvals explicit. Notes stay private.
3. **Record** — Existing simplified landscape/live reading desk: large separate Nick/Jenny notes, Done checkboxes, Bingo result and Cheese Grating, slim timer. No scene navigation/markers on live screen.
4. **Finish** — Link completed final audio, Grit Whimsy song, show notes, artwork and checks. These are linked assets, not duplicate manually entered records.
5. **Promote** — Pick comedy-first short clips, captions and channel-specific metadata for Instagram/Facebook; publishing posts remains explicit unless an approved connector/workflow exists.
6. **Approve & schedule** — One review screen summarizing status, exact movie/year, completed audio, cocktail recipe, Bingo card/link, episode metadata and release plan; no public release of a draft.

## Release integration (not yet shipped)
- **One authoritative episode ID and release state.** Prefer a private HQ publication model with controlled states `draft`, `ready`, `approved`, `scheduled`, `published`, `unpublished` and explicit error handling. Store provider episode ID/GUID, verified publication timestamp, and canonical URL once available.
- **Buzzsprout is source of truth.** HQ must not assert publication solely from a local scheduled date or manually checked box. Match by stable RSS GUID/provider ID; verify episode publicly present before public side effects. Do not invent a Buzzsprout API method, access token or billing requirement. Start with verified RSS ingestion and direct Buzzsprout scheduling links.
- **Public website consumes only a whitelisted published projection**: episode number/title, audio/links, approved cocktail ingredients/preparation/method, Bingo game identity, optional episode artwork, public host copy. Never transmit private notes, votes, raw workspace metadata or credentials.
- **Site auto-updates** released episode section and its approved cocktail recipe. Episode's public Bingo card is pinned above Coming Soon/Discovery, in episode-number ascending order. Movies merely watched, voted on, or played in Bingo do not qualify. Site's Buzzsprout audio embed remains the audio player.
- **Idempotent updates and safe edits**: multiple checks cannot create duplicates; retries surface errors; finalization requires approval; errors retain last valid public state. Edit/unpublish/delete paths, confirmation on irreversible actions and recovery/undo.
- Do not silently overwrite user-edited cocktail recipes, watch links, cast, season, or publishing copy.

## Minimal UX standards
- Home = clear current episode and six slim step links; keep Library/Resources collapsed. Avoid stacked cards and explanations; show help on request.
- A stage opens without side effects. Explicit `Create` / `Save` / `Approve` only when meaningful; cancel available; edit and delete accessible.
- No accidental Plus shortcuts or implicit draft creation on tab visit, search, opening movie, browsing feed or switching hosts.
- Mobile Android and desktop keyboard usable. Accessible text, contrast, buttons, focus and unsaved-change warnings.
- Hide complex original tools behind Advanced, while preserving old records and compatible editing APIs. Move data before removing UI.

## Search and freshness
- Exact title/year including punctuation variations and saved results always first; distinguish original vs sequel; aliases assist discovery without collapsing identity.
- Keep the already-approved TV-romance editorial pool; no generic low-rated theatrical films, teen romances or heavy unrelated titles.
- Coming Soon with verified premiere dates first, Top 20 then remaining discovery. Keep individual votes, both-No hiding, Recorded removal and manual corrections authoritative.
- Feed freshness: client rechecks when Radar is active and stale (45 minutes), not while typing or editing; show last-checked, error, retry. Shared Bingo editorial catalog currently caches remotely for 15 minutes. Separate actual **catalog source ingestion** from client rechecks; inspect GitHub Actions before declaring new movies added.
- Restore failed background catalog refresh jobs and raise conservative schedule from weekly to three times weekly, honoring Wikidata's bounds. Report source failures; never pretend an unchanged catalog is newly populated.
- Do not change taste ranking, candidate-pool inclusion policy or viewing eligibility on the back of a refresh-only request. Sample any proposed ranking/pool changes for Nick's signoff.

## Rollout and acceptance
**Slice A (2026-11-20, code committed):** Simplified home, collapsible secondary navigation, removed quick-add shortcut; exact results prioritized; active Radar checks after 45 minutes. Verify CI and live device behavior before declaring done.
**Slice B:** Make Find/Prepare/Cocktail/Bingo/Record/Finish genuinely pass the same authoritative movie and episode context without jumping or duplicate creation.
**Slice C:** Create publication-review gate and read-only verified Buzzsprout/RSS reconciliation; end-to-end preview and stage statuses.
**Slice D:** Site/Bingo published projection and atomic idempotent public publishing, replay/retry/edit/unpublish.
**Slice E:** Clip tooling and practical episode production buffer, with clear Monday checklist.
**Slice F:** Usability QA on Nick and Jenny's separate devices. Accessibility and recovery validation.

### Release-blocking acceptance
- A new user finds an exact title in two actions or fewer, regardless of active filters; ambiguous same-title years are separate.
- Visiting and leaving every step with no save creates **zero** records. Drafts can be edited or deleted deliberately.
- Nick and Jenny see their own notes and Bingo card in Record; older notes remain accessible.
- An unreleased episode **cannot** make a cocktail or featured release card public.
- Publishing once makes exactly one public episode, drink and featured Bingo entry, linked to each other; rerunning checks duplicates nothing.
- Episode release, site recipe and Bingo entry can be corrected/unpublished without raw GitHub edits by the hosts.
- On a source outage, show stale/last-known data with a visible error; never replace curated selections with unrelated films.
- All relevant CI tests, real browser smoke tests, GitHub Pages deployment and hosted checks recorded as separate evidence. A commit is not proof of deployment.

Keep this roadmap subordinate to Nick and Jenny's concrete weekly production deadlines; do not require them to spend more hours managing HQ than recording the show.
