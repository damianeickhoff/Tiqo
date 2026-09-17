import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  CalendarClock,
  Flag,
  Forward,
  GitMerge,
  HardDrive,
  Layers,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Stamp,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import type { ActivityType, Priority, TicketLinkKind, TicketType } from "@/generated/prisma/enums";
import { Avatar } from "@/components/avatar";
import { ReferenceChip } from "@/components/reference-chip";
import { messagesFor, type Messages } from "@/lib/i18n";
import { DeleteActivityButton } from "@/components/tickets/delete-activity-button";
import { PersonLink } from "@/components/person-link";

export type TimelineEvent = {
  id: string;
  createdAt: Date;
  actor: { id?: string; name: string; avatarVariant?: number | null } | null;
  type: ActivityType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  /// Where the thing this entry names can be found, when it names one.
  link?: string | null;
};

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * Events read as sentences — nobody reads a table of old and new values.
 *
 * Each case hands its values to the dictionary rather than building a string
 * here: Dutch puts the verb in a different place, and a sentence assembled from
 * English-shaped fragments cannot follow it there.
 */
export function describe(event: TimelineEvent, locale = "en-GB", dateLocale = locale) {
  const t = messagesFor(locale);
  const a = t.activity;
  const from = event.oldValue;
  const to = event.newValue;

  switch (event.type) {
    case "CREATED":
      return a.created(to);
    case "REPORTER_CHANGED":
      return a.reporterChanged(from, to);
    case "STATUS_CHANGED":
      return a.statusChanged(from ?? a.noStatus, to ?? a.noStatus);
    case "PRIORITY_CHANGED":
      return a.priorityChanged(priorityName(t, from), priorityName(t, to));
    case "TYPE_CHANGED":
      return a.typeChanged(typeName(t, from), typeName(t, to));
    case "PROJECT_CHANGED":
      return to ? a.projectChanged(from, to) : a.projectCleared(from);
    case "TEAM_CHANGED":
      return to ? a.teamChanged(from, to) : a.teamCleared(from);
    case "ASSIGNED":
      return a.assigned(to);
    case "UNASSIGNED":
      return a.unassigned(from);
    case "TITLE_CHANGED":
      return a.renamed(to);
    case "DESCRIPTION_CHANGED":
      return a.descriptionEdited;
    case "LABEL_ADDED":
      return a.tagAdded(to);
    case "LABEL_REMOVED":
      return a.tagRemoved(from);
    case "DUE_DATE_CHANGED":
      return to
        ? a.dueDateSet(new Intl.DateTimeFormat(dateLocale, STAMP).format(new Date(to)))
        : a.dueDateCleared;
    case "FORWARDED":
      return a.forwarded(to);
    case "MERGED":
      return to ? a.mergedInto(to) : a.mergedFrom(from);
    case "COMMENT_EDITED":
      return a.commentEdited(from);
    case "COMMENT_DELETED":
      return a.commentDeleted(from);
    case "STEP_ADDED":
      return a.stepAdded(to);
    case "STEP_REMOVED":
      return a.stepRemoved(from);
    case "STEP_DONE":
      return a.stepDone(to);
    case "STEP_REOPENED":
      return a.stepReopened(to);
    case "PLAN_APPLIED":
      return a.planApplied(to);
    // The phase the decision gates, which is null when the whole ticket waits.
    case "APPROVAL_REQUESTED":
      return a.approvalRequested(to);
    case "APPROVAL_GRANTED":
      return a.approvalGranted(to);
    case "APPROVAL_REFUSED":
      return a.approvalRefused(to);
    case "APPROVAL_CANCELLED":
      return a.approvalCancelled(to);
    case "COMMENTED":
      return a.commented;
    case "ATTACHMENT_REMOVED":
      return a.attachmentRemoved(from, to);
    // A reference is recorded at both ends and the two read in opposite
    // directions, so which side of the change is filled in says which end this
    // is: `newValue` is what was pointed at, `oldValue` is where it was pointed
    // from. The field names the kind, because a ticket, a project and a person
    // all read differently.
    // A link is recorded at both ends from one row, and the field says which
    // end this is: "out" reads the statement forwards with this ticket as the
    // subject, "in" reads it with the far ticket as the subject. Both carry the
    // forward verb, so the two entries cannot come to disagree.
    case "LINKED":
    case "UNLINKED": {
      const verb = to && to in t.links.verb ? t.links.verb[to as TicketLinkKind] : a.unknown;
      const incoming = event.field === "in";
      if (event.type === "LINKED") {
        return incoming ? a.linkedHere(verb, from) : a.linked(verb, from);
      }
      return incoming ? a.unlinkedHere(verb, from) : a.unlinked(verb, from);
    }
    case "CI_CREATED":
      return a.ciCreated;
    case "CI_UPDATED":
      return a.ciUpdated(event.field, from, to);
    case "CI_RELATED":
      return a.ciRelated(event.field, to);
    case "CI_UNRELATED":
      return a.ciUnrelated(event.field, to);
    case "CI_IMPORTED":
      return a.ciImported(to);
    case "CI_ADDED":
      return a.ciAdded(to);
    case "CI_REMOVED":
      return a.ciRemoved(to);
    case "REFERENCED":
      return to ? a.referred(event.field, to) : a.referredHere(event.field, from);
    default:
      return a.changed;
  }
}

