"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { changeReporter } from "@/lib/actions/ticket-ops";
import { Button, FormError } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

export type PickableUser = {
  id: string;
  name: string;
  email: string;
  avatarVariant: number;
  role: { name: string };
};

/**
 * Changing the requester re-points who the ticket is about — and therefore who
 * can see it — so the control is an explicit dialog rather than an inline
 * select that could be nudged by accident.
 */
export function RequesterPicker({
  ticketId,
  currentId,
  people,
}: {
  ticketId: string;
  currentId: string;
  people: PickableUser[];
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await changeReporter(ticketId, selected);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected(currentId);
          setError(null);
          setOpen(true);
        }}
        aria-label={t.ticket.changeRequester}
        title={t.ticket.changeRequester}
        className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
      >
        <Pencil size={13} />
      </button>

      {open ? (
        <Modal
          title={t.ticket.changeRequester}
          description="Pick the person this ticket is actually about."
          onClose={() => setOpen(false)}
        >
          <div className="space-y-4">
            <FormError>{error ?? undefined}</FormError>

            <div className="border-border rounded-card max-h-64 space-y-1 overflow-y-auto border p-1">
              {people.map((person) => {
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
                      <span className="text-md block truncate font-semibold">
                        {person.name}
                        {person.id === currentId ? (
                          <span className="text-text-3 ml-1.5 text-xs font-normal">current</span>
                        ) : null}
                      </span>
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="button" onClick={save} disabled={pending || selected === currentId}>
                {pending ? "Saving…" : "Change requester"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
