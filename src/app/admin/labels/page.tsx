"use client";

import { useCallback, useEffect, useState } from "react";

import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { OperatorGuard } from "@/components/admin/operator-guard";
import type { Label } from "@/lib/taxonomy";

function Labels() {
  const [labels, setLabels] = useState<Label[]>([]);

  const loadLabels = useCallback(async () => {
    try {
      const data = await fetch("/api/labels").then((response) =>
        response.json()
      );
      setLabels(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after await, not synchronously
    loadLabels();
  }, [loadLabels]);

  return <TaxonomyManager labels={labels} onRefresh={loadLabels} />;
}

export default function AdminLabelsPage() {
  return (
    <OperatorGuard>
      <Labels />
    </OperatorGuard>
  );
}
