"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * A value you take rather than follow.
 *
 * An address or a number on a contact card is almost always wanted in the
 * clipboard — to paste into a chat, a form, a phone. Making it a mailto: link
 * answered the rarer question and hijacked the click for a mail app nobody
 * asked to open; the buttons at the foot of the card are there for that.
 */
export function CopyValue({ value, className }: { value: string; className?: string }) {
  const t = useMessages();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={t.common.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // A browser that refuses the clipboard is not an error worth a
          // dialog; the value is on screen and can still be selected.
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className={cn(
        "group/copy hover:text-text flex min-w-0 items-center gap-1.5 text-left transition-colors",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check size={11} className="text-positive shrink-0" />
      ) : (
        <Copy
          size={11}
          className="text-text-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100"
        />
      )}
    </button>
  );
}
