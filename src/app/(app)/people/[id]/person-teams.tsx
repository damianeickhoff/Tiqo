"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { setTeamMember } from "@/lib/actions/teams";
import { TogglePicker } from "@/components/toggle-picker";
import { useMessages } from "@/components/shell/instance-context";

type Team = { id: string; name: string; color: string };

/**
 * The desks someone works, changed from their own page rather than from each
 * team in turn — the question "which desks is this person on" is asked here far
 * more often than it is asked of a team.
 */
export function PersonTeams({
  userId,
  name,
  teams,
  all,
  editable,
}: {
  userId: string;
  name: string;
  teams: Team[];
  all: Team[];
  editable: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const selected = new Set(teams.map((team) => team.id));

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {teams.length === 0 ? <span className="text-text-3">{t.common.none}</span> : null}

        {teams.map((team) => (
          <span key={team.id} className="tag">
            {team.name}
          </span>
        ))}

        {editable ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-text-3 hover:bg-surface-3 hover:text-text inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-base font-medium transition-colors"
          >
            <Pencil size={12} />
            {t.people.editTeams}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-negative mt-1.5 text-sm font-medium">{error}</p> : null}

      {picking ? (
        <TogglePicker
          title={t.people.teamsOf(name)}
          description={t.people.teamsBlurb}
          items={all.map((team) => ({
            id: team.id,
            label: team.name,
          }))}
          selected={selected}
          pending={pending}
          error={error}
          emptyText={t.people.noTeamsYet}
          searchPlaceholder={t.people.searchTeams}
          onToggle={(teamId, next) =>
            startTransition(async () => {
              const result = await setTeamMember(teamId, userId, next);
              setError(result.ok ? null : (result.error ?? null));
            })
          }
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}
