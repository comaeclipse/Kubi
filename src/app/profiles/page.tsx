"use client";

import { useState } from "react";
import { ProfileManager } from "@/components/admin/profile-manager";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function ProfilesPage() {
  const { profiles, refreshProfiles } = useProfile();
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      window.location.href = "/login";
    } catch {
      toast.error("Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Manage Profiles</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add or remove kids on your account. Tap a profile to set their time
          limit, block words, and choose which channels they can watch.
        </p>
      </div>

      <ProfileManager profiles={profiles} onRefresh={refreshProfiles} />

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        {user && (
          <p className="text-sm text-muted-foreground">{user.email}</p>
        )}
        {!user?.isDemo && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Account
          </Button>
        )}
      </div>

      {!user?.isDemo && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete account?</DialogTitle>
              <DialogDescription>
                This permanently deletes your account, all profiles, and watch
                history. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
