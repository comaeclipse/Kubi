"use client";

import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface User {
  id: number;
  email: string;
  emailVerified: boolean;
  isOperator: boolean;
  isDemo: boolean;
  onboardedAt: string | null;
  createdAt: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

interface UserManagerProps {
  users: User[];
  onRefresh: () => Promise<void>;
}

export function UserManager({ users: initialUsers, onRefresh }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Sync parent-driven refreshes (e.g. after a failed toggle) into local state.
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  async function toggleDemo(user: User) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo: !user.isDemo }),
      });
      if (!res.ok) throw new Error("Failed");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isDemo: !u.isDemo } : u))
      );
    } catch {
      await onRefresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon className="h-5 w-5" />
          Registered Users
        </h2>
        <p className="text-sm text-muted-foreground">
          View all registered parent accounts and their subscription status.
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              {/* Email */}
              <span className="min-w-0 flex-1 truncate font-medium">
                {user.email}
              </span>

              {/* Badges */}
              <div className="hidden sm:flex flex-wrap items-center gap-1 shrink-0">
                {user.isOperator && <Badge variant="default">Operator</Badge>}
                {user.isDemo && <Badge variant="outline">Demo</Badge>}
                {user.emailVerified ? (
                  <Badge variant="secondary">Verified</Badge>
                ) : (
                  <Badge variant="outline">Unverified</Badge>
                )}
                {user.subscriptionStatus && (
                  <Badge
                    variant={
                      user.subscriptionStatus === "active" ? "secondary" : "outline"
                    }
                  >
                    {user.subscriptionStatus}
                  </Badge>
                )}
              </div>

              {/* Dates */}
              <span className="hidden lg:block text-xs text-muted-foreground shrink-0 w-24 text-right">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>

              {/* Demo toggle */}
              <Button
                variant={user.isDemo ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0 text-xs"
                disabled={togglingId === user.id}
                onClick={() => toggleDemo(user)}
              >
                {user.isDemo ? "Unmark demo" : "Mark demo"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
