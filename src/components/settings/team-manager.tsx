"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { createTeam, deleteTeam, setTeamMember, updateTeam } from "@/lib/actions/teams";
import { Avatar } from "@/components/avatar";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { TogglePicker } from "@/components/toggle-picker";
import { useMessages } from "@/components/shell/instance-context";

type Person = { id: string; name: string; avatarVariant: number };
type Team = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  members: Person[];
  tickets: number;
};

export function TeamManager({ teams, staff }: { teams: Team[]; staff: Person[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createTeam, undefined);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-5">
      {teams.length === 0 ? (
        <p className="border-border text-text-3 rounded-card text-md border border-dashed px-4 py-8 text-center">
          {t.settings.noTeams}
        </p>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} staff={staff} />
          ))}
        </ul>
      )}

      <form action={formAction} className="border-border-soft space-y-3 border-t pt-4">
        <FormError>{errors.form}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.newTeam}</span>
            <Input name="name" placeholder={t.settings.name} maxLength={40} className="w-44" />
          </label>
          <label className="block flex-1">
            <span className="label mb-1.5 block">{t.settings.whatItCovers}</span>
            <Input name="description" maxLength={120} placeholder={t.common.optional} />
          </label>
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.colour}</span>
            <input
              type="color"
              name="color"
              defaultValue="#febe2e"
              aria-label={t.settings.colour}
              className="border-border bg-surface rounded-control h-11 w-12 cursor-pointer border p-1"
            />
          </label>
          <AddButton />
        </div>

        <FieldError>{errors.name}</FieldError>
      </form>
    </div>
  );
}

function TeamCard({ team, staff }: { team: Team; staff: Person[] }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [color, setColor] = useState(team.color);

  const memberIds = new Set(team.members.map((member) => member.id));

  // Someone put on a desk from their own page keeps their row here even if
  // their role has since stopped working tickets — a member nobody can see is
  // a member nobody can take off.
  const candidates = [
    ...staff,
    ...team.members.filter((member) => !staff.some((person) => person.id === member.id)),
  ];

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <li className="border-border rounded-card overflow-hidden border">
      <div className="bg-surface-2 flex flex-wrap items-center gap-3 px-4 py-3">
        {editing ? (
          <span className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label={t.settings.colour}
              className="border-border bg-surface rounded-control h-9 w-10 shrink-0 cursor-pointer border p-1"
            />
            <Input
              value={name}
              autoFocus
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-40"
              aria-label={t.settings.name}
            />
            <Input
              value={description}
              maxLength={120}
              placeholder={t.settings.whatItCovers}
              onChange={(event) => setDescription(event.target.value)}
              className="h-9 min-w-[12rem] flex-1"
              aria-label={t.settings.whatItCovers}
            />
            <button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() =>
                run(async () => {
                  const result = await updateTeam(team.id, { name, description, color });
                  if (result.ok) setEditing(false);
                  return result;
                })
              }
              aria-label={t.common.save}
              className="bg-brand rounded-control flex size-8 items-center justify-center text-[var(--brand-ink)] disabled:opacity-40"
            >
              <Check size={15} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label={t.common.cancel}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
            >
              <X size={15} />
            </button>
          </span>
        ) : (
          <>
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ background: team.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="text-md block font-semibold">{team.name}</span>
              {team.description ? (
                <span className="text-text-3 mt-0.5 block text-sm">{team.description}</span>
              ) : null}
            </span>

            <span className="flex shrink-0 -space-x-1.5">
              {team.members.slice(0, 5).map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  variant={member.avatarVariant}
                  size={24}
                  className="ring-2 ring-[var(--surface-2)]"
                />
              ))}
            </span>

            <span className="tnum text-text-3 shrink-0 text-base">
              {t.settings.ticketCount(team.tickets)}
            </span>

            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t.common.renameThing(team.name)}
                className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors"
              >
                <Pencil size={14} />
              </button>
              <ConfirmDelete
                title={t.common.deleteThing(team.name)}
                // What it costs is already written for the tooltip: a group
                // carrying tickets leaves them unrouted.
                blurb={team.tickets > 0 ? t.settings.unroutedWarning(team.tickets) : undefined}
                run={async () => run(() => deleteTeam(team.id))}
              >
                {(ask) => (
                  <button
                    type="button"
                    onClick={ask}
                    aria-label={t.common.deleteThing(team.name)}
                    title={
                      team.tickets > 0
                        ? t.settings.unroutedWarning(team.tickets)
                        : t.settings.deleteThisTeam
                    }
                    className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 items-center justify-center transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </ConfirmDelete>
            </span>

            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control shrink-0 px-2 py-1 text-base font-medium"
            >
              {t.settings.members}
            </button>
          </>
        )}
      </div>

      {error ? (
        <p className="border-border-soft bg-negative/[0.06] text-negative border-t px-4 py-2 text-sm font-medium">
          {error}
        </p>
      ) : null}

      {picking ? (
        <TogglePicker
          title={t.settings.membersOf(team.name)}
          description={t.settings.membersBlurb}
          items={candidates.map((person) => ({
            id: person.id,
            label: person.name,
            icon: <Avatar name={person.name} variant={person.avatarVariant} size={26} />,
          }))}
          selected={memberIds}
          pending={pending}
          error={error}
          emptyText={t.settings.noStaff}
          searchPlaceholder={t.settings.searchPeople}
          onToggle={(personId, next) => run(() => setTeamMember(team.id, personId, next))}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </li>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.settings.addTeam}
    </Button>
  );
}
