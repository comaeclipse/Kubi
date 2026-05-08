"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lock, Unlock, Users, Search, X } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");

  function submit() {
    const q = inputValue.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  function clear() {
    setInputValue("");
    router.push("/");
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder="Search videos…"
        className="pl-8 h-9 pr-8"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {inputValue && (
        <button
          className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          onClick={clear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { activeProfile, profiles, switchProfile, clearProfile } = useProfile();

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.isAdmin))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAdmin(false);
    window.location.reload();
  }

  return (
    <header className="flex items-center gap-2 border-b px-4 h-14 shrink-0">
      <SidebarTrigger />
      <Link href="/" className="font-bold text-lg shrink-0">
        SafeVision
      </Link>

      <div className="flex-1 flex justify-center px-4">
        <Suspense fallback={<div className="w-full max-w-sm h-9" />}>
          <SearchBar />
        </Suspense>
      </div>

      {activeProfile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <ProfileAvatar
                name={activeProfile.name}
                avatarColor={activeProfile.avatarColor}
                size="sm"
              />
              <span className="hidden sm:inline text-sm font-medium">
                {activeProfile.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {profiles
              .filter((p) => p.id !== activeProfile.id)
              .map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => switchProfile(profile.id)}
                  className="gap-2"
                >
                  <ProfileAvatar
                    name={profile.name}
                    avatarColor={profile.avatarColor}
                    size="sm"
                  />
                  {profile.name}
                </DropdownMenuItem>
              ))}
            {profiles.length > 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={clearProfile} className="gap-2">
              <Users className="h-4 w-4" />
              Switch Profile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isAdmin ? (
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Lock admin">
          <Unlock className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" asChild title="Admin">
          <Link href="/admin">
            <Lock className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </header>
  );
}
