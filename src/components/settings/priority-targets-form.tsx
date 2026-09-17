"use client";

import type { Priority } from "@/generated/prisma/enums";
import { updatePriorityTargets } from "@/lib/actions/settings";
import { PRIORITY_ORDER } from "@/lib/tickets";
import { PriorityBars } from "@/components/tickets/glyphs";
import { Input } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import type { Messages } from "@/lib/i18n";

/** Hours are how the target is stored; days are how people think about the long
 *  ones, so the field says both. */
function inWords(hours: number, t: Messages) {
  if (hours < 24) return t.settings.inHours(hours);
  return t.settings.inDays(Math.round((hours / 24) * 10) / 10);
}

export function PriorityTargetsForm({ targets }: { targets: Record<Priority, number> }) {
  const t = useMessages();
  const draft = useDraft<Record<string, number>>({ ...targets });
  const { draft: d, set } = draft;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIORITY_ORDER.map((priority) => (
          <label key={priority} className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-base font-semibold">
              <PriorityBars priority={priority} title={t.vocab.priority[priority]} />
              {t.vocab.priority[priority]}
            </span>
            <span className="relative block">
              <Input
                type="number"
                min={1}
                max={720}
                value={d[priority]}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  set({ [priority]: Number.isSafeInteger(next) ? next : 0 });
                }}
                aria-label={`${t.vocab.priority[priority]} — ${t.settings.hours}`}
                className="pr-12"
              />
              <span className="text-text-3 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                {t.settings.hours}
              </span>
            </span>
            {/* Reads the draft, so the plain-English line answers the number
                being typed rather than the one that was last saved. */}
            <span className="text-text-3 mt-1 block text-sm">{inWords(d[priority] ?? 0, t)}</span>
          </label>
        ))}
      </div>

      <SaveBar draft={draft} label={t.settings.targetsSave} save={updatePriorityTargets} />
    </div>
  );
}
