import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistVideos, videos } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import { fetchAllVideos } from "@/lib/youtube";

function extractPlaylistId(url: string): string | null {
  const trimmed = url.trim();
  // Accept bare playlist IDs (PL..., UU..., etc.)
  if (/^[A-Z]{2}[\w-]{10,}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.searchParams.get("list");
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, url } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return NextResponse.json(
        { error: "Could not extract a playlist ID from the provided URL" },
        { status: 400 }
      );
    }

    const ytVideos = await fetchAllVideos(playlistId);

    let matched: { id: number }[] = [];
    if (ytVideos.length > 0) {
      matched = await db
        .select({ id: videos.id })
        .from(videos)
        .where(inArray(videos.youtubeVideoId, ytVideos.map((v) => v.youtubeVideoId)));
    }

    const [playlist] = await db
      .insert(playlists)
      .values({ name: name.trim(), profileId: null })
      .returning();

    if (matched.length > 0) {
      await db
        .insert(playlistVideos)
        .values(matched.map((v, i) => ({ playlistId: playlist.id, videoId: v.id, position: i })))
        .onConflictDoNothing();
    }

    return NextResponse.json({
      playlistId: playlist.id,
      name: playlist.name,
      matched: matched.length,
      total: ytVideos.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
