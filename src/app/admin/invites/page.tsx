"use client";

import { useCallback, useEffect, useState } from "react";

import { InviteManager, type Invite } from "@/components/admin/invite-manager";
import { OperatorGuard } from "@/components/admin/operator-guard";

function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);

  const loadInvites = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/invites").then((r) => r.json());
      setInvites(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after await, not synchronously
    loadInvites();
  }, [loadInvites]);

  return <InviteManager invites={invites} onRefresh={loadInvites} />;
}

export default function AdminInvitesPage() {
  return (
    <OperatorGuard>
      <Invites />
    </OperatorGuard>
  );
}
