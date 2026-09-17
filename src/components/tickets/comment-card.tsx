"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  CornerUpLeft,
  Lock,
  Pencil,
  PencilLine,
  Pin,
  PinOff,
  SmilePlus,
  X,
  ShieldCheck,
} from "lucide-react";
import { addComment, toggleCommentPin, toggleReaction, updateComment } from "@/lib/actions/tickets";
import { DeleteCommentButton } from "@/components/tickets/delete-comment-button";
import { AttachmentList, type AttachmentRow } from "@/components/tickets/attachment-list";
import { AttachmentsProvider, DropZone } from "@/components/tickets/file-picker";
import { Button, FieldError, FormError } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { cn } from "@/lib/utils";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";

/** A small, fixed set beats a full picker: these cover what a queue needs. */
const EMOJI = ["👍", "🎉", "👀", "🙏", "❤️", "😄"] as const;

export type CommentReaction = { emoji: string; count: number; mine: boolean };

export type CommentNode = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  editedAt: Date | null;
  pinnedAt: Date | null;
  author: { id: string; name: string; avatarVariant: number; isMaster: boolean };
  reactions: CommentReaction[];
  attachments: AttachmentRow[];
  replies: CommentNode[];
};

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

export function CommentCard({
  comment,
  ticketId,
  currentUserId,
  isAdmin,
  depth = 0,
  requesterFirstName,
}: {
  comment: CommentNode;
  ticketId: string;
  currentUserId: string;
  isAdmin: boolean;
  depth?: number;
  /// Named on an internal note, so nobody has to wonder who cannot see it.
  requesterFirstName?: string;
}) {
  const dateFormat = useDateFormat(STAMP);
  const t = useMessages();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pinning, startPinning] = useTransition();

  const mine = comment.author.id === currentUserId;
  const canEdit = mine || isAdmin;

  return (
    <li
      id={`comment-${comment.id}`}
      className={cn("relative scroll-mt-24 py-3", depth > 0 && "ml-6 sm:ml-10")}
    >
      {/* The hover scope is this comment's own body, not the whole item: a
          named group is a descendant selector, so with it on the <li> every
          reply nested inside would light up its toolbar too. */}
      <div className="group/comment flex gap-3">
        <Avatar
          name={comment.author.name}
          variant={comment.author.avatarVariant}
          size={depth > 0 ? 24 : 28}
          className="relative z-10 shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-2">
          {/* A reply is flat on the page; an internal note is a washed block
              with an amber edge, so the two can never be mistaken. */}
          <div
            className={cn(
              "rounded-card relative border px-4 py-3",
              comment.isInternal ? "" : "bg-surface border-transparent shadow-[var(--highlight)]",
              comment.pinnedAt && "ring-brand/40 ring-2 ring-offset-2 ring-offset-[var(--surface)]",
            )}
            style={
              comment.isInternal
                ? {
                    background: "var(--brand-wash)",
                    borderColor: "color-mix(in oklab, var(--brand) 32%, transparent)",
                  }
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <PersonLink
                id={comment.author.id}
                name={comment.author.name}
                className="text-base font-semibold"
              />
              {comment.author.isMaster ? (
                <span
                  className="text-brand-deep inline-flex items-center gap-1 rounded-full bg-[var(--brand-tint)] px-1.5 py-0.5 text-xs font-semibold"
                  title={t.ticket.adminWrote}
                >
                  <ShieldCheck size={10} strokeWidth={2.5} />
                  {t.ticket.admin}
                </span>
              ) : null}
              {comment.editedAt ? (
                <span
                  className="bg-surface-2 text-text-3 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
                  title={t.ticket.editedOn(dateFormat.format(comment.editedAt))}
                >
                  <PencilLine size={9} />
                  {t.ticket.edited}
                </span>
              ) : null}
              {comment.isInternal ? (
                <span className="text-brand-deep inline-flex items-center gap-1 text-xs font-semibold">
                  <Lock size={10} strokeWidth={2.5} />
                  {requesterFirstName
                    ? t.ticket.hiddenFrom(requesterFirstName)
                    : t.ticket.internalNote}
                </span>
              ) : null}
              {comment.pinnedAt ? (
                <span className="text-brand-deep inline-flex items-center gap-1 rounded-full bg-[var(--brand-tint)] px-1.5 py-0.5 text-xs font-semibold">
                  <Pin size={9} strokeWidth={2.5} />
                  {t.ticket.pinned}
                </span>
              ) : null}

              {/* When it was said, in the corner: the rest of the row is about
                  who wrote it, and the clock belongs at the edge. */}
              <span className="text-text-3 ml-auto shrink-0 font-mono text-xs">
                {dateFormat.format(comment.createdAt)}
              </span>

              {/* Every action on a comment lives in one segmented control in
                  the corner, revealed on hover — present when wanted, invisible
                  while reading. */}
              {editing ? null : (
                <span className="bg-surface rounded-control absolute -top-7 right-3 z-10 flex shrink-0 overflow-visible opacity-0 shadow-[var(--shadow-float)] transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((open) => !open)}
                    title={t.ticket.addReaction}
                    aria-label={t.ticket.addReaction}
                    aria-expanded={pickerOpen}
                    className="text-text-2 hover:bg-surface-3 hover:text-text rounded-l-control flex size-8 items-center justify-center transition-colors"
                  >
                    <SmilePlus size={15} />
                  </button>

                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={pinning}
                      onClick={() => startPinning(() => void toggleCommentPin(comment.id))}
                      title={comment.pinnedAt ? t.ticket.unpin : t.ticket.pin}
                      aria-label={comment.pinnedAt ? t.ticket.unpin : t.ticket.pin}
                      aria-pressed={Boolean(comment.pinnedAt)}
                      className={cn(
                        "border-border hover:bg-surface-3 hover:text-text flex size-8 items-center justify-center border-l transition-colors",
                        comment.pinnedAt ? "text-brand-deep bg-[var(--brand-tint)]" : "text-text-2",
                      )}
                    >
                      {comment.pinnedAt ? <PinOff size={15} /> : <Pin size={15} />}
                    </button>
                  ) : null}

                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      title={t.ticket.editComment}
                      aria-label={t.ticket.editComment}
                      className="border-border text-text-2 hover:bg-surface-3 hover:text-text flex size-8 items-center justify-center border-l transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setReplying(true)}
                    title={t.ticket.replyToComment}
                    aria-label={t.ticket.replyToComment}
                    className="border-border text-text-2 hover:bg-surface-3 hover:text-text rounded-r-control flex size-8 items-center justify-center border-l transition-colors"
                  >
                    <CornerUpLeft size={15} />
                  </button>

                  {pickerOpen ? (
                    <>
                      <button
                        type="button"
                        aria-hidden
                        tabIndex={-1}
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setPickerOpen(false)}
                      />
                      <EmojiPicker commentId={comment.id} onPicked={() => setPickerOpen(false)} />
                    </>
                  ) : null}
                </span>
              )}
            </div>

            {editing ? (
              <EditForm
                commentId={comment.id}
                initial={comment.body}
                canDelete={canEdit}
                onDone={() => setEditing(false)}
              />
            ) : (
              <Markdown
                text={comment.body}
                className="text-text-2 text-md mt-1.5 leading-relaxed"
              />
            )}

            {!editing ? (
              <AttachmentList
                attachments={comment.attachments}
                viewerId={currentUserId}
                canModerate={isAdmin}
                body={comment.body}
              />
            ) : null}

            {/* The footer only exists once there is something to show in it —
                every control now lives in the corner. */}
            {!editing && comment.reactions.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {comment.reactions.map((reaction) => (
                  <ReactionPill key={reaction.emoji} commentId={comment.id} reaction={reaction} />
                ))}
              </div>
            ) : null}
          </div>

          {replying ? (
            <ReplyForm
              ticketId={ticketId}
              parentId={comment.id}
              onDone={() => setReplying(false)}
            />
          ) : null}
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <ol className="mt-1">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              ticketId={ticketId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              depth={depth + 1}
              requesterFirstName={requesterFirstName}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------- reactions -- */

function ReactionPill({ commentId, reaction }: { commentId: string; reaction: CommentReaction }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={reaction.mine}
      onClick={() => startTransition(() => void toggleReaction(commentId, reaction.emoji))}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-base transition-colors",
        reaction.mine
          ? "border-brand text-brand-deep bg-[var(--brand-tint)] font-semibold"
          : "text-text-2 hover:text-text border-transparent shadow-[var(--highlight)]",
      )}
      title={reaction.mine ? t.ticket.removeReaction : t.ticket.addThisReaction}
    >
      <span aria-hidden>{reaction.emoji}</span>
      <span className="tnum">{reaction.count}</span>
    </button>
  );
}

