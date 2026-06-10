import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildThumbnailUrl } from "@/lib/bunny";

// Redirects to a freshly-signed Bunny CDN thumbnail URL. Signing happens here
// (server-side) so tokens never go stale inside cached feed responses and the
// CDN security key never reaches the client.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const [row] = await db
    .select({ cdnHostname: channels.bunnyCdnHostname })
    .from(videos)
    .leftJoin(channels, eq(videos.channelId, channels.id))
    .where(eq(videos.youtubeVideoId, videoId))
    .limit(1);

  const url = buildThumbnailUrl(row?.cdnHostname, videoId);
  if (!url) {
    return NextResponse.json({ error: "No thumbnail available" }, { status: 404 });
  }

  // 307 keeps it a GET; short cache so the signed URL can be refreshed.
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
