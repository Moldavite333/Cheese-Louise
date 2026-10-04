# Cheese Louise HQ v1.32

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

- **Adaptive Cheese Master v1.32** builds a preliminary Cheese Rating before a movie is saved
- Discovery enrichment now uses TMDB synopsis, tagline, keywords, genres, production companies, character names, provider/network, holiday, and season clues
- Concept inference recognizes implicit setups such as hometown return + corporate career, inheritance + family business, widow + child, or family business + closure threat even when the exact Cheese Trait name never appears
- Confidence tiers and evidence explain why each trait was suggested
- Every Cheese Trait can store recognition aliases, story cues, context, and false-positive exclusions; the Trait Library has a **Teach** action for editing these
- Manual additions/removals and accepted/rejected Cheese Master suggestions are saved as feedback, so future inference can learn which words and story patterns tend to mean a trait in the Cheese Louise workspace
- Preliminary scoring confidence-weights evidence and reduces same-category double counting while keeping confirmed Cheese Traits authoritative
- Editable master Cheese Trait library
- Toggle traits on/off per movie
- Each selected trait contributes its point value to the movie's Cheese Rating
- Editing a trait point value recalculates movies using that trait
- Retire / restore traits without breaking old movies
- **Romantiverse Interpreter** for context-aware first-pass Cheese Ratings
- Exact-match, inferred-context, and multi-clue pattern detection
- Confidence and explanation shown for inferred Cheese Traits
- New Finds can be added with the likely traits accepted or added without them
- Saved movies can run the same Romantiverse inference from their synopsis
- Human confirmation remains authoritative; inferred traits can always be removed or edited
- Trait combinations, minimum Cheese Rating, Holiday, Season, provider, and release-timing filtering
- Saved filter presets

### Rules of the Romantiverse

- Shared persistent rulebook for Nick and Jenny
- Automatic stable rule numbering
- **Canon**, **Proposed**, and **Retired** states
- Notes/examples on each rule
- Search and status filtering
- Rules stay in the historical log instead of being deleted when they stop applying
- Rule changes appear in shared activity

### Cheese Louise Bar

- Shared cocktail library with two clear types: **Original Cocktail** and **Cheese Louise Cocktail**
- Cheese Louise variations can link back to the Original Cocktail they are based on
- Stores spirit, style, flavor tags, ingredients, glassware, garnish, method, notes, strength, tested state, rating, season, holiday, batchability, and source provenance
- Keeps the starter classic library while also loading a broad online Original Cocktail catalog from TheCocktailDB
- Recognizes current IBA official cocktails and their IBA categories by normalized cocktail name
- Online originals can be imported into the shared Cheese Louise Bar only when Nick or Jenny chooses to save/use them
- Movie matching now builds a granular flavor fingerprint from the synopsis, title, Holiday, Season, confirmed Cheese Traits, Romantiverse inference, providers/settings, and story/location clues
- Original Cocktail matching compares that movie fingerprint against ingredients, spirit, cocktail family, preparation/style, flavor tags, IBA status, and saved ratings
- Recent podcast use applies diversity penalties so the same cocktail, base spirit, or cocktail family does not keep winning every movie
- **Cheese Louise Versions** automatically creates three deliberately different options:
  - **Familiar** — strongest thematic classic riff
  - **Craft** — high-match option with a modern craft-bar technique/trend lens
  - **Wildcard** — a contrasting spirit/family that still makes thematic sense
- Each generated option explains **why this drink** and can be edited before saving
- Craft/trend weighting uses curated signals from PUNCH, Liquor.com, and Imbibe without copying their editorial recipes
- Episode workspace can search the same broad Original Cocktail catalog or generate three fresh Cheese Louise versions for the linked movie

### Podcast planning

- Episode pipeline with status, linked movie, release date, guest, cocktail, working notes, and full episode outline editor
- Shared schedule for watch, record, edit, release, premiere, guest, and other events
- Show Lab with Ideas / Testing / Working / Retired stages
- Show Lab and Rules of the Romantiverse share the same planning area
- Quick capture and explicit Show Lab idea creation

## Movie discovery source

The current automatic hunter uses TMDB as the broad movie metadata source and TMDB's watch-provider data, which is supplied by JustWatch. It searches broadly for romance and TV-movie candidates, then applies Cheese Louise signals to rank suspiciously cheesy possibilities.

The Romantiverse Interpreter sits on top of that raw metadata. It does not treat the synopsis as a perfect source of truth: it looks for explicit Cheese Traits, broader Romantiverse language, and combinations of clues such as a hometown return plus a high-powered career. It produces an estimate and explanation, while Nick and Jenny remain the final judges of which traits actually count.

This is intentionally broader than Hallmark alone so Netflix, Lifetime, Prime, streaming originals, self-aware camp, and other studios can surface. Studio-specific feeds may be added later to improve completeness for networks whose upcoming movies appear late or inconsistently in TMDB.

## Cocktail intelligence sources

The v1.13 Cocktail Intelligence layer uses **TheCocktailDB API** as its broad machine-readable Original Cocktail catalog. Results are normalized in the browser and cached for 24 hours. Saving or using an online recipe imports a local shared copy with its source ID and URL so the episode still points to an explicit recipe.

IBA status is a curated recognition layer based on the current official IBA cocktail names and categories; the app does not scrape the IBA site at runtime. Editorial sources such as PUNCH, Liquor.com, and Imbibe are used only as a craft/trend lens for techniques and weighting. Their recipe text is not copied into the Cheese Louise database.

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

TheCocktailDB's public development endpoint is called directly from the browser. If Cheese Louise is later packaged for an app store or needs a private/premium cocktail API key, that key should move behind a Supabase Edge Function instead of being committed to the frontend.

## Still on the roadmap

- Larger / more exhaustive Cheese Trait taxonomy and inference vocabulary
- **Romantiverse Bingo** card builder and per-episode card
- Richer calendar views and reminders
- Studio-specific upcoming-release collectors for even better Hallmark / Lifetime / MarVista / Reel One coverage
- Offline-first/service-worker support
