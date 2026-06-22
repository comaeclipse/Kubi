import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/auth/login", method: "POST" },
    { path: "/api/auth/register", method: "POST" },
    { path: "/api/auth/forgot-password", method: "POST" },
    { path: "/api/auth/reset-password", method: "POST" },
    { path: "/api/auth/verify-email", method: "POST" },
    { path: "/api/auth/resend-verification", method: "POST" },
    { path: "/api/stripe/checkout", method: "POST" },
    { path: "/api/stripe/portal", method: "POST" },
    { path: "/api/onboarding/complete", method: "POST" },
  ],
});
