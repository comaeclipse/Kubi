"use client";

import { useCallback, useEffect, useState } from "react";

import { ProfileManager } from "@/components/admin/profile-manager";
import { ChannelToggleList } from "@/components/admin/channel-toggle-list";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";

export default function AdminFamilyPage() {
  const { refreshProfiles: refreshContextProfiles } = useProfile();
  const { user } = useAuth();
  const [adminProfiles, setAdminProfiles] = useState<
    { id: number; name: string; avatarColor: string }[]
  >([]);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await fetch("/api/profiles").then((r) => r.json());
      setAdminProfiles(Array.isArray(data) ? data : []);
      refreshContextProfiles();
    } catch {
      // ignore
    }
  }, [refreshContextProfiles]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after await, not synchronously
    if (user) loadProfiles();
  }, [user, loadProfiles]);

  return (
    <div className="space-y-6">
      {/* Per-account: your kids and the channels they can watch */}
      <ProfileManager profiles={adminProfiles} onRefresh={loadProfiles} />

      <Separator />

      <ChannelToggleList />
    </div>
  );
}