/**
 * The sentence, with the thing it names made openable.
 *
 * The label is found inside the finished sentence rather than the sentence
 * being assembled from pieces here: Dutch puts the verb somewhere else, and a
 * sentence built from English-shaped fragments cannot follow it there. If the
 * label is not in the sentence — which would mean the two disagree — the plain
 * text is shown rather than a chip that might be wrong.
 */
export function Sentence({
  event,
  locale,
  dateLocale,
}: {
  event: TimelineEvent;
  locale: string;
  dateLocale?: string;
}): ReactNode {
  const sentence = describe(event, locale, dateLocale ?? locale);
  // A link always names a ticket and keeps its reference in oldValue, because
  // newValue is carrying the kind; a reference puts what it pointed at in
  // whichever of the two is filled in.
  const linkish = event.type === "LINKED" || event.type === "UNLINKED";
  // An asset names itself in `newValue`, and only the entry that added one
  // carries a link — the removal names something no longer on this ticket, and a
  // chip inviting a click would read as if it still were.
  // Both name something openable in `newValue` and carry the link to it. The
  // other CI entries either name nothing (created) or name something that is no
  // longer connected, and a chip inviting a click would read as if it were.
  const assetish = event.type === "CI_ADDED" || event.type === "CI_RELATED";
  const label = linkish ? event.oldValue : (event.newValue ?? event.oldValue);

  if ((event.type !== "REFERENCED" && !linkish && !assetish) || !event.link || !label) {
    return sentence;
  }

  const at = sentence.indexOf(label);
  if (at < 0) return sentence;

  const kind = linkish
    ? "ticket"
    : assetish
      ? "asset"
      : event.field === "project"
        ? "project"
        : event.field === "user"
          ? "user"
          : event.field === "doc"
            ? "doc"
            : event.field === "asset"
              ? "asset"
              : "ticket";

  return (
    <>
      {sentence.slice(0, at)}
      <ReferenceChip href={event.link} label={label} kind={kind} tone="plain" />
      {sentence.slice(at + label.length)}
    </>
  );
}

function priorityName(t: Messages, value: string | null) {
  const known = value && value in t.vocab.priority;
  return known ? t.vocab.priority[value as Priority].toLowerCase() : t.activity.unknown;
}

function typeName(t: Messages, value: string | null) {
  const known = value && value in t.vocab.type;
  return known ? t.vocab.type[value as TicketType].toLowerCase() : t.activity.unknown;
}

/** The glyph an event row carries: what kind of thing changed, at a glance. */
export function EventIcon({ type, size = 11 }: { type: ActivityType; size?: number }) {
  const props = { size, strokeWidth: 2 };
  switch (type) {
    case "CREATED":
      return <Plus {...props} />;
    case "ASSIGNED":
    case "UNASSIGNED":
    case "REPORTER_CHANGED":
      return <UserRound {...props} />;
    case "PRIORITY_CHANGED":
      return <Flag {...props} />;
    case "STATUS_CHANGED":
    case "TYPE_CHANGED":
      return <ArrowRightLeft {...props} />;
    case "PROJECT_CHANGED":
    case "TEAM_CHANGED":
    case "PLAN_APPLIED":
      return <Layers {...props} />;
    case "LABEL_ADDED":
    case "LABEL_REMOVED":
      return <Tag {...props} />;
    case "DUE_DATE_CHANGED":
      return <CalendarClock {...props} />;
    case "FORWARDED":
      return <Forward {...props} />;
    case "MERGED":
      return <GitMerge {...props} />;
    case "STEP_ADDED":
    case "STEP_REMOVED":
    case "STEP_DONE":
    case "STEP_REOPENED":
      return <ListChecks {...props} />;
    case "REFERENCED":
    case "LINKED":
    case "UNLINKED":
      return <Link2 {...props} />;
    case "CI_ADDED":
    case "CI_REMOVED":
    case "CI_CREATED":
    case "CI_IMPORTED":
      return <HardDrive {...props} />;
    case "CI_RELATED":
    case "CI_UNRELATED":
      return <Link2 {...props} />;
    case "CI_UPDATED":
      return <Pencil {...props} />;
    case "COMMENTED":
    case "COMMENT_EDITED":
    case "COMMENT_DELETED":
      return <MessageSquare {...props} />;
    case "ATTACHMENT_REMOVED":
      return <Paperclip {...props} />;
    case "APPROVAL_REQUESTED":
    case "APPROVAL_CANCELLED":
      return <Stamp {...props} />;
    case "APPROVAL_GRANTED":
      return <ThumbsUp {...props} />;
    case "APPROVAL_REFUSED":
      return <ThumbsDown {...props} />;
    default:
      return <Pencil {...props} />;
  }
}

