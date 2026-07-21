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
import { Home, Shield, ListMusic, History, Music2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function SortableChannelItem({
  channel,
  isActive,
  reorderable,
  justDraggedRef,
}: {
  channel: Channel;
  isActive: boolean;
  reorderable: boolean;
  justDraggedRef: React.MutableRefObject<number | null>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: channel.id, disabled: !reorderable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className="group/menu-item relative"
    >
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "!h-auto flex-col gap-1 py-2",
          isDragging && "relative z-10 opacity-80"
        )}
      >
        <Link
          href={`/channel/${channel.youtubeChannelId}`}
          title={channel.title}
          className="flex flex-col items-center justify-center gap-1"
          // An <a href> is natively draggable, so pressing and dragging one
          // starts the browser's own link drag alongside dnd-kit's pointer
          // drag. Dropping that link on the page navigates to it with a full
          // document load, which blows away the reorder mid-flight.
          draggable={false}
          {...(reorderable ? { ...attributes, ...listeners } : {})}
          onClick={(e) => {
            if (justDraggedRef.current === channel.id) {
              e.preventDefault();
              justDraggedRef.current = null;
            }
          }}
        >
          <ChannelAvatar
            title={channel.title}
            thumbnailUrl={channel.thumbnailUrl}
            className="h-16 w-16 flex-none rounded-full text-2xl"
          />
          <span className="w-16 truncate text-center text-[11px] text-muted-foreground">
            {channel.title}
          </span>
        </Link>
      </SidebarMenuButton>
    </li>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { activeProfile, restoring } = useProfile();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const justDraggedRef = useRef<number | null>(null);

  // Reordering writes to the active profile's own sort order, so it's only
  // available once a profile is selected (and thus scoping the channel list).
  const reorderable = Boolean(activeProfile);

  useEffect(() => {
    // `restoring` is true until the last-active profile has been read back
    // from localStorage; fetching before then could scope to the wrong
    // profile (or none) and flash the wrong list.
    if (restoring) return;
    const profileParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    fetch(`/api/channels${profileParam}`)
      .then((r) => r.json())
      .then((data) => setChannels(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [pathname, activeProfile?.id, restoring]);

  useEffect(() => {
    const profileParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    fetch(`/api/playlists${profileParam}`)
      .then((r) => r.json())
      .then((data) => setPlaylists(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [pathname, activeProfile?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      if (delta.x !== 0 || delta.y !== 0) {
        justDraggedRef.current = active.id as number;
        // The click that follows pointerup is the one to swallow. Anything
        // later is a real click, so drop the guard once that click has had
        // its turn — otherwise a drag that ends without a click leaves the
        // channel permanently unclickable.
        setTimeout(() => {
          justDraggedRef.current = null;
        }, 0);
      }
      if (!over || active.id === over.id || !activeProfile) return;

      const oldIndex = channels.findIndex((c) => c.id === active.id);
      const newIndex = channels.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(channels, oldIndex, newIndex);
      setChannels(reordered);
      fetch(`/api/profiles/${activeProfile.id}/channels/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelIds: reordered.map((c) => c.id) }),
      }).catch(() => {
        setChannels(channels);
      });
    },
    [activeProfile, channels]
  );

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
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/music"}>
              <Link href="/music">
                <Music2 className="h-4 w-4" />
                <span>Music</span>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={channels.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <SidebarMenu>
                {channels.map((channel) => (
                  <SortableChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={pathname === `/channel/${channel.youtubeChannelId}`}
                    reorderable={reorderable}
                    justDraggedRef={justDraggedRef}
                  />
                ))}
              </SidebarMenu>
            </SortableContext>
          </DndContext>
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
