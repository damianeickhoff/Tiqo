"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  BookText,
  LayoutGrid,
  ListChecks,
  Mail,
  Palette,
  HardDrive,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import { can, type Actor, type Permission } from "@/lib/permissions";
import { useMessages } from "@/components/shell/instance-context";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One section per concern. Splitting them is the point: a settings page that
 * scrolls forever is one nobody reads to the bottom of, and these six have
 * nothing to say to each other.
 */
const SECTIONS: {
  href: string;
  label: (t: Messages) => string;
  icon: typeof Palette;
  permission: Permission;
}[] = [
  {
    href: "/settings/general",
    label: (t) => t.settings.sections.general,
    icon: Palette,
    permission: "settings.general",
  },
  {
    href: "/settings/tickets",
    label: (t) => t.settings.sections.tickets,
    icon: Ticket,
    permission: "settings.tickets",
  },
  {
    href: "/settings/portal",
    label: (t) => t.forms.title,
    icon: LayoutGrid,
    permission: "settings.tickets",
  },
  {
    href: "/settings/plans",
    label: (t) => t.plan.templatesTitle,
    icon: ListChecks,
    permission: "settings.tickets",
  },
  {
    href: "/settings/teams",
    label: (t) => t.settings.sections.teams,
    icon: Users,
    permission: "team.manage",
  },
  {
    href: "/settings/cmdb",
    label: (t) => t.cmdb.typesTitle,
    icon: HardDrive,
    permission: "ci.manage",
  },
  {
    href: "/settings/docs",
    label: (t) => t.docs.title,
    icon: BookText,
    permission: "doc.manage",
  },
  {
    href: "/settings/tags",
    label: (t) => t.settings.sections.tags,
    icon: Tag,
    permission: "settings.tags",
  },
  {
    href: "/settings/words",
    label: (t) => t.settings.sections.words,
    icon: Ban,
    permission: "settings.words",
  },
  {
    href: "/settings/mail",
    label: (t) => t.settings.sections.mail,
    icon: Mail,
    permission: "settings.mail",
  },
  {
    href: "/settings/accounts",
    label: (t) => t.settings.sections.roles,
    icon: ShieldCheck,
    permission: "settings.roles",
  },
];

export function SettingsNav({ user }: { user: Actor }) {
  const pathname = usePathname();
  const t = useMessages();
  // A section you cannot use is not shown; its page refuses you anyway.
  const sections = SECTIONS.filter((section) => can(user, section.permission));

  return (
    <nav className="mb-5 lg:mb-0">
      <ul className="flex gap-0.5 overflow-x-auto lg:sticky lg:top-5 lg:flex-col lg:overflow-visible">
        {sections.map(({ href, label: labelOf, icon: Icon }) => {
          const label = labelOf(t);
          // Its own page or anything under it: the portal section has tabs of
          // its own, and standing on one of those is still standing in Portal.
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control flex h-9 items-center gap-2.5 px-2.5 text-base whitespace-nowrap transition-colors duration-150",
                  active
                    ? "bg-surface-3 text-text font-semibold"
                    : "text-text-2 hover:bg-surface-2 hover:text-text font-medium",
                )}
              >
                <Icon size={15} className={active ? "text-text" : "text-text-3"} />
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
