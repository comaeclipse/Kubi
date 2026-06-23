"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { PROFILE_COLORS } from "@/lib/profile-colors";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, History } from "lucide-react";

interface Profile {
  id: number;
  name: string;
  avatarColor: string;
}

interface ProfileManagerProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
}

export function ProfileManager({ profiles, onRefresh }: ProfileManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROFILE_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  // Profile whose watch history is pending a confirm-to-clear.
  const [clearingProfile, setClearingProfile] = useState<Profile | null>(null);
  const [clearing, setClearing] = useState(false);

  function openCreateDialog() {
    setEditingProfile(null);
    setName("");
    setSelectedColor(PROFILE_COLORS[0].value);
    setDialogOpen(true);
  }

  function openEditDialog(profile: Profile) {
    setEditingProfile(profile);
    setName(profile.name);
    setSelectedColor(profile.avatarColor);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingProfile) {
        const res = await fetch(`/api/profiles/${editingProfile.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), avatarColor: selectedColor }),
        });
        if (!res.ok) throw new Error("Failed to update profile");
        toast.success("Profile updated");
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), avatarColor: selectedColor }),
        });
        if (!res.ok) throw new Error("Failed to create profile");
        toast.success("Profile created");
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete profile");
      toast.success("Profile deleted");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleClearHistory() {
    if (!clearingProfile) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/profiles/${clearingProfile.id}/history`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear watch history");
      toast.success(`Cleared ${clearingProfile.name}'s watch history`);
      setClearingProfile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Profiles</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? "Edit Profile" : "Create Profile"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex justify-center">
                <ProfileAvatar
                  name={name || "?"}
                  avatarColor={selectedColor}
                  size="xl"
                />
              </div>
              <Input
                placeholder="Profile name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <div>
                <p className="text-sm font-medium mb-2">Pick a color</p>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`h-8 w-8 rounded-full transition-all ${
                        selectedColor === color.value
                          ? "ring-2 ring-offset-2 ring-foreground scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full"
              >
                {saving
                  ? "Saving..."
                  : editingProfile
                    ? "Save Changes"
                    : "Create Profile"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No profiles yet. Create one so kids can track their own watch progress.
        </p>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <ProfileAvatar
                name={profile.name}
                avatarColor={profile.avatarColor}
                size="md"
              />
              <span className="font-medium flex-1">{profile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setClearingProfile(profile)}
                title="Clear watch history"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(profile)}
                title="Edit profile"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(profile.id)}
                title="Delete profile"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={clearingProfile !== null}
        onOpenChange={(open) => {
          if (!open) setClearingProfile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear watch history</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Clear all watch history for{" "}
              <span className="font-medium text-foreground">
                {clearingProfile?.name}
              </span>
              ? This removes their resume progress and recently-watched list.
              This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setClearingProfile(null)}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearHistory}
                disabled={clearing}
              >
                {clearing ? "Clearing..." : "Clear history"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
