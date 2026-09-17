"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { updateTicket } from "@/lib/actions/tickets";
import { Button } from "@/components/ui";
import { TogglePicker } from "@/components/toggle-picker";
import { useMessages } from "@/components/shell/instance-context";

export type Candidate = { id: string; reference: string; title: string; inProject: boolean };

/**
 * Filing work into the project from the project's own side.
 *
 * The ticket page can already do this one at a time, but somebody setting a
 * project up is looking at the project and thinking "these six belong to it",
 * not walking the queue opening tickets.
 *
 * Goes through `updateTicket` rather than writing the column directly, so a
 * ticket filed from here gets the same trail entry as one filed from its own
 * page. Immediate, not drafted: filing is a verb on its own.
 */
export function ProjectTicketPicker({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: Candidate[];
}) {
  const t = useMessages();
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
        <Plus size={14} strokeWidth={2.5} />
        {t.projects.addTickets}
      </Button>

      {picking ? (
        <TogglePicker
          title={t.projects.addTickets}
          description={t.projects.addTicketsBlurb}
          items={candidates.map((ticket) => ({
            id: ticket.id,
            label: ticket.reference,
            hint: ticket.title,
          }))}
          selected={new Set(candidates.filter((one) => one.inProject).map((one) => one.id))}
          pending={pending}
          error={error}
          emptyText={t.common.noMatches}
          searchPlaceholder={t.projects.findTicket}
          onToggle={(id, next) =>
            startTransition(async () => {
              const result = await updateTicket(id, { projectId: next ? projectId : null });
              setError(result.ok ? null : result.error);
            })
          }
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}
