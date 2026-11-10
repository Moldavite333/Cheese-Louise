# Mixology Stage 2 — local review

This extends the approved Stage 1 implementation in the isolated `mixology-stage1` checkout. Both stages are local and uncommitted. The original checkout is preserved. No hosted migrations, deployment, paid AI calls, reminders, or scheduled research were performed.

## Implemented

### Two-stage research

The studio reuses the existing broad catalog and matching engine. Discovery proposes up to five distinct source-backed directions, with family/ingredient diversity and explicit limited-coverage or broadened-search messages. Alcoholic and alcohol-free searches use separate source categories. Concepts are starting points, not finalized or tasted original recipes.

Only the selected direction triggers full recipe retrieval and name checks for its foundation and current working name. The initial adapter uses 24cocktails; search coverage is explicitly limited to that provider. It does not claim absolute originality or name availability. Full recipe, search-only result, partial research, source failure, identity mismatch, and cached evidence remain distinguishable. Links, original retrieval timestamps, name queries and findings persist.

Selected research is shown first; alternative directions collapse below it. A human can review exact foundation differences before importing them into a working draft. Subsequent draft changes invalidate a stale import. Current ingredient comparisons are derived from the current draft, with conservative text normalization; no false unit/product equivalence or originality percentage is claimed.

### Collaborative bartender

`supabase/functions/mixology-bartender/` implements an authenticated server endpoint using the Responses API with strict structured output. It reads the caller's authorized recipe, workshop, movie premises and attributable tasting evidence. It proposes at most twelve validated operations. It never writes a recipe, approval, tasting or publication.

The browser displays the proposed differences before Apply. Manual changes invalidate stale proposals. Apply edits the working draft through the existing validated editor, preserving undo and revision checks. Rejecting a proposal does not infer an ingredient dislike or taste preference. Desktop keeps a read-only current recipe beside the conversation; mobile uses a collapsible recipe summary.

The backend requires all of the following before any provider request:

- `MIXOLOGY_AI_ENABLED=true`
- An explicitly selected `MIXOLOGY_AI_MODEL`
- Server-side `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- A valid signed-in user with access to the requested workspace and recipe

These settings were **not activated**. The model transport was faked during tests. Real model quality, latency and cocktail quality remain unverified and require a separately authorized staging/pilot session.

Requests have stable IDs, one acquisition lease, cached completed replies, a fifteen-second workspace cooldown and a hard limit of twenty attempts per rolling twenty-four hours. Failed/incomplete attempts count toward that bound. Input context is capped at 60,000 characters and model output at 3,000 tokens. Uncertain or running requests are not automatically repeated. `store:false` is sent to the provider; HQ retains its own validated reply and conversation history.

### Shared conversation and research history

Workshop drafts reuse Stage 1's local recovery and revision-checked saving. The current conversation window is bounded, while original messages are retained in an append-only conversation log. Earlier messages can be loaded. Authorship cannot be reassigned and archived messages cannot be rewritten by authenticated clients.

Each selected investigation is separately retained in a research log. Editing a question does not create research-history spam; switching directions does not destroy earlier evidence. Exports include the current workshop and loaded history. These exports are not a substitute for a database backup.

### Conservative taste evidence

“Our tastes” keeps hosts separate and uses confirmed directional chips from exact tasted versions. It considers the last 180 days and counts repeated entries for the same recipe on the same recorded UTC day once. Three supporting recipe-days establish only a tentative direction; contradictory evidence suppresses that conclusion. Counts and supporting comments are visible, and observations can be excluded/restored for this workshop.

Simple comments such as “Too sweet for me” can offer an optional interpretation button. The host must confirm it; raw text is preserved. Reported speech, negation and ambiguous prose are not silently converted into preferences. Correcting a tasting changes future retrieval; archived correction history is not treated as another tasting.

No opaque taste score, ingredient-dislike classifier, learned numerical flavor profile, or automatic generalization from approval/popularity was added. The bartender receives explicit evidence and its limitations rather than a fabricated shared average.

## Prepared database changes

`supabase/migrations/20261109214131_mixology_stage2.sql` is prepared but unapplied to the hosted project. It adds private, workspace-scoped workshops, conversation/research logs and request accounting, plus explicit “not sweet enough” / “not tart enough” tasting choices.

Workshop writes use caller permissions, RLS, composite workspace references and revision checks. Only the server role can finish a request accounting record. Clients cannot mark a request complete or rewrite cached replies. This stage does not reuse or modify the separately audited production-document policy defect.

Before release, authorize staging setup separately, apply Stage 1 then Stage 2 migrations there, verify actual Supabase Auth/PostgREST grants and member/nonmember behavior, serve/deploy the function to staging, and test paid-provider activation only within an explicitly approved model/budget. No production activation is implied by this local implementation.

## Reproducible checks

```
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm test:mixology-browser
pnpm test:mixology-stage2-browser
node scripts/cocktail-browser-smoke.mjs
node scripts/hq-browser-smoke.mjs
```

The new browser checks use the actual migrations and Edge handler against isolated PostgreSQL/WASM. Their model and research responses are fictional fixtures, and non-local browser requests are blocked. Separate free public API reads verified the documented full-recipe and search response shapes; no private material was submitted.

### Observed results

- **225 automated tests passed**, including the existing regressions and new operation, provenance, learning-evidence, SQL/RLS and provider-failure checks.
- Stage 2 assembled browser flows passed at **390 px and 1440 px**: five concepts, selected-only research, exact proposal preview, no automatic recipe mutation, stale-proposal blocking, human Apply, conversation recovery, optional interpretation confirmation and sparse-data handling.
- Stage 1 browser regressions passed at **390 px and 1440 px**, including two-host feedback, conflicts, offline recovery, episode return and independent counterparts.
- Existing cocktail browser checks passed at both widths; the existing HQ assembly passed at **360, 768, 1024 and 1440 px**.
- Phone research and desktop bartender previews were inspected. Tested views had no horizontal overflow. This is fixture verification, not a real host usability study or a validated cocktail tasting.

The backend also supplies the requesting host and authorized display names alongside attributed conversation/evidence, so “me,” Nick and Jenny remain distinguishable. It sends no profile contact fields.

Review images are generated under ignored `artifacts/`: `mixology-stage2-research-390.png`, `mixology-stage2-research-1440.png`, `mixology-stage2-bartender-390.png` and `mixology-stage2-bartender-1440.png`. They contain fictional test feedback and a fake model response, not a validated cocktail recommendation.

## References

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth-legacy-jwt)
- [24cocktails developer API, caching and attribution](https://24cocktails.com/developers.html)

Stage 3 approval/preparation/recording completion and Stage 4 publication/community work remain outside this increment. Stop for review before continuing or activating hosted services.
