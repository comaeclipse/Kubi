import { NextResponse } from "next/server";
import {
  hashPin,
  verifyPin,
  getPinHash,
  setPinHash,
  setAdminCookie,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 }
      );
    }

    const existingHash = await getPinHash();

    // First time: create PIN
    if (!existingHash) {
      const hash = await hashPin(pin);
      await setPinHash(hash);
      await setAdminCookie();
      return NextResponse.json({ success: true, created: true });
    }

    // Verify existing PIN
    const valid = await verifyPin(pin);
    if (!valid) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    await setAdminCookie();
    return NextResponse.json({ success: true, created: false });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
