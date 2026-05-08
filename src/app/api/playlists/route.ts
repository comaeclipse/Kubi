import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistVideos } from "@/db/schema";
import { eq, isNull, or, sql, asc } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const videoId = searchParams.get("videoId");

    const videoCountSq = db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, playlists.id));

    const whereClause = profileId
      ? or(eq(playlists.profileId, parseInt(profileId)), isNull(playlists.profileId))
      : isNull(playlists.profileId);

    const rows = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        profileId: playlists.profileId,
        createdAt: playlists.createdAt,
        videoCount: sql<number>`(${videoCountSq})`,
      })
      .from(playlists)
      .where(whereClause)
      .orderBy(asc(playlists.name));

    if (videoId) {
      const vid = parseInt(videoId);
      const containsSq = db
        .select({ exists: sql<boolean>`1` })
        .from(playlistVideos)
        .where(
          sql`${playlistVideos.playlistId} = ${playlists.id} AND ${playlistVideos.videoId} = ${vid}`
        );

      const rowsWithContains = await db
        .select({
          id: playlists.id,
          name: playlists.name,
          profileId: playlists.profileId,
          createdAt: playlists.createdAt,
          videoCount: sql<number>`(${videoCountSq})`,
          containsVideo: sql<boolean>`EXISTS (${containsSq})`,
        })
        .from(playlists)
        .where(whereClause)
        .orderBy(asc(playlists.name));

      return NextResponse.json(rowsWithContains);
    }

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, profileId } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (profileId === null || profileId === undefined) {
      if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const [playlist] = await db
      .insert(playlists)
      .values({
        name: name.trim(),
        profileId: profileId ?? null,
      })
      .returning();

    return NextResponse.json(playlist);
  } catch {
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
