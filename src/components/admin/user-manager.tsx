"use client";

import { Users as UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface User {
  id: number;
  email: string;
  emailVerified: boolean;
  isOperator: boolean;
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

export function UserManager({ users, onRefresh }: UserManagerProps) {
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

      <div className="grid gap-2 sm:grid-cols-2">
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">
            No users yet.
          </p>
        )}
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate font-medium text-sm">
                    {user.email}
                  </p>
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground mt-1">
                    {user.isOperator && (
                      <Badge variant="default">Operator</Badge>
                    )}
                    {user.emailVerified ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                    {user.subscriptionStatus && (
                      <Badge variant={user.subscriptionStatus === "active" ? "secondary" : "outline"}>
                        {user.subscriptionStatus}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                {user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
                  <p>Trial ends {new Date(user.trialEndsAt).toLocaleDateString()}</p>
                )}
                {user.onboardedAt && (
                  <p>Onboarded {new Date(user.onboardedAt).toLocaleDateString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
