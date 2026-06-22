"use client";

import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { useAuth } from "@/context/auth-context";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Middleware/app-shell redirects unauthenticated users; this is a safety net.
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage</h1>
      <AdminNav />
      {children}
    </div>
  );
}
