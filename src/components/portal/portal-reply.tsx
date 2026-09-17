"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { replyFromPortal } from "@/lib/actions/portal";
import { Button, buttonClass, FieldError, FormError, Textarea } from "@/components/ui";
import {
  AttachButton,
  AttachChips,
  AttachmentsProvider,
  DropZone,
} from "@/components/tickets/file-picker";
import { useMessages } from "@/components/shell/instance-context";

/** Answering the desk. One box and one button — a requester replying to their
 *  own request needs no visibility switch, no assignee and no tags. */
export function PortalReply({ ticketId }: { ticketId: string }) {
  const t = useMessages();
  const reply = replyFromPortal.bind(null, ticketId);
  const [state, formAction] = useActionState(reply, undefined);
  const errors = state?.errors ?? {};
  const sent = state !== undefined && !state.errors;

  // The draft is held beside the action result it was written against: once a
  // send succeeds, that result is new and the box falls back to empty. A
  // rejected send keeps every word of it.
  const [draft, setDraft] = useState<{ from: unknown; text: string }>({
    from: undefined,
    text: "",
  });
  const body = sent && draft.from !== state ? "" : draft.text;
  const setBody = (text: string) => setDraft({ from: state, text });

  return (
    <form action={formAction} className="space-y-3">
      <AttachmentsProvider result={state}>
        <DropZone className="-m-1 space-y-3 p-1">
          {/* The clip sits above the box with the label, the way it sits in the
            desk's own toolbar: attaching is part of writing the reply, not part
            of sending it. */}
          <div className="flex items-center justify-between">
            <p className="label">{t.portal.addReply}</p>
            <AttachButton className={buttonClass("ghost", "sm")} showLabel />
          </div>
          <FormError>{errors.form}</FormError>

          {/* A plain box. The desk writes in Markdown because the desk knows it is
            writing Markdown; a requester answering a question does not, and a
            reply that turns their asterisks into italics is a surprise nobody
            asked for. */}
          <Textarea
            name="body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t.portal.replyPlaceholder}
          />
          <FieldError>{errors.body}</FieldError>
          <FieldError>{errors.files}</FieldError>
          <AttachChips />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Submit />
          </div>
        </DropZone>
      </AttachmentsProvider>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Send size={14} />
      {pending ? t.ticket.posting : t.portal.send}
    </Button>
  );
}
