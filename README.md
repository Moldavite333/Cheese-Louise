# Cheese Louise HQ v1.2

A mobile-first shared podcast workspace for **Cheese Louise**.

## v1.2 — real shared sync

The app now uses Supabase instead of browser-only storage for the shared workspace.

### Shared features

- Separate Nick / Jenny logins
- Shared workspace with a one-time join code
- Movie Radar
- Per-person Yes / Maybe / No voting
- Per-person bookmarks
- Shared movie comments
- Shared episode pipeline
- Shared schedule
- Shared Show Lab ideas
- Activity feed
- Realtime updates across devices
- Row Level Security so only signed-in workspace members can read/write workspace data
- One-time import of the old v1.1 local browser data when the first workspace is created

## First-time setup

1. Open the app.
2. Nick creates an account and confirms the email if Supabase asks for confirmation.
3. Nick creates **Cheese Louise HQ**.
4. If old v1.1 browser data is found, choose **Import**.
5. Copy the join code shown at the top of the app.
6. Jenny creates her own account, confirms her email if needed, then joins using that code.

After that, changes are stored in Supabase and shared between both phones.

## Hosting

The frontend remains a static PWA and can be hosted with GitHub Pages from `main`.

The Supabase publishable key is intentionally client-side. Authorization is enforced with Supabase Auth + Postgres Row Level Security. No Supabase secret/service key is included in this repository.

## Next upgrades

- Automated movie ingestion from Hallmark, Lifetime, MarVista, Reel One, and related sources
- Full episode-outline editor
- Romantiverse Rules database
- Bingo card builder
- Cocktail database and movie/cocktail matching
- Better calendar views and reminders
