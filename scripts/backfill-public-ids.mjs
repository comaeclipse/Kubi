// One-off: give every existing YouTube video a scrambled 11-char public_id so
// the watch URL never shows the real YouTube video id. Bunny videos are left
// null (they keep their GUID as the route key). Idempotent / safe to re-run.
//
// Adds the column + unique index if missing, then backfills in batches.
//
// Required env: DATABASE_URL
//
// Run: node scripts/backfill-public-ids.mjs

import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = neon(DATABASE_URL);

// Must match src/lib/public-id.ts generatePublicId.
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
function generatePublicId(length = 11) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 63];
  return out;
}

const log = (...a) => console.log("•", ...a);
const CHUNK = 1000;

async function main() {
  await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS public_id text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS videos_public_id_unique
    ON videos (public_id)`;
  log("public_id column + unique index ready");

  const rows = await sql`
    SELECT id FROM videos WHERE source = 'youtube' AND public_id IS NULL`;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const ids = batch.map((r) => r.id);
    const pubs = batch.map(() => generatePublicId());
    await sql.query(
      `UPDATE videos AS v SET public_id = d.p
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS p) d
       WHERE v.id = d.id`,
      [ids, pubs]
    );
    log(`backfilled ${i + batch.length}/${rows.length}`);
  }

  const [{ missing }] = await sql`
    SELECT count(*)::int AS missing FROM videos
    WHERE source = 'youtube' AND public_id IS NULL`;
  const sample = await sql`
    SELECT public_id FROM videos WHERE public_id IS NOT NULL LIMIT 5`;
  console.log("\nVERIFY:");
  console.log("  youtube videos missing public_id (should be 0):", missing);
  console.log("  sample public_ids:", sample.map((r) => r.public_id));
  console.log(`\n✅ Backfilled ${rows.length} video(s).`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
