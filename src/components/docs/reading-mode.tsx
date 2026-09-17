"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { setDocPref } from "@/lib/actions/docs";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The words, and nothing beside them.
 *
 * Both rails go: the tree is for getting here and the cards are about the page
 * rather than in it, and neither is what somebody at two in the morning is
 * reading. Remembered per person because it is a way of reading rather than a
 * state of this page — somebody who wants the rails gone wants them gone on
 * the next runbook too.
 *
 * Saved rather than held in the browser, and the rails are then simply not
 * rendered: hiding a server-rendered rail from a client component means a
 * class on the body and a rule to match it, and one round trip is cheaper to
 * keep honest than that.
 */
export function ReadingModeButton({ reading }: { reading: boolean }) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * The tree belongs to the layout, which no page can reach into — and a
   * layout cannot tell a document from the shelf it is on, so it must not
   * decide this for itself: somebody who turned reading mode on to read one
   * runbook would find the shelf beside it had lost its tree too.
   *
   * So the page says so, for as long as it is the page.
   */
  useEffect(() => {
    if (!reading) return;
    document.documentElement.dataset.docReading = "1";
    return () => {
      delete document.documentElement.dataset.docReading;
    };
  }, [reading]);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={reading}
      onClick={() =>
        startTransition(async () => {
          await setDocPref({ reading: !reading });
          router.refresh();
        })
      }
      className={cn(
        "rounded-control flex h-8 items-center gap-1.5 border px-2.5 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50",
        reading
          ? "text-brand-deep border-transparent bg-[var(--brand-tint)]"
          : "bg-surface text-text-2 hover:text-text border-transparent shadow-[var(--highlight)]",
      )}
    >
      {reading ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      {reading ? t.docs.leaveReading : t.docs.readingMode}
    </button>
  );
}