/** Anchored under the corner control, right-aligned so it never runs off the
 *  edge of a narrow comment. */
function EmojiPicker({ commentId, onPicked }: { commentId: string; onPicked: () => void }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  return (
    <div className="animate-rise bg-surface absolute top-full right-0 z-40 mt-1.5 flex gap-0.5 rounded-full p-1 shadow-[var(--shadow-float)]">
      {EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={pending}
          aria-label={t.ticket.reactWith(emoji)}
          onClick={() => {
            startTransition(() => void toggleReaction(commentId, emoji));
            onPicked();
          }}
          className="hover:bg-surface-3 text-md grid size-7 place-items-center rounded-full transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- edit/reply -- */

function EditForm({
  commentId,
  initial,
  canDelete,
  onDone,
}: {
  commentId: string;
  initial: string;
  canDelete: boolean;
  onDone: () => void;
}) {
  const t = useMessages();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateComment(commentId, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      onDone();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <MarkdownEditor
        autoFocus
        rows={4}
        value={draft}
        onChange={setDraft}
        placeholder={t.ticket.editingComment}
      />
      {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <span className="text-text-3 text-sm">{t.ticket.saveShortcut}</span>

        {/* Delete sits here rather than in the footer: it belongs with the
            other decisions about this comment, not next to the reactions. */}
        {canDelete ? (
          <span className="ml-auto">
            <DeleteCommentButton commentId={commentId} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ReplySubmit() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? t.ticket.posting : t.ticket.postReply}
    </Button>
  );
}

function ReplyForm({
  ticketId,
  parentId,
  onDone,
}: {
  ticketId: string;
  parentId: string;
  onDone: () => void;
}) {
  const t = useMessages();
  const [state, formAction] = useActionState(addComment, undefined);
  const [reply, setReply] = useState("");
  const errors = state?.errors ?? {};

  const posted = state && !state.errors;
  useEffect(() => {
    if (posted) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posted]);

  return (
    <form action={formAction} className="animate-rise card space-y-2.5 p-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="parentId" value={parentId} />

      <AttachmentsProvider>
        <DropZone className="-m-1 space-y-2.5 p-1">
          <MarkdownEditor
            name="body"
            rows={3}
            autoFocus
            value={reply}
            onChange={setReply}
            placeholder={t.ticket.writeReply}
          />
          <FieldError>{errors.body}</FieldError>
          <FieldError>{errors.files}</FieldError>
          <FormError>{errors.form}</FormError>

          <div className="border-border-soft flex flex-wrap items-center gap-2 border-t pt-2.5">
            <ReplySubmit />
            <Button type="button" size="sm" variant="ghost" onClick={onDone}>
              <X size={13} />
              {t.common.cancel}
            </Button>
          </div>
        </DropZone>
      </AttachmentsProvider>
    </form>
  );
}
