"use client";

import { useProfile } from "@/context/profile-context";
import { ProfileAvatar } from "./profile-avatar";

export function ProfilePicker() {
  const { profiles, switchProfile } = useProfile();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8 px-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Who's watching?</h1>
          <p className="text-muted-foreground mt-2">
            Select your profile to continue
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 max-w-lg">
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
      </div>
    </div>
  );
}
