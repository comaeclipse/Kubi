import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id: youtubeVideoId } = await params;
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId || !(await userOwnsProfile(auth.id, parseInt(profileId)))) {
    return NextResponse.json({ progressSeconds: 0 });
  }

  const rows = await db
    .select()
    .from(videoProgress)
    .where(
      and(
        eq(videoProgress.profileId, parseInt(profileId)),
        eq(videoProgress.youtubeVideoId, youtubeVideoId)
      )
    )
    .limit(1);

  const progressSeconds = rows[0]?.progressSeconds ?? 0;
  return NextResponse.json({ progressSeconds });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id: youtubeVideoId } = await params;
  const body = await req.json();
  const seconds = Number(body?.seconds ?? 0);
  const profileId = Number(body?.profileId);

  if (!profileId || !Number.isFinite(profileId)) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  if (!(await userOwnsProfile(auth.id, profileId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Number.isFinite(seconds) || seconds < 0) {
    return NextResponse.json({ error: "Invalid seconds value" }, { status: 400 });
  }

  await db
    .insert(videoProgress)
    .values({
      profileId,
      youtubeVideoId,
      progressSeconds: Math.floor(seconds),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [videoProgress.profileId, videoProgress.youtubeVideoId],
      set: {
        progressSeconds: Math.floor(seconds),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
