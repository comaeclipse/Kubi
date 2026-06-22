import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

export async function GET() {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isOperator: users.isOperator,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
      subscriptionStatus: users.subscriptionStatus,
      trialEndsAt: users.trialEndsAt,
      currentPeriodEndsAt: users.currentPeriodEndsAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const decryptedRows = rows.map((row) => ({
    ...row,
    email: decrypt(row.email),
  }));

  return NextResponse.json(decryptedRows);
}
