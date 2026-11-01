# Cheese Louise HQ red-team review

Scope: authenticated HQ production client and source code. Real user records were not modified during tests.

## Confirmed problems addressed
- Navigation accumulated nine equally weighted tabs and buried Bar/Bingo/Podcast 101 under unrelated parent views.
- Fixed navigation and recording actions could overlap on small screens.
- Dashboard next episode was chosen by creation order rather than unfinished release order.
- Realtime redraws could interrupt open editors. Deferral now leaves a visible manual-refresh control.
- Movie queries could silently turn failed reads into empty lists.
- Votes, bookmarks, and comments were repeatedly scanned per movie. These are now grouped once.
- Autumn/Fall and holiday punctuation/aliases caused false negatives.
- Season/holiday controls narrowed loaded lists but did not initiate external discovery.
- Year filtering ignored catalog entries containing only a year.
- Applying/saving year filter presets lost network/release-window values.
- External search did not consistently obey studio/year/vote-scope filters.
- Older search responses could overwrite a newer cached query.
- External TMDB results were incorrectly saved as Hallmark records, weakening duplicate detection.
- Movie-keyed recording selector was labeled Episode even though it does not bind to an episode record.

## UI design implemented
Desktop grouped sidebar: Plan / Make / Library / Resources.
Mobile: Today / Movies / Watch / Record / More, a single row with safe-area clearance.
Today: four production steps, next unfinished episode, saved local recording, missing-credit queue.
Account/join code: secondary account menu.
Consistent restrained teal/charcoal palette, warm accent, readable spacing, keyboard focus, modal roles/focus confinement.
No features or stored user content deleted.

## Material remaining limitations
- Hallmark discovery backend scans a finite hardcoded collection list (2024–2026). Better filters cannot find records the backend never retrieves.
- TMDB concept results are bounded and filtered after ranking. No claim of exhaustive season/holiday coverage.
- Backend classifications are suggestions from metadata; they are not verified scene facts.
- Watch Along drafts and recording sessions remain device-local; not shared between phone/laptop.
- Recording sessions are movie-keyed rather than episode-keyed.
- Legacy global overrides and many synchronous scripts remain. This pass adds a cohesive interface without risking a wholesale data-layer rewrite; modularizing the app is still warranted.
- Authenticated cross-device saving, publishing, and email recovery require a separate live integration check.
- Draft safeguards defer realtime updates; they do not provide full offline/shared draft synchronization.
- Browser regression tests exercise assembled scripts locally with fixture authentication/data; live authenticated records and saving remain outside those checks.

## Validation
Node syntax checks, production/credits/filter regressions, and Chromium phone/tablet/desktop workflow tests with fixtures. Tests do not write real user records.

## Layout follow-up — October 31, 2026

Reviewed the original findings and remaining limitations against the current source. This pass addresses layout and navigation; backend coverage, shared draft storage, and recording-to-episode binding remain open above.

| Finding | Repair | Verification |
| --- | --- | --- |
| Mobile Radar view buttons disappeared into a horizontal strip | All/Mutual/Yes/Saved/Unreviewed/Needs Review now wrap visibly | Browser checks toolbar scroll width |
| Global search consumed recording and watching space | Contextual compact header on production screens, with desktop movie-search shortcut | Recording header height checked |
| Sticky trait controls could sit behind the header | Header height is measured and used as the sticky offset | Browser checks trait tools against header bounds |
| Small laptops used grids sized for a full-width desktop | Watch Along, movie cards, Producer Desk and Recording adapt to sidebar space | 1024px laptop added to route checks |
| Long rundown made the notes column extremely tall | Bounded preview with keyboard focus and vertical scrolling | Preview height and keyboard accessibility checked |
| Long trait libraries pushed Watch Notes far down the phone screen | Sticky Traits / Notes / Rundown jump links with clear header offsets | Notes jump geometry checked |
| Phone calendar reduced event titles to a few letters | Full readable agenda below the month grid | Complete long event title checked |
| Recording controls used unstyled browser buttons | Consistent surfaces, disabled states and primary timer action | Screenshots at four widths |
| Recording actions competed with bottom navigation | Navigation height is measured for action offset and page clearance | Browser checks the two rectangles do not overlap |
| More menu allowed focus into the page behind it | Backdrop, inert content, focus containment, Escape and responsive dismissal | Keyboard and resize checks |
| Movie taste explanation crowded out discovery | Favorites and matching explanation moved into an expandable disclosure | Phone screenshot review |
| Skip link could leak over content during focus changes | Explicit offscreen clipping, revealed on keyboard focus | Screenshot review |
| Empty recent activity left an unexplained blank section | Helpful empty state | Dashboard fixture review |
| Date-only release labels shifted a day in western time zones | Format date-only values as local calendar dates | Browser asserts November 2 stays November 2 |

Current checks use phone (360px), tablet (768px), small laptop (1024px), and desktop (1440px). Fixtures include populated traits, activity and a long calendar event. Screenshots are written to the local `artifacts/` folder, not published as user content.

