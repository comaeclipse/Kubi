"use client";

import { useState } from "react";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface Invite {
  id: number;
  code: string;
  label: string | null;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
  registrations: number;
}

interface InviteManagerProps {
  invites: Invite[];
  onRefresh: () => Promise<void>;
}

export function InviteManager({ invites, onRefresh }: InviteManagerProps) {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (label.trim()) body.label = label.trim();
      if (maxUses && Number(maxUses) > 0) body.maxUses = Number(maxUses);
      if (expiresAt) body.expiresAt = expiresAt;

      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLabel("");
      setMaxUses("");
      setExpiresAt("");
      await onRefresh();
      toast.success("Invite created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Failed to copy link")
    );
  }

  async function deleteInvite(invite: Invite) {
    const label = invite.label ? `"${invite.label}"` : "this invite";
    if (!confirm(`Delete ${label}? Existing accounts won't be affected.`)) return;

    const response = await fetch(`/api/admin/invites/${invite.id}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      toast.error("Delete failed");
      return;
    }
    await onRefresh();
    toast.success("Invite deleted");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Link2 className="h-5 w-5" />
          Invite Links
        </h2>
        <p className="text-sm text-muted-foreground">
          Create reusable invite links. Anyone who registers via a link skips
          email verification.
        </p>
      </div>

      <form onSubmit={createInvite} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="sm:max-w-xs"
        />
        <Input
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Max uses (optional)"
          className="sm:w-36"
        />
        <Input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="sm:w-44"
          title="Expires at (optional)"
        />
        <Button type="submit" disabled={saving}>
          <Plus className="mr-1 h-4 w-4" />
          Create
        </Button>
      </form>

      <div className="grid gap-2 sm:grid-cols-2">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">
            No invite links yet.
          </p>
        )}
        {invites.map((invite) => (
          <Card key={invite.id}>
            <CardContent className="flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-medium text-sm">
                  {invite.label ?? <span className="text-muted-foreground italic">Unlabeled</span>}
                </p>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {invite.registrations} registered
                  </Badge>
                  {invite.maxUses !== null && (
                    <Badge variant="outline">
                      max {invite.maxUses}
                    </Badge>
                  )}
                  {invite.expiresAt && (
                    <Badge variant="outline">
                      expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => copyLink(invite.code)}
                aria-label="Copy invite link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteInvite(invite)}
                aria-label="Delete invite"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
