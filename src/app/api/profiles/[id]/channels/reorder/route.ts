import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { profileChannels } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";

// PATCH /api/profiles/[id]/channels/reorder
// Body: { channelIds: number[] } — the profile's approved channels in their
// new display order. Only channels already approved for this profile are
// reordered; anything else in the body is ignored.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const profileId = Number((await params).id);
    const { channelIds } = await request.json();
    if (
      !Array.isArray(channelIds) ||
      channelIds.some((id) => !Number.isInteger(id))
    ) {
      return NextResponse.json({ error: "Invalid channel order" }, { status: 400 });
    }
    if (!(await userOwnsProfile(auth.id, profileId))) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const approvedRows = await db
      .select({ channelId: profileChannels.channelId })
      .from(profileChannels)
      .where(eq(profileChannels.profileId, profileId));
    const approvedIds = new Set(approvedRows.map((row) => row.channelId));

    await Promise.all(
      channelIds
        .filter((channelId) => approvedIds.has(channelId))
        .map((channelId, index) =>
          db
            .update(profileChannels)
            .set({ sortOrder: index })
            .where(
              and(
                eq(profileChannels.profileId, profileId),
                eq(profileChannels.channelId, channelId)
              )
            )
        )
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder channels" }, { status: 500 });
  }
}
