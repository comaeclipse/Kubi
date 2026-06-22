import { NextResponse } from "next/server";
import { desc, sql, eq } from "drizzle-orm";

import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { newInviteCode } from "@/lib/invites";

export async function GET() {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const registrationsSq = db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(users)
    .where(eq(users.invitedVia, invitations.id));

  const rows = await db
    .select({
      id: invitations.id,
      code: invitations.code,
      label: invitations.label,
      maxUses: invitations.maxUses,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      registrations: sql<number>`(${registrationsSq})`,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : null;
    const maxUses =
      typeof body.maxUses === "number" && body.maxUses > 0
        ? body.maxUses
        : null;
    const expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt
        ? new Date(body.expiresAt)
        : null;

    const code = newInviteCode();

    const rows = await db
      .insert(invitations)
      .values({ code, label, maxUses, expiresAt, createdBy: auth.id })
      .returning();
    const created = (rows as any[])[0];

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("invitations_code")
        ? "Invite code collision — please try again"
        : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
