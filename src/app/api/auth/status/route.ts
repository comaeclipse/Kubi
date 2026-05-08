import { NextResponse } from "next/server";
import { isAdmin, getPinHash } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await isAdmin();
    const pinSet = (await getPinHash()) !== null;
    return NextResponse.json({ isAdmin: admin, pinSet });
  } catch {
    return NextResponse.json(
      { error: "Failed to check auth status" },
      { status: 500 }
    );
  }
}
