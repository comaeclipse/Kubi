"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VideoPlayer } from "@/components/video/video-player";
import { VideoGrid } from "@/components/video/video-grid";
import { AddToPlaylistDialog } from "@/components/playlist/add-to-playlist-dialog";
import { useProfile } from "@/context/profile-context";

interface Video {
  id: number;
  youtubeVideoId: string;
  youtubeChannelId: string | null;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  channelId: number;
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  hidden?: boolean;
  progressSeconds?: number | null;
}

export default function WatchPage() {
  const params = useParams<{ videoId: string }>();
  const { activeProfile } = useProfile();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [suggestedRelated, setSuggestedRelated] = useState<Video[]>([]);
  const [startSeconds, setStartSeconds] = useState<number>(0);

  useEffect(() => {
    const profileParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    const progressProfileParam = activeProfile
      ? `?profileId=${activeProfile.id}`
      : "";

    Promise.all([
      fetch(`/api/videos/${params.videoId}${profileParam}`).then((r) =>
        r.json()
      ),
      fetch(
        `/api/videos/${params.videoId}/progress${progressProfileParam}`
      ).then((r) => r.json()),
    ]).then(([videoData, progressData]) => {
      if (videoData.video) {
        setVideo(videoData.video);
        setRelated(videoData.related || []);
        setSuggestedRelated(videoData.suggestedRelated || []);
      }
      setStartSeconds(progressData?.progressSeconds ?? 0);
    });
  }, [params.videoId, activeProfile]);

  if (!video) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <VideoPlayer
        youtubeVideoId={video.youtubeVideoId}
        title={video.title}
        startSeconds={startSeconds}
        profileId={activeProfile?.id}
      />
      <div>
        <h1 className="text-xl font-bold">{video.title}</h1>
        <div className="flex items-center gap-3 mt-1">
          {video.channelTitle && video.youtubeChannelId && (
            <Link
              href={`/channel/${video.youtubeChannelId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {video.channelTitle}
            </Link>
          )}
          {activeProfile && (
            <AddToPlaylistDialog videoId={video.id} videoTitle={video.title} />
          )}
        </div>
      </div>

      {suggestedRelated.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Related Videos</h2>
          <VideoGrid videos={suggestedRelated} />
        </div>
      )}

      {related.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            More from this channel
          </h2>
          <VideoGrid videos={related} />
        </div>
      )}
    </div>
  );
}
