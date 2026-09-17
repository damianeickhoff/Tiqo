"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Pencil, Send } from "lucide-react";
import { sendMailTest } from "@/lib/actions/mail";
import type { TemplateKind } from "@/lib/mail-templates";
import {
  ColumnHandle,
  SortHeader,
  useResizableColumns,
} from "@/components/table/resizable-columns";
import { type SortDir } from "@/components/table/sort";
import { Button, buttonClass, FormError } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Every kind of mail the desk sends, one to a row.
 *
 * A table rather than a stack of panels because the question this screen
 * answers is a comparison — which of these is edited, which of these anybody is
 * actually receiving — and a comparison wants columns. The template itself is a
 * page of its own, reached from Edit.
 *
 * It resizes and orders the way the queue does, from the same primitive: two
 * tables on one desk that answer a drag differently are two tables somebody has
 * to learn twice.
 */

export type TemplateRow = {
  kind: TemplateKind;
  subject: string;
  edited: boolean;
  /// When the desk's own wording was last written. Null on a shipped one, which
  /// has no row behind it to carry a date.
  updatedAt: Date | null;
  sent: number;
};

/// Everything but the subject, which takes whatever they leave. Ten rows of
/// short cells and one long one: a fixed subject column would either cut every
/// line or leave half the table empty.
const COLUMNS = ["kind", "goesTo", "state", "lastEdited", "sent", "edit"] as const;

type ColumnKey = (typeof COLUMNS)[number];

const DEFAULTS: Record<ColumnKey, number> = {
  kind: 180,
  goesTo: 140,
  state: 88,
  lastEdited: 88,
  sent: 64,
  edit: 76,
};

/// The tracks, with the subject sitting flexible in the middle of them. Written
/// out rather than taken from the hook's own `gridTemplate`, which lists the
/// resizable columns in order and has nowhere to put the one that is not.
const TEMPLATE =
  "var(--col-kind) var(--col-goesTo) minmax(0,1fr) var(--col-state) var(--col-lastEdited) var(--col-sent) var(--col-edit)";

/** Which column the table is read in. Sorted here rather than on the server:
 *  ten rows are already in the browser, and a round trip to reorder them would
 *  be a page load to answer a question the page can answer itself. */
type Field = "kind" | "goesTo" | "state" | "lastEdited" | "sent";