Remaining work stays explicit: improve catalog acquisition and metadata classification; design shared Watch Along/recording persistence and episode binding; reduce legacy global overrides; verify authenticated cross-device saving and recovery. The layout checks do not establish that those backend workflows are complete.

## Recommendations and posters follow-up

- Saved Radar cards ignored `poster_url` entirely. They now render the stored image; browser checks assert that the image actually loads.
- Canonical poster requests omitted year-only catalog metadata. Year lookup now includes catalog `year` and `release_year`; requests are batched eight at a time and failed lookups preserve existing artwork.
- Saved movies without artwork receive a verified, browser-cached poster lookup. Existing/manual locked images are preserved.
- A late poster-resolver save override incorrectly treated external TMDB results as Hallmark records. External results now use the original provenance-aware save path.
- Default recommendations now use the `recommend-romantiverse` Edge Function rather than the same finite Hallmark collection on every refresh. Exact title/year matching resolves the eight starting favorites before ranking; ambiguous matches are reported rather than guessed.
- Discovery combines favorite-based TMDB recommendations, separate premise-keyword searches for TV romances, changing catalog pages, and identity-checked title probes for sparsely tagged movies. It prioritizes quirky/magical romance and rejects unrelated genres, shorts, and weak matches.
- Fresh batches exclude supplied favorites, saved movies, passed/No-voted titles, and earlier batches. History is scoped to the workspace on the current browser; if browser storage fails, an in-memory history remains for the current page. “Include previously shown movies” is an explicit history reset.
- All returned recommendation records include a TMDB poster. Candidate ranking explains the favorite and metadata relationship; fit scores are ranking signals, not calibrated probabilities or verified scene facts.
- Live service checks resolved all eight starting favorites and checked actual poster URLs. Browser fixtures cover loaded saved/recommended posters and replacement of the first recommendation batch by a different second batch.
- A live exclusion test returned 18 additional films with zero overlap with the 22 earlier checked records, including Snowmance, A Kiss Before Christmas, Love Strikes Twice, and A Timeless Christmas. TV romances receive preference; strongly related fantastical theatrical romances can also appear. Sparse genre/keyword tags are handled using explicit synopsis evidence and Fantasy genre metadata, without treating ordinary "Christmas spirit" as a ghost story.

Limits: discovery remains bounded, provider tagging may omit films, and poster lookup may leave an ambiguous movie unresolved. Seen-history is device-local; shared votes still come from the existing workspace. No new database schema or auth policy was introduced.

## Permanent no-horror policy and hourly review

Search and recommendations share `supabase/functions/_shared/movie-content-policy.js` with the browser. It excludes genre ID 27, mixed Horror/Romance, named horror genres, explicit horror keywords and clear horror descriptions. Search applies the rule before and after enrichment and drops unknown genre classifications; browser checks also block cached horror results. Existing saved records are retained but known horror is filtered from Radar. Friendly-ghost romance and magical wishes remain allowed.

The hourly chat monitor is active for read-only health checks and reviewable production improvement proposals. Automatic approval review rejected broad unattended hourly publishing; the accepted monitor does not deploy or mutate production/user records. `HQ-MAINTENANCE.md` documents the check sequence, limits and production backlog, and `scripts/hq-health.mjs` checks the live page, assets and workflow status. Local checks require the desktop app and computer to be running.

## Retired show segments removed

At the user's request, Rules of the Romantiverse and Ruleify were removed from HQ. Their loaded scripts/styles, navigation routes, rulebook loader/editor and generation UI are gone. A small production hub keeps Show Lab, Podcast 101 and Bingo working independently. Episode placeholders, launch checklist copy, Producer Desk guidance, default trait-category prompts and Bingo artwork no longer promote the retired segments. Historical database migrations remain as schema history; this cleanup does not delete unrelated production records. Browser checks now cover Bingo and assert the retired routes and actions are absent throughout the remaining screens.

## Recording notes-first layout

The recording screen now places full-size reading notes in the main column with compact timing, collapsed segment browsing and a smaller reference area. Gold labeled cards identify Cheese Traits, blue cards identify manually ordered talking points, teal cards separate Watch Along observations, rose identifies the segment cue, and purple identifies the Cheese Grating. Labels and numbering accompany colors. Long paragraphs are split on sentence boundaries for reading, preserving the text and order; markup is escaped. New rundown snapshots preserve Watch Along's mixed trait/note order. Existing snapshots, timer state, laps and markers remain compatible. Updating notes from Watch Along is explicit and disabled while the timer runs. Tests cover talk order, text preservation/escaping and legacy sessions; four-width browser checks verify compact timer geometry and separate note cards.

Follow-up: the reading view now shows the latest Watch Along draft when present, without rewriting the stored recording snapshot. Earlier session notes remain accessible in a separate disclosure when they differ. A prominent jump link reaches the Watch Along observations and a direct button opens Watch Along for the same movie. The Recording default and navigation handoff follow the watched movie while preserving an already running timer. Tests explicitly cover stale snapshots and movie selection; fixture browser tests begin with an empty older snapshot to verify that the real note cards still appear.
