import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_COOKIE = "admin_session";
const COOKIE_MAX_AGE = 2 * 60 * 60; // 2 hours

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "pin_hash"));

  if (result.length === 0) return false;

  return bcrypt.compare(pin, result[0].value);
}

export async function getPinHash(): Promise<string | null> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "pin_hash"));

  return result.length > 0 ? result[0].value : null;
}

export async function setPinHash(hash: string): Promise<void> {
  const existing = await getPinHash();
  if (existing) {
    await db
      .update(settings)
      .set({ value: hash })
      .where(eq(settings.key, "pin_hash"));
  } else {
    await db.insert(settings).values({ key: "pin_hash", value: hash });
  }
}

export async function setAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated";
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
