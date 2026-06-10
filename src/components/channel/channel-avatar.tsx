import { cn } from "@/lib/utils";

interface ChannelAvatarProps {
  title: string;
  thumbnailUrl?: string | null;
  /** Sizing/shape (and text size for the letter fallback), e.g. "h-16 w-16 rounded-full text-2xl". */
  className?: string;
}

// Deterministic hue from the channel title so the fallback colour is stable
// across renders (not actually random per paint, but unique-looking per channel).
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * Channel icon. Renders the thumbnail image when present; otherwise a colored
 * monogram — light background with a darker letter of the same hue.
 */
export function ChannelAvatar({
  title,
  thumbnailUrl,
  className,
}: ChannelAvatarProps) {
  if (thumbnailUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={thumbnailUrl}
        alt={title}
        className={cn("object-cover", className)}
        loading="lazy"
      />
    );
  }

  const letter = title.trim().charAt(0).toUpperCase() || "?";
  const hue = hueFromString(title || "?");

  return (
    <div
      aria-label={title}
      className={cn("flex items-center justify-center font-semibold", className)}
      style={{
        backgroundColor: `hsl(${hue} 65% 88%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
    >
      {letter}
    </div>
  );
}
