"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GitCompare, History, Loader2, RotateCcw } from "lucide-react";
import { readRevision, restoreRevision } from "@/lib/actions/docs";
import { Markdown } from "@/components/markdown";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { PanelCard } from "@/components/tickets/panel-card";
import { Button } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";

export type RevisionRow = {
  id: string;
  note: string | null;
  createdAt: Date;
  author: { name: string; avatarVariant: number | null } | null;
};

type Opened = Awaited<ReturnType<typeof readRevision>>;

/**
 * What this page said before each change.
 *
 * Every save keeps the previous words, so the list reads as a column of
 * changes: who, when, and — when they said — why. That is the shape of the
 * question people actually arrive with. "What did this say last week" is
 * answered by opening the change that came after last week, not by counting
 * versions backwards.
 *
 * Bodies are fetched one at a time, on opening. A history of fifty entries is
 * fifty whole documents, and forty-nine of them are never read.
 *
 * Comparing two of them is its own screen rather than a mode in this card:
 * picking two rows in a 320px rail and then reading the result in a dialog on
 * top of the page they came from was three things competing for the same
 * corner of the screen.
 */
export function DocHistory({
  revisions,
  canEdit,
  currentAuthor,
  currentAt,
  compareHref,
}: {
  revisions: RevisionRow[];
  canEdit: boolean;
  /// The version on screen, shown at the top of the list so the history has a
  /// present tense and not only a past one.
  currentAuthor: string | null;
  currentAt: Date;
  compareHref: string;
}) {
  const t = useMessages();
  const when = useDateFormat({
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [opened, setOpened] = useState<Opened>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open(id: string) {
    setLoadingId(id);
    startTransition(async () => {
      const revision = await readRevision(id);
      setLoadingId(null);
      if (revision) setOpened(revision);
    });
  }

  function restore(id: string) {
    startTransition(async () => {
      const result = await restoreRevision(id);
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setOpened(null);
      setError(null);
    });
  }

  return (
    <PanelCard
      title={t.docs.history}
      action={
        revisions.length > 0 ? (
          <Link
            href={compareHref}
            className="text-text-3 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <GitCompare size={12} />
            {t.docs.compareShort}
          </Link>
        ) : undefined
      }
    >
      <ul className="divide-line divide-y">
        <li>
          <Row
            lead={<span className="bg-brand size-1.5 shrink-0 rounded-full" aria-hidden />}
            title={t.docs.currentVersion}
            hint={
              currentAuthor
                ? t.docs.updatedBy(currentAuthor, when.format(currentAt))
                : when.format(currentAt)
            }
          />
        </li>

        {revisions.length === 0 ? (
          <li className="text-text-3 px-3.5 py-3 text-sm">{t.docs.noHistory}</li>
        ) : (
          revisions.map((revision) => (
            <li key={revision.id}>
              <Row
                onOpen={() => open(revision.id)}
                loading={loadingId === revision.id}
                lead={
                  revision.author ? (
                    <Avatar
                      name={revision.author.name}
                      variant={revision.author.avatarVariant}
                      size={20}
                      className="shrink-0"
                    />
                  ) : (
                    <History size={14} className="text-text-3 shrink-0" />
                  )
                }
                title={
                  revision.note ?? t.docs.changeBy(revision.author?.name ?? t.activity.someone)
                }
                hint={
                  revision.author
                    ? t.docs.updatedBy(revision.author.name, when.format(revision.createdAt))
                    : when.format(revision.createdAt)
                }
              />
            </li>
          ))
        )}
      </ul>

      {opened ? (
        <Modal
          size="lg"
          title={opened.title}
          description={t.docs.beforeThisChange}
          onClose={() => setOpened(null)}
        >
          <div className="space-y-4">
            <p className="text-text-3 text-sm">
              {opened.author
                ? t.docs.updatedBy(opened.author.name, when.format(opened.createdAt))
                : when.format(opened.createdAt)}
              {opened.note ? ` · ${opened.note}` : ""}
            </p>

            {/* Boxed and scrollable, so an old version never reads as the page
                itself — the one mistake that would matter here. */}
            <div className="border-line bg-surface-2 rounded-card max-h-[50vh] overflow-y-auto border p-4">
              {opened.body.trim() ? (
                <Markdown text={opened.body} className="tiqo-prose text-md leading-relaxed" />
              ) : (
                <p className="text-text-3 text-md italic">{t.docs.emptyDoc}</p>
              )}
            </div>

            {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => restore(opened.id)}
                >
                  {pending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  {pending ? t.docs.restoring : t.docs.restore}
                </Button>
              ) : null}

              <button
                type="button"
                onClick={() => setOpened(null)}
                className="text-text-3 hover:text-text rounded-full px-2 py-1 text-base font-medium transition-colors"
              >
                {t.docs.closeRevision}
              </button>

              {canEdit ? (
                <p className="text-text-3 basis-full text-sm">{t.docs.restoreBlurb}</p>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </PanelCard>
  );
}

/** One line of the history. Reading, it opens the version it replaced; the
 *  live one has nothing to open, because it is what the page already says. */
function Row({
  onOpen,
  loading = false,
  lead,
  title,
  hint,
}: {
  onOpen?: () => void;
  loading?: boolean;
  lead: React.ReactNode;
  title: string;
  hint: string;
}) {
  const inside = (
    <>
      <span className="mt-0.5 flex shrink-0 items-center">{lead}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{title}</span>
        <span className="text-text-3 block truncate text-sm">{hint}</span>
      </span>
      {loading ? <Loader2 size={13} className="text-text-3 mt-1 shrink-0 animate-spin" /> : null}
    </>
  );

  const shape = "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors";

  if (!onOpen) return <span className={shape}>{inside}</span>;

  return (
    <button type="button" onClick={onOpen} className={`${shape} hover:bg-surface-2`}>
      {inside}
    </button>
  );
}
