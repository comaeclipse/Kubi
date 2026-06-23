import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { importVideoPage } from "@/lib/channel-import";

// POST /api/my-channels/[id]/import  body: { pageToken? }
// Imports one page of a private channel the caller owns. The client loops on
// nextPageToken until null to pull the full history.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const id = parseInt((await params).id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const pageToken: string | undefined = body?.pageToken ?? undefined;

    // Only the owner may import into their private channel.
    const [channel] = await db
      .select({
        id: channels.id,
        uploadsPlaylistId: channels.uploadsPlaylistId,
      })
      .from(channels)
      .where(and(eq(channels.id, id), eq(channels.ownerUserId, auth.id)))
      .limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (!channel.uploadsPlaylistId) {
      return NextResponse.json(
        { error: "This channel cannot be imported" },
        { status: 400 }
      );
    }

    const result = await importVideoPage(
      channel.id,
      channel.uploadsPlaylistId,
      pageToken
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
