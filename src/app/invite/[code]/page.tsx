import { redirect } from "next/navigation";
import Link from "next/link";
import { findUsableInvite } from "@/lib/invites";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const invite = await findUsableInvite(code);

  if (invite) {
    redirect(`/register?invite=${code}`);
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invite not valid</CardTitle>
          <p className="text-sm text-muted-foreground">
            This invite link has expired, reached its usage limit, or doesn't
            exist. Ask the person who shared it to send you a new one.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Register without invite</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Already have an account? Log in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
