import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { labels } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import {
  isLabelKind,
  normalizeLabelSlug,
} from "@/lib/taxonomy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Partial<typeof labels.$inferInsert> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.slug === "string") {
      const slug = normalizeLabelSlug(body.slug);
      if (!slug) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      updates.slug = slug;
    }
    if (body.kind !== undefined) {
      if (!isLabelKind(body.kind)) {
        return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
      }
      updates.kind = body.kind;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(labels)
      .set(updates)
      .where(eq(labels.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update label" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(labels)
    .where(eq(labels.id, id))
    .returning({ id: labels.id });
  if (!deleted) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
