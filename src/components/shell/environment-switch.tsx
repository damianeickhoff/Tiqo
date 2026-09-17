"use client";

import { useRef } from "react";
import { LayoutGrid, LifeBuoy } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * A window name per side, not one shared between them.
 *
 * With a single name, the tab opened by this button carries that name itself —
 * so pressing the button *in* that tab targeted the window it was already in
 * and navigated away instead of opening anything. Naming the destination rather
 * than "the other side" keeps each tab pointing at the other one.
 */
const TAB = { desk: "tiqo-desk", portal: "tiqo-portal" } as const;

/**
 * The way to the other side, in its own tab.
 *
 * A named window target is what keeps it to one tab: `window.open` with a name
 * that is already open reuses that window rather than making another, so six
 * presses over an afternoon leave six presses and one tab. The `focus()` is
 * what brings it forward — reusing a tab without raising it looks exactly like
 * a button that did nothing.
 */
export function EnvironmentSwitch({
  here,
  className,
}: {
  here: "desk" | "portal";
  /// The portal's bar draws its controls as pills; the desk's as its usual
  /// controls. The shape is the caller's, the behaviour is not.
  className?: string;
}) {
  const t = useMessages();
  const other = useRef<Window | null>(null);

  const to = here === "desk" ? "/portal" : "/";
  const target = here === "desk" ? TAB.portal : TAB.desk;
  const label = here === "desk" ? t.nav.portalSide : t.nav.deskSide;
  const Icon = here === "desk" ? LifeBuoy : LayoutGrid;

  function open() {
    // The handle from a previous press, if that tab is still alive. Closing a
    // tab leaves the window object behind, which is what `closed` is for.
    if (other.current && !other.current.closed) {
      other.current.focus();
      return;
    }
    other.current = window.open(to, target);
    other.current?.focus();
  }

  return (
    <button
      type="button"
      onClick={open}
      title={t.nav.openInTab(label)}
      className={cn(
        "bg-surface text-text-2 hover:text-text rounded-control text-md inline-flex h-9 shrink-0 items-center gap-1.5 border border-transparent px-2.5 font-medium shadow-[var(--shadow-sm)] transition-[background-color,color,border-color,box-shadow] duration-150 hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
