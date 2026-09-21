import { Pin } from "lucide-react";
import { CommentCard, type CommentNode } from "@/components/tickets/comment-card";
import type { AttachmentRow } from "@/components/tickets/attachment-list";
import { EventIcon, Sentence, type TimelineEvent } from "@/components/tickets/activity";
import { PersonLink } from "@/components/person-link";
import { messagesFor } from "@/lib/i18n";

export type TimelineItem =
  ({ kind: "comment" } & CommentNode) | ({ kind: "event" } & TimelineEvent);

/** A comment as the database hands it over, before replies are nested. */
export type CommentRow = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt: Date | null;
  pinnedAt: Date | null;
  parentId: string | null;
  author: { id: string; name: string; avatarVariant: number; role: { isMaster: boolean } };
  reactions: { emoji: string; userId: string }[];
  attachments: AttachmentRow[];
};

/** Rows in, one pill per emoji out — with whether this viewer is among them. */
function summariseReactions(
  rows: { emoji: string; userId: string }[],
  viewerId: string,
): CommentNode["reactions"] {
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();

  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.userId === viewerId) entry.mine = true;
    byEmoji.set(row.emoji, entry);
  }

  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

/**
 * Comments come back flat; replies are nested here so a thread renders as a
 * thread. Only top-level comments are returned — replies travel with their
 * parent, whose position in the sequence is the one that matters.
 *
 * The rows must arrive in the order they were written, so a parent is always
 * known by the time its replies are read.
 */
export function threadComments(rows: CommentRow[], viewerId: string): CommentNode[] {
  const nodes = new Map<string, CommentNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        body: row.body,
        isInternal: row.isInternal,
        createdAt: row.createdAt,
        editedAt: row.editedAt,
        pinnedAt: row.pinnedAt,
        author: {
          id: row.author.id,
          name: row.author.name,
          avatarVariant: row.author.avatarVariant,
          isMaster: row.author.role.isMaster,
        },
        reactions: summariseReactions(row.reactions, viewerId),
        attachments: row.attachments,
        replies: [],
      },
    ]),
  );

  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}

/**
 * Pinned comments, deepest replies included, oldest pin first.
 *
 * They are listed rather than lifted: a thread is a sequence, and moving a
 * comment out of it loses the "and then". A jump link finds it in a long
 * conversation without pretending it was said at a different time.
 */
function pinnedIn(nodes: CommentNode[]): CommentNode[] {
  const found: CommentNode[] = [];
  const walk = (list: CommentNode[]) => {
    for (const node of list) {
      if (node.pinnedAt) found.push(node);
      walk(node.replies);
    }
  };
  walk(nodes);
  return found.sort((a, b) => a.pinnedAt!.getTime() - b.pinnedAt!.getTime());
}

/** The gist of a comment with its Markdown taken off, for a one-line link. */
function gist(body: string) {
  const line =
    body
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find(Boolean) ?? "";
  const plain = line
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    // Only leading marks are syntax. A "#" in the middle of a line is the start
    // of a reference, and dropping it turns "as #INC-2609 0006" into prose.
    .replace(/^[>#\s]+/, "")
    .replace(/[*_~=`]/g, "")
    .trim();
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * Replies and field changes on one rail, in the order they happened — a status
 * move between two messages is part of the story, and reading them apart loses
 * the sequence. Events are small icon rows; a run of them is grouped between
 * two hairlines so the replies stay the things with weight.
 */
export function ConversationTimeline({
  items,
  ticketId,
  currentUserId,
  canDeleteAny,
  locale,
  dateLocale,
  requesterFirstName,
}: {
  items: TimelineItem[];
  ticketId: string;
  currentUserId: string;
  canDeleteAny: boolean;
  locale: string;
  /// What dates are written in, where that differs from the language.
  dateLocale?: string;
  /// Who an internal note is hidden from, named on the note itself.
  requesterFirstName?: string;
}) {
  const dateFormat = new Intl.DateTimeFormat(dateLocale ?? locale, STAMP);
  const t = messagesFor(locale);

  if (items.length === 0) {
    return <p className="text-text-3 text-md px-4 py-8 text-center">{t.ticket.nothingHappened}</p>;
  }

  const pinned = pinnedIn(
    items.filter((item): item is { kind: "comment" } & CommentNode => item.kind === "comment"),
  );

  // Consecutive events become one group, so the rail alternates between a
  // reply and the handful of changes that happened around it.
  const groups: (
    | { kind: "comment"; item: { kind: "comment" } & CommentNode }
    | { kind: "events"; items: ({ kind: "event" } & TimelineEvent)[] }
  )[] = [];
  for (const item of items) {
    if (item.kind === "comment") {
      groups.push({ kind: "comment", item });
    } else {
      const last = groups[groups.length - 1];
      if (last && last.kind === "events") last.items.push(item);
      else groups.push({ kind: "events", items: [item] });
    }
  }

  return (
    <>
      {pinned.length > 0 ? (
        <div className="border-line border-b bg-[var(--brand-tint)] px-4 py-3">
          <p className="text-brand-deep mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] uppercase">
            <Pin size={11} strokeWidth={2.5} />
            {t.ticket.pinnedHeading}
          </p>
          <ul className="space-y-1">
            {pinned.map((comment) => (
              <li key={comment.id}>
                <a
                  href={`#comment-${comment.id}`}
                  className="text-text-2 hover:text-text block truncate text-base transition-colors"
                >
                  <span className="text-text font-semibold">{comment.author.name}</span>{" "}
                  {gist(comment.body)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Faint dividers rather than a box each: the thread is one card now, and
          the rows inside it are separated the way rows in a card are. The
          direct-child selector leaves a comment's own replies alone — they are
          nested in their parent's list, not siblings in this one. */}
      <ol className="[&>li+li]:border-line [&>li+li]:border-t">
        {groups.map((group) =>
          group.kind === "comment" ? (
            <CommentCard
              key={group.item.id}
              comment={group.item}
              ticketId={ticketId}
              currentUserId={currentUserId}
              isAdmin={canDeleteAny}
              requesterFirstName={requesterFirstName}
            />
          ) : (
            <li key={group.items[0]!.id} className="px-4 py-1.5">
              <ul>
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="text-text-2 grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-1 text-sm"
                  >
                    <span className="bg-surface-2 text-text-3 ml-1 flex size-5 items-center justify-center rounded-full">
                      <EventIcon type={item.type} />
                    </span>
                    <span className="min-w-0">
                      {item.actor ? (
                        <PersonLink
                          id={item.actor.id}
                          name={item.actor.name}
                          className="text-text font-semibold"
                        />
                      ) : (
                        <span className="text-text font-semibold">{t.activity.someone}</span>
                      )}{" "}
                      <Sentence event={item} locale={locale} />
                    </span>
                    <span className="text-text-3 shrink-0 font-mono text-xs whitespace-nowrap">
                      {dateFormat.format(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ),
        )}
      </ol>
    </>
  );
}
