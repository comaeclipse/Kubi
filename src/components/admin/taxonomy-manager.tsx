"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Label, LabelKind } from "@/lib/taxonomy";

interface TaxonomyManagerProps {
  labels: Label[];
  onRefresh: () => Promise<void>;
}

export function TaxonomyManager({
  labels,
  onRefresh,
}: TaxonomyManagerProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LabelKind>("tag");
  const [saving, setSaving] = useState(false);

  async function createLabel(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setName("");
      await onRefresh();
      toast.success("Label created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function editLabel(label: Label) {
    const nextName = prompt("Label name", label.name)?.trim();
    if (!nextName || nextName === label.name) return;
    const response = await fetch(`/api/labels/${label.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName, slug: nextName }),
    });
    if (!response.ok) {
      toast.error((await response.json()).error ?? "Update failed");
      return;
    }
    await onRefresh();
    toast.success("Label updated");
  }

  async function deleteLabel(label: Label) {
    if (!confirm(`Delete "${label.name}" and remove it from all content?`)) {
      return;
    }
    const response = await fetch(`/api/labels/${label.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Delete failed");
      return;
    }
    await onRefresh();
    toast.success("Label deleted");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Tags className="h-5 w-5" />
          Taxonomy
        </h2>
        <p className="text-sm text-muted-foreground">
          Categories drive modes such as Music. Tags describe qualities such as
          calm, cute, or learning.
        </p>
      </div>

      <form onSubmit={createLabel} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New label"
          className="sm:max-w-xs"
        />
        <Select
          value={kind}
          onValueChange={(value) => setKind(value as LabelKind)}
        >
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="tag">Tag</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={saving || !name.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </form>

      <div className="grid gap-2 sm:grid-cols-2">
        {labels.map((label) => (
          <Card key={label.id}>
            <CardContent className="flex items-center gap-2 p-3">
              <span className="min-w-0 flex-1 truncate font-medium">
                {label.name}
              </span>
              <Badge variant="secondary">{label.kind}</Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editLabel(label)}
                aria-label={`Edit ${label.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteLabel(label)}
                aria-label={`Delete ${label.name}`}
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
