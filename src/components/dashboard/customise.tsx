"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, LayoutGrid } from "lucide-react";
import { saveDashboard } from "@/lib/actions/dashboard";
import {
  WIDGETS,
  WIDGET_SPAN,
  readWidgets,
  writeWidgets,
  type Placed,
  type WidgetId,
} from "@/lib/dashboard-widgets";
import { Button, buttonClass } from "@/components/ui";
import { Modal } from "@/components/modal";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Which panels someone keeps, and in what order.
 *
 * A draft with a Save, like every other panel that describes something rather
 * than doing something — see CLAUDE.md. The list is the arrangement: what is
 * ticked is shown, and the order of the ticked ones is the order on the page.
 *
 * The order is stored as a string, so it is held here as one too — the draft
 * hook compares values, and an array would compare by identity and never look
 * dirty.
 */
export function CustomiseDashboard({
  chosen,
  names,
}: {
  chosen: Placed[];
  /// The titles the cards themselves use, handed over rather than kept in a
  /// dictionary of their own: a panel that names a widget differently from the
  /// card it toggles is a panel nobody can use with confidence.
  names: Record<WidgetId, string>;
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  // Held as the stored string, because the draft hook compares values and an
  // array would compare by identity and never look dirty. Widths ride along
  // untouched: this panel is about what is shown, not how wide it is.
  const draft = useDraft({ order: writeWidgets(chosen) });

  const current = readWidgets(draft.draft.order);
  const shown = current.map((one) => one.id);
  const set = (next: Placed[]) => draft.set({ order: writeWidgets(next) });

  const toggle = (id: WidgetId) =>
    set(
      shown.includes(id)
        ? current.filter((one) => one.id !== id)
        : [...current, { id, span: WIDGET_SPAN[id] }],
    );

  const move = (id: WidgetId, by: -1 | 1) => {
    const at = shown.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= current.length) return;
    const next = [...current];
    [next[at], next[to]] = [next[to]!, next[at]!];
    set(next);
  };

  // Shown in the arrangement they will appear in, with everything hidden after
  // it — the list doubles as a preview of the page.
  const rows: WidgetId[] = [...shown, ...WIDGETS.filter((id) => !shown.includes(id))];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("outline", "md")}>
        <LayoutGrid size={15} />
        {t.dashboard.customise}
      </button>

      {open ? (
        <Modal
          title={t.dashboard.customiseTitle}
          description={t.dashboard.customiseBlurb}
          onClose={() => setOpen(false)}
        >
          <ul className="divide-border-soft divide-y">
            {rows.map((id) => {
              const on = shown.includes(id);
              const at = shown.indexOf(id);
              return (
                <li key={id} className="flex items-center gap-3 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(id)}
                      className="accent-brand size-4 shrink-0"
                    />
                    <span className={cn("text-md truncate", on ? "font-medium" : "text-text-3")}>
                      {names[id]}
                    </span>
                  </label>

                  {on ? (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Nudge
                        label={t.common.moveUp(names[id])}
                        disabled={at === 0}
                        onClick={() => move(id, -1)}
                        icon={<ArrowUp size={14} />}
                      />
                      <Nudge
                        label={t.common.moveDown(names[id])}
                        disabled={at === current.length - 1}
                        onClick={() => move(id, 1)}
                        icon={<ArrowDown size={14} />}
                      />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 pt-4">
            <SaveBar
              draft={draft}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              save={(values) => saveDashboard(values.order)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => set(WIDGETS.map((id) => ({ id, span: WIDGET_SPAN[id] })))}
            >
              {t.dashboard.showAll}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Nudge({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors disabled:opacity-30"
    >
      {icon}
    </button>
  );
}
