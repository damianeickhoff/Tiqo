"use client";

import type { Priority, TicketType } from "@/generated/prisma/enums";
import { updateTicketDefaults } from "@/lib/actions/settings";
import { PRIORITY_ORDER, TYPE_ORDER } from "@/lib/tickets";
import { Select } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";

export function TicketDefaultsForm({
  defaultType,
  defaultPriority,
  defaultProjectId,
  projects,
}: {
  defaultType: TicketType;
  defaultPriority: Priority;
  defaultProjectId: string | null;
  projects: { id: string; name: string }[];
}) {
  const t = useMessages();
  const draft = useDraft({
    defaultType: defaultType as string,
    defaultPriority: defaultPriority as string,
    defaultProjectId: defaultProjectId ?? "",
  });
  const { draft: d, set } = draft;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label mb-1.5 block">{t.ticket.type}</span>
          <Select
            value={d.defaultType}
            onChange={(event) => set({ defaultType: event.target.value })}
          >
            {TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {t.vocab.type[type]}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.ticket.priority}</span>
          <Select
            value={d.defaultPriority}
            onChange={(event) => set({ defaultPriority: event.target.value })}
          >
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {t.vocab.priority[priority]}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.ticket.project}</span>
          <Select
            value={d.defaultProjectId}
            onChange={(event) => set({ defaultProjectId: event.target.value })}
          >
            <option value="">{t.ticket.noProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <SaveBar draft={draft} label={t.settings.defaultsSave} save={updateTicketDefaults} />
    </div>
  );
}
