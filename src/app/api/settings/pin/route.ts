import { NextResponse } from "next/server";
import { isAdmin, verifyPin, hashPin, setPinHash } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPin, newPin } = await request.json();

    if (
      !currentPin ||
      !newPin ||
      !/^\d{4}$/.test(currentPin) ||
      !/^\d{4}$/.test(newPin)
    ) {
      return NextResponse.json(
        { error: "Both PINs must be exactly 4 digits" },
        { status: 400 }
      );
    }

    const valid = await verifyPin(currentPin);
    if (!valid) {
      return NextResponse.json(
        { error: "Current PIN is incorrect" },
        { status: 401 }
      );
    }

    const hash = await hashPin(newPin);
    await setPinHash(hash);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update PIN" },
      { status: 500 }
    );
  }
}
