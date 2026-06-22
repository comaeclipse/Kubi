import crypto from "crypto";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type Invitation = typeof invitations.$inferSelect;

// Returns the invite row if the code is valid, not expired, and under maxUses;
// otherwise null. An invalid/expired/maxed invite is treated as "no invite" by
// callers — they fall back to normal email verification rather than erroring.
export async function findUsableInvite(code: string): Promise<Invitation | null> {
  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.code, code));

  if (!invite) return null;

  if (invite.expiresAt && invite.expiresAt < new Date()) return null;

  if (invite.maxUses !== null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.invitedVia, invite.id));
    if (Number(count) >= invite.maxUses) return null;
  }

  return invite;
}

// Human-friendly alphabet for short invite codes — omits ambiguous
// characters (0/O, 1/I/L) so codes are easy to read and type.
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Generates a short, random, human-friendly invite code (default 5 chars).
// 31^5 ≈ 28M combinations; collisions are caught by the unique constraint and
// retried by the caller.
export function newInviteCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}
