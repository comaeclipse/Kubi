import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import {
  readUsage,
  recordHeartbeat,
  resetUsage,
  resolveTimeZone,
} from "@/lib/profile-time";

// The child's daily time budget. GET reads the tally, POST is the heartbeat
// that banks time, DELETE is the parent handing back a fresh allowance.
// All three resolve the profile against the caller's own account first, so one
// parent can't read or reset another family's screen time.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const timeZone = resolveTimeZone(
    new URL(request.url).searchParams.get("timeZone")
  );

  const usage = await readUsage(auth.id, Number(id), timeZone);
  if (!usage) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json(usage);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const timeZone = resolveTimeZone(body?.timeZone);

  const usage = await recordHeartbeat(
    auth.id,
    Number(id),
    timeZone,
    body?.resume === true
  );
  if (!usage) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json(usage);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const timeZone = resolveTimeZone(
    new URL(request.url).searchParams.get("timeZone")
  );

  const usage = await resetUsage(auth.id, Number(id), timeZone);
  if (!usage) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json(usage);
}
