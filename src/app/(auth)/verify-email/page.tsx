"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    (async () => {
      if (!token) {
        setStatus("error");
        return;
      }
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        setStatus(res.ok ? "success" : "error");
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {status === "verifying" && "Verifying..."}
            {status === "success" && "Email verified"}
            {status === "error" && "Verification failed"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {status === "verifying" && "Confirming your email address."}
            {status === "success" && "Your account is active. You can log in now."}
            {status === "error" &&
              "This link is invalid or has expired. Try logging in to resend."}
          </p>
        </CardHeader>
        {status !== "verifying" && (
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
