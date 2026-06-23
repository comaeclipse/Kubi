// One-off migration: make watch history opaque to raw DB access by replacing
// the plaintext youtube_video_id in video_progress with a keyed HMAC blind
// index (videoIdBlindIndex), and joining to a matching hash on videos instead.
//
// After this runs, video_progress holds only (profile_id, video_id_hash, ...)
// — an admin with DB/console/dump access can't tell which videos a profile
// watched. Mirrors how users.email / profiles.name are already protected.
//
// Expand/contract migration — the Neon DB is shared between local and prod, so
// the old (deployed) code and the new code must both work during cutover.
//
//   PHASE=additive (run BEFORE deploying the new code) — idempotent:
//     A. DDL — add nullable videos.youtube_video_id_hash + video_progress.video_id_hash.
//     B. Backfill — compute the HMAC for every videos row and progress row.
//     C. Expand — unique index on videos(hash) + on video_progress(profile_id,
//        video_id_hash) (so the new upsert's ON CONFLICT target exists), and
//        drop NOT NULL on the legacy video_progress.youtube_video_id so new
//        inserts (which omit it) succeed. Old code keeps working unchanged.
//
//   PHASE=finalize (run AFTER the new code is fully deployed) — idempotent:
//     D. Contract — set the hash columns NOT NULL, swap the video_progress PK to
//        (profile_id, video_id_hash), and drop the legacy youtube_video_id.
//
//   PHASE=all (default) — runs additive + finalize in one shot. Only safe if no
//   old code is serving against this DB (e.g. solo/local, brief downtime).
//
// Required env: DATABASE_URL, ENCRYPTION_KEY (same key the app uses)
//
// Run: PHASE=additive node scripts/encrypt-watch-history.mjs
//      (deploy) then: PHASE=finalize node scripts/encrypt-watch-history.mjs

import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

const { DATABASE_URL, ENCRYPTION_KEY } = process.env;

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const key = Buffer.from(ENCRYPTION_KEY || "", "base64");
if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");

const sql = neon(DATABASE_URL);

// Must match src/lib/crypto.ts videoIdBlindIndex byte-for-byte.
const videoIdBlindIndex = (id) =>
  crypto.createHmac("sha256", key).update(id).digest("base64");

const log = (...a) => console.log("•", ...a);

async function columnExists(table, column) {
  const [row] = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}`;
  return Boolean(row);
}

// --- Phase A: DDL ---
async function ddl() {
  await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS youtube_video_id_hash text`;
  await sql`ALTER TABLE video_progress ADD COLUMN IF NOT EXISTS video_id_hash text`;
  log("Phase A: hash columns ready");
}

// --- Phase B: backfill ---
// Batched: tens of thousands of videos make per-row round-trips too slow, so we
// compute the HMACs in JS and bulk-update one chunk at a time via unnest().
const CHUNK = 1000;

async function backfill() {
  const vids = await sql`
    SELECT id, youtube_video_id FROM videos WHERE youtube_video_id_hash IS NULL`;
  for (let i = 0; i < vids.length; i += CHUNK) {
    const batch = vids.slice(i, i + CHUNK);
    const ids = batch.map((v) => v.id);
    const hashes = batch.map((v) => videoIdBlindIndex(v.youtube_video_id));
    await sql.query(
      `UPDATE videos AS v SET youtube_video_id_hash = d.h
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS h) d
       WHERE v.id = d.id`,
      [ids, hashes]
    );
    log(`Phase B: hashed videos ${i + batch.length}/${vids.length}`);
  }
  log(`Phase B: hashed ${vids.length} video(s)`);

  // Only possible while the legacy column still exists (i.e. pre-Phase-C).
  if (await columnExists("video_progress", "youtube_video_id")) {
    const prog = await sql`
      SELECT profile_id, youtube_video_id
      FROM video_progress WHERE video_id_hash IS NULL`;
    for (let i = 0; i < prog.length; i += CHUNK) {
      const batch = prog.slice(i, i + CHUNK);
      const pids = batch.map((p) => p.profile_id);
      const yids = batch.map((p) => p.youtube_video_id);
      const hashes = batch.map((p) => videoIdBlindIndex(p.youtube_video_id));
      await sql.query(
        `UPDATE video_progress AS vp SET video_id_hash = d.h
         FROM (SELECT unnest($1::int[]) AS pid, unnest($2::text[]) AS yid,
                      unnest($3::text[]) AS h) d
         WHERE vp.profile_id = d.pid AND vp.youtube_video_id = d.yid`,
        [pids, yids, hashes]
      );
    }
    log(`Phase B: hashed ${prog.length} progress row(s)`);
  } else {
    log("Phase B: video_progress.youtube_video_id already dropped — skipping");
  }
}

