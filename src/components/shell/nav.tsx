"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookText,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import { can, canOpenSettings, type Actor, type Permission } from "@/lib/permissions";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Group = "work" | "organisation" | "foot";

/**
 * `permission` is what gates the entry; the two without one are what an
 * account is for. Settings is its own question — any one of several
 * permissions opens it — so it carries a predicate instead.
 *
 * The group is where the entry sits on the rail: the work itself, the
 * organisation around it, and Settings at the foot beside the account.
 */
const ITEMS: {
  href: string;
  label: (t: Messages) => string;
  icon: typeof LayoutDashboard;
  group: Group;
  permission?: Permission;
  visible?: (user: Actor) => boolean;
}[] = [
  { href: "/", label: (t) => t.nav.dashboard, icon: LayoutDashboard, group: "work" },
  { href: "/tickets", label: (t) => t.nav.tickets, icon: Ticket, group: "work" },
  {
    href: "/projects",
    label: (t) => t.nav.projects,
    icon: FolderKanban,
    group: "work",
    permission: "ticket.view.all",
  },
  {
    href: "/cmdb",
    label: (t) => t.cmdb.title,
    icon: HardDrive,
    group: "work",
    permission: "ci.view",
  },
  {
    href: "/docs",
    label: (t) => t.docs.title,
    icon: BookText,
    group: "work",
    permission: "doc.view",
  },
  {
    href: "/people",
    label: (t) => t.nav.people,
    icon: Users,
    group: "organisation",
    permission: "people.view",
  },
  {
    href: "/settings",
    label: (t) => t.nav.settings,
    icon: Settings,
    group: "foot",
    visible: canOpenSettings,
  },
];

const GROUP_LABEL: Record<Group, ((t: Messages) => string) | null> = {
  work: (t) => t.nav.groupWork,
  organisation: (t) => t.nav.groupOrganisation,
  foot: null,
};

function visibleTo(user: Actor) {
  return ITEMS.filter((item) => {
    if (item.visible) return item.visible(user);
    return item.permission ? can(user, item.permission) : true;
  });
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

export function SideNav({
  user,
  collapsed = false,
  t,
  groups,
}: {
  user: Actor;
  collapsed?: boolean;
  t: Messages;
  /// Which groups to draw, in order. The rail calls this twice so Settings
  /// can sit at the foot without a second component knowing the list.
  groups: Group[];
}) {
  const isActive = useIsActive();
  const items = visibleTo(user);

  return (
    <nav className={cn("flex flex-col gap-0.5", collapsed && "w-full items-center")}>
      {groups.map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        const heading = GROUP_LABEL[group];
        return (
          <div key={group} className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
            {heading && !collapsed ? (
              <p className="label px-2.5 pt-3 pb-1.5">{heading(t)}</p>
            ) : heading && collapsed ? (
              <span aria-hidden className="bg-line my-2 h-px w-6" />
            ) : null}
            {rows.map(({ href, label: labelOf, icon: Icon }) => {
              const label = labelOf(t);
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  // Collapsed, the icon is the only label there is, so the
                  // accessible name has to come from the attributes instead.
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={cn(
                    "group rounded-control text-md relative flex h-10 items-center transition-[background-color,color] duration-150",
                    collapsed ? "w-9 justify-center" : "gap-3 px-2.5",
                    active
                      ? "bg-surface-2 text-text font-semibold"
                      : "text-text-2 hover:bg-surface-2 hover:text-text font-medium",
                  )}
                >
                  {/* The active marker is the brand's job — it is the one thing
                      on the rail that should catch the eye. It sits on the
                      rail's outer edge, outside the row's own box. */}
                  <span
                    aria-hidden
                    className={cn(
                      "bg-brand absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full transition-transform duration-200",
                      collapsed ? "-left-2" : "-left-3",
                      active ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.1 : 1.8}
                    className={active ? "text-text" : "text-text-3 group-hover:text-text-2"}
                  />
                  {collapsed ? null : label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function MobileNav({ user, t }: { user: Actor; t: Messages }) {
  const isActive = useIsActive();
  const items = visibleTo(user);

  return (
    <nav className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {items.map(({ href, label: labelOf, icon: Icon }) => {
        const label = labelOf(t);
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs"
          >
            <span
              aria-hidden
              className={cn(
                "bg-brand absolute top-0 h-[2.5px] w-8 rounded-b-full transition-transform duration-200",
                active ? "scale-x-100" : "scale-x-0",
              )}
            />
            <Icon
              size={19}
              strokeWidth={active ? 2.2 : 1.8}
              className={active ? "text-brand-deep" : "text-text-3"}
            />
            <span className={active ? "text-text font-semibold" : "text-text-3"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
