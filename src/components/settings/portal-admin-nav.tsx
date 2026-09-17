"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutTemplate,
  Megaphone,
  PanelsTopLeft,
  Settings2,
  SquareStack,
} from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** One row of tabs. The portal's parts are peers, not a hierarchy. */
export function PortalAdminNav() {
  const t = useMessages();
  const pathname = usePathname();

  const tabs = [
    { href: "/settings/portal", label: t.forms.tabGeneral, icon: Settings2, exact: true },
    { href: "/settings/portal/home", label: t.forms.tabHome, icon: LayoutTemplate },
    { href: "/settings/portal/catalogue", label: t.forms.tabCatalogue, icon: SquareStack },
    { href: "/settings/portal/forms", label: t.forms.tabForms, icon: PanelsTopLeft },
    { href: "/settings/portal/knowledge", label: t.forms.tabKnowledge, icon: BookOpen },
    { href: "/settings/portal/notices", label: t.forms.tabNotices, icon: Megaphone },
  ];

  return (
    <nav className="flex gap-5 overflow-x-auto">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
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
            <Icon size={14} className={active ? undefined : "text-text-3"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
