"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "My Family", operatorOnly: false },
  { href: "/admin/library", label: "Master Library", operatorOnly: true },
  { href: "/admin/labels", label: "Labels", operatorOnly: true },
  { href: "/admin/invites", label: "Invites", operatorOnly: true },
];

export function AdminNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOperator = Boolean(user?.isOperator);

  const tabs = TABS.filter((tab) => !tab.operatorOnly || isOperator);

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
