"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/shell/logo";
import { EnvironmentSwitch } from "@/components/shell/environment-switch";
import { ThemePicker } from "@/components/shell/theme-picker";
import { PortalSearch } from "@/components/portal/portal-search";
import type { ThemeChoice } from "@/lib/ui-preferences";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The bar: on the ground, no line under it, the section you are in as a white
 * pill. Three or four places to be, a search, the way to the desk for the
 * people who have one, and everything about you behind your own face.
 *
 * A portal with a navigation bar as deep as the desk's would be the desk with
 * different paint.
 */
export function PortalHeader({
  title,
  user,
  canSeeDesk,
  theme,
  openRequests,
  approvals,
}: {
  title: string;
  user: { name: string; email: string; avatarVariant: number };
  /// Whether this account works the desk. A requester has nothing to switch to.
  canSeeDesk: boolean;
  theme: ThemeChoice;
  /// How many of this person's requests are still running. Shown beside the
  /// link so nobody has to open it to find out whether anything is waiting.
  openRequests: number;
  /// How many decisions are waiting on them, or null if nobody has ever asked
  /// them for one. Null hides the link entirely: a portal that grows a section
  /// most people will never have anything in is a portal with a dead end in it.
  approvals: number | null;
}) {
  // Derived here rather than handed down: the dictionary holds functions, and a
  // function cannot cross from a server component into a client one.
  const t = useMessages();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // The same shortcut as the desk's palette, for the same box.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((was) => !was);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = [
    { href: "/portal", label: t.portal.home, count: 0 },
    { href: "/portal/answers", label: t.portal.answers, count: 0 },
    { href: "/portal/requests", label: t.portal.myRequests, count: openRequests },
    ...(approvals === null
      ? []
      : [{ href: "/portal/approvals", label: t.portal.approvals, count: approvals }]),
  ];

  const round =
    "bg-surface text-text-2 hover:text-text flex h-9 items-center justify-center rounded-full shadow-[var(--highlight)] transition-colors";

  return (
    <header className="relative z-30">
      <div className="portal-wrap flex h-[68px] items-center gap-3 sm:gap-7">
        <Link href="/portal" className="flex shrink-0 items-center gap-2.5">
          <Logo size={26} wordmark={false} />
          <span className="hidden text-[15px] font-semibold tracking-[-0.01em] sm:block">
            {title}
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map(({ href, label, count }) => {
            const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-[7px] rounded-full px-3 text-base font-medium transition-colors sm:px-[13px]",
                  active
                    ? "bg-surface text-text shadow-[var(--highlight)]"
                    : "text-text-2 hover:bg-surface-2 hover:text-text",
                )}
              >
                {label}
                {count > 0 ? (
                  <span className="tnum bg-brand text-brand-ink inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-bold">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t.portal.searchButton}
            title={`${t.portal.searchButton} · ⌘K`}
            className={cn(round, "w-9")}
          >
            <Search size={17} />
          </button>

          {canSeeDesk ? (
            <>
              <span aria-hidden className="bg-line-strong mx-1 hidden h-[22px] w-px sm:block" />
              <EnvironmentSwitch here="portal" className="rounded-full px-3.5" />
            </>
          ) : null}

          <span aria-hidden className="bg-line-strong mx-1 hidden h-[22px] w-px sm:block" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((was) => !was)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={user.name}
              title={user.name}
              className="hover:ring-line-strong flex items-center rounded-full transition-shadow hover:ring-2"
            >
              <Avatar name={user.name} variant={user.avatarVariant} size={32} />
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="animate-rise bg-surface absolute right-0 z-50 mt-2 w-[270px] rounded-[18px] p-2 shadow-[var(--shadow-md)]"
                >
                  <div className="border-line mb-1.5 flex items-center gap-2.5 border-b px-3 pt-2.5 pb-3">
                    <Avatar name={user.name} variant={user.avatarVariant} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{user.name}</p>
                      <p className="text-text-3 truncate text-xs">{user.email}</p>
                    </div>
                  </div>

                  <p className="label px-3 pt-2 pb-1.5">{t.settings.themeLabel}</p>
                  <div className="px-3 pb-2">
                    <ThemePicker choice={theme} compact />
                  </div>

                  <form action={logout}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="hover:bg-surface-2 flex h-9 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-base font-medium transition-colors"
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
      </div>

      {/* The same combobox the hero holds, as a dialog: the header's search
          button is for the pages that have no hero. */}
      {searchOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.portal.searchButton}
          className="animate-fade fixed inset-0 z-50 flex items-start justify-center bg-[rgba(9,9,11,0.45)] px-4 pt-[12vh] backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="animate-rise w-full max-w-[620px]">
            <PortalSearch size="hero" autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
