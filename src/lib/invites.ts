import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateToken } from "@/lib/crypto";

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

// Generates a random 16-byte URL-safe token for use as an invite code.
export function newInviteCode(): string {
  return generateToken(16);
}
