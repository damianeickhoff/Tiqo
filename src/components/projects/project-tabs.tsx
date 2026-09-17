"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** One row of views over the same body of work, with how much is in each. */
export function ProjectTabs({
  projectKey,
  counts,
}: {
  projectKey: string;
  counts?: { work?: number; milestones?: number; people?: number };
}) {
  const t = useMessages();
  const pathname = usePathname();
  const base = `/projects/${projectKey}`;

  const tabs = [
    { href: base, label: t.projects.overview, exact: true },
    { href: `${base}/board`, label: t.projects.board },
    { href: `${base}/tickets`, label: t.projects.allWork, count: counts?.work },
    { href: `${base}/milestones`, label: t.projects.milestones, count: counts?.milestones },
    { href: `${base}/people`, label: t.projects.people, count: counts?.people },
  ];

  return (
    <nav className="-mb-px flex gap-5 overflow-x-auto">
      {tabs.map(({ href, label, exact, count }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-1.5 text-base font-medium whitespace-nowrap transition-colors",
              active
                ? "text-text after:bg-brand after:absolute after:inset-x-0 after:-bottom-px after:h-0.5"
                : "text-text-2 hover:text-text",
            )}
          >
            {label}
            {count !== undefined ? (
              <span className="text-text-3 font-mono text-xs">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
