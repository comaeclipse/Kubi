"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { ProfilePicker } from "@/components/profile/profile-picker";
import { AuthProvider } from "@/context/auth-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";

// Routes that render bare (no sidebar/profile chrome): the auth flow.
const BARE_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

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
    return (
      <>
        <ProfilePicker />
        <OnboardingDialog />
      </>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <OnboardingDialog />
    </SidebarProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isBare) {
    // Auth pages: no profile provider, no sidebar — just the page.
    return <AuthProvider>{children}</AuthProvider>;
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <AppContent>{children}</AppContent>
      </ProfileProvider>
    </AuthProvider>
  );
}
