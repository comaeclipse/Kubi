import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import { fetchVideoPage, fetchVideoDetails } from "@/lib/youtube";

// POST /api/channels/[id]/import
// Body: { pageToken?: string }
// Imports one playlist page (up to 50 videos) for the given channel.
// Returns { imported, nextPageToken } so the client can drive the loop.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const pageToken: string | undefined = body?.pageToken ?? undefined;

    // Look up the channel to get its uploads playlist ID
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, parseInt(id)))
      .limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!channel.uploadsPlaylistId) {
      return NextResponse.json(
        { error: "This channel cannot be imported" },
        { status: 400 }
      );
    }

    // Fetch one page of playlist items from YouTube
    const { videos: videoList, nextPageToken } = await fetchVideoPage(
      channel.uploadsPlaylistId,
      pageToken
    );

    if (videoList.length === 0) {
      return NextResponse.json({ imported: 0, nextPageToken: null });
    }

    // Fetch durations + Shorts detection for this page's videos
    const videoIds = videoList.map((v) => v.youtubeVideoId);
    const details = await fetchVideoDetails(videoIds);
    const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

    // Insert, skipping any that already exist (safe to call multiple times)
    await db
      .insert(videos)
      .values(
        videoList.map((v) => ({
          channelId: channel.id,
          youtubeVideoId: v.youtubeVideoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          duration: detailsMap.get(v.youtubeVideoId)?.duration ?? null,
          isShort: detailsMap.get(v.youtubeVideoId)?.isShort ?? false,
        }))
      )
      .onConflictDoNothing();

    return NextResponse.json({
      imported: videoList.length,
      nextPageToken,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
