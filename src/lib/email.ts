import { Resend } from "resend";

// Sends verification + password-reset emails via Resend.
//
// Requires RESEND_API_KEY + EMAIL_FROM. If RESEND_API_KEY is unset (e.g. local
// dev), we skip the network call and log the link to the server console so the
// flow is still testable end-to-end without a provider.

function appUrl(): string {
  // Prefer an explicit URL. APP_URL is a plain runtime var (no build-time
  // inlining gotcha); NEXT_PUBLIC_APP_URL is supported for back-compat.
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // On Vercel this is always present at runtime (the project's production
  // domain), so email links work even without any custom env var.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

// Returns true if the email was sent (or skipped in dev), false on provider
// error. Never throws — callers (register, password reset) must not fail the
// user-facing operation just because the email provider hiccuped.
async function send(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. To: ${to} | ${subject}`
    );
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM || "Kubi <onboarding@resend.dev>";
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      // error.message often includes the real reason (e.g. test-mode recipient
      // restriction, unverified domain, bad key).
      console.error(`[email] Resend error sending "${subject}" to ${to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] Threw sending "${subject}" to ${to}:`, err);
    return false;
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<boolean> {
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] Verify link for ${to}: ${link}`);
  }
  return send(
    to,
    "Verify your Kubi email",
    `<p>Welcome to Kubi! Confirm your email to activate your account:</p>
     <p><a href="${link}">Verify my email</a></p>
     <p>This link expires in 24 hours.</p>`
  );
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<boolean> {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] Reset link for ${to}: ${link}`);
  }
  return send(
    to,
    "Reset your Kubi password",
    `<p>We received a request to reset your Kubi password.</p>
     <p><a href="${link}">Reset my password</a></p>
     <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`
  );
}
