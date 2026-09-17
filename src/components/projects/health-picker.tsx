"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ProjectHealth } from "@/generated/prisma/enums";
import { updateProject } from "@/lib/actions/projects";
import { HEALTH_META, HEALTH_ORDER } from "@/lib/projects";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * How the project is going, said out loud.
 *
 * Immediate rather than drafted, and deliberately so: this is not a description
 * of the project, it is a statement about it — the same kind of thing as
 * closing a ticket. Someone opens this menu because the answer has changed, and
 * making them press Save afterwards only adds a step to a decision they have
 * already made.
 */
export function HealthPicker({ projectId, health }: { projectId: string; health: ProjectHealth }) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Shown at once, corrected by the server if it refuses: the menu closing on
  // the old value is what makes a status picker feel broken.
  const [shown, setShown] = useState(health);
  const meta = HEALTH_META[shown];

  function pick(next: ProjectHealth) {
    setShown(next);
    setOpen(false);
    startTransition(async () => {
      const result = await updateProject(projectId, { health: next });
      if (!result.ok) setShown(health);
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-line bg-surface hover:border-line-strong flex h-8 items-center gap-2 rounded-full border px-2.5 text-sm font-medium shadow-[var(--highlight)] transition-[border-color,opacity] disabled:opacity-60"
      >
        <span aria-hidden className="size-2 rounded-full" style={{ background: meta.color }} />
        {t.projects.healthNames[shown]}
        <ChevronDown size={13} className="text-text-3" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="animate-rise border-border bg-surface rounded-card absolute right-0 z-50 mt-2 w-56 overflow-hidden border p-1 shadow-[var(--shadow-float)]"
          >
            {HEALTH_ORDER.map((value) => {
              const option = HEALTH_META[value];
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={value === shown}
                  onClick={() => pick(value)}
                  className={cn(
                    "rounded-control flex w-full items-center gap-2 px-2.5 py-2 text-left text-base transition-colors",
                    value === shown ? "bg-surface-2 font-semibold" : "hover:bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: option.color }}
                  />
                  {t.projects.healthNames[value]}
                  {value === shown ? (
                    <Check size={14} className="text-text-3 ml-auto" strokeWidth={2.5} />
                  ) : null}
                </button>
              );
            })}
            <p className="text-text-3 px-2.5 py-2 text-sm leading-snug">{t.projects.healthHint}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
