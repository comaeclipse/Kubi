import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { decrypt, generateToken, hashToken } from "@/lib/crypto";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export type CurrentUser = {
  id: number;
  email: string;
  emailVerified: boolean;
  isOperator: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Creates a session row (storing only the token hash) and sets the cookie to
// the raw token, so a DB leak can't be replayed as a valid session.
export async function createSession(userId: number): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await db.insert(sessions).values({
    token: hashToken(token),
    userId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isOperator: users.isOperator,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, hashToken(token)));

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
    return null;
  }

  return {
    id: row.id,
    email: decrypt(row.email),
    emailVerified: row.emailVerified,
    isOperator: row.isOperator,
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Removes all sessions for a user (e.g. after a password reset).
export async function destroyAllSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// Best-effort cleanup of expired sessions.
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// Route guards. Each returns either the user/operator, or a NextResponse to
// return immediately. Usage:
//   const auth = await requireUser();
//   if (auth instanceof NextResponse) return auth;
//   const user = auth;
export async function requireUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "Email not verified" }, { status: 403 });
  }
  return user;
}

export async function requireOperator(): Promise<CurrentUser | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
