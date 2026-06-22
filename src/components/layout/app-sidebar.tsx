"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { Home, Shield, ListMusic, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
}

interface Playlist {
  id: number;
  name: string;
  profileId: number | null;
  videoCount: number;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then(setChannels)
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const profileParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    fetch(`/api/playlists${profileParam}`)
      .then((r) => r.json())
      .then((data) => setPlaylists(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [pathname, activeProfile?.id]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          Kubi
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/"}>
              <Link href="/">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/recently-watched"}>
              <Link href="/recently-watched">
                <History className="h-4 w-4" />
                <span>Recently Watched</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="px-4 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Channels
          </span>
        </div>

        <ScrollArea className="flex-1">
          <SidebarMenu>
            {channels.map((channel) => (
              <SidebarMenuItem key={channel.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/channel/${channel.youtubeChannelId}`}
                  className="!h-auto py-2"
                >
                  <Link
                    href={`/channel/${channel.youtubeChannelId}`}
                    title={channel.title}
                    className="justify-center"
                  >
                    <ChannelAvatar
                      title={channel.title}
                      thumbnailUrl={channel.thumbnailUrl}
                      className="h-16 w-16 flex-none rounded-full text-2xl"
                    />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>

        <div className="px-4 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Playlists
          </span>
        </div>

        <SidebarMenu>
          {playlists.length === 0 ? (
            <SidebarMenuItem>
              <span className="px-4 text-xs text-muted-foreground">
                No playlists yet
              </span>
            </SidebarMenuItem>
          ) : (
            playlists.map((playlist) => (
              <SidebarMenuItem key={playlist.id}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/playlist/${playlist.id}`}
                >
                  <Link href={`/playlist/${playlist.id}`}>
                    <ListMusic className="h-4 w-4" />
                    <span className="truncate flex-1">{playlist.name}</span>
                    {playlist.profileId === null && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Shared
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>

        {user?.isOperator && (
          <SidebarMenu className="mt-auto pb-4">
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/admin"}>
                <Link href="/admin">
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
