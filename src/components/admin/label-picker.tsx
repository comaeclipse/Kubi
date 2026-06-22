"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { Label } from "@/lib/taxonomy";

interface LabelPickerProps {
  labels: Label[];
  assigned: Label[];
  onSave: (labelIds: number[]) => Promise<Label[]>;
  compact?: boolean;
}

export function LabelPicker({
  labels,
  assigned,
  onSave,
  compact = false,
}: LabelPickerProps) {
  const [selected, setSelected] = useState(() => new Set(assigned.map((l) => l.id)));
  const [saving, setSaving] = useState(false);

  async function toggle(labelId: number) {
    const next = new Set(selected);
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    setSelected(next);
    setSaving(true);
    try {
      const updated = await onSave([...next]);
      setSelected(new Set(updated.map((label) => label.id)));
    } catch {
      setSelected(new Set(assigned.map((label) => label.id)));
      toast.error("Failed to update labels");
    } finally {
      setSaving(false);
    }
  }

  const selectedLabels = labels.filter((label) => selected.has(label.id));

  return (
    <details className="relative">
      <summary
        className={`list-none cursor-pointer rounded-md border bg-background hover:bg-muted flex items-center gap-1.5 ${
          compact ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm"
        }`}
      >
        <Tags className="h-3.5 w-3.5" />
        {selectedLabels.length > 0
          ? selectedLabels.map((label) => label.name).join(", ")
          : "Labels"}
      </summary>
      <div className="absolute right-0 z-40 mt-1 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
        {labels.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            Create labels in Taxonomy first.
          </p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {labels.map((label) => (
              <label
                key={label.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selected.has(label.id)}
                  disabled={saving}
                  onChange={() => toggle(label.id)}
                />
                <span className="flex-1">{label.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {label.kind}
                </Badge>
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
