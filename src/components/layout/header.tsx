"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
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
import { Users, Search, X, Settings, LogOut, UserCircle, CreditCard } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { toast } from "sonner";

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

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
  const { activeProfile, profiles, switchProfile, clearProfile } = useProfile();
  const { user } = useAuth();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleManageBilling() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch {
      toast.error("Could not open billing portal");
    }
  }

  const daysLeft = user ? trialDaysLeft(user.trialEndsAt) : null;
  const isOnTrial = daysLeft !== null && !user?.subscriptionId;

  return (
    <header className="flex items-center gap-2 border-b px-4 h-14 shrink-0">
      <SidebarTrigger />
      <Link href="/" className="font-bold text-lg shrink-0">
        Kubi
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Account">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {user && (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                {user.email}
              </div>
              {isOnTrial && (
                <div className="px-2 py-1 text-xs text-amber-600 font-medium">
                  {daysLeft === 0 ? "Trial ending today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in trial`}
                </div>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/profiles">
              <UserCircle className="h-4 w-4" />
              Manage Profiles
            </Link>
          </DropdownMenuItem>
          {user?.isOperator && (
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/admin">
                <Settings className="h-4 w-4" />
                Manage
              </Link>
            </DropdownMenuItem>
          )}
          {isOnTrial && (
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/subscribe">
                <CreditCard className="h-4 w-4" />
                Subscribe
              </Link>
            </DropdownMenuItem>
          )}
          {user?.subscriptionId && (
            <DropdownMenuItem onClick={handleManageBilling} className="gap-2">
              <CreditCard className="h-4 w-4" />
              Manage billing
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
