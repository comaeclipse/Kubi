import { db } from "@/db";
import { videos } from "@/db/schema";
import { fetchVideoPage, fetchVideoDetails } from "@/lib/youtube";

export interface ImportPageResult {
  imported: number;
  nextPageToken: string | null;
}

// Imports one page (up to 50 videos) of a channel's uploads playlist: fetches
// the page, resolves durations + Shorts detection, then bulk-inserts the page
// (skipping any that already exist). Shared by the operator import route and
// the user-facing private-channel import route so the two can't diverge.
export async function importVideoPage(
  channelId: number,
  uploadsPlaylistId: string,
  pageToken?: string
): Promise<ImportPageResult> {
  const { videos: videoList, nextPageToken } = await fetchVideoPage(
    uploadsPlaylistId,
    pageToken
  );

  if (videoList.length === 0) {
    return { imported: 0, nextPageToken: null };
  }

  const videoIds = videoList.map((v) => v.youtubeVideoId);
  const details = await fetchVideoDetails(videoIds);
  const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

  await db
    .insert(videos)
    .values(
      videoList.map((v) => ({
        channelId,
        youtubeVideoId: v.youtubeVideoId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        duration: detailsMap.get(v.youtubeVideoId)?.duration ?? null,
        isShort: detailsMap.get(v.youtubeVideoId)?.isShort ?? false,
      }))
    )
    .onConflictDoNothing();

  return { imported: videoList.length, nextPageToken };
}
