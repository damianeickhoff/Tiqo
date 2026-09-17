"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Forward,
  HardDrive,
  History,
  Merge,
  Send,
  Star,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { addComment, updateTicket } from "@/lib/actions/tickets";
import { AttachChips, AttachmentsProvider, DropZone } from "@/components/tickets/file-picker";
import {
  deleteTicket,
  forwardTicket,
  mergeTicket,
  searchMergeTargets,
  toggleStar,
} from "@/lib/actions/ticket-ops";
import { ActivityFeed, type TimelineEvent } from "@/components/tickets/activity";
import { TicketAssetsDialog } from "@/components/cmdb/ticket-assets-dialog";
import type { TicketAsset } from "@/lib/ticket-assets";
import { useLocale, useMessages } from "@/components/shell/instance-context";
import { Button, FieldError, FormError, Input, Textarea } from "@/components/ui";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";

type Composer = "reply" | "note" | null;
type Dialog = "forward" | "merge" | "delete" | "activity" | "assets" | null;

export type ForwardRecipient = {
  id: string;
  name: string;
  email: string;
  avatarVariant: number;
  role: { name: string };
};

/** How far the plan has got, as the toolbar needs it. */
export type PlanProgress = { settled: number; total: number; pct: number };

type Ctx = {
  ticketId: string;
  ticketNumber: number;
  ticketReference: string;
  /// Set when these controls drive one step's conversation rather than the
  /// change's own: a comment written here lands on the step, and the toolbar
  /// stays behind on the ticket page.
  stepId: string | null;
  /// Null on anything that is not a change with a plan, which is what keeps the
  /// plan control off the other two kinds of ticket.
  plan: PlanProgress | null;
  /// Where the Close button sends a ticket, or null if no status is marked for
  /// it — in which case the button has nothing to do and says so.
  closingStatusId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canNote: boolean;
  isClosed: boolean;
  /// Which assets the ticket is about, already carrying what else is open
  /// around them. Behind a toolbar button rather than on the rail — the rail is
  /// full, and this is consulted rather than watched.
  assets: TicketAsset[];
  canEditAssets: boolean;
  viewerName: string;
  viewerAvatar: number;
  composer: Composer;
  openComposer: (mode: Exclude<Composer, null>) => void;
  closeComposer: () => void;
  dialog: Dialog;
  openDialog: (dialog: Exclude<Dialog, null>) => void;
  closeDialog: () => void;
  starred: boolean;
  setStarred: (value: boolean) => void;
  recipients: ForwardRecipient[];
  activities: TimelineEvent[];
  prevNumber: number | null;
  nextNumber: number | null;
};

const TicketCtx = createContext<Ctx | null>(null);

function useTicket() {
  const ctx = useContext(TicketCtx);
  if (!ctx) throw new Error("Ticket action components must be used inside TicketActionsProvider.");
  return ctx;
}

/**
 * The props the toolbar alone needs are optional: a step page mounts this for
 * the composer and the forward dialog, and has no queue to walk or ticket to
 * close.
 */
