"use client";

interface BunnyVideoPlayerProps {
  // Server-signed Bunny Stream embed URL (token + expires already applied).
  embedUrl: string;
  title: string;
}

export function BunnyVideoPlayer({ embedUrl, title }: BunnyVideoPlayerProps) {
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
