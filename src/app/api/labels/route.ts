import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { labels } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import {
  isLabelKind,
  normalizeLabelSlug,
} from "@/lib/taxonomy";

export async function GET() {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(labels)
    .orderBy(asc(labels.kind), asc(labels.name));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const kind = body.kind;
    const slug = normalizeLabelSlug(
      typeof body.slug === "string" && body.slug.trim() ? body.slug : name
    );

    if (!name || !slug || !isLabelKind(kind)) {
      return NextResponse.json(
        { error: "Name and a valid kind are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(labels)
      .values({ name, slug, kind })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("labels_slug_unique")
        ? "A label with that slug already exists"
        : "Failed to create label";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
