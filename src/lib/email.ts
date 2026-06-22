import { Resend } from "resend";

// Sends verification + password-reset emails via Resend.
//
// Requires RESEND_API_KEY + EMAIL_FROM. If RESEND_API_KEY is unset (e.g. local
// dev), we skip the network call and log the link to the server console so the
// flow is still testable end-to-end without a provider.

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. To: ${to} | ${subject}`
    );
    return;
  }
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "Kubi <onboarding@resend.dev>";
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] Verify link for ${to}: ${link}`);
  }
  await send(
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
): Promise<void> {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] Reset link for ${to}: ${link}`);
  }
  await send(
    to,
    "Reset your Kubi password",
    `<p>We received a request to reset your Kubi password.</p>
     <p><a href="${link}">Reset my password</a></p>
     <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`
  );
}
