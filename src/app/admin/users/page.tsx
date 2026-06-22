"use client";

import { useCallback, useEffect, useState } from "react";

import { UserManager } from "@/components/admin/user-manager";
import { OperatorGuard } from "@/components/admin/operator-guard";

function Users() {
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/users").then((r) => r.json());
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after await, not synchronously
    loadUsers();
  }, [loadUsers]);

  return <UserManager users={users} onRefresh={loadUsers} />;
}

export default function AdminUsersPage() {
  return (
    <OperatorGuard>
      <Users />
    </OperatorGuard>
  );
}
