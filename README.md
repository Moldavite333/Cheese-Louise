# Cheese Louise HQ v1.10

A mobile-first shared podcast workspace and cheesy-movie hunting system for **Cheese Louise**.

## What is live now

### Shared HQ

- Separate Nick / Jenny logins
- Shared workspace with a one-time join code
- Realtime updates across devices
- Activity feed
- One-time import of the old v1.1 browser data
- Supabase Row Level Security around shared workspace data

### Movie Radar

- Automatic TMDB movie discovery with a **New Finds** intake
- Posters, synopsis, release dates, TMDB source links, and US streaming-provider information when available
- Automatic Holiday / Special and Season classification
- Shared Radar filters across both New Finds and saved movies
- **Needs Review** intake status so discovered movies do not silently become permanent picks
- Duplicate protection using TMDB IDs
- Manual Add Movie remains available for obscure titles
- Nick / Jenny Yes, Maybe, No voting
- Per-person bookmarks and shared comments
- Search, saved filters, Mutual, Saved, Unreviewed, and Needs Review views

### Cheese Rating / Cheese Traits

- Editable master Cheese Trait library
- Toggle traits on/off per movie
- Each selected trait contributes its point value to the movie's Cheese Rating
- Editing a trait point value recalculates movies using that trait
- Retire / restore traits without breaking old movies
- **Romantiverse Interpreter** for context-aware first-pass Cheese Ratings
- Exact-match, inferred-context, and multi-clue pattern detection
- Confidence and explanation shown for inferred Cheese Tray-Ts
- New Finds can be added with the likely traits accepted or added without them
- Saved movies can run the same Romantiverse inference from their synopsis
- Human confirmation remains authoritative; inferred traits can always be removed or edited
- Trait combinations, minimum Cheese Rating, Holiday, Season, provider, and release-timing filtering
- Saved filter presets

### Podcast planning

- Episode pipeline with status, linked movie, release date, guest, cocktail, working notes, and full episode outline editor
- Shared schedule for watch, record, edit, release, premiere, guest, and other events
- Show Lab with Ideas / Testing / Working / Retired stages
- Quick capture and explicit Show Lab idea creation

## Movie discovery source

The current automatic hunter uses TMDB as the broad movie metadata source and TMDB's watch-provider data, which is supplied by JustWatch. It searches broadly for romance and TV-movie candidates, then applies Cheese Louise signals to rank suspiciously cheesy possibilities.

The Romantiverse Interpreter sits on top of that raw metadata. It does not treat the synopsis as a perfect source of truth: it looks for explicit Cheese Traits, broader Romantiverse language, and combinations of clues such as a hometown return plus a high-powered career. It produces an estimate and explanation, while Nick and Jenny remain the final judges of which traits actually count.

This is intentionally broader than Hallmark alone so Netflix, Lifetime, Prime, streaming originals, self-aware camp, and other studios can surface. Studio-specific feeds may be added later to improve completeness for networks whose upcoming movies appear late or inconsistently in TMDB.

## First-time setup

1. Open the app.
2. One person creates an account and creates **Cheese Louise HQ**.
3. If old v1.1 browser data is found, choose **Import**.
4. Copy the join code shown at the top of the app.
5. The second person creates their own account and joins using that code.

After that, changes are stored in Supabase and shared between both users.

## Hosting and secrets

The frontend is hosted as a static PWA on GitHub Pages from `main`.

The Supabase publishable key is intentionally client-side. Authorization is enforced with Supabase Auth + Postgres Row Level Security. The private TMDB read token is stored as a Supabase Edge Function secret and is not committed to GitHub.

## Still on the roadmap

- Dedicated **Rules of the Romantiverse** database
- Larger / more exhaustive Cheese Tray-T taxonomy and inference vocabulary
- **Romantiverse Bingo** card builder and per-episode card
- Cocktail database with trait-based movie/cocktail matching
- Richer calendar views and reminders
- Studio-specific upcoming-release collectors for even better Hallmark / Lifetime / MarVista / Reel One coverage
- Offline-first/service-worker support
