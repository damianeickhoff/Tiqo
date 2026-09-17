import { getMessages } from "@/lib/settings";
import { SortHeader } from "@/components/table/resizable-columns";
import { nextSort, type SortDir } from "@/components/table/sort";
import type { QueueSort } from "@/lib/tickets";
import { AT, COLUMNS } from "@/components/tickets/ticket-row";
import { Resizer } from "@/components/tickets/ticket-table";
import { cn } from "@/lib/utils";

/**
 * What each column of the queue is, and the handle for reordering by it.
 *
 * The rows carry a lot per line — a reference, a plan's progress, a reply
 * count, two dates — and none of it says what it is. This names them once at
 * the top instead of every row explaining itself, and tapping a name is how the
 * queue is put in that column's order.
 *
 * Lives inside the same `@container` as the list, and takes its widths and its
 * breakpoints from the row, so a header and its column appear and disappear
 * together and cannot drift out of alignment. Each heading carries the grab
 * strip for its own column.
 *
 * Sticky at the top of whatever scrolls, so a long queue keeps its headings —
 * which is why it needs an opaque ground of its own, and why a caller drawing
 * it inside a card has to say so.
 */
export async function TicketColumns({
  sort,
  dir,
  query,
  className,
}: {
  sort?: QueueSort;
  dir?: SortDir;
  /// The rest of the address as it stands — the filters, the search, the page.
  /// The order is one more thing the URL is saying, not a thing that replaces
  /// what it was saying.
  ///
  /// Without it the headings are labels and nothing more: a dashboard card
  /// shows one question's answer in the order that question is asked in, and a
  /// heading there that reordered the whole queue page would be a link out of
  /// the card dressed as a column.
  query?: string;
  className?: string;
}) {
  const t = await getMessages();

  /** The same queue, ordered by this column. Worked out here because a server
   *  component cannot hand a client one a function to work it out with. */
  const hrefOf = (field: QueueSort) => {
    const next = nextSort(field, sort, dir);
    const params = new URLSearchParams(query ?? "");
    params.set("sort", next.sort);
    params.set("dir", next.dir);
    // A reorder starts again at the first page: page four of the old order is
    // not page four of the new one.
    params.delete("page");
    return `/tickets?${params.toString()}`;
  };

  const heading = (field: QueueSort, label: string, align?: "left" | "right") =>
    query === undefined ? (
      <span className={cn("block truncate", align === "right" && "text-right")}>{label}</span>
    ) : (
      <SortHeader
        field={field}
        sort={sort}
        dir={dir}
        label={label}
        align={align}
        href={hrefOf(field)}
      />
    );

  return (
    <div
      className={cn(
        "label border-line bg-surface sticky top-0 z-10 hidden h-9 items-center gap-3 border-b pr-4 pl-[24px] @sm:flex",
        className,
      )}
    >
      <Heading column="reference" className={cn("shrink-0", COLUMNS.reference)}>
        {heading("reference", t.tickets.colReference)}
      </Heading>

      {/* A column like any other now, with a width and an edge of its own.
          Not `SUBJECT` itself: the row's version clips its overflow, which
          would take the grab strip with it. */}
      <Heading column="subject" className={cn("min-w-0 @sm:shrink-0", COLUMNS.subject)}>
        {heading("subject", t.tickets.colSubject)}
      </Heading>

      <span className="flex shrink-0 items-center gap-3">
        {/* How far along a plan is has no order of its own worth reading a
            queue in, so this one heading is a label and nothing more. */}
        <Heading column="plan" className={cn(AT.plan, COLUMNS.plan)}>
          <span className="block truncate">{t.tickets.colPlan}</span>
        </Heading>

        <Heading column="status" className={cn(AT.status, COLUMNS.status)}>
          {heading("status", t.ticket.status)}
        </Heading>

        <Heading column="priority" className={cn(AT.priority, COLUMNS.priority)}>
          {heading("priority", t.ticket.priority)}
        </Heading>

        {/* Matches the dot the rows show where the bars will not fit, so the
            columns after it stay in step. */}
        <span aria-hidden className="size-2 shrink-0 @4xl:hidden" />

        <Heading column="requester" className={cn(AT.requester, COLUMNS.requester)}>
          {heading("requester", t.tickets.colRequester)}
        </Heading>

        <Heading column="assignee" className={COLUMNS.assignee}>
          {heading("assignee", t.tickets.colAssignee)}
        </Heading>

        <Heading column="replies" className={cn(AT.replies, COLUMNS.replies)}>
          {heading("replies", t.tickets.colReplies, "right")}
        </Heading>

        <Heading column="created" className={cn(AT.created, COLUMNS.created)}>
          {heading("created", t.tickets.colCreated, "right")}
        </Heading>

        <Heading column="due" className={cn(AT.due, COLUMNS.due)}>
          {heading("due", t.tickets.colDue, "right")}
        </Heading>

        <Heading column="left" className={cn(AT.left, COLUMNS.left)}>
          {heading("left", t.tickets.colLeft, "right")}
        </Heading>
      </span>
    </div>
  );
}

/**
 * One heading and the grab strip on its right edge.
 *
 * The clipping is on the inner span, never the outer: the strip hangs outside
 * the cell by design, and an `overflow: hidden` on the box it lives in trims it
 * away — which is how a row of handles ends up looking present and being
 * ungrabbable.
 */
function Heading({
  column,
  className,
  children,
}: {
  column: React.ComponentProps<typeof Resizer>["column"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("relative", className)}>
      {children}
      <Resizer column={column} />
    </span>
  );
}
