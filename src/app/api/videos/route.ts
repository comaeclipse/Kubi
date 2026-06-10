import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels, videoProgress } from "@/db/schema";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";

// Bunny videos store no thumbnail in the DB — point them at the server-side
// redirect endpoint that signs a fresh Bunny CDN thumbnail URL per request.
function mapVideoThumbnail<
  T extends { source?: string | null; youtubeVideoId: string; thumbnailUrl: string | null }
>(row: T): T {
  if (row.source === "bunny") {
    return { ...row, thumbnailUrl: `/api/bunny/thumbnail/${row.youtubeVideoId}` };
  }
  return row;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const channelSlug = url.searchParams.get("channelId");
    const includeHidden = url.searchParams.get("includeHidden") === "true";
    const includeShorts = url.searchParams.get("includeShorts") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "0") || 0;
    const offset = parseInt(url.searchParams.get("offset") || "0") || 0;
    const sort = url.searchParams.get("sort") || "recent";
    const profileId = url.searchParams.get("profileId");
    const q = url.searchParams.get("q")?.trim();

    const conditions = [];

    if (channelSlug) {
      if (/^\d+$/.test(channelSlug)) {
        conditions.push(eq(videos.channelId, parseInt(channelSlug)));
      } else {
        conditions.push(eq(channels.youtubeChannelId, channelSlug));
      }
    }

    if (!includeHidden) {
      conditions.push(eq(videos.hidden, false));
    }

    if (!includeShorts) {
      conditions.push(eq(videos.isShort, false));
    }

    if (q) {
      conditions.push(
        or(ilike(videos.title, `%${q}%`), ilike(channels.title, `%${q}%`))!
      );
    }

    const orderBy =
      sort === "random" ? sql`RANDOM()` : desc(videos.publishedAt);

    const progressJoinCondition = profileId
      ? and(
          eq(videos.youtubeVideoId, videoProgress.youtubeVideoId),
          eq(videoProgress.profileId, parseInt(profileId))
        )
      : sql`false`;

    let query = db
      .select({
        id: videos.id,
        channelId: videos.channelId,
        youtubeVideoId: videos.youtubeVideoId,
        youtubeChannelId: channels.youtubeChannelId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        publishedAt: videos.publishedAt,
        duration: videos.duration,
        hidden: videos.hidden,
        isShort: videos.isShort,
        source: videos.source,
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        progressSeconds: videoProgress.progressSeconds,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .leftJoin(videoProgress, progressJoinCondition)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .$dynamic();

    if (limit > 0) {
      query = query.limit(limit).offset(offset);
    }

    const rows = await query;
    const result = rows.map(mapVideoThumbnail);

    if (limit > 0) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(videos)
        .leftJoin(channels, eq(videos.channelId, channels.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return NextResponse.json({
        videos: result,
        total: countResult.count,
        hasMore: offset + limit < countResult.count,
      });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
