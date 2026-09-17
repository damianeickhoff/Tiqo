"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Ticket } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The one place new things start.
 *
 * Two shapes of the same menu: the rail's primary button and the top bar's
 * quiet one. Both open the same list, because "new" means the same thing in
 * both places and having them lead somewhere different is how people learn not
 * to trust either.
 *
 * Projects only appear for someone who can make one — a menu that offers an
 * action and then refuses it is worse than a menu with one item.
 */
export function NewMenu({
  variant,
  collapsed = false,
  canCreateProject,
}: {
  variant: "rail" | "bar";
  collapsed?: boolean;
  canCreateProject: boolean;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  const label = variant === "rail" ? t.nav.newThing : t.nav.new;

  return (
    <div className={cn("relative", variant === "rail" && !collapsed && "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
        className={
          variant === "rail"
            ? cn(
                "bg-brand hover:bg-brand-hover rounded-control flex items-center justify-center gap-1.5 font-semibold text-[var(--brand-ink)] transition-[background-color,box-shadow] duration-150 hover:shadow-[0_6px_18px_-6px_var(--brand-glow)]",
                collapsed ? "size-10" : "text-md h-10 w-full",
              )
            : "bg-brand hover:bg-brand-hover rounded-control hidden h-9 items-center gap-1.5 px-3 text-base font-semibold text-[var(--brand-ink)] shadow-[0_1px_2px_rgba(9,9,11,0.1)] transition-colors sm:inline-flex"
        }
      >
        <Plus size={variant === "rail" ? 16 : 15} strokeWidth={2.5} />
        {variant === "rail" && collapsed ? null : label}
      </button>

      {open ? (
        <>
          {/* Anywhere else closes it, including the button that opened it. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div
            role="menu"
            className={cn(
              "animate-rise bg-surface rounded-card absolute z-50 mt-1.5 min-w-[13rem] overflow-hidden p-1 shadow-[var(--shadow-float)]",
              variant === "rail" ? "top-full left-0" : "top-full right-0",
            )}
          >
            <Item
              href="/tickets/new"
              icon={<Ticket size={15} />}
              label={t.nav.newTicket}
              onGo={() => setOpen(false)}
            />
            {canCreateProject ? (
              <Item
                href="/projects?new=1"
                icon={<FolderKanban size={15} />}
                label={t.nav.newProject}
                onGo={() => setOpen(false)}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Item({
  href,
  icon,
  label,
  onGo,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onGo: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onGo}
      className="hover:bg-surface-2 rounded-control flex items-center gap-2.5 px-2.5 py-2 text-base font-medium transition-colors"
    >
      <span className="text-text-3 shrink-0">{icon}</span>
      {label}
    </Link>
  );
}
