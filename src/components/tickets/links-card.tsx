"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, GitBranchPlus, Loader2, Plus, X } from "lucide-react";
import type { TicketLinkKind } from "@/generated/prisma/enums";
import {
  linkTickets,
  searchLinkTargets,
  unlinkTickets,
  type LinkCandidate,
} from "@/lib/actions/ticket-links";
import { PanelCard } from "@/components/tickets/panel-card";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { TicketPeekDialog } from "@/components/ticket-peek";
import { Button, FieldError, FormError, Input, PickerRow, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const KINDS: TicketLinkKind[] = ["RELATES_TO", "DUPLICATES", "BLOCKS", "CAUSED_BY", "PARENT_OF"];

/**
 * The order the card reads in.
 *
 * Family first: a parent and its children are the structure of the work, and
 * everything else is commentary on it. Then what is holding this up, then what
 * it repeats, then what caused it, and "relates to" last because it is what
 * somebody reaches for when none of the others fit.
 *
 * Keyed by reading rather than by kind: "is blocked by" is a different sentence
 * from "blocks" and belongs under its own heading, even though both are the
 * same row seen from opposite ends.
 */
const READING_ORDER: string[] = [
  "PARENT_OF:in",
  "PARENT_OF:out",
  "BLOCKS:in",
  "BLOCKS:out",
  "DUPLICATES:out",
  "DUPLICATES:in",
  "CAUSED_BY:out",
  "CAUSED_BY:in",
  "RELATES_TO:out",
  "RELATES_TO:in",
];

const reading = (kind: TicketLinkKind, incoming: boolean) => `${kind}:${incoming ? "in" : "out"}`;

/**
 * One link as it reads from the ticket being looked at.
 *
 * `incoming` is the whole of the difference between the two ends: the row is
 * stored once, from the ticket it was made on, and the far end renders the
 * inverse verb rather than a second row that could come to disagree with it.
 */
export type LinkRow = {
  id: string;
  kind: TicketLinkKind;
  incoming: boolean;
  ticket: LinkCandidate;
};

/**
 * What this ticket has to do with others.
 *
 * Adding and removing take effect at once — a link is a list-level command,
 * which is the exception CLAUDE.md names, and there is nothing here worth
 * drafting. The dialog is only how a ticket is chosen.
 */
export function LinksCard({
  ticketId,
  ticketNumber,
  links,
  canEdit,
}: {
  ticketId: string;
  /// Only so the card can point at `/tickets/new?parent=…`. The links
  /// themselves are made by id.
  ticketNumber: number;
  links: LinkRow[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [adding, setAdding] = useState(false);
  const [peeking, setPeeking] = useState<number | null>(null);
  /// Which row is being withdrawn, not merely that one is: a single flag dimmed
  /// every X on the card at once and left nobody sure which link was going.
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Grouped by reading, in the order above. A rail card of eight links with the
  // parent third and a child seventh is a list somebody has to read twice to
  // work out what this ticket belongs to.
  const groups = useMemo(() => {
    const byReading = new Map<string, LinkRow[]>();
    for (const link of links) {
      const key = reading(link.kind, link.incoming);
      const rows = byReading.get(key);
      if (rows) rows.push(link);
      else byReading.set(key, [link]);
    }
    return READING_ORDER.filter((key) => byReading.has(key)).map((key) => ({
      key,
      rows: byReading.get(key)!,
    }));
  }, [links]);

  function remove(id: string) {
    setRemoving(id);
    setError(null);
    startTransition(async () => {
      const result = await unlinkTickets(id);
      setRemoving(null);
      // Cleared on the way in as well as set on the way out, so a failure
      // somebody has since corrected does not stay on the card for ever.
      setError(result.ok ? null : (result.errors.form ?? t.errors.generic));
    });
  }

  return (
    <PanelCard
      title={t.links.title}
      action={
        canEdit ? (
          <span className="flex items-center gap-0.5">
            {/* Raising the child rather than linking one: the form comes up
                knowing which ticket it belongs under, and the link is written
                on save. A real link, because it leaves this page. */}
            <Link
              href={`/tickets/new?parent=${ticketNumber}`}
              aria-label={t.links.newChild}
              title={t.links.newChild}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
            >
              <GitBranchPlus size={14} />
            </Link>
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label={t.links.addTo}
              title={t.links.addTo}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
            >
              <Plus size={14} />
            </button>
          </span>
        ) : null
      }
    >
      {error ? (
        <div className="px-3.5 pt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      {links.length === 0 ? (
        <p className="text-text-3 px-3.5 py-3 text-base">{t.links.none}</p>
      ) : (
        <div className="divide-line divide-y">
          {groups.map((group) => {
            const [kind, side] = group.key.split(":") as [TicketLinkKind, "in" | "out"];
            return (
              <section key={group.key}>
                {/* The verb, said once over the group rather than on every row.
                    A rail card that repeats "relates to" four times spends its
                    width on the part that is not changing. */}
                <h3 className="label bg-surface-2 px-3.5 py-1.5">
                  {side === "in" ? t.links.inverse[kind] : t.links.verb[kind]}
                </h3>
                <ul className="divide-line divide-y">
                  {group.rows.map((link) => {
                    const settled = Boolean(link.ticket.status?.settles);
                    return (
                      <li key={link.id} className="flex items-start gap-2 px-3.5 py-2">
                        <StatusRing
                          status={link.ticket.status}
                          title={link.ticket.status?.name ?? t.tickets.noStatus}
                          className="mt-0.5"
                        />

                        <div className="min-w-0 flex-1 leading-tight">
                          {/* A real link, so it can be middle-clicked, copied and
                      opened in a tab like every other reference in the app.
                      The peek beside it is the shortcut, not the only way in.
                      Two lines rather than one: at rail width a reference and
                      a title on the same line leave the title truncated to
                      nothing, which is the half somebody is reading. */}
                          <a
                            href={`/tickets/${link.ticket.number}`}
                            className={cn(
                              "hover:text-brand-deep block min-w-0 transition-colors",
                              // Settled links stay readable and stop competing: they
                              // are history, and the open ones are the work.
                              settled && "opacity-60",
                            )}
                          >
                            <span className="block truncate font-mono text-xs font-medium">
                              {link.ticket.reference}
                            </span>
                            <span
                              className={cn("block truncate text-sm", settled && "line-through")}
                              title={link.ticket.title}
                            >
                              {link.ticket.title}
                            </span>
                          </a>
                        </div>

                        <span className="flex shrink-0 items-center gap-0.5 pt-0.5">
                          <PriorityBars priority={link.ticket.priority} />
                          <button
                            type="button"
                            onClick={() => setPeeking(link.ticket.number)}
                            aria-label={t.links.peek(link.ticket.reference)}
                            title={t.links.peek(link.ticket.reference)}
                            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => remove(link.id)}
                              // Per row, so removing one link does not dim every other
                              // X on the card and leave nobody sure which one went.
                              disabled={removing === link.id}
                              aria-label={t.links.remove}
                              title={t.links.remove}
                              className="text-text-3 hover:bg-surface-3 hover:text-negative rounded-control p-1 transition-colors disabled:opacity-50"
                            >
                              {removing === link.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <X size={13} />
                              )}
                            </button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {adding ? <AddLinkDialog ticketId={ticketId} onClose={() => setAdding(false)} /> : null}
      {peeking !== null ? (
        <TicketPeekDialog number={peeking} onClose={() => setPeeking(null)} />
      ) : null}
    </PanelCard>
  );
}

/**
 * Choosing the far ticket and what to say about it.
 *
 * Pressing Add records the statement; there is no Save here because there is no
 * draft — the dialog exists to pick, not to describe.
 */
function AddLinkDialog({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const t = useMessages();
  /// Kind and direction in one value, because they are one choice: "blocks" and
  /// "is blocked by" are the same row written from opposite ends, and asking
  /// for the verb and then for a direction is asking the same question twice.
  const [picked, setPicked] = useState("RELATES_TO:out");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkCandidate[]>([]);
  /// Until the first answer comes back there is nothing to say: "No matches"
  /// before anything has been searched is a lie the picker told on open.
  const [searched, setSearched] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Debounced rather than run per keystroke: the search runs against every
  // ticket this person can read, and a query per character is a query per
  // character.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      searchLinkTargets(ticketId, query).then((rows) => {
        if (!live) return;
        setResults(rows);
        setSearched(true);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [ticketId, query]);

  /**
   * Every way the ten readings can be said, as the picker offers them.
   *
   * Both ends of each kind, except where a kind reads the same in both
   * directions — "relates to" said twice would be two options that do the same
   * thing and look like a mistake in the list.
   */
  const readings = KINDS.flatMap((kind) =>
    t.links.inverse[kind] === t.links.verb[kind]
      ? [{ value: reading(kind, false), label: t.links.verb[kind] }]
      : [
          { value: reading(kind, false), label: t.links.verb[kind] },
          { value: reading(kind, true), label: t.links.inverse[kind] },
        ],
  );

  function add() {
    if (!chosen) return;
    const [kind, side] = picked.split(":") as [TicketLinkKind, "in" | "out"];
    startTransition(async () => {
      // The inverse readings are the same row written from the other end, so
      // the chosen ticket becomes the source and this one the target. One row
      // per statement, whichever way somebody happened to say it.
      const result =
        side === "in"
          ? await linkTickets(chosen, { targetId: ticketId, kind })
          : await linkTickets(ticketId, { targetId: chosen, kind });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal title={t.links.addTo} onClose={onClose}>
      <div className="space-y-4">
        <FormError>{errors.form}</FormError>

        <div className="flex items-center gap-2">
          <span className="label shrink-0">{t.links.kind}</span>
          <Select
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className="flex-1"
          >
            {readings.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.links.search}
          aria-label={t.links.search}
        />

        <div className="border-border rounded-card max-h-64 space-y-1 overflow-y-auto border p-1">
          {results.length === 0 ? (
            <p className="text-text-3 py-6 text-center text-base">
              {searched ? t.common.noMatches : t.links.searching}
            </p>
          ) : (
            results.map((candidate) => (
              <PickerRow
                key={candidate.id}
                selected={chosen === candidate.id}
                aria-pressed={chosen === candidate.id}
                onClick={() => setChosen(candidate.id)}
                lead={<StatusRing status={candidate.status} title={candidate.status?.name} />}
                title={candidate.reference}
                hint={candidate.title}
                trail={<PriorityBars priority={candidate.priority} />}
              />
            ))
          )}
        </div>

        <FieldError>{errors.targetId}</FieldError>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={add} disabled={pending || !chosen}>
            {pending ? t.common.saving : t.links.add}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
