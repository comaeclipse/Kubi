import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const allProfiles = await db.select().from(profiles);
    return NextResponse.json(allProfiles);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, avatarColor } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!avatarColor || typeof avatarColor !== "string") {
      return NextResponse.json(
        { error: "Avatar color is required" },
        { status: 400 }
      );
    }

    const [profile] = await db
      .insert(profiles)
      .values({ name: name.trim(), avatarColor })
      .returning();

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
