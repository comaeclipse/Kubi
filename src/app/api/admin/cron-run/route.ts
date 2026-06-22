import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const baseUrl = new URL(request.url).origin;
  const res = await fetch(`${baseUrl}/api/cron/sync-channels`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
