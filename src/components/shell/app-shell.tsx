"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { MobileNav, SideNav } from "@/components/shell/nav";
import { Logo } from "@/components/shell/logo";
import { Avatar, type AvatarFallback } from "@/components/avatar";
import { AvatarPicker } from "@/components/shell/avatar-picker";
import { ScrollWatcher } from "@/components/shell/scroll-watcher";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationBell } from "@/components/shell/notification-bell";
import { EnvironmentSwitch } from "@/components/shell/environment-switch";
import { ThemePicker } from "@/components/shell/theme-picker";
import type { ThemeChoice } from "@/lib/ui-preferences";
import type { Notice } from "@/lib/notifications";
import { InstanceProvider } from "@/components/shell/instance-context";
import type { Clock } from "@/lib/tickets";
import { messagesFor, type Messages } from "@/lib/i18n";
import { NewMenu } from "@/components/shell/new-menu";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "@/lib/ui-preferences";
import { getCrumb, getServerCrumb, subscribeCrumb } from "@/lib/topbar-crumb";
import { BackControl, VisitRecorder } from "@/components/shell/nav-history";

type ShellUser = {
  id: string;
  name: string;
  email: string;
  avatarVariant: number;
  avatarImage: string | null;
  roleName: string;
  isMaster: boolean;
  permissions: string[];
};

function canCreateProject(user: ShellUser) {
  return user.isMaster || user.permissions.includes("project.manage");
}