export function MailTemplatesTable({ templates }: { templates: TemplateRow[] }) {
  const t = useMessages();
  const when = useDateFormat({ day: "numeric", month: "short" });
  const [sending, startTransition] = useTransition();
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No order at all until somebody asks for one: the shipped order is the
  // order these messages happen in, which is the most useful one there is.
  const [order, setOrder] = useState<{ sort?: Field; dir?: SortDir }>({});

  const { style, container, onResizeStart, reset } = useResizableColumns({
    key: "mail-templates",
    columns: COLUMNS,
    defaults: DEFAULTS,
  });

  const rows = useMemo(() => {
    const { sort, dir } = order;
    if (!sort) return templates;

    const value = (row: TemplateRow) => {
      switch (sort) {
        case "kind":
          return t.mail.templates[row.kind].name;
        case "goesTo":
          return t.mail.templates[row.kind].goesTo;
        case "state":
          return row.edited ? 1 : 0;
        case "lastEdited":
          return row.updatedAt ? row.updatedAt.getTime() : 0;
        case "sent":
          return row.sent;
      }
    };

    return [...templates].sort((one, other) => {
      const a = value(one);
      const b = value(other);
      const compared = typeof a === "string" ? a.localeCompare(b as string) : a - (b as number);
      return dir === "desc" ? -compared : compared;
    });
  }, [templates, order, t]);

  const heading = (field: Field, label: string, align?: "left" | "right") => (
    <SortHeader
      field={field}
      sort={order.sort}
      dir={order.dir}
      label={label}
      align={align}
      onChange={setOrder}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-text-2 min-w-0 flex-1 basis-[22rem] text-base">{t.mail.wordingBlurb}</p>

        {/* A verb on its own: it sends now, and there is nothing to save. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sending}
          onClick={() =>
            startTransition(async () => {
              setSaid(null);
              setError(null);
              const result = await sendMailTest();
              if (result.ok) setSaid(t.mail.sentTest(result.to));
              else setError(result.error ?? t.errors.generic);
            })
          }
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? t.mail.sendingTest : t.mail.sendEvery}
        </Button>

        {said ? (
          <span className="text-positive animate-fade text-sm font-medium">{said}</span>
        ) : null}
      </div>

      <FormError>{error ?? undefined}</FormError>

      {/* The widths are custom properties on this element; the header and every
          row read the same track list from it, so the two cannot drift. Below
          the breakpoint the table gives up on columns entirely rather than
          shrinking them into initials. */}
      <div
        ref={container}
        style={{ ...style, ["--template" as string]: TEMPLATE }}
        className="border-line rounded-card border"
      >
        <div
          className={cn(
            ROW,
            "label border-line bg-surface-2 rounded-t-card hidden h-9 items-center border-b lg:grid",
          )}
        >
          <Heading onResizeStart={onResizeStart} onReset={reset} column="kind">
            {heading("kind", t.mail.colKind)}
          </Heading>
          <Heading onResizeStart={onResizeStart} onReset={reset} column="goesTo">
            {heading("goesTo", t.mail.colGoesTo)}
          </Heading>

          {/* The one column with no width of its own: it takes what the others
              leave, and so has no edge of its own to drag. */}
          <span className="truncate">{t.mail.colSubject}</span>

          <Heading onResizeStart={onResizeStart} onReset={reset} column="state">
            {heading("state", t.mail.colWording)}
          </Heading>
          <Heading onResizeStart={onResizeStart} onReset={reset} column="lastEdited">
            {heading("lastEdited", t.mail.colLastEdited)}
          </Heading>
          <Heading onResizeStart={onResizeStart} onReset={reset} column="sent">
            {heading("sent", t.mail.colSentIn30, "right")}
          </Heading>
          <span />
        </div>

        <ul className="divide-line divide-y">
          {rows.map((row) => {
            const meta = t.mail.templates[row.kind];
            return (
              <li key={row.kind} className={cn(ROW, "items-center px-3.5 py-2.5 lg:px-0")}>
                <span className="text-md truncate font-semibold lg:pl-3.5">{meta.name}</span>
                <span className="text-text-2 truncate text-sm">{meta.goesTo}</span>
                <span className="text-text-2 col-span-2 truncate font-mono text-xs lg:col-span-1">
                  {row.subject}
                </span>
                <span className="truncate text-sm">
                  {row.edited ? (
                    <span className="border-brand/40 text-brand-deep rounded-full border bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
                      {t.mail.edited}
                    </span>
                  ) : (
                    <span className="text-text-3 text-xs">{t.mail.shipped}</span>
                  )}
                </span>
                <span className="text-text-3 truncate text-xs">
                  {row.updatedAt ? when.format(row.updatedAt) : "—"}
                </span>
                <span className="text-text-3 truncate text-right font-mono text-xs">
                  {row.sent}
                </span>
                <span className="flex justify-end lg:pr-3.5">
                  <Link
                    href={`/settings/mail/templates/${row.kind}`}
                    className={buttonClass("outline", "sm")}
                  >
                    <Pencil size={13} />
                    {t.common.edit}
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/// One track list for the header and every row. The subject comes last in the
/// markup and reads last on a narrow screen, which is the order somebody scans
/// these in anyway: what the message is, then what it says.
const ROW =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-3 gap-y-1 lg:[grid-template-columns:var(--template)] lg:gap-x-3";

/**
 * One heading and the grab strip on its trailing edge.
 *
 * The clipping is on the inner span, never the outer: the strip hangs outside
 * the cell by design, and an `overflow: hidden` on the box it lives in trims it
 * away.
 */
function Heading({
  column,
  onResizeStart,
  onReset,
  children,
}: {
  column: ColumnKey;
  onResizeStart: (id: ColumnKey) => (event: React.PointerEvent) => void;
  onReset: (id: ColumnKey) => void;
  children: React.ReactNode;
}) {
  const t = useMessages();

  return (
    <span className={cn("relative", column === "kind" && "pl-3.5")}>
      {children}
      <ColumnHandle
        label={t.tickets.resizeColumn}
        title={t.tickets.resizeHint}
        onResizeStart={onResizeStart(column)}
        onReset={() => onReset(column)}
      />
    </span>
  );
}
