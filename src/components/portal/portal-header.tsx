"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/shell/logo";
import { EnvironmentSwitch } from "@/components/shell/environment-switch";
import { ThemePicker } from "@/components/shell/theme-picker";
import type { ThemeChoice } from "@/lib/ui-preferences";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** Three places to be, and the way out. A portal with a navigation bar as deep
 *  as the desk's would be the desk with different paint. */
export function PortalHeader({
  title,
  user,
  canSeeDesk,
  theme,
  openRequests,
  approvals,
}: {
  title: string;
  user: { name: string; avatarVariant: number };
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

  const links = [
    { href: "/portal", label: t.portal.home, count: 0 },
    { href: "/portal/answers", label: t.portal.answers, count: 0 },
    { href: "/portal/requests", label: t.portal.myRequests, count: openRequests },
    ...(approvals === null
      ? []
      : [{ href: "/portal/approvals", label: t.portal.approvals, count: approvals }]),
  ];

  return (
    <header className="border-line bg-bg/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="portal-width mx-auto flex h-14 w-full items-center gap-3 px-5 lg:px-6">
        <Link href="/portal" className="flex items-center gap-2.5">
          <Logo size={26} />
        </Link>

        <span className="text-text-3 border-line hidden border-l pl-3 text-base sm:block">
          {title}
        </span>

        <nav className="ml-auto flex items-center gap-1">
          {/* Words, not pictures. Three destinations do not need icons to be
              told apart, and the icons were saying the same thing twice. */}
          {links.map(({ href, label, count }) => {
            const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3 text-base font-medium transition-colors",
                  active
                    ? "bg-surface-3 text-text"
                    : "text-text-2 hover:bg-surface-2 hover:text-text",
                )}
              >
                {label}
                {count > 0 ? (
                  <span className="tnum bg-brand rounded-full px-1.5 font-mono text-xs font-semibold text-[var(--brand-ink)]">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {canSeeDesk ? (
            <>
              <span aria-hidden className="bg-line mx-1 h-5 w-px" />
              <EnvironmentSwitch here="portal" />
            </>
          ) : null}

          <span aria-hidden className="bg-line mx-1 h-5 w-px" />

          {/* Everything about you, behind your own face: the theme and the way
              out are both things you do to your session, not to the portal. */}
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
              <Avatar name={user.name} variant={user.avatarVariant} size={28} />
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
                  className="animate-rise border-line bg-surface rounded-card absolute right-0 z-50 mt-2 w-56 overflow-hidden border shadow-[var(--shadow-float)]"
                >
                  <div className="border-line flex items-center gap-2.5 border-b px-4 py-3">
                    <Avatar name={user.name} variant={user.avatarVariant} size={32} />
                    <p className="min-w-0 truncate text-base font-semibold">{user.name}</p>
                  </div>

                  <div className="border-line space-y-1.5 border-b px-4 py-3">
                    <p className="label">{t.settings.themeLabel}</p>
                    <ThemePicker choice={theme} compact />
                  </div>

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
        </nav>
      </div>
    </header>
  );
}
