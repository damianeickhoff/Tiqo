"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { setProjectMember } from "@/lib/actions/projects";
import { Button } from "@/components/ui";
import { TogglePicker } from "@/components/toggle-picker";
import { Avatar } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";

type Person = { id: string; name: string; avatarVariant: number; email?: string };

/**
 * Adding people from the page that lists them.
 *
 * The same control lives on the overview, and both are worth having: the
 * overview is where a project is described, and this is where someone goes when
 * the question is specifically "who is on this".
 */
export function ProjectRoster({
  projectId,
  members,
  roster,
}: {
  projectId: string;
  members: Person[];
  roster: Person[];
}) {
  const t = useMessages();
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-text-3 text-base">{error ?? t.projects.members}</p>
      <Button type="button" variant="outline" disabled={pending} onClick={() => setPicking(true)}>
        <Plus size={15} strokeWidth={2.5} />
        {t.projects.addMembers}
      </Button>

      {picking ? (
        <TogglePicker
          title={t.projects.addMembers}
          description={t.projects.members}
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
          onToggle={(id, next) => run(() => setProjectMember(projectId, id, next))}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
