"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/context/profile-context";

interface Playlist {
  id: number;
  name: string;
  profileId: number | null;
  createdAt: string;
}

interface Video {
  id: number;
  youtubeVideoId: string;
  youtubeChannelId: string | null;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  position: number;
  progressSeconds?: number | null;
}

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const { activeProfile } = useProfile();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const profileParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    fetch(`/api/playlists/${params.id}${profileParam}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setPlaylist(data.playlist);
        setVideos(data.videos || []);
      })
      .catch(() => setPlaylist(null))
      .finally(() => setLoading(false));
  }, [params.id, activeProfile]);

  async function handleRemoveVideo(videoId: number) {
    try {
      const res = await fetch(`/api/playlists/${params.id}/videos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) throw new Error();
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      toast.success("Video removed from playlist");
    } catch {
      toast.error("Failed to remove video");
    }
  }

  if (loading) {
    return <VideoGrid videos={[]} loading />;
  }

  if (!playlist) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Playlist not found</p>
      </div>
    );
  }

  const canEdit =
    playlist.profileId === null
      ? false // admin playlists managed from admin panel
      : activeProfile?.id === playlist.profileId;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ListMusic className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          {playlist.profileId === null && (
            <Badge variant="secondary">Shared</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {videos.length} video{videos.length !== 1 ? "s" : ""}
        </p>
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListMusic className="h-12 w-12 mb-4" />
          <p className="text-lg">This playlist is empty</p>
          <p className="text-sm">Add videos from the watch page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="relative group">
              <VideoCard {...video} />
              {canEdit && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemoveVideo(video.id);
                  }}
                  title="Remove from playlist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
