// One-off migration: introduce user accounts WITHOUT destroying existing
// profiles/playlists/watch-progress (unlike `drizzle-kit push`, which rebuilds
// the profiles table and drops its rows because of the new NOT NULL user_id).
//
// Phases (all idempotent / safe to re-run):
//   A. DDL — create users/sessions/email_tokens/user_channels, add nullable
//      user_id to profiles + playlists.
//   B. Owner — ensure the owner account exists (created here only if
//      OWNER_PASSWORD is provided; on prod the owner registers via the app).
//   C. Backfill — assign every still-unowned profile to the owner, encrypting
//      its name in place; enable all master channels for the owner; mark owner
//      as operator.
//   D. Constrain — set user_id NOT NULL on profiles + playlists.
//
// Required env: DATABASE_URL, ENCRYPTION_KEY, OWNER_EMAIL
// Optional env: OWNER_PASSWORD (create the owner if missing — rehearsal only)
//
// Run: node scripts/migrate-accounts.mjs

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const { DATABASE_URL, ENCRYPTION_KEY, OWNER_EMAIL, OWNER_PASSWORD } = process.env;

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!OWNER_EMAIL) throw new Error("OWNER_EMAIL is required");
const key = Buffer.from(ENCRYPTION_KEY || "", "base64");
if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");

const sql = neon(DATABASE_URL);

// --- crypto helpers (must match src/lib/crypto.ts byte-for-byte) ---
const normalizeEmail = (e) => e.trim().toLowerCase();
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}
function decrypt(payload) {
  const [iv, tag, data] = payload.split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
const emailBlindIndex = (e) =>
  crypto.createHmac("sha256", key).update(normalizeEmail(e)).digest("base64");

const log = (...a) => console.log("•", ...a);

// --- Phase A: DDL ---
async function ddl() {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    email_hash text NOT NULL UNIQUE,
    email text NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean NOT NULL DEFAULT false,
    is_operator boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS email_tokens (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS user_channels (
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, channel_id)
  )`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE`;
  log("Phase A: schema ready");
}

// --- Phase B: ensure owner ---
async function ensureOwner() {
  const hash = emailBlindIndex(OWNER_EMAIL);
  const [existing] = await sql`SELECT id, is_operator FROM users WHERE email_hash = ${hash}`;
  if (existing) {
    log(`Phase B: owner exists (id=${existing.id})`);
    return existing.id;
  }
  if (!OWNER_PASSWORD) {
    throw new Error(
      `Owner ${OWNER_EMAIL} not found. Register it via the app first, or set OWNER_PASSWORD to create it here.`
    );
  }
  const [created] = await sql`INSERT INTO users (email_hash, email, password_hash, email_verified, is_operator)
    VALUES (${hash}, ${encrypt(normalizeEmail(OWNER_EMAIL))}, ${await bcrypt.hash(OWNER_PASSWORD, 10)}, true, true)
    RETURNING id`;
  log(`Phase B: owner created (id=${created.id})`);
  return created.id;
}

// --- Phase C: backfill ---
async function backfill(ownerId) {
  // Assign + encrypt every unowned profile (the legacy kids).
  const orphans = await sql`SELECT id, name FROM profiles WHERE user_id IS NULL`;
  for (const p of orphans) {
    await sql`UPDATE profiles SET name = ${encrypt(p.name)}, user_id = ${ownerId} WHERE id = ${p.id}`;
    log(`  assigned + encrypted profile id=${p.id} ("${p.name}")`);
  }
  // Any unowned playlists -> owner (prod has none today, but be safe).
  await sql`UPDATE playlists SET user_id = ${ownerId} WHERE user_id IS NULL`;
  // Enable every master channel for the owner.
  await sql`INSERT INTO user_channels (user_id, channel_id)
    SELECT ${ownerId}, id FROM channels
    ON CONFLICT (user_id, channel_id) DO NOTHING`;
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM user_channels WHERE user_id = ${ownerId}`;
  // Ensure operator.
  await sql`UPDATE users SET is_operator = true WHERE id = ${ownerId}`;
  log(`Phase C: ${orphans.length} profile(s) assigned, ${count} channel(s) enabled, owner is operator`);
}

// --- Phase D: constraints ---
async function constrain() {
  await sql`ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL`;
  await sql`ALTER TABLE playlists ALTER COLUMN user_id SET NOT NULL`;
  log("Phase D: user_id is now NOT NULL on profiles + playlists");
}

async function verify(ownerId) {
  const profiles = await sql`SELECT id, name, user_id FROM profiles ORDER BY id`;
  const decoded = profiles.map((p) => ({
    id: p.id,
    name: (() => { try { return decrypt(p.name); } catch { return "<not encrypted!>"; } })(),
    user_id: p.user_id,
  }));
  const progress = await sql`SELECT profile_id, count(*)::int AS n FROM video_progress GROUP BY profile_id ORDER BY profile_id`;
  console.log("\nVERIFY:");
  console.log("  owner id:", ownerId);
  console.log("  profiles:", decoded);
  console.log("  progress rows:", progress);
}

async function main() {
  const phase = process.env.PHASE || "all";
  await ddl();
  if (phase === "ddl") {
    console.log("\n✅ DDL phase complete (schema only).");
    return;
  }
  const ownerId = await ensureOwner();
  await backfill(ownerId);
  await constrain();
  await verify(ownerId);
  console.log("\n✅ Migration complete.");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
