import { db } from "@/db";
import { emailTokens } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/crypto";

export type EmailTokenType = "verify" | "reset";

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TTL_MS = 60 * 60 * 1000; // 1h

// Issues a single-use token of a given type for a user (replacing any existing
// tokens of that type). Returns the raw token to email; only its hash is stored.
export async function issueEmailToken(
  userId: number,
  type: EmailTokenType,
  ttlMs: number
): Promise<string> {
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, type)));

  const token = generateToken();
  await db.insert(emailTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

// Validates a raw token; on success deletes it (single use) and returns userId.
export async function consumeEmailToken(
  token: string,
  type: EmailTokenType
): Promise<number | null> {
  const [row] = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.tokenHash, hashToken(token)),
        eq(emailTokens.type, type),
        gt(emailTokens.expiresAt, new Date())
      )
    );

  if (!row) return null;
  await db.delete(emailTokens).where(eq(emailTokens.id, row.id));
  return row.userId;
}
