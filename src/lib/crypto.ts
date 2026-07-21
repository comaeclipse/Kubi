import crypto from "crypto";

// At-rest field encryption for personal data (kid names, email).
//
// ENCRYPTION_KEY is a base64-encoded 32-byte key (generate with
// `openssl rand -base64 32`). Losing/rotating it makes existing ciphertext
// unreadable, so treat it like a database credential.

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}); generate one with: openssl rand -base64 32`
    );
  }
  cachedKey = key;
  return key;
}

// Returns "iv:authTag:ciphertext", each part base64.
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// Legacy account migrations may briefly leave personal fields as plaintext.
// Accept only values that clearly are not in our three-part GCM envelope;
// malformed encrypted-looking values still fail closed through decrypt().
export function decryptLegacyCompatible(payload: string): string {
  return payload.split(":").length === 1 ? payload : decrypt(payload);
}

// Deterministic HMAC of a normalized email — used as a unique constraint and
// login lookup key, since the encrypted `email` column can't be queried.
export function emailBlindIndex(email: string): string {
  const key = getKey();
  return crypto
    .createHmac("sha256", key)
    .update(normalizeEmail(email))
    .digest("base64");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deterministic HMAC of a video id — lets us link watch history to a video
// without storing the plaintext id in video_progress, so a DB leak / raw DB
// access can't reveal which videos a profile watched.
export function videoIdBlindIndex(youtubeVideoId: string): string {
  const key = getKey();
  return crypto
    .createHmac("sha256", key)
    .update(youtubeVideoId)
    .digest("base64");
}

// Keyed signature over a cookie payload we hand to the browser and later trust
// (the parent-PIN unlock ticket). Signing rather than storing a row keeps the
// ticket stateless; the key never leaves the server, so it can't be forged.
export function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", getKey())
    .update(payload)
    .digest("base64url");
}

export function verifyPayloadSignature(
  payload: string,
  signature: string
): boolean {
  const expected = Buffer.from(signPayload(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// Opaque, URL-safe token for sessions and email links.
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// One-way hash for tokens stored in the DB (sessions/email tokens), so a DB
// leak doesn't expose usable tokens.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64");
}
