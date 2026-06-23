import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";

// Clear all watch history for one of the account's own kid profiles, without
// deleting the profile itself. Parent-initiated from the "My Family" admin page.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const profileId = parseInt(id);

    if (!(await userOwnsProfile(auth.id, profileId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .delete(videoProgress)
      .where(eq(videoProgress.profileId, profileId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to clear watch history" },
      { status: 500 }
    );
  }
}
