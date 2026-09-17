"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns2, Rows3 } from "lucide-react";
import { CI_MODE_COOKIE, type CiMode } from "@/lib/ci-mode";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * List or Split, and it stays chosen.
 *
 * A cookie rather than a column on the account, like the collapsed sidebar and
 * the theme: it is a preference about the shape of a screen rather than about
 * the desk's work, and it has to be known before the page renders — which is
 * the one thing a cookie does that a query cannot.
 */
export function CiViewMode({ mode }: { mode: CiMode }) {
  const t = useMessages();
  const router = useRouter();
  const [chosen, setChosen] = useState(mode);

  // Written after the press rather than during it: the cookie is what the
  // server reads on the next render, so the press picks and the effect tells.
  useEffect(() => {
    if (chosen === mode) return;
    document.cookie = `${CI_MODE_COOKIE}=${chosen}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [chosen, mode, router]);

  return (
    <div className="bg-surface-2 flex shrink-0 gap-0.5 rounded-full p-0.5">
      {(["list", "split"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setChosen(option)}
          aria-pressed={chosen === option}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors",
            chosen === option
              ? "bg-surface text-text shadow-[var(--highlight)]"
              : "text-text-2 hover:text-text",
          )}
        >
          {option === "list" ? <Rows3 size={12} /> : <Columns2 size={12} />}
          {option === "list" ? t.cmdb.modeList : t.cmdb.modeSplit}
        </button>
      ))}
    </div>
  );
}

/**
 * Up and down move the selection in the pane.
 *
 * The rows are links, so the keyboard already reaches them one tab at a time;
 * this is the other way people read a list of forty — hands still, eyes on the
 * pane. Ignored while something is being typed into, because a search box is
 * also a place where the down arrow means something.
 */
export function CiPeekKeys({ ids, current }: { ids: string[]; current: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  /// What the pane is showing, which is not always what the URL says: with
  /// nothing picked the register opens on the first row, and the first press of
  /// the down arrow has to move off it rather than onto it.
  const peek = params.get("peek") ?? current;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (ids.length === 0) return;

      const at = peek ? ids.indexOf(peek) : -1;
      const next =
        at < 0
          ? ids[0]!
          : ids[Math.min(ids.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))]!;
      if (next === peek) return;

      event.preventDefault();
      const query = new URLSearchParams(params.toString());
      query.set("peek", next);
      router.replace(`/cmdb?${query.toString()}`, { scroll: false });
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, peek, params, router]);

  return null;
}
