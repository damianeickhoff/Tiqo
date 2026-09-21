"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Actor, type Permission } from "@/lib/permissions";
import { useMessages } from "@/components/shell/instance-context";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One entry per concern, under four headings. Splitting them is the point: a
 * settings page that scrolls forever is one nobody reads to the bottom of, and
 * these have nothing to say to each other. The headings are what makes eleven
 * of them readable as a list rather than as a wall.
 */
type Entry = { href: string; label: (t: Messages) => string; permission: Permission };

const GROUPS: { label: (t: Messages) => string; entries: Entry[] }[] = [
  {
    label: (t) => t.settings.groups.desk,
    entries: [
      {
        href: "/settings/general",
        label: (t) => t.settings.sections.general,
        permission: "settings.general",
      },
      {
        href: "/settings/teams",
        label: (t) => t.settings.sections.teams,
        permission: "team.manage",
      },
      {
        href: "/settings/accounts",
        label: (t) => t.settings.sections.roles,
        permission: "settings.roles",
      },
    ],
  },
  {
    label: (t) => t.settings.groups.tickets,
    entries: [
      {
        href: "/settings/tickets",
        label: (t) => t.settings.sections.tickets,
        permission: "settings.tickets",
      },
      {
        href: "/settings/plans",
        label: (t) => t.plan.templatesTitle,
        permission: "settings.tickets",
      },
      {
        href: "/settings/tags",
        label: (t) => t.settings.sections.tags,
        permission: "settings.tags",
      },
      {
        href: "/settings/words",
        label: (t) => t.settings.sections.words,
        permission: "settings.words",
      },
    ],
  },
  {
    label: (t) => t.settings.groups.portal,
    entries: [
      { href: "/settings/portal", label: (t) => t.forms.title, permission: "settings.tickets" },
    ],
  },
  {
    label: (t) => t.settings.groups.system,
    entries: [
      {
        href: "/settings/mail",
        label: (t) => t.settings.sections.mail,
        permission: "settings.mail",
      },
      { href: "/settings/cmdb", label: (t) => t.cmdb.typesTitle, permission: "ci.manage" },
      { href: "/settings/docs", label: (t) => t.docs.title, permission: "doc.manage" },
    ],
  },
];

/**
 * The navigation sits on the ground: no card, no border, plain text, and the
 * entry you are standing on as a white pill — the one thing on this side of
 * the page that is a surface.
 */
export function SettingsNav({ user }: { user: Actor }) {
  const pathname = usePathname();
  const t = useMessages();
  // A section you cannot use is not shown; its page refuses you anyway. A
  // heading with nothing left under it goes with them.
  const groups = GROUPS.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => can(user, entry.permission)),
  })).filter((group) => group.entries.length > 0);

  return (
    <nav className="mb-5 lg:mb-0">
      <div className="flex gap-0.5 overflow-x-auto lg:sticky lg:top-5 lg:block lg:overflow-visible">
        {groups.map((group, index) => (
          <div key={group.label(t)} className={cn("shrink-0", index > 0 && "lg:mt-4")}>
            <p className={cn("label hidden px-2.5 pb-1.5 lg:block", index > 0 && "pt-1")}>
              {group.label(t)}
            </p>
            <ul className="flex gap-0.5 lg:flex-col">
              {group.entries.map(({ href, label: labelOf }) => {
                const label = labelOf(t);
                // Its own page or anything under it: the portal section has
                // tabs of its own, and standing on one of those is still
                // standing in Portal.
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href} className="shrink-0 lg:shrink">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-control flex h-9 items-center px-2.5 text-base whitespace-nowrap transition-colors duration-150",
                        active
                          ? "bg-surface text-text font-semibold shadow-[var(--highlight)]"
                          : "text-text-2 hover:text-text font-medium",
                      )}
                    >
                      <span className="min-w-0 truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
