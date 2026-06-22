import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOperator } from "@/lib/auth";

export async function GET() {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "cron_sync_history"));

  const history = row ? JSON.parse(row.value) : [];
  return NextResponse.json(history);
}
