"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquare, Send, Trash2, X } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { addProjectComment, deleteProjectComment } from "@/lib/actions/projects";
import { Button, FieldError, FormError } from "@/components/ui";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Markdown } from "@/components/markdown";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { EventIcon, Sentence, type TimelineEvent } from "@/components/tickets/activity";
import { DeleteActivityButton } from "@/components/tickets/delete-activity-button";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type ProjectComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarVariant: number };
};

/** One rail carries both, told apart by which shape arrived. */
type Item = ({ kind: "comment" } & ProjectComment) | ({ kind: "event" } & TimelineEvent);

/**
 * The project's own conversation, and everything that happened to it.
 *
 * One rail rather than two, for the same reason a ticket has one: a status move
 * between two messages is part of the story, and reading them apart loses the
 * sequence. It is drawn the way a ticket's thread is drawn, down to the resting
 * row at the foot that opens into a composer — it is the same kind of thing, and
 * two different ways of writing a message in one app is one too many.
 *
 * Not a ticket thread in one respect: there is no internal/public split,
 * because a project has no requester reading over its shoulder.
 */
export function ProjectConversation({
  projectId,
  comments,
  events,
  viewerId,
  viewerName,
  viewerAvatar,
  canModerate,
  canRemoveActivity,
  locale,
}: {
  projectId: string;
  comments: ProjectComment[];
  events: TimelineEvent[];
  viewerId: string;
  viewerName: string;
  viewerAvatar: number;
  canModerate: boolean;
  canRemoveActivity: boolean;
  locale: string;
}) {
  const t = useMessages();
  const post = addProjectComment.bind(null, projectId);
  const [state, formAction] = useActionState(post, undefined);
  const [writing, setWriting] = useState(false);
  const stamp = useDateFormat({
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const errors = state?.errors ?? {};
  const sent = state !== undefined && !state.errors;

  // Held beside the action result it was written against, so a posted comment
  // leaves an empty box and a rejected one keeps every word.
  const [draft, setDraft] = useState<{ from: unknown; text: string }>({
    from: undefined,
    text: "",
  });
  const body = sent && draft.from !== state ? "" : draft.text;

  // A posted comment closes the box again, the way a reply does on a ticket.
  // Adjusted while rendering rather than in an effect: the box closing is not
  // synchronising with anything outside React, it is this component reacting to
  // a new result, and an effect would render it open once before shutting it.
  const [lastResult, setLastResult] = useState(state);
  if (state !== lastResult) {
    setLastResult(state);
    if (state && !state.errors) setWriting(false);
  }

  const items: Item[] = [
    ...comments.map((comment) => ({ kind: "comment" as const, ...comment })),
    ...events.map((event) => ({ kind: "event" as const, ...event })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="label">{t.projects.conversation}</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-text-3 py-6 text-base">{t.projects.noComments}</p>
      ) : (
        <ol>
          {items.map((item) =>
            item.kind === "event" ? (
              <li
                key={item.id}
                className="group/act text-text-2 flex items-center gap-2.5 py-2 text-sm"
              >
                <span className="bg-surface-2 text-text-3 flex size-5 shrink-0 items-center justify-center rounded-full">
                  <EventIcon type={item.type} size={10} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="text-text font-semibold">
                    {item.actor ? (
                      <PersonLink id={item.actor.id} name={item.actor.name} />
                    ) : (
                      t.activity.someone
                    )}
                  </span>{" "}
                  <Sentence event={item} locale={locale} />
                </span>
                <span className="text-text-3 tnum relative shrink-0 font-mono text-xs whitespace-nowrap">
                  {canRemoveActivity ? (
                    <span className="absolute top-1/2 right-full mr-1 flex -translate-y-1/2">
                      <DeleteActivityButton activityId={item.id} />
                    </span>
                  ) : null}
                  {stamp.format(item.createdAt)}
                </span>
              </li>
            ) : (
              <CommentRow
                key={item.id}
                comment={item}
                stamp={stamp}
                canDelete={item.author.id === viewerId || canModerate}
              />
            ),
          )}
        </ol>
      )}

      {/* The resting row floats over the thread until it is clicked, exactly as
          the reply row does on a ticket. */}
      <div className={cn("z-20 scroll-mb-4", writing ? "relative" : "sticky bottom-4")}>
        {writing ? (
          <form action={formAction} className="animate-rise card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="label">{t.projects.conversation}</p>
              <button
                type="button"
                onClick={() => setWriting(false)}
                aria-label={t.common.cancel}
                className="text-text-3 hover:text-text transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <FormError>{errors.form}</FormError>
            <MarkdownEditor
              name="body"
              rows={5}
              autoFocus
              value={body}
              onChange={(text) => setDraft({ from: state, text })}
              placeholder={t.projects.commentPlaceholder}
            />
            <FieldError>{errors.body}</FieldError>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
              <p className="text-text-3 text-sm">
                <span className="hidden sm:inline">
                  {t.ticket.pressKeys}{" "}
                  <kbd className="bg-surface-3 rounded px-1 py-0.5 font-mono text-xs">Alt</kbd>
                  {" + "}
                  <kbd className="bg-surface-3 rounded px-1 py-0.5 font-mono text-xs">
                    Enter
                  </kbd>{" "}
                  {t.ticket.toPost}
                </span>
              </p>
              <Post />
            </div>
          </form>
        ) : (
          <div className="card flex items-center gap-2 py-1.5 pr-1.5 pl-2.5 shadow-[var(--shadow-float)]">
            <Avatar name={viewerName} variant={viewerAvatar} size={24} className="shrink-0" />
            {/* The whole line is the control: click anywhere to start writing. */}
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="text-text-3 hover:text-text-2 h-8 min-w-0 flex-1 truncate text-left text-base transition-colors"
            >
              {t.projects.commentPlaceholder}
            </button>
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="bg-brand rounded-control inline-flex h-8 items-center gap-1.5 px-2.5 text-sm font-semibold text-[var(--brand-ink)] shadow-[0_1px_2px_rgba(9,9,11,0.1)] transition-[background-color] duration-150 hover:bg-[var(--brand-hover)]"
            >
              <MessageSquare size={14} />
              {t.projects.postComment}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One message, as a card beside its author's face — the shape a
 * ticket's comments have, so a person who writes in both places is writing in
 * the same place twice.
 */
function CommentRow({
  comment,
  stamp,
  canDelete,
}: {
  comment: ProjectComment;
  stamp: Intl.DateTimeFormat;
  canDelete: boolean;
}) {
  const t = useMessages();

  return (
    <li className="relative py-3">
      <div className="group/comment flex gap-3">
        <Avatar
          name={comment.author.name}
          variant={comment.author.avatarVariant}
          size={28}
          className="relative z-10 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="card relative px-4 py-3">
            <p className="mb-1 flex flex-wrap items-baseline gap-x-2">
              <PersonLink
                id={comment.author.id}
                name={comment.author.name}
                className="text-md font-semibold"
              />
              <span className="text-text-3 tnum font-mono text-xs">
                {stamp.format(comment.createdAt)}
              </span>
            </p>
            <Markdown text={comment.body} className="text-md leading-relaxed" />

            {canDelete ? (
              <span className="bg-surface rounded-control absolute -top-7 right-3 z-10 flex shrink-0 opacity-0 shadow-[var(--shadow-float)] transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
                <ConfirmDelete
                  title={t.ticket.deleteThisComment}
                  run={async () => void deleteProjectComment(comment.id)}
                >
                  {(ask) => (
                    <button
                      type="button"
                      onClick={ask}
                      title={t.common.delete}
                      aria-label={t.common.delete}
                      className="text-text-2 hover:bg-negative/10 hover:text-negative rounded-control flex size-8 items-center justify-center transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </ConfirmDelete>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function Post() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Send size={14} />
      {pending ? t.ticket.posting : t.projects.postComment}
    </Button>
  );
}
