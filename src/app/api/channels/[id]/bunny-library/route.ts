import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireOperator } from "@/lib/auth";
import { listLibraryVideos, resolveLibraryId } from "@/lib/bunny";

// List the videos available in this Bunny channel's Stream library, flagging
// which ones have already been imported.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, parseInt(id)))
    .limit(1);

  if (!channel || channel.source !== "bunny") {
    return NextResponse.json({ error: "Bunny channel not found" }, { status: 404 });
  }

  const libraryId = resolveLibraryId(channel.bunnyLibraryId);
  if (!libraryId) {
    return NextResponse.json(
      { error: "No Bunny library is configured for this channel" },
      { status: 400 }
    );
  }

  let libVideos;
  try {
    libVideos = await listLibraryVideos(libraryId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Bunny" },
      { status: 502 }
    );
  }

  const guids = libVideos.map((v) => v.guid);
  const existing = guids.length
    ? await db
        .select({ youtubeVideoId: videos.youtubeVideoId })
        .from(videos)
        .where(inArray(videos.youtubeVideoId, guids))
    : [];
  const importedSet = new Set(existing.map((e) => e.youtubeVideoId));

  return NextResponse.json({
    videos: libVideos.map((v) => ({ ...v, imported: importedSet.has(v.guid) })),
  });
}
