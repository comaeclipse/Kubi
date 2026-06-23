import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels, videoProgress, userChannels } from "@/db/schema";
import { eq, and, desc, ne, sql, inArray } from "drizzle-orm";
import { requireUser, requireOperator } from "@/lib/auth";
import { extractKeywords } from "@/lib/related-videos";
import { buildEmbedUrl, resolveLibraryId } from "@/lib/bunny";
import { visibleChannel } from "@/lib/channel-visibility";

// Point Bunny videos at the signed-thumbnail redirect endpoint.
function mapThumb<
  T extends { source?: string | null; youtubeVideoId: string; thumbnailUrl: string | null }
>(row: T): T {
  if (row.source === "bunny") {
    return { ...row, thumbnailUrl: `/api/bunny/thumbnail/${row.youtubeVideoId}` };
  }
  return row;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profileId");

    // Non-operators may only watch videos from channels they've enabled.
    let enabledIds: number[] = [];
    if (!auth.isOperator) {
      const rows = await db
        .select({ channelId: userChannels.channelId })
        .from(userChannels)
        .where(eq(userChannels.userId, auth.id));
      enabledIds = rows.map((r) => r.channelId);
    }
    const enabledFilter = (col: typeof videos.channelId) =>
      auth.isOperator
        ? undefined
        : enabledIds.length > 0
          ? inArray(col, enabledIds)
          : sql`false`;

    const progressJoinCondition = profileId
      ? and(
          eq(videos.youtubeVideoId, videoProgress.youtubeVideoId),
          eq(videoProgress.profileId, parseInt(profileId))
        )
      : sql`false`;

    const [video] = await db
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
        source: videos.source,
        bunnyLibraryId: channels.bunnyLibraryId,
        bunnyCdnHostname: channels.bunnyCdnHostname,
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        progressSeconds: videoProgress.progressSeconds,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .leftJoin(videoProgress, progressJoinCondition)
      .where(
        and(
          eq(videos.youtubeVideoId, id),
          enabledFilter(videos.channelId),
          // Blocks operators/other users from opening someone's private video.
          visibleChannel(auth.id)
        )
      )
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const related = await db
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
        source: videos.source,
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        progressSeconds: videoProgress.progressSeconds,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .leftJoin(videoProgress, progressJoinCondition)
      .where(
        and(
          eq(videos.channelId, video.channelId),
          eq(videos.hidden, false)
        )
      )
      .orderBy(desc(videos.publishedAt))
      .limit(9);

    // Cross-channel related videos by fuzzy title/channel matching
    let suggestedRelated: typeof related = [];
    const keywords = extractKeywords(video.title);

    if (keywords.length > 0) {
      const likeClauses = keywords.map(
        (kw) => {
          const escaped = kw.replace(/[%_]/g, "\\$&");
          return sql`(CASE WHEN lower(${videos.title}) LIKE ${"%" + escaped + "%"} THEN 1 ELSE 0 END + CASE WHEN lower(${channels.title}) LIKE ${"%" + escaped + "%"} THEN 1 ELSE 0 END)`;
        }
      );

      const score = sql<number>`(${sql.join(likeClauses, sql` + `)})`;

      const orConditions = keywords.map((kw) => {
        const escaped = kw.replace(/[%_]/g, "\\$&");
        const pattern = "%" + escaped + "%";
        return sql`(${videos.title} ILIKE ${pattern} OR ${channels.title} ILIKE ${pattern})`;
      });

      const scored = await db
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
          source: videos.source,
          channelTitle: channels.title,
          channelThumbnailUrl: channels.thumbnailUrl,
          progressSeconds: videoProgress.progressSeconds,
          score,
        })
        .from(videos)
        .leftJoin(channels, eq(videos.channelId, channels.id))
        .leftJoin(videoProgress, progressJoinCondition)
        .where(
          and(
            ne(videos.channelId, video.channelId),
            eq(videos.hidden, false),
            eq(videos.isShort, false),
            enabledFilter(videos.channelId),
            visibleChannel(auth.id),
            sql`(${sql.join(orConditions, sql` OR `)})`
          )
        )
        .orderBy(sql`${score} DESC`)
        .limit(8);

      suggestedRelated = scored.map(({ score: _, ...rest }) => rest);
    }

    // Build the (signed) Bunny embed URL for the main video, and rewrite Bunny
    // thumbnails to the signing redirect endpoint.
    let bunnyEmbedUrl: string | null = null;
    if (video.source === "bunny") {
      const libraryId = resolveLibraryId(video.bunnyLibraryId);
      if (libraryId) {
        bunnyEmbedUrl = buildEmbedUrl(libraryId, video.youtubeVideoId);
      }
    }

    return NextResponse.json({
      video: { ...mapThumb(video), bunnyEmbedUrl },
      related: related
        .filter((v) => v.youtubeVideoId !== video.youtubeVideoId)
        .slice(0, 8)
        .map(mapThumb),
      suggestedRelated: suggestedRelated.map(mapThumb),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const updates: Partial<typeof videos.$inferInsert> = {};
    if (typeof body.hidden === "boolean") {
      updates.hidden = body.hidden;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(videos)
      .set(updates)
      .where(eq(videos.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const videoId = parseInt(id);

    const [video] = await db
      .select({ youtubeVideoId: videos.youtubeVideoId })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Clean up progress rows (no FK constraint reaches video_progress).
    await db
      .delete(videoProgress)
      .where(eq(videoProgress.youtubeVideoId, video.youtubeVideoId));

    // Deleting the video cascades to playlist_videos.
    await db.delete(videos).where(eq(videos.id, videoId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