const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** Which day an event belongs to, as a comparable key. */
function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** The keys for today and yesterday. Here rather than in a component body,
 *  where React's purity rule rightly objects to `Date.now()`. */
function recentDayKeys() {
  const now = Date.now();
  return { today: dayKey(new Date(now)), yesterday: dayKey(new Date(now - 86_400_000)) };
}

/**
 * The trail as the rail shows it: what changed, not who changed it.
 *
 * The full feed leads with a face, which is right in a dialog you opened to
 * find out who did something. Four rows in a card answer a different question —
 * what has happened to this ticket lately — so the glyph says what kind of
 * change it was and the name stays inside the sentence.
 */
export function RailActivity({
  events,
  canRemove = false,
  locale = "en-GB",
  dateLocale,
}: {
  events: TimelineEvent[];
  canRemove?: boolean;
  locale?: string;
  dateLocale?: string;
}) {
  const t = messagesFor(locale);
  const time = new Intl.DateTimeFormat(dateLocale ?? locale, TIME);
  const shortDay = new Intl.DateTimeFormat(dateLocale ?? locale, DAY);

  if (events.length === 0) {
    return <p className="text-text-3 px-3.5 py-3 text-base">{t.ticket.nothingChanged}</p>;
  }

  const { today, yesterday } = recentDayKeys();

  return (
    <ol className="px-3.5 pt-1 pb-2.5">
      {events.map((event, index) => {
        // Grouped in place rather than sorted into buckets: the events arrive
        // newest first, so a divider is simply a row whose day is not the
        // previous row's.
        const key = dayKey(event.createdAt);
        const previous = events[index - 1];
        const divider = previous && dayKey(previous.createdAt) === key ? null : key;

        return (
          <li key={event.id}>
            {divider ? (
              <p className="label pt-2 pb-1 text-[10px]">
                {divider === today
                  ? t.ticket.today
                  : divider === yesterday
                    ? t.ticket.yesterday
                    : shortDay.format(event.createdAt)}
              </p>
            ) : null}

            <div className="group/act grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2.5 py-1.5">
              <span className="bg-surface-2 border-line text-text-3 mt-px flex size-[18px] items-center justify-center rounded-full border">
                <EventIcon type={event.type} size={10} />
              </span>
              <span className="text-text-2 min-w-0 text-sm leading-snug">
                <span className="text-text font-semibold">
                  {event.actor ? (
                    <PersonLink id={event.actor.id} name={event.actor.name} />
                  ) : (
                    t.activity.someone
                  )}
                </span>{" "}
                <Sentence event={event} locale={locale} dateLocale={dateLocale} />
              </span>
              {/* The remove control hangs to the left of the time rather than
                  after it: sitting in the flow it reserved its own width even
                  while invisible, and the times then stopped short of the edge
                  the glyphs on the other side are aligned to. */}
              <span className="text-text-3 tnum relative pt-0.5 font-mono text-xs">
                {canRemove ? (
                  <span className="absolute top-1/2 right-full mr-1 flex -translate-y-1/2">
                    <DeleteActivityButton activityId={event.id} />
                  </span>
                ) : null}
                {time.format(event.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The audit trail. No "use client" here on purpose — the card renders on the
 * server and the same component fills the full-history dialog on the client.
 */
export function ActivityFeed({
  events,
  canRemove = false,
  className,
  locale = "en-GB",
  dateLocale,
}: {
  events: TimelineEvent[];
  canRemove?: boolean;
  className?: string;
  locale?: string;
  /// What dates are written in, where the desk has separated that from the
  /// language it speaks. Defaults to the language.
  dateLocale?: string;
}) {
  const dateFormat = new Intl.DateTimeFormat(dateLocale ?? locale, STAMP);
  const t = messagesFor(locale);
  if (events.length === 0) {
    return <p className="text-text-3 text-base">{t.ticket.nothingChanged}</p>;
  }

  return (
    <ol className={`divide-line divide-y ${className ?? ""}`}>
      {events.map((event) => (
        <li
          key={event.id}
          className="group/act text-text-2 grid grid-cols-[20px_minmax(0,1fr)] items-start gap-2.5 py-2 text-sm"
        >
          {/* The face rather than a dot: who did it is half of what happened. */}
          {event.actor ? (
            <Avatar
              name={event.actor.name}
              variant={event.actor.avatarVariant}
              size={20}
              className="mt-px"
            />
          ) : (
            <span className="bg-surface-2 border-line text-text-3 mt-px flex size-5 items-center justify-center rounded-full border">
              <EventIcon type={event.type} />
            </span>
          )}
          <span className="min-w-0 leading-snug">
            <span className="text-text font-semibold">
              {event.actor ? (
                <PersonLink id={event.actor.id} name={event.actor.name} />
              ) : (
                t.activity.someone
              )}
            </span>{" "}
            <Sentence event={event} locale={locale} dateLocale={dateLocale} />
            <span className="text-text-3 mt-0.5 flex items-center gap-2 font-mono text-xs">
              {dateFormat.format(event.createdAt)}
              {canRemove ? <DeleteActivityButton activityId={event.id} /> : null}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
