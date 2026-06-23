import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

// DELETE /api/my-channels/[id]
// Removes a private channel the caller owns. Deleting the channel cascades its
// videos and user_channels rows.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const id = parseInt((await params).id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(channels)
      .where(and(eq(channels.id, id), eq(channels.ownerUserId, auth.id)))
      .returning({ id: channels.id });

    if (!deleted) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove channel" },
      { status: 500 }
    );
  }
}
