"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video/video-player";
import { useProfile } from "@/context/profile-context";

const DEMO_VIDEO = {
  youtubeVideoId: "i-JxEd-IMzs",
  title: "Amtrak Cascades Trains 2026",
  channelTitle: "CoasterFan2105",
  channelUrl: "https://www.youtube.com/@CoasterFan2105",
};

export default function YouTubeNoCookieDemoPage() {
  const { activeProfile } = useProfile();
  const [startSeconds, setStartSeconds] = useState(0);

  useEffect(() => {
    if (!activeProfile) return;

    fetch(
      `/api/videos/${DEMO_VIDEO.youtubeVideoId}/progress?profileId=${activeProfile.id}`
    )
      .then((r) => r.json())
      .then((data) => setStartSeconds(data?.progressSeconds ?? 0))
      .catch(() => setStartSeconds(0));
  }, [activeProfile]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <VideoPlayer
        youtubeVideoId={DEMO_VIDEO.youtubeVideoId}
        title={DEMO_VIDEO.title}
        startSeconds={activeProfile ? startSeconds : 0}
        profileId={activeProfile?.id}
        useNoCookieHost
      />

      <div>
        <h1 className="text-xl font-bold">{DEMO_VIDEO.title}</h1>
        <div className="flex items-center gap-3 mt-1">
          <Link
            href={DEMO_VIDEO.channelUrl}
            className="text-sm text-muted-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {DEMO_VIDEO.channelTitle}
          </Link>
        </div>
      </div>
    </div>
  );
}
