import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import {
  listLibraryVideos,
  resolveLibraryId,
  secondsToIso8601,
} from "@/lib/bunny";

// Import selected videos from the channel's Bunny library by GUID. Metadata
// (title, duration, upload date) is fetched authoritatively from Bunny.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const channelId = parseInt(id);
    const { guids } = await request.json();

    if (!Array.isArray(guids) || guids.length === 0) {
      return NextResponse.json(
        { error: "guids must be a non-empty array" },
        { status: 400 }
      );
    }

    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel || channel.source !== "bunny") {
      return NextResponse.json(
        { error: "Bunny channel not found" },
        { status: 404 }
      );
    }

    const libraryId = resolveLibraryId(channel.bunnyLibraryId);
    if (!libraryId) {
      return NextResponse.json(
        { error: "No Bunny library is configured for this channel" },
        { status: 400 }
      );
    }

    const lib = await listLibraryVideos(libraryId);
    const byGuid = new Map(lib.map((v) => [v.guid, v]));

    const requested = new Set<string>(guids);
    const toInsert = lib
      .filter((v) => requested.has(v.guid) && byGuid.has(v.guid))
      .map((v) => ({
        channelId,
        youtubeVideoId: v.guid,
        title: v.title,
        duration: secondsToIso8601(v.lengthSeconds),
        publishedAt: v.dateUploaded,
        source: "bunny",
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0 });
    }

    const inserted = await db
      .insert(videos)
      .values(toInsert)
      .onConflictDoNothing({ target: videos.youtubeVideoId })
      .returning({ id: videos.id });

    return NextResponse.json({ imported: inserted.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import" },
      { status: 500 }
    );
  }
}
