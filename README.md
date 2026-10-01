# Cheese Louise HQ v1.1

A mobile-first shared podcast workspace prototype for Cheese Louise.

## What works in v1.1

- Nick / Jenny profile switching
- Per-person movie voting: Yes / Maybe / No
- Per-person bookmarks
- Shared movie comments
- Mutual-pick and split-decision logic
- Home dashboard with items needing your vote
- Movie search and filters
- Shared schedule
- Episode pipeline scaffold
- Show Lab: Ideas → Testing → Working → Retired
- Quick Add from anywhere
- Activity feed
- Mobile-first responsive design
- Installable PWA manifest
- Local persistence with `localStorage`

## Important limitation

This prototype stores data in the browser on the current device. It does **not yet sync between Nick's and Jenny's phones**. The UI/data structure is deliberately designed so v1.2 can swap the storage layer to Supabase without redesigning the app.

## Run locally

Open `index.html` in a browser, or serve the folder with any simple static server.

Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder to the repository root.
3. In GitHub: **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`.
6. Save.

The app will then be available at the repository's GitHub Pages URL.

## Recommended v1.2

- Supabase Auth: separate Nick and Jenny accounts
- Supabase Postgres: shared synced data
- Supabase Realtime: comments, votes, schedule updates appear instantly
- Real movie ingestion from TMDB / Hallmark / Lifetime sources
- Full episode-outline editor
- Romantiverse Rules database
- Bingo card builder
- Cocktail database
