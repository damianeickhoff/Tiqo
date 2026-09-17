"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff } from "lucide-react";
import { toggleDocStar } from "@/lib/actions/docs";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The handful of pages one person keeps coming back to.
 *
 * Personal and immediate: pinning is a list-level command, it says nothing
 * about the page, and asking somebody to save it would be asking them to
 * confirm a bookmark. Two shapes — a labelled chip in a page's toolbar, and a
 * bare mark in the corner of a card, where a word would crowd the title.
 */
export function PinButton({
  docId,
  pinned,
  variant = "chip",
}: {
  docId: string;
  pinned: boolean;
  variant?: "chip" | "mark";
}) {
  const t = useMessages();
  const [on, setOn] = useState(pinned);
  const [pending, startTransition] = useTransition();

  const label = on ? t.docs.unpin : t.docs.pin;

  function toggle() {
    startTransition(async () => {
      const result = await toggleDocStar(docId);
      if (result.ok) setOn(result.pinned);
    });
  }

  if (variant === "mark") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={label}
        aria-label={label}
        aria-pressed={on}
        className={cn(
          "shrink-0 transition-colors disabled:opacity-50",
          on ? "text-brand-deep" : "text-text-3 hover:text-text",
        )}
      >
        <Pin size={13} className={on ? "fill-current" : undefined} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "rounded-control flex h-8 items-center gap-1.5 border px-2.5 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50",
        on
          ? "text-brand-deep border-transparent bg-[var(--brand-tint)]"
          : "bg-surface text-text-2 hover:text-text border-transparent shadow-[var(--highlight)]",
      )}
    >
      {on ? <Pin size={13} className="fill-current" /> : <PinOff size={13} />}
      {label}
    </button>
  );
}