export function TicketActionsProvider({
  ticketId,
  ticketNumber,
  ticketReference,
  stepId = null,
  plan = null,
  closingStatusId = null,
  canEdit,
  canDelete = false,
  canNote,
  isClosed = false,
  assets = [],
  canEditAssets = false,
  viewerName,
  viewerAvatar,
  starred: initialStarred = false,
  recipients,
  activities = [],
  prevNumber = null,
  nextNumber = null,
  children,
}: {
  ticketId: string;
  ticketNumber: number;
  ticketReference: string;
  stepId?: string | null;
  plan?: PlanProgress | null;
  /// Where the Close button sends a ticket, or null if no status is marked for
  /// it — in which case the button has nothing to do and says so.
  closingStatusId?: string | null;
  canEdit: boolean;
  canDelete?: boolean;
  canNote: boolean;
  isClosed?: boolean;
  assets?: TicketAsset[];
  canEditAssets?: boolean;
  viewerName: string;
  viewerAvatar: number;
  starred?: boolean;
  recipients: ForwardRecipient[];
  activities?: TimelineEvent[];
  prevNumber?: number | null;
  nextNumber?: number | null;
  children: React.ReactNode;
}) {
  const [composer, setComposer] = useState<Composer>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [starred, setStarred] = useState(initialStarred);

  return (
    <TicketCtx.Provider
      value={{
        ticketId,
        ticketNumber,
        ticketReference,
        stepId,
        plan,
        closingStatusId,
        canEdit,
        canDelete,
        canNote,
        isClosed,
        assets,
        canEditAssets,
        viewerName,
        viewerAvatar,
        composer,
        openComposer: (mode) => setComposer(mode),
        closeComposer: () => setComposer(null),
        dialog,
        openDialog: (next) => setDialog(next),
        closeDialog: () => setDialog(null),
        starred,
        setStarred,
        recipients,
        activities,
        prevNumber,
        nextNumber,
      }}
    >
      {children}
      <Dialogs />
    </TicketCtx.Provider>
  );
}

/**
 * The rail's way into the full trail. It opens the same dialog the toolbar
 * does, from a card that is rendered on the server — which is the whole reason
 * this is its own component rather than a button in the card.
 */
export function ActivityAllLink() {
  const t = useTicket();
  const m = useMessages();

  return (
    <button
      type="button"
      onClick={() => t.openDialog("activity")}
      className="text-brand-deep text-xs font-medium transition-colors hover:underline"
    >
      {m.ticket.allOf(t.activities.length)}
    </button>
  );
}

/* --------------------------------------------------------------- toolbar -- */

/** Quiet controls: the row reads as one line of verbs, and only Reply is lit. */
const TOOL =
  "inline-flex h-8 items-center gap-1.5 rounded-control px-2 " +
  "text-sm font-medium text-text-2 " +
  "transition-[background-color,color] duration-150 hover:bg-surface-2 hover:text-text";

/** The right-hand group: the plan, the trail and the way through the queue
 *  are raised, so they read as places to go rather than things to do. */
const TOOL_OUTLINE =
  "inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2 " +
  "text-sm font-medium text-text-2 shadow-[var(--highlight)] " +
  "transition-[border-color,color] duration-150 hover:border-line-strong hover:text-text";

const TOOL_PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-control bg-brand px-2.5 " +
  "text-sm font-semibold text-[var(--brand-ink)] shadow-[0_1px_2px_rgba(9,9,11,0.1)] " +
  "transition-[background-color] duration-150 hover:bg-brand-hover";

const STEP =
  "flex size-8 items-center justify-center rounded-control border border-line bg-surface " +
  "text-text-2 shadow-[var(--highlight)] transition-[border-color,color] " +
  "hover:border-line-strong hover:text-text";

/**
 * The full action row that sits directly under the top bar. Its sticky offset is
 * the bar's own `--bar`, so the two stack flush while scrolling; from lg up the
 * content box is the scrollport and the offset is that box's edge.
 */
