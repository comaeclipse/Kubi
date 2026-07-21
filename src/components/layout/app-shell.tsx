"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { ProfileProvider, type Profile } from "@/context/profile-context";
import { ProfilePicker } from "@/components/profile/profile-picker";
import { TimeLimitGuard } from "@/components/profile/time-limit-guard";
import { AuthProvider, useAuth, type AuthUser } from "@/context/auth-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";

// Routes that render bare (no sidebar/profile chrome): the auth flow + billing.
const BARE_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/subscribe",
  "/invite",
];

// Deliberately does not block on profile restoration: the profiles are
// server-rendered, and gating the whole shell would replace every page's
// server-rendered HTML with a spinner on hydration. Pages that fetch
// profile-scoped data wait on `restoring` from useProfile() themselves.
function AppContent({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && !user.hasAccess) {
      router.push("/subscribe");
    }
  }, [authLoading, user, router]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <OnboardingDialog />
      <ProfilePicker />
      <TimeLimitGuard />
    </SidebarProvider>
  );
}

export function AppShell({
  children,
  initialUser,
  initialProfiles,
}: {
  children: ReactNode;
  initialUser: AuthUser | null;
  initialProfiles: Profile[];
}) {
  const pathname = usePathname();
  const isBare = BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isBare) {
    // Auth pages: no profile provider, no sidebar — just the page.
    return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
  }

  return (
    <AuthProvider initialUser={initialUser}>
      <ProfileProvider initialProfiles={initialProfiles}>
        <AppContent>{children}</AppContent>
      </ProfileProvider>
    </AuthProvider>
  );
}
