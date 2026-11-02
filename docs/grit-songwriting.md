# Grit movie songwriting

The former Grit Lyrics feature rotated three fixed choruses and openings. The replacement uses a server model, the movie synopsis and characters, HQ movie comments, Watch Along notes, optional extra details, and the last twelve locally saved song drafts. It retries once when a line matches prior songs or the old stock choruses. Similar ideas and factual accuracy still need editorial review.

## Connect automatic writing

1. Open [Cheese Louise function secrets](https://supabase.com/dashboard/project/wgvsnmukiaobcbyqhkkt/functions/secrets).
2. Add the server secret `OPENAI_API_KEY` using an API key from your own OpenAI API project. Do not put it into frontend code, movie notes, lyrics, or chat.
3. Optionally set `GRIT_LYRICS_MODEL`; the default is `gpt-4.1`.
4. Refresh HQ and open Grit Lyrics. The public readiness endpoint reports only whether connections exist: <https://wgvsnmukiaobcbyqhkkt.supabase.co/functions/v1/grit-lyrics>.

The function is already deployed. Research and generation POST requests verify the signed-in user and workspace membership. The gateway JWT switch is off because the function validates user credentials itself. GET returns readiness only. Request throttling is best effort per function instance; configure provider project spending limits as appropriate.

## Available without the songwriting API

- Research movie fetches identity-checked TMDB overview, character credits and up to three public review excerpts when available. Ambiguous titles and wrong years are rejected. Many TV movies have sparse reviews.
- Copy songwriting brief creates a movie-specific prompt for ChatGPT, including your extra details and recent lyrics to avoid. It is a writing/research handoff, not an automatically generated song.
- Editable lyrics and extra details save per movie and HQ workspace on the current device. They do not sync between hosts or devices.

With the API connected, optional web research searches public plot summaries and reviews using title/year/cast. It returns source links, distinguishes opinion from plot, and instructs the writer to create original language. No arbitrary source URL is fetched by the function, and it does not bypass site restrictions. Research may contain spoilers.

Validation: Node tests cover prompt material, repeated-line retry/rejection, source links, title/year matching, missing setup, provider failure, and workspace authorization. Browser fixtures cover writing, editing, draft preservation, research, copy brief, history, reload, and responsive layout. Live CI checks deployed readiness and rejects unsigned requests; it does not charge for a live generated song.
