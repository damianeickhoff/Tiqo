"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import {
  createCannedReply,
  deleteCannedReply,
  moveCannedReply,
  updateCannedReply,
} from "@/lib/actions/canned";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button, Card, FormError, Input, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type CannedReply = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
};

/**
 * The answers the desk sends over and over.
 *
 * Written here in the words they will be sent in — Markdown, the same as a
 * reply — so what an operator picks in the composer is what an operator would
 * have typed. Nothing is substituted into them: a greeting with the wrong name
 * in it is worse than no greeting, and a template language is a feature nobody
 * asked for yet.
 */
export function CannedManager({ replies }: { replies: CannedReply[] }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <div className="space-y-3">
      <FormError>{error ?? undefined}</FormError>

      {replies.length === 0 && !adding ? (
        <p className="border-line text-text-3 rounded-card text-md border border-dashed px-4 py-8 text-center">
          {t.settings.noCannedReplies}
        </p>
      ) : (
        <ul className="space-y-3">
          {replies.map((reply, index) => (
            <li key={reply.id}>
              <ReplyRow
                reply={reply}
                first={index === 0}
                last={index === replies.length - 1}
                pending={pending}
                run={run}
              />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <NewReply pending={pending} run={run} onDone={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <Plus size={15} strokeWidth={2.5} />
          {t.settings.addCannedReply}
        </Button>
      )}
    </div>
  );
}

function ReplyRow({
  reply,
  first,
  last,
  pending,
  run,
}: {
  reply: CannedReply;
  first: boolean;
  last: boolean;
  pending: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const draft = useDraft({ title: reply.title, body: reply.body });
  const { draft: form, set } = draft;

  return (
    <Card className={cn("space-y-3 p-4", !reply.isActive && "opacity-60")}>
      <div className="flex flex-wrap items-start gap-3">
        <label className="block min-w-[12rem] flex-1">
          <span className="label mb-1.5 block">{t.settings.cannedTitle}</span>
          <Input
            value={form.title}
            maxLength={80}
            onChange={(event) => set({ title: event.target.value })}
          />
        </label>

        <span className="flex shrink-0 items-center gap-0.5 pt-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateCannedReply(reply.id, { isActive: !reply.isActive }))}
            title={reply.isActive ? t.forms.hide : t.forms.show}
            aria-label={reply.isActive ? t.forms.hide : t.forms.show}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
          >
            {reply.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(() => moveCannedReply(reply.id, "up"))}
            aria-label={t.common.moveUp(reply.title)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center disabled:opacity-30"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(() => moveCannedReply(reply.id, "down"))}
            aria-label={t.common.moveDown(reply.title)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center disabled:opacity-30"
          >
            <ChevronDown size={15} />
          </button>
          <ConfirmDelete
            title={t.common.deleteThing(reply.title)}
            run={async () => run(() => deleteCannedReply(reply.id))}
          >
            {(ask) => (
              <button
                type="button"
                onClick={ask}
                aria-label={t.common.deleteThing(reply.title)}
                className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-8 items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            )}
          </ConfirmDelete>
        </span>
      </div>

      <label className="block">
        <span className="label mb-1.5 block">{t.settings.cannedBody}</span>
        <Textarea
          value={form.body}
          rows={4}
          onChange={(event) => set({ body: event.target.value })}
        />
      </label>

      <SaveBar
        draft={draft}
        save={(values) => updateCannedReply(reply.id, { title: values.title, body: values.body })}
      />
    </Card>
  );
}

function NewReply({
  pending,
  run,
  onDone,
}: {
  pending: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
  onDone: () => void;
}) {
  const t = useMessages();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <Card className="animate-rise space-y-3 p-4">
      <label className="block">
        <span className="label mb-1.5 block">{t.settings.cannedTitle}</span>
        <Input
          value={title}
          maxLength={80}
          autoFocus
          placeholder={t.settings.cannedTitlePlaceholder}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="block">
        <span className="label mb-1.5 block">{t.settings.cannedBody}</span>
        <Textarea
          value={body}
          rows={4}
          placeholder={t.settings.cannedBodyPlaceholder}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={pending || !title.trim() || !body.trim()}
          onClick={() =>
            run(async () => {
              const result = await createCannedReply(title, body);
              if (result.ok) onDone();
              return result;
            })
          }
        >
          {pending ? t.common.adding : t.common.add}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
    </Card>
  );
}
