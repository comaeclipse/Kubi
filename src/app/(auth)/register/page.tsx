"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [wasInvited, setWasInvited] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(inviteCode ? { invite: inviteCode } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign up failed");
      setWasInvited(Boolean(data.invited));
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        {inviteCode && !done && (
          <Badge variant="secondary" className="mx-auto mb-2">
            You&apos;ve been invited
          </Badge>
        )}
        <CardTitle className="text-2xl">
          {done
            ? wasInvited
              ? "Account created"
              : "Check your email"
            : "Create your account"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {done
            ? wasInvited
              ? "Your account is ready — you can log in now."
              : "We sent a verification link. Click it to activate your account, then log in."
            : "Sign up to curate videos for your kids"}
        </p>
      </CardHeader>
      <CardContent>
        {done ? (
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password (min 8 characters)"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Sign up"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
