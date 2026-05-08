import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { isAdmin } from "@/lib/auth";
import { fetchVideoDetails } from "@/lib/youtube";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all video IDs from DB
    const allVideos = await db
      .select({ id: videos.id, youtubeVideoId: videos.youtubeVideoId })
      .from(videos);

    if (allVideos.length === 0) {
      return NextResponse.json({ scanned: 0, shortsFound: 0 });
    }

    const videoIds = allVideos.map((v) => v.youtubeVideoId);
    const details = await fetchVideoDetails(videoIds);
    const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

    let shortsFound = 0;
    for (const video of allVideos) {
      const detail = detailsMap.get(video.youtubeVideoId);
      if (detail) {
        await db
          .update(videos)
          .set({ isShort: detail.isShort })
          .where(eq(videos.id, video.id));
        if (detail.isShort) shortsFound++;
      }
    }

    return NextResponse.json({ scanned: allVideos.length, shortsFound });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan for Shorts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
