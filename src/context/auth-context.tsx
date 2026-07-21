"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: number;
  email: string;
  emailVerified: boolean;
  isOperator: boolean;
  onboarded: boolean;
  isDemo: boolean;
  stripeCustomerId: string | null;
  billingProvider: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null; // ISO string from JSON
  currentPeriodEndsAt: string | null;
  hasAccess: boolean;
  // Parent PIN gate: false until the parent creates a PIN. `pinUnlockedUntil`
  // is the ISO expiry of the current unlock, or null while locked.
  hasPin: boolean;
  pinUnlockedUntil: string | null;
};

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  // Resolved on the server and shipped in the initial HTML, so there is no
  // post-hydration fetch on first load. `refresh` re-checks on demand.
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
