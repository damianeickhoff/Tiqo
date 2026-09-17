"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The four faces of mail settings, as peers.
 *
 * Routes rather than local state: a template opens on a page of its own, and
 * coming back from it has to land on the wording rather than on whichever tab
 * the screen happened to start on.
 */
export function MailTabs({ wording, log }: { wording: number; log: number }) {
  const t = useMessages();
  const pathname = usePathname();

  const tabs = [
    { href: "/settings/mail", label: t.mail.tabConnection, exact: true },
    { href: "/settings/mail/templates", label: t.mail.tabWording, count: wording },
    { href: "/settings/mail/signature", label: t.mail.tabSignature },
    { href: "/settings/mail/log", label: t.mail.tabLog, count: log },
  ];

  return (
    <nav className="flex gap-5 overflow-x-auto">
      {tabs.map(({ href, label, count, exact }) => {
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
