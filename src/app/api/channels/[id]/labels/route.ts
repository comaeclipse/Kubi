import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { channelLabels, channels, labels } from "@/db/schema";
import { requireOperator } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const channelId = Number((await params).id);
  const body = await request.json();
  const labelIds = Array.from(
    new Set(
      Array.isArray(body.labelIds)
        ? body.labelIds.filter(Number.isInteger).slice(0, 100)
        : []
    )
  ) as number[];

  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId));
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (labelIds.length > 0) {
    const valid = await db
      .select({ id: labels.id })
      .from(labels)
      .where(inArray(labels.id, labelIds));
    if (valid.length !== labelIds.length) {
      return NextResponse.json({ error: "Unknown label" }, { status: 400 });
    }
  }

  await db.delete(channelLabels).where(eq(channelLabels.channelId, channelId));
  if (labelIds.length > 0) {
    await db
      .insert(channelLabels)
      .values(labelIds.map((labelId) => ({ channelId, labelId })));
  }

  const assigned = await db
    .select({
      id: labels.id,
      slug: labels.slug,
      name: labels.name,
      kind: labels.kind,
    })
    .from(channelLabels)
    .innerJoin(
      labels,
      and(
        eq(channelLabels.labelId, labels.id),
        eq(channelLabels.channelId, channelId)
      )
    );
  return NextResponse.json(assigned);
}