// --- Phase C: expand (additive constraints; old + new code coexist) ---
async function expand() {
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS videos_youtube_video_id_hash_unique
    ON videos (youtube_video_id_hash)`;
  // The new upsert targets (profile_id, video_id_hash); give it a unique index
  // now (separate from the old PK) so ON CONFLICT works before the PK swap.
  // (youtube_video_id can't be made nullable here — it's still in the PK — so
  // the old PK stays NOT NULL until finalize drops it.)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS video_progress_profile_video_hash_unique
    ON video_progress (profile_id, video_id_hash)`;
  log("Phase C: expand done (unique indexes added for the new join + upsert)");
}

// --- Phase D: contract (run only after the new code is fully deployed) ---
async function finalize() {
  await sql`ALTER TABLE videos ALTER COLUMN youtube_video_id_hash SET NOT NULL`;
  await sql`ALTER TABLE video_progress ALTER COLUMN video_id_hash SET NOT NULL`;

  // Swap the primary key from (profile_id, youtube_video_id) to
  // (profile_id, video_id_hash), then drop the now-unused plaintext column.
  const [pk] = await sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'video_progress'::regclass AND contype = 'p'`;
  if (pk?.conname === "video_progress_profile_id_youtube_video_id_pk") {
    await sql.query(`ALTER TABLE video_progress DROP CONSTRAINT "${pk.conname}"`);
  }
  const [existingPk] = await sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'video_progress'::regclass AND contype = 'p'`;
  if (!existingPk) {
    await sql`ALTER TABLE video_progress
      ADD PRIMARY KEY (profile_id, video_id_hash)`;
  }
  // The new PK now covers (profile_id, video_id_hash); drop the redundant
  // temp unique index expand() created for the upsert.
  await sql`DROP INDEX IF EXISTS video_progress_profile_video_hash_unique`;
  await sql`ALTER TABLE video_progress DROP COLUMN IF EXISTS youtube_video_id`;
  log("Phase D: contract done (NOT NULL set, PK swapped, legacy column dropped)");
}

async function verify() {
  const [{ vids }] = await sql`
    SELECT count(*)::int AS vids FROM videos WHERE youtube_video_id_hash IS NULL`;
  const sample = await sql`
    SELECT profile_id, video_id_hash, progress_seconds
    FROM video_progress LIMIT 5`;
  console.log("\nVERIFY:");
  console.log("  videos missing hash (should be 0):", vids);
  console.log("  sample video_progress (only opaque hashes):", sample);
}

async function main() {
  const phase = process.env.PHASE || "all";

  if (phase === "finalize") {
    // Catch any rows the old code inserted (video_id_hash NULL) between the
    // additive phase and the deploy, so the NOT NULL in finalize won't fail.
    await backfill();
    await finalize();
    await verify();
    console.log("\n✅ Finalize (contract) complete.");
    return;
  }

  await ddl();
  await backfill();
  await expand();

  if (phase === "additive") {
    await verify();
    console.log(
      "\n✅ Additive (expand) complete. Deploy the new code, then run:" +
        "\n   PHASE=finalize node scripts/encrypt-watch-history.mjs"
    );
    return;
  }

  await finalize();
  await verify();
  console.log("\n✅ Watch-history encryption migration complete.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