export function AppShell({
  user,
  defaultCollapsed,
  clock,
  locale,
  dateLocale,
  notices,
  unread,
  portalOpen,
  theme,
  avatarFallback,
  children,
}: {
  user: ShellUser;
  defaultCollapsed: boolean;
  clock: Clock;
  locale: string;
  dateLocale: string;
  notices: Notice[];
  unread: number;
  /// Whether the portal is open at all. With it closed there is nowhere to
  /// switch to, so the control is not offered.
  portalOpen: boolean;
  /// Read from the cookie by the layout, so the first client render agrees
  /// with the HTML the server sent.
  theme: ThemeChoice;
  /// What people without a picture look like, instance-wide.
  avatarFallback: AvatarFallback;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // The bar and the rail are handed the dictionary rather than reaching for it:
  // they render on every page, and one lookup here beats a dozen below.
  const t = messagesFor(locale);

  // The preference lives in a cookie rather than localStorage so the server
  // already knows it and renders the right width on the first paint — reading
  // it in an effect would flash the wrong sidebar on every navigation.
  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  return (
    // One L-shaped frame. The rail runs the full height on the left and the bar
    // sits over the content only; both are --chrome with no line between them
    // or against the work area, so they read as one piece, and the work area is
    // the ground inset into them. --rail is the single source of the rail's
    // width: the grid column and everything that lines up with it read the same
    // value.
    <InstanceProvider clock={clock} locale={locale} dateLocale={dateLocale}>
      <div
        className="bg-chrome flex min-h-dvh flex-col lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[var(--rail)_minmax(0,1fr)] lg:grid-rows-[var(--bar)_minmax(0,1fr)] lg:overflow-hidden"
        style={{
          ["--rail" as string]: collapsed ? "var(--rail-collapsed)" : "var(--rail-expanded)",
        }}
      >
        <ScrollWatcher />
        <VisitRecorder t={t} />

        <aside
          className={cn(
            "bg-chrome hidden min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain py-3 lg:row-span-2 lg:flex",
            collapsed ? "items-center px-2" : "px-3",
          )}
        >
          {/* The mark, in the corner it belongs in. Collapsed, the wordmark
              goes and the tile stays: a rail 56px wide has room for a mark and
              nothing else, and the mark alone still reads as the way home. */}
          <div
            className={cn("mb-3 flex h-9 items-center", collapsed ? "justify-center" : "pl-1.5")}
          >
            <Link href="/" aria-label={t.nav.home} className="flex items-center">
              <Logo size={24} wordmark={!collapsed} />
            </Link>
          </div>

          <SideNav user={user} collapsed={collapsed} t={t} groups={["work", "organisation"]} />

          {/* Widening the rail is a thing you do to the rail, so the control
              lives at the bottom of it with the other thing that is always
              there — not up in the corner competing with the mark. */}
          <div className={cn("mt-auto", collapsed && "w-full")}>
            <div className={cn("flex", collapsed ? "justify-center" : "px-0.5")}>
              <button
                type="button"
                onClick={toggle}
                aria-label={collapsed ? t.nav.expand : t.nav.collapse}
                title={collapsed ? t.nav.expand : t.nav.collapse}
                className={cn(
                  "text-text-3 hover:bg-surface-2 hover:text-text rounded-control text-md flex h-10 items-center font-medium transition-colors",
                  collapsed ? "w-9 justify-center" : "w-full gap-3 px-2",
                )}
              >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                {collapsed ? null : t.nav.collapse}
              </button>
            </div>
            <SideNav user={user} collapsed={collapsed} t={t} groups={["foot"]} />
          </div>
        </aside>

        <TopBar
          user={user}
          t={t}
          notices={notices}
          unread={unread}
          portalOpen={portalOpen}
          theme={theme}
          avatarFallback={avatarFallback}
        />

        {/* From lg up this box is the scrollport: sticky descendants sit at its
            own edge (`lg:top-0`). Below lg the window scrolls and they clear the
            bar with `top-[var(--bar)]`. It is also the work area: the ground,
            inset into the white chrome with a margin to the window's right and
            bottom edges. What sits on it is the page's business — one sheet, or
            cards. */}
        <div className="bg-bg flex min-h-[calc(100dvh-var(--bar))] flex-col lg:mr-3 lg:mb-3 lg:min-h-0 lg:overflow-y-auto lg:rounded-[var(--radius-panel)]">
          <main className="flex-1 pb-24 lg:pb-0">{children}</main>
        </div>

        <MobileNav user={user} t={t} />
      </div>
    </InstanceProvider>
  );
}

/* ---------------------------------------------------------------- top bar -- */

/** The bar's height is `--bar` on purpose: the ticket toolbar and the content
 *  box both offset by that exact value, so it must not drift with content. */
function TopBar({
  user,
  t,
  notices,
  unread,
  portalOpen,
  theme,
  avatarFallback,
}: {
  user: ShellUser;
  t: Messages;
  notices: Notice[];
  unread: number;
  portalOpen: boolean;
  theme: ThemeChoice;
  avatarFallback: AvatarFallback;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const crumb = useSyncExternalStore(subscribeCrumb, getCrumb, getServerCrumb);

  // The back link belongs to the bar, not the page, so it is derived from the
  // route rather than injected upward from the ticket view.
  const onTicket = /^\/tickets\/[^/]+$/.test(pathname) && pathname !== "/tickets/new";

  return (
    <header className="bg-chrome sticky top-0 z-40 flex h-[var(--bar)] shrink-0 items-center gap-2 px-4 lg:static">
      {/* Below lg there is no rail, so the mark lives here. */}
      <Link href="/" aria-label={t.nav.home} className="mr-1 flex shrink-0 items-center lg:hidden">
        <Logo size={28} />
      </Link>

      {/* Where you came from, named — the route the rail cannot offer. */}
      <BackControl t={t} />

      {/* On a ticket, the way back to the queue is the first thing on the bar. */}
      {onTicket ? (
        <Link
          href="/tickets"
          className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control text-md inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 font-medium transition-colors"
        >
          <ArrowLeft size={15} />
          <span className="hidden sm:inline">{t.nav.allTickets}</span>
        </Link>
      ) : null}

      {/* Which ticket you are on, so a scrolled thread never loses its label.
          Written by the ticket page — the bar lives in the layout, above the
          page, so the value cannot come down as a prop. */}
      {onTicket && crumb ? (
        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          <span className="bg-surface-3 text-text-2 rounded-chip inline-flex h-5 shrink-0 items-center px-1.5 font-mono text-xs leading-none font-medium">
            {crumb.reference}
          </span>
          <span className="text-text-2 text-md truncate leading-none font-medium">
            {crumb.title}
          </span>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {/* On white chrome a white button with a shadow has nothing to sit on,
            so the bar's controls are wells like the search box. */}
        {portalOpen ? (
          <EnvironmentSwitch here="desk" className="bg-surface-2 shadow-none hover:shadow-none" />
        ) : null}

        <GlobalSearch />

        <NewMenu variant="bar" canCreateProject={canCreateProject(user)} />

        <span aria-hidden className="bg-line mx-0.5 hidden h-5 w-px sm:block" />

        <NotificationBell initialNotices={notices} initialUnread={unread} />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="hover:bg-surface-3 flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-0.5 transition-colors"
          >
            <Avatar
              name={user.name}
              variant={user.avatarVariant}
              image={user.avatarImage}
              fallback={avatarFallback}
              size={30}
            />
            <ChevronDown
              size={13}
              className={cn(
                "text-text-3 transition-transform duration-200",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {menuOpen ? (
            <>
              {/* A backdrop closes the menu on any outside click without a
                  document-level listener to install and tear down. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="animate-rise bg-surface rounded-card absolute right-0 z-50 mt-2 w-60 overflow-hidden shadow-[var(--shadow-lg)]"
              >
                <div className="border-line flex items-center gap-2.5 border-b px-4 py-3">
                  <Avatar
                    name={user.name}
                    variant={user.avatarVariant}
                    image={user.avatarImage}
                    fallback={avatarFallback}
                    size={32}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{user.name}</p>
                    <p className="text-text-3 truncate font-mono text-xs">{user.email}</p>
                  </div>
                </div>

                <AvatarPicker
                  name={user.name}
                  variant={user.avatarVariant}
                  image={user.avatarImage}
                  fallback={avatarFallback}
                />

                <div className="border-line border-b px-4 py-2.5">
                  <span className="text-brand-deep rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
                    {user.roleName}
                  </span>
                </div>

                <div className="border-line space-y-1.5 border-b px-4 py-3">
                  <p className="label">{t.settings.themeLabel}</p>
                  <ThemePicker choice={theme} />
                </div>

                <Link
                  href={`/people/${user.id}`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="border-line hover:bg-surface-2 flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-base font-medium transition-colors"
                >
                  <UserRound size={15} className="text-text-3" />
                  {t.nav.yourProfile}
                </Link>

                <form action={logout}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="hover:bg-surface-2 flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-base font-medium transition-colors"
                  >
                    <LogOut size={15} className="text-text-3" />
                    {t.nav.signOut}
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
