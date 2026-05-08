import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels, videoProgress } from "@/db/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import { extractKeywords } from "@/lib/related-videos";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profileId");

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
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        progressSeconds: videoProgress.progressSeconds,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .leftJoin(videoProgress, progressJoinCondition)
      .where(eq(videos.youtubeVideoId, id))
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
            sql`(${sql.join(orConditions, sql` OR `)})`
          )
        )
        .orderBy(sql`${score} DESC`)
        .limit(8);

      suggestedRelated = scored.map(({ score: _, ...rest }) => rest);
    }

    return NextResponse.json({
      video,
      related: related
        .filter((v) => v.youtubeVideoId !== video.youtubeVideoId)
        .slice(0, 8),
      suggestedRelated,
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
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { hidden } = await request.json();

    if (typeof hidden !== "boolean") {
      return NextResponse.json(
        { error: "hidden must be a boolean" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(videos)
      .set({ hidden })
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