export function TicketToolbar() {
  const t = useTicket();
  const m = useMessages();
  const [pending, startTransition] = useTransition();
  /// A refused action has to say so. Closing can now be refused — a settled
  /// ticket needs somebody's name on it — and a button that quietly does
  /// nothing is worse than one that is not there.
  const [refused, setRefused] = useState<string | null>(null);
  /// Shown once and then stood down. The graph knows this ticket is holding
  /// something up; it does not know that the desk has already dealt with it,
  /// so the second press goes through rather than arguing twice.
  const [warned, setWarned] = useState(false);

  function star() {
    startTransition(async () => {
      t.setStarred(!t.starred);
      const result = await toggleStar(t.ticketId);
      if (!result.ok) t.setStarred(t.starred);
    });
  }

  function close() {
    if (!t.closingStatusId) return;
    startTransition(async () => {
      // The warning is the action's now, because the properties card can settle
      // a ticket the same way and a check that lived here would not reach it.
      // The latch stays: what the second press carries is permission to go on.
      const result = await updateTicket(t.ticketId, { statusId: t.closingStatusId }, warned);
      if (!result.ok && "warn" in result) {
        setWarned(true);
        setRefused(result.error);
        return;
      }
      setRefused(result.ok ? null : result.error);
    });
  }

  return (
    <div className="border-line bg-bg/90 sticky top-[var(--bar)] z-30 flex h-[var(--toolbar)] items-center gap-1 border-b px-4 backdrop-blur-md lg:top-0 lg:px-5">
      {refused ? (
        <p
          role="alert"
          className="border-negative/35 bg-negative/[0.07] text-negative rounded-control order-last w-full border px-3 py-2 text-base font-medium"
        >
          {refused}
        </p>
      ) : null}
      <button
        type="button"
        onClick={star}
        disabled={pending}
        aria-pressed={t.starred}
        title={t.starred ? m.ticket.starRemove : m.ticket.starAdd}
        className={cn(
          TOOL,
          "w-7 justify-center px-0",
          t.starred ? "text-brand-deep bg-[var(--brand-tint)]" : "text-text-3 hover:text-text",
        )}
      >
        <Star size={14} strokeWidth={2} />
      </button>

      <button type="button" onClick={() => t.openComposer("reply")} className={TOOL_PRIMARY}>
        <CornerUpLeft size={14} />
        {m.ticket.reply}
      </button>

      {t.canNote ? (
        <button
          type="button"
          onClick={() => t.openComposer("note")}
          className={cn(TOOL, "text-text-2 hover:text-text")}
        >
          <StickyNote size={14} />
          {m.ticket.addNote}
        </button>
      ) : null}

      {t.canEdit ? (
        <button
          type="button"
          onClick={() => t.openDialog("forward")}
          className={cn(TOOL, "text-text-2 hover:text-text")}
        >
          <Forward size={14} />
          {m.ticket.forward}
        </button>
      ) : null}

      {t.canEdit ? (
        <>
          <button
            type="button"
            onClick={close}
            disabled={pending || t.isClosed || !t.closingStatusId}
            className={cn(
              TOOL,
              "text-text-2 hover:text-text disabled:opacity-40 disabled:hover:shadow-[var(--shadow-sm)]",
            )}
            title={t.isClosed ? "This ticket is already closed" : "Close this ticket"}
          >
            <CheckCircle2 size={14} />
            {m.common.close}
          </button>

          <button
            type="button"
            onClick={() => t.openDialog("merge")}
            className={cn(TOOL, "text-text-2 hover:text-text")}
          >
            <Merge size={14} />
            {m.ticket.merge}
          </button>
        </>
      ) : null}

      {t.canDelete ? (
        <button
          type="button"
          onClick={() => t.openDialog("delete")}
          className={cn(TOOL, "text-text-2 hover:border-negative/40 hover:text-negative")}
        >
          <Trash2 size={14} />
          {m.common.delete}
        </button>
      ) : null}

      {/* Right-hand group: the plan, the full history, and a way through the
          queue. */}
      <div className="ml-auto flex items-center gap-1.5">
        <PlanControl />

        {/* A dot rather than a number when something is wrong: the count says
            how many assets, the dot says go and look. */}
        <button type="button" onClick={() => t.openDialog("assets")} className={TOOL_OUTLINE}>
          <HardDrive size={14} />
          {m.cmdb.assetsOnTicket}
          {t.assets.some((asset) => asset.alsoOpen > 0 || asset.nearby) ? (
            <span aria-hidden className="bg-negative size-1.5 rounded-full" />
          ) : (
            <span className="tnum text-text-3 font-mono text-xs">{t.assets.length}</span>
          )}
        </button>

        <button type="button" onClick={() => t.openDialog("activity")} className={TOOL_OUTLINE}>
          <History size={14} />
          {m.ticket.activity}
          <span className="tnum text-text-3 font-mono text-xs">{t.activities.length}</span>
        </button>

        <span aria-hidden className="bg-line mx-0.5 h-4 w-px" />

        {t.prevNumber ? (
          <Link
            href={`/tickets/${t.prevNumber}`}
            className={STEP}
            title={m.ticket.previous(String(t.prevNumber))}
          >
            <ChevronLeft size={15} />
          </Link>
        ) : (
          <span className={cn(STEP, "cursor-not-allowed opacity-30")} aria-hidden>
            <ChevronLeft size={15} />
          </span>
        )}

        {t.nextNumber ? (
          <Link
            href={`/tickets/${t.nextNumber}`}
            className={STEP}
            title={m.ticket.next(String(t.nextNumber))}
          >
            <ChevronRight size={15} />
          </Link>
        ) : (
          <span className={cn(STEP, "cursor-not-allowed opacity-30")} aria-hidden>
            <ChevronRight size={15} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The plan, as one control in the toolbar: how far it has got, and the way in.
 *
 * It sits here rather than in the conversation because a plan is a property of
 * the change, not a message in its thread — a card between the description and
 * the first reply pushed the conversation down the page to say what a ring and
 * two numbers say. The board itself keeps its own page: it is a table of steps,
 * and there is no honest way to fold that into this column.
 */
function PlanControl() {
  const t = useTicket();
  const m = useMessages();
  if (!t.plan) return null;

  const { settled, total, pct } = t.plan;
  const circumference = 2 * Math.PI * 6;

  return (
    <Link href={`/tickets/${t.ticketNumber}/plan`} title={m.plan.openPlan} className={TOOL_OUTLINE}>
      <span
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={m.plan.title}
        className="flex"
      >
        <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" strokeWidth="2.5" />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke={pct === 100 ? "var(--positive)" : "var(--brand)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
          />
        </svg>
      </span>
      {m.plan.title}
      <span className="tnum text-text-3 font-mono text-xs">
        {settled}/{total}
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------- composer -- */

function ComposerSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const m = useMessages();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? m.ticket.posting : label}
      {pending ? null : <Send size={13} strokeWidth={2.2} />}
    </Button>
  );
}

/**
 * The reply box only exists once someone asks for it — the buttons below the
 * conversation are the resting state, which is what keeps a long thread from
 * ending in a permanently empty field.
 */
export function ConversationComposer() {
  const t = useTicket();
  const m = useMessages();
  const [state, formAction] = useActionState(addComment, undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const errors = state?.errors ?? {};

  // The draft, stored beside the action result it was typed against. A new
  // result that carried no errors means it was posted, so what is shown falls
  // back to empty — while a rejected post keeps every word of it.
  const [draft, setDraft] = useState<{ from: unknown; text: string }>({
    from: undefined,
    text: "",
  });
  // Any error at all means it was not posted, so the words stay. Naming the
  // fields instead was how a rejected attachment came to clear the reply that
  // went with it.
  const body = state !== undefined && !state.errors && draft.from !== state ? "" : draft.text;
  const setBody = (text: string) => setDraft({ from: state, text });

  // Opening the composer should bring it into view; a reply control at the far
  // end of a long thread is otherwise easy to miss.
  //
  // Not smooth, and not by choice: a smooth scrollIntoView is silently dropped
  // inside a nested scroll container in some engines — the composer then keeps
  // whatever position autoFocus happened to leave, which is a couple of hundred
  // pixels short of the bottom. Landing in the right place beats gliding to the
  // wrong one, and the composer has its own entrance animation either way.
  useEffect(() => {
    if (t.composer) {
      containerRef.current?.scrollIntoView({ block: "end" });
    }
  }, [t.composer]);

  // A posted comment closes the box again.
  const posted = state && !state.errors;
  useEffect(() => {
    if (posted) t.closeComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posted]);

  const isNote = t.composer === "note";

  return (
    // The sticky box has to be the conversation column's last child: a wrapper
    // sized to the bar would be its own containing block, leaving sticky no room
    // to lift it into view. Only the resting bar floats — an open composer is
    // tall enough that pinning it would cover the thread it replies to.
    <div
      ref={containerRef}
      className={cn("z-20 scroll-mb-4", t.composer ? "relative" : "sticky bottom-4")}
    >
      {t.composer ? (
        <form
          action={formAction}
          className={cn(
            "animate-rise card space-y-3 p-4",
            isNote && "border-dashed bg-[var(--brand-tint)]",
          )}
          style={
            isNote
              ? { borderColor: "color-mix(in oklab, var(--brand) 55%, transparent)" }
              : undefined
          }
        >
          <input type="hidden" name="ticketId" value={t.ticketId} />
          {t.stepId ? <input type="hidden" name="stepId" value={t.stepId} /> : null}
          {isNote ? <input type="hidden" name="isInternal" value="on" /> : null}

          <AttachmentsProvider>
            <DropZone className="-m-1 space-y-3 p-1">
              <div className="flex items-center justify-between">
                <p className="label">{isNote ? m.ticket.internalNote : m.ticket.reply}</p>
                <button
                  type="button"
                  onClick={t.closeComposer}
                  aria-label={m.common.cancel}
                  className="text-text-3 hover:text-text transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <MarkdownEditor
                name="body"
                rows={5}
                autoFocus
                value={body}
                onChange={setBody}
                placeholder={isNote ? m.ticket.notePlaceholder : m.ticket.replyPlaceholder}
              />
              <FieldError>{errors.body}</FieldError>
              <FieldError>{errors.files}</FieldError>
              <FormError>{errors.form}</FormError>

              {/* Said once, where the files would land. The composer takes a
                  pasted or dropped screenshot exactly as the new-ticket form
                  does, and a capability nobody is told about is one nobody
                  uses — but it goes under the box rather than beside the
                  Post button, where it would compete with the verb. */}
              <AttachChips />
              <p className="text-text-3 text-sm">{m.ticket.attachHint}</p>

              <div className="border-border-soft flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
                <p className="text-text-3 text-sm">
                  {isNote ? m.ticket.noteHint : m.ticket.replyHint}
                  <span className="ml-1.5 hidden sm:inline">
                    {m.ticket.pressKeys}{" "}
                    <kbd className="border-border bg-surface-3 rounded border px-1 py-0.5 font-mono text-xs">
                      Alt
                    </kbd>
                    {" + "}
                    <kbd className="border-border bg-surface-3 rounded border px-1 py-0.5 font-mono text-xs">
                      Enter
                    </kbd>{" "}
                    {m.ticket.toPost}
                  </span>
                </p>
                <ComposerSubmit label={isNote ? m.ticket.addNote : m.ticket.postReply} />
              </div>
            </DropZone>
          </AttachmentsProvider>
        </form>
      ) : (
        <ConversationActions />
      )}
    </div>
  );
}

/**
 * The resting row at the foot of the conversation, led by whoever is about to
 * write. It floats over the thread — the shadow and the slightly opaque surface
 * are what say it is above the content rather than part of it.
 */
function ConversationActions() {
  const t = useTicket();
  const m = useMessages();

  return (
    <div className="card flex items-center gap-2 py-1.5 pr-1.5 pl-2.5 shadow-[var(--shadow-float)]">
      <Avatar name={t.viewerName} variant={t.viewerAvatar} size={24} className="shrink-0" />

      {/* The whole line is the reply control: click anywhere to start writing. */}
      <button
        type="button"
        onClick={() => t.openComposer("reply")}
        className="text-text-3 hover:text-text-2 h-8 min-w-0 flex-1 truncate text-left text-base transition-colors"
      >
        {m.ticket.replyPlaceholder}
      </button>

      <button type="button" onClick={() => t.openComposer("reply")} className={TOOL_PRIMARY}>
        <CornerUpLeft size={14} />
        {m.ticket.reply}
      </button>

      {t.canNote ? (
        <button
          type="button"
          onClick={() => t.openComposer("note")}
          className={cn(TOOL, "text-text-2 hover:text-text")}
        >
          <StickyNote size={14} />
          {m.ticket.addNote}
        </button>
      ) : null}

      {t.canEdit ? (
        <button
          type="button"
          onClick={() => t.openDialog("forward")}
          className={cn(TOOL, "text-text-2 hover:text-text")}
        >
          <Forward size={14} />
          {m.ticket.forward}
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- dialogs -- */

function Dialogs() {
  const t = useTicket();
  if (!t.dialog) return null;

  if (t.dialog === "forward") return <ForwardDialog />;
  if (t.dialog === "merge") return <MergeDialog />;
  if (t.dialog === "activity") return <ActivityDialog />;
  if (t.dialog === "assets") {
    return (
      <TicketAssetsDialog
        ticketId={t.ticketId}
        assets={t.assets}
        canEdit={t.canEditAssets}
        onClose={t.closeDialog}
      />
    );
  }
  return <DeleteDialog />;
}

function ActivityDialog() {
  const t = useTicket();
  const m = useMessages();
  const locale = useLocale();

  return (
    <Modal
      title={m.ticket.activityOn(t.ticketReference)}
      description={m.ticket.activityCount(t.activities.length)}
      onClose={t.closeDialog}
    >
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        <ActivityFeed events={t.activities} canRemove={t.canDelete} locale={locale} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="button" variant="outline" onClick={t.closeDialog}>
          {m.common.done}
        </Button>
      </div>
    </Modal>
  );
}

function ForwardSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Forwarding…" : "Forward ticket"}
    </Button>
  );
}

function ForwardDialog() {
  const t = useTicket();
  const m = useMessages();
  const [state, formAction] = useActionState(forwardTicket, undefined);
  const [selected, setSelected] = useState<string>(t.recipients[0]?.id ?? "");
  const errors = state?.errors ?? {};

  const done = state && !state.errors;
  useEffect(() => {
    if (done) t.closeDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <Modal
      title={m.ticket.forwardTitle(t.ticketReference)}
      description={m.ticket.forwardBlurb}
      onClose={t.closeDialog}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="ticketId" value={t.ticketId} />
        <input type="hidden" name="toUserId" value={selected} />
        <FormError>{errors.form}</FormError>

        <div className="space-y-2">
          <p className="label">{m.ticket.forwardTo}</p>
          {t.recipients.length === 0 ? (
            <p className="bg-surface-3 text-text-2 rounded-control px-3 py-2 text-base">
              {m.ticket.nobodyElse}
            </p>
          ) : (
            <div className="border-border rounded-card max-h-56 space-y-1 overflow-y-auto border p-1">
              {t.recipients.map((person) => {
                const on = selected === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setSelected(person.id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors",
                      on ? "bg-[var(--brand-tint)]" : "hover:bg-surface-2",
                    )}
                  >
                    <Avatar name={person.name} variant={person.avatarVariant} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="text-md block truncate font-semibold">{person.name}</span>
                      <span className="text-text-3 block truncate font-mono text-xs">
                        {person.email}
                      </span>
                    </span>
                    <span className="text-text-3 shrink-0 text-xs capitalize">
                      {person.role.name.toLowerCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <FieldError>{errors.toUserId}</FieldError>
        </div>

        <div className="space-y-2">
          <label className="label block" htmlFor="forward-message">
            {m.ticket.message}
          </label>
          <Textarea
            id="forward-message"
            name="message"
            rows={3}
            placeholder={m.ticket.forwardPlaceholder}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={t.closeDialog}>
            {m.common.cancel}
          </Button>
          <ForwardSubmit />
        </div>
      </form>
    </Modal>
  );
}

function MergeSubmit({ disabled }: { disabled: boolean }) {
  const m = useMessages();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? m.ticket.merging : m.ticket.mergeTicket}
    </Button>
  );
}

function MergeDialog() {
  const t = useTicket();
  const m = useMessages();
  const [state, formAction] = useActionState(mergeTicket, undefined);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { number: number; reference: string; title: string; status: { name: string } | null }[]
  >([]);
  const [chosen, setChosen] = useState<{ number: number; reference: string; title: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errors = state?.errors ?? {};

  // Suggestions are fetched from the change handler on a short debounce rather
  // than from an effect, so each keystroke does not queue a round trip.
  function search(next: string) {
    setQuery(next);
    setChosen(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setResults(await searchMergeTargets(t.ticketId, next));
    }, 180);
  }

  // Prime the list with recent tickets the moment the dialog opens.
  useEffect(() => {
    let live = true;
    searchMergeTargets(t.ticketId, "").then((initial) => {
      if (live) setResults(initial);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [t.ticketId]);

  return (
    <Modal
      title={m.ticket.mergeTitle(t.ticketReference)}
      description={m.ticket.mergeBlurb}
      onClose={t.closeDialog}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="ticketId" value={t.ticketId} />
        <input type="hidden" name="targetNumber" value={chosen?.number ?? ""} />
        <FormError>{errors.form}</FormError>

        <div className="space-y-2">
          <label className="label block" htmlFor="merge-search">
            {m.ticket.mergeIntoLabel}
          </label>
          <Input
            id="merge-search"
            autoFocus
            value={chosen ? `${chosen.reference} · ${chosen.title}` : query}
            onChange={(event) => search(event.target.value)}
            placeholder={m.ticket.mergeSearch}
            aria-invalid={Boolean(errors.targetNumber)}
          />
          <FieldError>{errors.targetNumber}</FieldError>
        </div>

        {chosen ? (
          <p className="rounded-control flex items-center justify-between gap-3 bg-[var(--brand-tint)] px-3 py-2 text-base">
            <span className="min-w-0 truncate">
              {m.ticket.mergingInto}{" "}
              <span className="font-mono font-semibold">{chosen.reference}</span>
            </span>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="text-text-3 hover:text-text shrink-0"
            >
              {m.ticket.change}
            </button>
          </p>
        ) : (
          <div className="border-border rounded-card max-h-56 space-y-1 overflow-y-auto border p-1">
            {results.length === 0 ? (
              <p className="text-text-3 px-2.5 py-3 text-base">{m.ticket.noMatchingTicket}</p>
            ) : (
              results.map((result) => (
                <button
                  key={result.number}
                  type="button"
                  onClick={() =>
                    setChosen({
                      number: result.number,
                      reference: result.reference,
                      title: result.title,
                    })
                  }
                  className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors"
                >
                  <span className="bg-surface-3 text-text-2 rounded-control shrink-0 px-1.5 py-0.5 font-mono text-xs font-medium">
                    {result.reference}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base">{result.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={t.closeDialog}>
            {m.common.cancel}
          </Button>
          <MergeSubmit disabled={!chosen} />
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog() {
  const t = useTicket();
  const m = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    startTransition(async () => {
      const result = await deleteTicket(t.ticketId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/tickets");
    });
  }

  return (
    <Modal
      title={m.ticket.deleteTitle(t.ticketReference)}
      description={m.ticket.deleteBlurb}
      onClose={t.closeDialog}
    >
      <div className="space-y-4">
        <FormError>{error ?? undefined}</FormError>

        <p className="text-text-2 text-md">{m.ticket.noUndo}</p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={t.closeDialog}>
            {m.common.cancel}
          </Button>
          <Button type="button" variant="danger" onClick={confirm} disabled={pending}>
            {pending ? m.ticket.deleting : m.ticket.deletePermanently}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
