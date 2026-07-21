import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireParent, requireUser } from "@/lib/auth";
import { encrypt, decryptLegacyCompatible } from "@/lib/crypto";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, auth.id));

    // Names are encrypted at rest — decrypt for the owner.
    const decrypted = rows.map((p) => ({
      ...p,
      name: decryptLegacyCompatible(p.name),
    }));
    return NextResponse.json(decrypted);
  } catch (error) {
    console.error("Failed to fetch profiles", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const { name, avatarColor } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!avatarColor || typeof avatarColor !== "string") {
      return NextResponse.json(
        { error: "Avatar color is required" },
        { status: 400 }
      );
    }

    const [profile] = await db
      .insert(profiles)
      .values({
        userId: auth.id,
        name: encrypt(name.trim()),
        avatarColor,
      })
      .returning();

    return NextResponse.json({ ...profile, name: name.trim() });
  } catch (error) {
    console.error("Failed to create profile", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
