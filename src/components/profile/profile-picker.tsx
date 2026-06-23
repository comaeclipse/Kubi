"use client";

import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/context/auth-context";
import { ProfileAvatar } from "./profile-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ProfilePicker() {
  const { profiles, activeProfile, loading, switchProfile } = useProfile();
  const { user } = useAuth();

  // Hold the picker back until onboarding is finished — the onboarding wizard
  // owns the screen (and creates the first profile) until then.
  const open =
    !loading &&
    Boolean(user?.onboarded) &&
    !activeProfile &&
    profiles.length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold">Who's watching?</DialogTitle>
          <DialogDescription>Select your profile to continue</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-6 py-4">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => switchProfile(profile.id)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-muted"
            >
              <div className="transition-transform group-hover:scale-110">
                <ProfileAvatar
                  name={profile.name}
                  avatarColor={profile.avatarColor}
                  size="xl"
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
