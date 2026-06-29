import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { decryptLegacyCompatible } from "@/lib/crypto";
import type { AuthUser } from "@/context/auth-context";
import type { Profile } from "@/context/profile-context";

export interface InitialData {
  user: AuthUser | null;
  profiles: Profile[];
}

// Server-side equivalent of the /api/auth/status + /api/profiles calls the
// client contexts used to make on mount. Fetching here lets the root layout
// ship the data in the initial HTML, removing a post-hydration round-trip.
export async function getInitialData(): Promise<InitialData> {
  const current = await getCurrentUser();
  if (!current) return { user: null, profiles: [] };

  // Dates aren't JSON-serializable across the RSC boundary in the shape the
  // client expects (it wants ISO strings), so convert them here.
  const user: AuthUser = {
    id: current.id,
    email: current.email,
    emailVerified: current.emailVerified,
    isOperator: current.isOperator,
    onboarded: current.onboarded,
    isDemo: current.isDemo,
    stripeCustomerId: current.stripeCustomerId,
    billingProvider: current.billingProvider,
    subscriptionId: current.subscriptionId,
    subscriptionStatus: current.subscriptionStatus,
    trialEndsAt: current.trialEndsAt?.toISOString() ?? null,
    currentPeriodEndsAt: current.currentPeriodEndsAt?.toISOString() ?? null,
    hasAccess: current.hasAccess,
  };

  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, current.id));

  const profileList: Profile[] = rows.map((p) => ({
    id: p.id,
    name: decryptLegacyCompatible(p.name),
    avatarColor: p.avatarColor,
    createdAt: p.createdAt.toISOString(),
  }));

  return { user, profiles: profileList };
}
