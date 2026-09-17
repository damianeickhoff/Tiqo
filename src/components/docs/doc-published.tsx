"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, EyeOff, ExternalLink, Globe, Loader2, RefreshCw } from "lucide-react";
import { publishDoc, withdrawDoc } from "@/lib/actions/docs";
import { PanelCard } from "@/components/tickets/panel-card";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Where this page has been put in front of requesters.
 *
 * Shown only once it has been published, and it says which of the two states
 * the answer is in — because a page whose article is hidden looks exactly like
 * one that was never published, and the difference decides whether publishing
 * again creates a second answer or wakes the first.
 *
 * And, when the page has moved on since, it says so. The two are allowed to
 * drift — what you tell a requester is shorter than what you tell an engineer
 * — but drifting silently is how a desk ends up telling people to follow a
 * procedure it stopped using in March.
 */
export function PublishedCard({
  docId,
  articleId,
  articleTitle,
  categoryId,
  categoryName,
  publishedWhen,
  isLive,
  behind,
  canManage,
}: {
  docId: string;
  articleId: string;
  articleTitle: string;
  /// The section the answer is already in. Sent back with a re-publish so
  /// catching the answer up cannot quietly move it out of its section.
  categoryId: string | null;
  categoryName: string | null;
  publishedWhen: string;
  isLive: boolean;
  /// How many saves this page has had since the answer was last written from
  /// it. Counted on the server, where the revisions are.
  behind: number;
  canManage: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState(isLive);
  const [caughtUp, setCaughtUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <PanelCard
      title={t.docs.publishedAs}
      action={
        canManage && behind > 0 && !caughtUp ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await publishDoc(docId, { categoryId, isPublished: live });
                if (!result.ok) {
                  setError(Object.values(result.errors)[0] ?? t.errors.generic);
                  return;
                }
                setError(null);
                setCaughtUp(true);
              })
            }
            className="text-brand-deep inline-flex items-center gap-1 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t.docs.republish}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <Globe
            size={14}
            className={live ? "text-positive mt-0.5 shrink-0" : "text-text-3 mt-0.5 shrink-0"}
          />
          <a
            href={`/settings/portal/knowledge/${articleId}`}
            className="hover:text-brand-deep min-w-0 flex-1 text-base font-medium transition-colors"
          >
            {articleTitle}
          </a>
        </div>

        <p className="text-text-3 text-sm">
          {categoryName ? t.docs.underSection(categoryName, publishedWhen) : publishedWhen}
          {live ? "" : ` · ${t.docs.withdrawn}`}
        </p>

        {behind > 0 && !caughtUp ? (
          <p className="callout-brand text-brand-deep flex items-start gap-1.5 px-2 py-1.5 text-sm">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {t.docs.answerBehind(behind)}
          </p>
        ) : null}

        {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
          <a
            href={`/settings/portal/knowledge/${articleId}`}
            className="text-text-3 hover:text-text inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ExternalLink size={12} />
            {t.docs.viewArticle}
          </a>

          {canManage && live ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await withdrawDoc(docId);
                  if (result.ok) setLive(false);
                })
              }
              className="text-text-3 hover:text-text inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <EyeOff size={12} />
              {t.docs.withdraw}
            </button>
          ) : null}
        </div>
      </div>
    </PanelCard>
  );
}
