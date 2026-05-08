import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const res = await fetch(`${baseUrl}/api/cron/sync-channels`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
