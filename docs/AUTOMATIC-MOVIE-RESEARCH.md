# Automatic movie research

## Behavior

After sign-in and loading the saved-movie library, HQ automatically queues research for up to 100 saved movies, newest first, excluding Passed and movies rejected by the existing horror policy. No research runs for transient discovery/search results. New saved movies are picked up after the existing shared-data reload. Finished reports are reused for 30 days unless the movie identity/synopsis changes. Refresh research requests a new take after a 30-minute cooldown.

One movie runs at a time per workspace. The backend returns immediately and processes the durable queue through authenticated server-to-server continuations, so closing the page does not stop the current queue chain. An interrupted worker's eight-minute lease is recoverable on a subsequent library visit/status poll. Failed jobs preserve the prior report and use a 30-minute retry delay. Backend limits permit 40 starts per hour per workspace and six attempts per movie per day. A queued library exceeding the hourly limit resumes on a later signed-in status poll; there is no separate scheduled cron service.

Reports contain a sourced plot outline, character motivations, distinct discussion angles, interpretation labels, existing-catalog trope candidates, and concrete gaps to check while watching. Web research prioritizes matching official network/studio/distributor pages and detailed recaps, with title/year/cast disambiguation. Streaming availability and precise movie timestamps are never generated. Thin evidence produces a partial brief, not invented plot padding.

Shared briefs appear in saved movie details and Recording. New story beats populate the editable recording outline. Existing scene IDs, bookmarks, host notes, manually edited descriptions and user-confirmed descriptions survive refresh. Scene prompts and character notes also appear in Jenny's text rundown. The full research brief has separate copy/download controls. Candidate tropes do not modify confirmed movie traits or Bingo results.

## Data and security

`movie_research_briefs` stores current job state and report; `movie_research_versions` retains generated revisions; `movie_research_runs` enforces the hourly start budget. Reports are shared with members of the same workspace, with a matching movie/workspace check. Authenticated clients have SELECT only on reports and versions. They cannot write generated material or invoke backend queue RPCs. Worker claims use an advisory lock plus a unique lease token; stale completions cannot overwrite a newer claim.

The `movie-research` function validates a real Supabase user and membership before preparing research. It reads saved movies through the user's RLS context, ignoring supplied client movie facts. Internal queue continuation requires the exact server-side service credential. Gateway JWT verification is disabled because the handler performs its own authenticated-user validation, matching the existing HQ function pattern. Public GET returns readiness booleans only. No private credentials, provider response bodies, lease tokens or input hashes are returned to clients.

Only public movie identity/cast is sent into web search. Private host notes, user profiles, comments and caption uploads are not sent to web search. Model outputs use strict JSON schema, followed by application validation: unknown source IDs and trope IDs are removed, source anchors must occur in the referenced input, unanchored facts are omitted, model-provided timestamps are discarded, and title/year mismatches fail. External research summaries remain AI drafts with source links, not independent verification of original webpage text.

Research reports are cached on the device for reading after they load. User-authored timeline notes remain in the existing local timeline store. Undo stores scene deltas instead of copying all raw evidence on each keystroke, limiting local storage growth. Offline notes are still device-local; this change does not add cloud synchronization of manual scene edits.

## Configuration

The existing Cheese Louise Supabase project supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Add `OPENAI_API_KEY` through the project's Edge Function secrets; never put it in frontend source, a committed environment file, or chat. `TMDB_READ_ACCESS_TOKEN` enables matching metadata enrichment. Optional `MOVIE_RESEARCH_MODEL` overrides the existing `GRIT_LYRICS_MODEL` or `gpt-4.1` default. Research uses the Responses API with web search, then a separate schema-constrained synthesis call, with `store:false`. API use consumes the project's available API credits; cached reports do not make new AI calls.

Migration `20261102175801_automatic_movie_research_briefs.sql` is the exact version assigned by the connected Supabase migration tool. The local CLI was unavailable; migration history was read back to retain the actual generated version. The additive migration and function deployment do not rewrite movies, notes, traits or Bingo data.

## Validation

New fixtures cover identity mismatch/alternate titles, real citation filtering, source-anchor validation, unknown trope IDs, rejected model timestamps, authentication/membership, cached report reuse, provider failures, mid-generation movie corrections, signed internal continuation, cross-workspace browser responses, preservation of edited/approved scenes, and compact undo recovery. Browser fixtures exercise research display, automatic outline import, scene-linked prompts and existing caption/note/Bingo workflows at four viewport widths. Live checks validate safe readiness and unsigned request rejection. Runtime generation must additionally be checked with a signed-in HQ user and an available AI API credit balance.

The initial database advisor baseline had unrelated existing poster/RPC/password findings; the new tables/functions added no new security findings. Queue-claim and member/nonmember RLS checks use synthetic transaction-rolled-back data. Full production writes and AI source quality are separate from fixture success.

References: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks), [function environment variables](https://supabase.com/docs/guides/functions/secrets).
