import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  channelLabels,
  channels,
  labels,
  videoLabels,
  videos,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { visibleChannel } from "@/lib/channel-visibility";
import { getProfileContentRules } from "@/lib/profile-content";

const MAX_LIMIT = 20;
const MAX_EXCLUSIONS = 200;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const rules = await getProfileContentRules(auth.id, Number(body.profileId));
    if (rules === null) {
      return NextResponse.json({ error: "A valid profile is required" }, { status: 403 });
    }
    if (rules.channelIds.length === 0) {
      return NextResponse.json({ videos: [], eligibleCount: 0 });
    }
    const allowedChannelIds = rules.channelIds;

    const requestedLimit = Number(body.limit);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isInteger(requestedLimit) ? requestedLimit : MAX_LIMIT)
    );
    const excludeVideoIds = Array.from(
      new Set(
        Array.isArray(body.excludeVideoIds)
          ? body.excludeVideoIds
              .filter(Number.isInteger)
              .slice(-MAX_EXCLUSIONS)
          : []
      )
    ) as number[];

    const musicChannelIds = db
      .select({ channelId: channelLabels.channelId })
      .from(channelLabels)
      .innerJoin(labels, eq(channelLabels.labelId, labels.id))
      .where(and(eq(labels.slug, "music"), eq(labels.kind, "category")));

    const musicVideoIds = db
      .select({ videoId: videoLabels.videoId })
      .from(videoLabels)
      .innerJoin(labels, eq(videoLabels.labelId, labels.id))
      .where(and(eq(labels.slug, "music"), eq(labels.kind, "category")));

    // Restrict to channels the caller may see. Private channels carry no labels
    // so wouldn't match music anyway, but guard explicitly — this route is not
    // otherwise enablement-scoped.
    const eligibility = and(
      eq(videos.source, "youtube"),
      eq(videos.hidden, false),
      eq(videos.isShort, false),
      inArray(videos.channelId, allowedChannelIds),
      visibleChannel(auth.id),
      rules.titleFilter,
      or(
        inArray(videos.channelId, musicChannelIds),
        inArray(videos.id, musicVideoIds)
      ),
      excludeVideoIds.length > 0
        ? notInArray(videos.id, excludeVideoIds)
        : undefined
    );

    const [queue, countRows] = await Promise.all([
      db
        .select({
          id: videos.id,
          youtubeVideoId: videos.youtubeVideoId,
          title: videos.title,
          duration: videos.duration,
          thumbnailUrl: videos.thumbnailUrl,
          channelId: channels.id,
          youtubeChannelId: channels.youtubeChannelId,
          channelTitle: channels.title,
          channelThumbnailUrl: channels.thumbnailUrl,
        })
        .from(videos)
        .innerJoin(channels, eq(videos.channelId, channels.id))
        .where(eligibility)
        .orderBy(sql`RANDOM()`)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)` })
        .from(videos)
        .innerJoin(channels, eq(videos.channelId, channels.id))
        .where(
          and(
            eq(videos.source, "youtube"),
            eq(videos.hidden, false),
            eq(videos.isShort, false),
            inArray(videos.channelId, allowedChannelIds),
            visibleChannel(auth.id),
            rules.titleFilter,
            or(
              inArray(videos.channelId, musicChannelIds),
              inArray(videos.id, musicVideoIds)
            )
          )
        ),
    ]);

    return NextResponse.json({
      videos: queue,
      eligibleCount: Number(countRows[0]?.count ?? 0),
    });
  } catch (error) {
    console.error("Failed to build music queue", error);
    return NextResponse.json(
      { error: "Failed to build music queue" },
      { status: 500 }
    );
  }
}
