"use client";

import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  avatarColor: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-xl",
  xl: "h-24 w-24 text-4xl",
};

export function ProfileAvatar({
  name,
  avatarColor,
  size = "md",
  className,
}: ProfileAvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: avatarColor }}
    >
      {initial}
    </div>
  );
}
