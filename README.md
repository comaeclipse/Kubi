# Kubi

**A parent-controlled video frontend for kids.**

Kubi is for parents who are tired of the lack of real parental controls on YouTube. Instead of handing a child the open YouTube app — with its endless autoplay, algorithmic rabbit holes, and unvetted recommendations — Kubi lets you build a walled garden of *only* the channels and videos you've personally approved.

It's a custom frontend: your child sees a clean, kid-friendly interface containing nothing but the content you curate. There are no ads, no comments, no "up next" surprises, and no way to wander off into the wider internet.

## What it does

- **Multi-user accounts** — Parents register with email and password. Each account gets its own isolated library of channels, profiles, and playlists.
- **Email verification** — New accounts must verify their email before they can log in. Password reset is also email-based.
- **Operator role** — One or more "operator" accounts curate the master channel library; regular parent accounts toggle which channels from the library appear in their view.
- **Curate by channel** — Add YouTube channels by ID; Kubi pulls in their videos so your kids can browse them in a safe shell.
- **Hide individual videos** — Approve a channel but veto specific videos you don't want shown.
- **Self-hosted video** — Add your own videos as "channels" via [Bunny Stream](https://bunny.net/) (e.g. home movies, downloaded content) alongside YouTube channels.
- **Kid profiles** — Separate, colorful profiles per child, each with its own watch history and playlists.
- **Parent PIN** — A 4-digit PIN set during onboarding gates every parent screen (profiles, time limits, blocked words, channel approvals, the account). Entering it unlocks them for 15 minutes; forgetting it is recoverable with the account password.
- **Resume watching** — Watch progress is saved per profile, so kids pick up where they left off.
- **Playlists** — Build curated playlists, including importing existing YouTube playlists.
- **Encryption at rest** — Emails and kid profile names are AES-256-GCM encrypted in the database; email lookups use an HMAC blind index.
- **Automatic sync** — A daily cron job pulls new uploads from your approved channels so the library stays fresh without manual work.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [Neon](https://neon.tech) serverless Postgres via [Drizzle ORM](https://orm.drizzle.team)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- YouTube Data API v3 for channel/video metadata
- Bunny Stream (optional) for self-hosted video
- [Resend](https://resend.com) for transactional email (verification, password reset)
- Designed to deploy on [Vercel](https://vercel.com)

## Running locally

**Prerequisites:** Node.js 20+, a [Neon](https://neon.tech) Postgres database, and a [YouTube Data API key](https://developers.google.com/youtube/v3/getting-started).

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   See the [Environment variables](#environment-variables) section below for the full list.

3. **Push the database schema**

   ```bash
   npx drizzle-kit push
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). You'll be prompted to register an account. The first account can be promoted to operator via a direct database update:

   ```sql
   UPDATE users SET is_operator = true WHERE id = 1;
   ```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon Postgres pooled connection string |
| `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 key |
| `CRON_SECRET` | ✅ | Long random string protecting the cron sync endpoint |
| `ENCRYPTION_KEY` | ✅ | Base64-encoded 32-byte key for at-rest encryption. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Base URL for email links (e.g. `http://localhost:3000` locally, your domain in production) |
| `RESEND_API_KEY` | optional | [Resend](https://resend.com) API key. If unset, verification/reset links are logged to the server console instead of emailed |
| `EMAIL_FROM` | optional | Sender address for emails (defaults to `Kubi <onboarding@resend.dev>`) |
| `BUNNY_STREAM_LIBRARY_ID` | optional | Bunny Stream library ID (only if hosting your own videos) |
| `BUNNY_STREAM_CDN_HOSTNAME` | optional | Bunny CDN pull-zone hostname |
| `BUNNY_STREAM_TOKEN_SECURITY_KEY` | optional | Bunny embed token authentication key |
| `BUNNY_STREAM_API_KEY` | optional | Bunny Stream management API key |

## Deploying on Vercel

The app is built to run on Vercel with zero extra configuration.

1. **Push this repo to GitHub** (or GitLab/Bitbucket).

2. **Import it on Vercel** — go to [vercel.com/new](https://vercel.com/new) and select the repository. Vercel auto-detects Next.js.

3. **Add a database** — provision [Neon Postgres from the Vercel Marketplace](https://vercel.com/marketplace/neon) (or bring your own). This sets `DATABASE_URL` for you.

4. **Set environment variables** in the Vercel project settings (Settings → Environment Variables). See the [Environment variables](#environment-variables) table above.

5. **Deploy.** Vercel builds and ships the app.

6. **Initialize the database** — run `npx drizzle-kit push` locally against your production `DATABASE_URL`, or pull the env with `vercel env pull` first.

7. **Create an operator** — register the first account, then promote it:

   ```sql
   UPDATE users SET is_operator = true WHERE id = 1;
   ```

8. **Daily sync** — [`vercel.json`](./vercel.json) registers a cron job that hits `/api/cron/sync-channels` once a day (04:00 UTC) to pull new uploads from your approved channels. Vercel runs this automatically; the `CRON_SECRET` authenticates the request.
