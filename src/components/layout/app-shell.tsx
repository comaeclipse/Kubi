"use client";

import { type ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { ProfilePicker } from "@/components/profile/profile-picker";

function AppContent({ children }: { children: ReactNode }) {
  const { activeProfile, profiles, loading } = useProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!activeProfile && profiles.length > 0) {
    return <ProfilePicker />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <AppContent>{children}</AppContent>
    </ProfileProvider>
  );
}
