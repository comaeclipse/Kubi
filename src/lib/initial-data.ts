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
//
// This runs unguarded inside the root layout (every route), so any failure
// here — a decrypt() throw on a bad ciphertext/key, a transient DB error,
// etc. — must degrade to "logged out" rather than throw. Throwing would take
// down the entire app render (no error.tsx catches a root-layout crash before
// the client even hydrates), which looks to users exactly like "cookie login
// stopped working": a session cookie present, but the site won't load at all.
export async function getInitialData(): Promise<InitialData> {
  try {
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
      hasPin: current.hasPin,
      pinUnlockedUntil: current.pinUnlockedUntil?.toISOString() ?? null,
    };

    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, current.id));

    const profileList: Profile[] = rows.map((p) => ({
      id: p.id,
      name: decryptLegacyCompatible(p.name),
      avatarColor: p.avatarColor,
      blockedKeywords: p.blockedKeywords ?? [],
      dailyLimitMinutes: p.dailyLimitMinutes,
      createdAt: p.createdAt.toISOString(),
    }));

    return { user, profiles: profileList };
  } catch (err) {
    console.error("[getInitialData] failed, falling back to logged-out:", err);
    return { user: null, profiles: [] };
  }
}
