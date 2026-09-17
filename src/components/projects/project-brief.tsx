"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { setProjectMember, updateProject } from "@/lib/actions/projects";
import { Button, Input, Select } from "@/components/ui";
import { PanelCard } from "@/components/tickets/panel-card";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { TogglePicker } from "@/components/toggle-picker";
import { Avatar } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";

type Person = { id: string; name: string; avatarVariant: number; email?: string };

/** Dates come out of the database as dates and go back as `YYYY-MM-DD`. */
function asDay(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/**
 * What the project is, in the words of whoever runs it.
 *
 * A draft with a Save, per the rule the rest of the app follows — this is a
 * description of the project, not a command. Membership is the exception: adding
 * someone to a project is its own decision, so it takes effect the moment it is
 * made.
 */
export function ProjectBrief({
  project,
  members,
  roster,
  canEdit,
}: {
  project: {
    id: string;
    name: string;
    startsOn: Date | null;
    dueOn: Date | null;
    isArchived: boolean;
    leadId: string | null;
    /// Named here rather than looked up in the roster: the roster is only
    /// loaded for someone who can change it, and the read-only view still has
    /// to be able to say who runs this.
    lead: { name: string } | null;
  };
  members: Person[];
  roster: Person[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const draft = useDraft({
    name: project.name,
    startsOn: asDay(project.startsOn),
    dueOn: asDay(project.dueOn),
    leadId: project.leadId ?? "",
  });
  const { draft: d, set } = draft;

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  // Everyone can read who runs it and when it is due; changing any of it needs
  // the permission. Without this, someone who cannot save would be handed a
  // form whose Save is refused by the server.
  if (!canEdit) {
    return (
      <PanelCard title={t.projects.details} bodyClassName="space-y-3 p-3.5">
        <Fact label={t.projects.lead} value={project.lead?.name ?? t.projects.noLead} />
        <Fact label={t.projects.starts} value={asDay(project.startsOn) || t.projects.noDates} />
        <Fact label={t.projects.due} value={asDay(project.dueOn) || t.projects.noDates} />

        <div className="border-border-soft border-t pt-3">
          <p className="label mb-2">{t.projects.members}</p>
          {members.length === 0 ? (
            <p className="text-text-3 text-base">{t.projects.noMembers}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {members.map((person) => (
                <li
                  key={person.id}
                  className="border-border flex items-center gap-2 rounded-full border px-2 py-1 text-base"
                >
                  <Avatar name={person.name} variant={person.avatarVariant} size={20} />
                  <span className="font-medium">{person.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard title={t.projects.details} bodyClassName="space-y-4 p-3.5">
      <label className="block">
        <span className="label mb-1.5 block">{t.projects.nameLabel}</span>
        <Input value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label mb-1.5 block">{t.projects.starts}</span>
          <Input
            type="date"
            value={d.startsOn}
            onChange={(e) => set({ startsOn: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{t.projects.due}</span>
          <Input type="date" value={d.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />
        </label>
      </div>

      <label className="block">
        <span className="label mb-1.5 block">{t.projects.lead}</span>
        <Select value={d.leadId} onChange={(e) => set({ leadId: e.target.value })}>
          <option value="">{t.projects.noLead}</option>
          {roster.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </label>

      {/* No bar at all while there is nothing to save: a Save button that is
          always there but almost always disabled teaches people to ignore it. */}
      <SaveBar
        draft={draft}
        hideWhenIdle
        save={(values) =>
          updateProject(project.id, {
            name: values.name,
            startsOn: values.startsOn || null,
            dueOn: values.dueOn || null,
            leadId: values.leadId || null,
          })
        }
      />

      <div className="border-border-soft border-t pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="label">{t.projects.members}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setPicking(true)}
          >
            <Plus size={14} strokeWidth={2.5} />
            {t.projects.addMembers}
          </Button>
        </div>

        {members.length === 0 ? (
          <p className="text-text-3 text-base">{t.projects.noMembers}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {members.map((person) => (
              <li
                key={person.id}
                className="border-border flex items-center gap-2 rounded-full border py-1 pr-1 pl-1.5 text-base"
              >
                <Avatar name={person.name} variant={person.avatarVariant} size={20} />
                <span className="font-medium">{person.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setProjectMember(project.id, person.id, false))}
                  aria-label={t.projects.removeMember(person.name)}
                  className="text-text-3 hover:bg-negative/12 hover:text-negative flex size-6 items-center justify-center rounded-full transition-colors"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="text-negative mt-2 text-sm font-medium">{error}</p> : null}
      </div>

      {picking ? (
        <TogglePicker
          title={t.projects.addMembers}
          description={t.projects.addMembersBlurb(project.name)}
          items={roster.map((person) => ({
            id: person.id,
            label: person.name,
            hint: person.email,
            icon: <Avatar name={person.name} variant={person.avatarVariant} size={22} />,
          }))}
          selected={new Set(members.map((person) => person.id))}
          pending={pending}
          error={error}
          emptyText={t.common.noMatches}
          searchPlaceholder={t.people.search}
          onToggle={(id, next) => run(() => setProjectMember(project.id, id, next))}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </PanelCard>
  );
}

/** One read-only line of the brief: what it is, and what it says. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{label}</span>
      <span className="text-text-2 text-base">{value}</span>
    </div>
  );
}
