import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress, videos } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { videoIdBlindIndex } from "@/lib/crypto";
import { resolveYoutubeVideoId } from "@/lib/public-id";
import { getProfileContentRules } from "@/lib/profile-content";

async function profileCanWatchVideo(
  userId: number,
  profileId: number,
  youtubeVideoId: string
) {
  const rules = await getProfileContentRules(userId, profileId);
  if (!rules?.channelIds.length) return false;
  const [video] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(
      and(
        eq(videos.youtubeVideoId, youtubeVideoId),
        rules.videoFilter,
        rules.titleFilter
      )
    )
    .limit(1);
  return Boolean(video);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id: slug } = await params;
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId || !(await userOwnsProfile(auth.id, parseInt(profileId)))) {
    return NextResponse.json({ progressSeconds: 0 });
  }

  const youtubeVideoId = await resolveYoutubeVideoId(slug);
  if (!youtubeVideoId) {
    return NextResponse.json({ progressSeconds: 0 });
  }
  if (!(await profileCanWatchVideo(auth.id, parseInt(profileId), youtubeVideoId))) {
    return NextResponse.json({ progressSeconds: 0 });
  }

  const rows = await db
    .select()
    .from(videoProgress)
    .where(
      and(
        eq(videoProgress.profileId, parseInt(profileId)),
        eq(videoProgress.videoIdHash, videoIdBlindIndex(youtubeVideoId))
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

  const { id: slug } = await params;
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

  const youtubeVideoId = await resolveYoutubeVideoId(slug);
  if (!youtubeVideoId) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  if (!(await profileCanWatchVideo(auth.id, profileId, youtubeVideoId))) {
    return NextResponse.json({ error: "Video is not available to this profile" }, { status: 403 });
  }

  await db
    .insert(videoProgress)
    .values({
      profileId,
      videoIdHash: videoIdBlindIndex(youtubeVideoId),
      progressSeconds: Math.floor(seconds),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [videoProgress.profileId, videoProgress.videoIdHash],
      set: {
        progressSeconds: Math.floor(seconds),
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
