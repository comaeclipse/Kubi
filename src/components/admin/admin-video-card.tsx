"use client";


import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/youtube";
import { LabelPicker } from "@/components/admin/label-picker";
import type { Label } from "@/lib/taxonomy";

interface AdminVideoCardProps {
  id: number;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  hidden: boolean;
  onToggleHidden: (id: number, hidden: boolean) => void;
  labels: Label[];
  assignedLabels?: Label[];
  onLabelsChanged: () => void;
}

export function AdminVideoCard({
  id,
  title,
  thumbnailUrl,
  duration,
  hidden,
  onToggleHidden,
  labels,
  assignedLabels = [],
  onLabelsChanged,
}: AdminVideoCardProps) {
  const formattedDuration = formatDuration(duration);

  return (
    <Card className={hidden ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="relative h-16 w-28 rounded overflow-hidden bg-muted shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {formattedDuration && (
            <Badge
              variant="secondary"
              className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 py-0"
            >
              {formattedDuration}
            </Badge>
          )}
        </div>
        <span className="flex-1 text-sm font-medium line-clamp-2">
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <LabelPicker
            labels={labels}
            assigned={assignedLabels}
            compact
            onSave={async (labelIds) => {
              const response = await fetch(`/api/videos/${id}/labels`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelIds }),
              });
              if (!response.ok) throw new Error();
              const updated = await response.json();
              onLabelsChanged();
              return updated;
            }}
          />
          <span className="text-xs text-muted-foreground">
            {hidden ? "Hidden" : "Visible"}
          </span>
          <Switch
            checked={!hidden}
            onCheckedChange={(checked) => onToggleHidden(id, !checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
