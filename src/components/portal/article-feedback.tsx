"use client";

import { useState, useTransition } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { voteOnArticle } from "@/lib/actions/portal";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Did this answer solve it.
 *
 * Asked at the end of the article rather than in a banner at the top, because
 * the only person who can answer it is the one who has finished reading. The
 * tally beside it is the month's, which is the window in which "people still
 * find this useful" is a claim worth making.
 */
export function ArticleFeedback({
  articleId,
  helpedThisMonth,
  mine,
}: {
  articleId: string;
  helpedThisMonth: number;
  /// What this person said last time, so the page does not ask twice.
  mine: boolean | null;
}) {
  const t = useMessages();
  const [choice, setChoice] = useState<boolean | null>(mine);
  const [pending, startTransition] = useTransition();

  function vote(helpful: boolean) {
    const was = choice;
    setChoice(helpful);
    startTransition(async () => {
      const result = await voteOnArticle(articleId, helpful);
      if (!result.ok) setChoice(was);
    });
  }

  // Counted optimistically: the vote just cast is in the number the reader is
  // looking at, without waiting for the page to come back.
  const helped = helpedThisMonth + (choice === true && mine !== true ? 1 : 0);

  return (
    <div className="border-line flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-6 py-4 sm:px-7">
      <p className="text-text-2 text-base">{t.portal.didThisSolveIt}</p>

      <div className="flex items-center gap-1.5">
        <Choice on={choice === true} pending={pending} onClick={() => vote(true)}>
          <ThumbsUp size={14} />
          {t.common.yes}
        </Choice>
        <Choice on={choice === false} pending={pending} onClick={() => vote(false)}>
          <ThumbsDown size={14} />
          {t.portal.notReally}
        </Choice>
      </div>

      <p className="text-text-3 ml-auto text-[12.5px]">
        {choice !== null && choice !== mine ? (
          <span className="text-positive inline-flex items-center gap-1 font-medium">
            <Check size={12} strokeWidth={2.5} />
            {choice ? t.common.saved : t.portal.thanksForSaying}
          </span>
        ) : helped > 0 ? (
          t.portal.helpedThisMonth(helped)
        ) : (
          t.portal.notHelpedYet
        )}
      </p>
    </div>
  );
}

function Choice({
  on,
  pending,
  onClick,
  children,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
        "transition-[background-color,color] disabled:opacity-60",
        // Round 12 asks for contrast by fill: the chosen answer is a brand
        // wash, the other a plain well, and neither carries a border.
        on ? "text-brand-deep bg-[var(--brand-tint)]" : "bg-surface-2 text-text-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
