import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOperator } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const userId = parseInt(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json();

  if (typeof body.isDemo !== "boolean") {
    return NextResponse.json({ error: "isDemo (boolean) is required" }, { status: 400 });
  }

  const updated = await db
    .update(users)
    .set({ isDemo: body.isDemo })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
