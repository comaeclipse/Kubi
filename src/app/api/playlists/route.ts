import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistVideos } from "@/db/schema";
import { eq, isNull, or, and, sql, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const videoId = searchParams.get("videoId");

    const videoCountSq = db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, playlists.id));

    // Always scope to the account; within it, a profile sees its own playlists
    // plus the account-wide ones (profileId IS NULL).
    const scopeClause = profileId
      ? or(
          eq(playlists.profileId, parseInt(profileId)),
          isNull(playlists.profileId)
        )
      : isNull(playlists.profileId);
    const whereClause = and(eq(playlists.userId, auth.id), scopeClause);

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
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { name, profileId } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // A kid-owned playlist must reference one of this account's profiles.
    if (profileId !== null && profileId !== undefined) {
      if (!(await userOwnsProfile(auth.id, parseInt(profileId)))) {
        return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
      }
    }

    const [playlist] = await db
      .insert(playlists)
      .values({
        userId: auth.id,
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
