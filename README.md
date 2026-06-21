# Kubi

**A parent-controlled video frontend for kids.**

Kubi is for parents who are tired of the lack of real parental controls on YouTube. Instead of handing a child the open YouTube app — with its endless autoplay, algorithmic rabbit holes, and unvetted recommendations — Kubi lets you build a walled garden of *only* the channels and videos you've personally approved.

It's a custom frontend: your child sees a clean, kid-friendly interface containing nothing but the content you curate. There are no ads, no comments, no "up next" surprises, and no way to wander off into the wider internet.

## What it does

- **Curate by channel** — Add YouTube channels by ID; Kubi pulls in their videos so your kids can browse them in a safe shell.
- **Hide individual videos** — Approve a channel but veto specific videos you don't want shown.
- **Self-hosted video** — Add your own videos as "channels" via [Bunny Stream](https://bunny.net/) (e.g. home movies, downloaded content) alongside YouTube channels.
- **Kid profiles** — Separate, colorful profiles per child, each with its own watch history and playlists.
- **Resume watching** — Watch progress is saved per profile, so kids pick up where they left off.
- **Playlists** — Build curated playlists, including importing existing YouTube playlists.
- **PIN-protected admin** — All management (adding channels, hiding videos, creating profiles) lives behind a parent-set PIN. Kids can't change what they're allowed to watch.
- **Automatic sync** — A daily cron job pulls new uploads from your approved channels so the library stays fresh without manual work.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- [Neon](https://neon.tech) serverless Postgres via [Drizzle ORM](https://orm.drizzle.team)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- YouTube Data API v3 for channel/video metadata
- Bunny Stream (optional) for self-hosted video
- Designed to deploy on [Vercel](https://vercel.com)

## Running locally

**Prerequisites:** Node.js 20+, a [Neon](https://neon.tech) Postgres database, and a [YouTube Data API key](https://developers.google.com/youtube/v3/getting-started).

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — create a `.env` file in the project root:

   ```bash
   # Database (Neon Postgres pooled connection string)
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

   # YouTube Data API v3 key (for fetching channel/video metadata)
   YOUTUBE_API_KEY=your_youtube_api_key

   # Shared secret protecting the cron sync endpoint
   CRON_SECRET=any_long_random_string

   # --- Bunny Stream (optional — only if hosting your own videos) ---
   BUNNY_STREAM_LIBRARY_ID=
   BUNNY_STREAM_CDN_HOSTNAME=
   BUNNY_STREAM_TOKEN_SECURITY_KEY=
   BUNNY_STREAM_API_KEY=
   ```

3. **Push the database schema**

   ```bash
   npx drizzle-kit push
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). On first visit you'll set the admin PIN, then add your first channel from the admin area.

## Deploying on Vercel

The app is built to run on Vercel with zero extra configuration.

1. **Push this repo to GitHub** (or GitLab/Bitbucket).

2. **Import it on Vercel** — go to [vercel.com/new](https://vercel.com/new) and select the repository. Vercel auto-detects Next.js.

3. **Add a database** — provision [Neon Postgres from the Vercel Marketplace](https://vercel.com/marketplace/neon) (or bring your own). This sets `DATABASE_URL` for you.

4. **Set environment variables** in the Vercel project settings (Settings → Environment Variables):

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `DATABASE_URL` | ✅ | Auto-set if you use the Neon Marketplace integration |
   | `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 key |
   | `CRON_SECRET` | ✅ | Long random string; Vercel passes this to the cron job |
   | `BUNNY_STREAM_*` | optional | Only if you host your own videos via Bunny Stream |

5. **Deploy.** Vercel builds and ships the app.

6. **Initialize the database** — run `npx drizzle-kit push` locally against your production `DATABASE_URL`, or pull the env with `vercel env pull` first.

7. **Daily sync** — [`vercel.json`](./vercel.json) registers a cron job that hits `/api/cron/sync-channels` once a day (04:00 UTC) to pull new uploads from your approved channels. Vercel runs this automatically; the `CRON_SECRET` authenticates the request.

Once deployed, open the site, set your admin PIN, and start curating.
