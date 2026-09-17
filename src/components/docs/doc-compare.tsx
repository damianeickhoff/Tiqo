"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2, RotateCcw, X } from "lucide-react";
import { restoreRevision } from "@/lib/actions/docs";
import type { DiffRow } from "@/lib/diff";
import { Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** One thing that can stand on either side of the comparison. */
export type Version = {
  /// A revision's id, or "current" for the live page.
  id: string;
  label: string;
  meta: string;
};

/**
 * Two versions of a page, side by side.
 *
 * Its own screen rather than a dialog: a diff is the widest thing in this
 * feature, and the two things somebody does with one — read every changed line,
 * and put an old version back — both want the whole window.
 *
 * Older on the left, always. A diff that reads backwards says things were
 * added when they were removed, so the sides are decided by the clock and not
 * by which picker was touched last. Restore lives on the left for the same
 * reason: there is nothing to restore about the version already on the page.
 */
export function DocCompare({
  backHref,
  backTitle,
  versions,
  olderId,
  newerId,
  olderMeta,
  newerMeta,
  rows,
  canEdit,
}: {
  backHref: string;
  backTitle: string;
  versions: Version[];
  olderId: string;
  newerId: string;
  olderMeta: Version;
  newerMeta: Version;
  rows: DiffRow[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const router = useRouter();
  const params = useSearchParams();
  const [inline, setInline] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A reworded line is one line gone and one line arrived, so those two numbers
  // are the whole of it — a third "lines changed" would only be their sum.
  const added = rows.filter((row) => row.left === null).length;
  const removed = rows.filter((row) => row.right === null).length;

  function pick(side: "a" | "b", value: string) {
    const query = new URLSearchParams(params.toString());
    query.set(side, value);
    router.push(`?${query.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="border-line flex min-h-[44px] flex-wrap items-center gap-2 border-b px-5 py-2 lg:px-8">
        <Link
          href={backHref}
          className="text-text-3 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
        >
          <ChevronLeft size={13} />
          {backTitle}
        </Link>
        <span className="text-text-3" aria-hidden>
          ·
        </span>
        <span className="text-base font-medium">{t.docs.compareTitle}</span>
        <span className="text-text-3 ml-2 text-sm">{t.docs.changedLines(removed, added)}</span>

        <span className="ml-auto flex items-center gap-2">
          <span
            role="group"
            aria-label={t.docs.compareLayout}
            className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
          >
            {(
              [
                [false, t.docs.sideBySide],
                [true, t.docs.inline],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={inline === mode}
                onClick={() => setInline(mode)}
                className={cn(
                  "h-7 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow]",
                  inline === mode
                    ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                    : "text-text-2 hover:text-text",
                )}
              >
                {label}
              </button>
            ))}
          </span>

          <Link
            href={backHref}
            className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control flex h-8 items-center gap-1.5 border px-2.5 text-sm font-medium shadow-[var(--highlight)] transition-colors"
          >
            <X size={13} />
            {t.common.close}
          </Link>
        </span>
      </div>

      <div className="space-y-4 px-5 py-5 lg:px-8">
        {error ? <p className="text-negative text-base font-medium">{error}</p> : null}

        {inline ? (
          <div className="card overflow-hidden">
            <div className="border-line flex flex-wrap items-center gap-3 border-b px-3.5 py-2.5">
              <Picker
                label={t.docs.compareOlder}
                value={olderId}
                versions={versions}
                onChange={(value) => pick("a", value)}
              />
              <span className="text-text-3" aria-hidden>
                →
              </span>
              <Picker
                label={t.docs.compareNewer}
                value={newerId}
                versions={versions}
                onChange={(value) => pick("b", value)}
              />
            </div>
            <Lines rows={rows} />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Column
              label={t.docs.compareOlder}
              value={olderId}
              meta={olderMeta.meta}
              versions={versions}
              onChange={(value) => pick("a", value)}
              action={
                // Only on the older side, and only for something that is not
                // already what the page says.
                canEdit && olderId !== "current" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await restoreRevision(olderId);
                        if (!result.ok) {
                          setError(result.error ?? t.errors.generic);
                          return;
                        }
                        setError(null);
                        router.push(backHref);
                      })
                    }
                    className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control ml-auto flex h-7 shrink-0 items-center gap-1.5 border px-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RotateCcw size={12} />
                    )}
                    {t.docs.restore}
                  </button>
                ) : null
              }
              rows={rows}
              side="left"
            />
            <Column
              label={t.docs.compareNewer}
              value={newerId}
              meta={newerMeta.meta}
              versions={versions}
              onChange={(value) => pick("b", value)}
              action={
                newerId === "current" ? (
                  <span className="tag ml-auto shrink-0">{t.docs.currentVersion}</span>
                ) : null
              }
              rows={rows}
              side="right"
            />
          </div>
        )}
      </div>
    </>
  );
}

function Picker({
  label,
  value,
  versions,
  onChange,
}: {
  label: string;
  value: string;
  versions: Version[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="label shrink-0">{label}</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-56 text-sm"
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Column({
  label,
  value,
  meta,
  versions,
  onChange,
  action,
  rows,
  side,
}: {
  label: string;
  value: string;
  meta: string;
  versions: Version[];
  onChange: (value: string) => void;
  action: React.ReactNode;
  rows: DiffRow[];
  side: "left" | "right";
}) {
  return (
    <div className="card flex min-w-0 flex-col overflow-hidden">
      <div className="border-line flex flex-wrap items-center gap-2.5 border-b px-3.5 py-2.5">
        <Picker label={label} value={value} versions={versions} onChange={onChange} />
        <span className="text-text-3 min-w-0 truncate text-sm">{meta}</span>
        {action}
      </div>
      <Lines rows={rows} only={side} />
    </div>
  );
}

/**
 * The lines themselves.
 *
 * The source rather than the rendered page: a diff of two rendered documents
 * shows paragraphs moving about and says nothing about what was typed, and the
 * thing somebody is checking is the sentence that changed. Lines are the unit
 * because a line is what a person edits and what a runbook is read in.
 */
function Lines({ rows, only }: { rows: DiffRow[]; only?: "left" | "right" }) {
  if (only) {
    return (
      <div className="max-h-[65vh] overflow-auto py-1.5">
        {rows.map((row, at) => {
          const text = only === "left" ? row.left : row.right;
          return <Line key={at} text={text} changed={row.changed} side={only} />;
        })}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto py-1.5">
      {rows.map((row, at) => (
        // Inline: removed then added, in the order they happened, so a reworded
        // sentence reads as one change rather than as two unrelated lines in
        // two columns.
        <span key={at} className="block">
          {row.left !== null && row.changed ? <Line text={row.left} changed side="left" /> : null}
          {row.right !== null ? <Line text={row.right} changed={row.changed} side="right" /> : null}
          {row.left !== null && !row.changed && row.right === null ? (
            <Line text={row.left} changed={false} side="left" />
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** A removed line is tinted the way a refusal is and an added one the way a
 *  confirmation is; a line the other side does not have gets a ground rather
 *  than nothing, because an empty row beside a tinted one reads as a bug. */
function Line({
  text,
  changed,
  side,
}: {
  text: string | null;
  changed: boolean;
  side: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "flex gap-2.5 px-3 py-0.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap",
        text === null
          ? "bg-[color-mix(in_oklab,var(--text)_4%,transparent)]"
          : changed
            ? side === "left"
              ? "text-text-2 bg-[color-mix(in_oklab,var(--negative)_12%,transparent)] line-through"
              : "bg-[color-mix(in_oklab,var(--positive)_14%,transparent)]"
            : "text-text-2",
      )}
    >
      <span className="text-text-3 w-3 shrink-0 select-none" aria-hidden>
        {text === null ? "" : changed ? (side === "left" ? "−" : "+") : ""}
      </span>
      <span className="min-w-0">{text ?? ""}</span>
    </span>
  );
}
