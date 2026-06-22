"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";

// Client-side gate for operator-only admin sub-pages. Non-operators are bounced
// back to the family tab; data is also protected server-side via requireOperator().
export function OperatorGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !user.isOperator) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  if (loading || !user || !user.isOperator) return null;

  return <>{children}</>;
}
