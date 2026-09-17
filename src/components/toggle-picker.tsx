"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

export type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
};

/**
 * A dialog for turning a handful of things on and off — team members seen from
 * a team, teams seen from a person. Every toggle saves on its own, so there is
 * nothing to confirm and closing never loses anything.
 *
 * Rows keep the order they arrive in even as they are picked: a list that sorts
 * the chosen to the top moves the row out from under the cursor mid-click.
 */
export function TogglePicker({
  title,
  description,
  items,
  selected,
  pending,
  error,
  emptyText,
  searchPlaceholder,
  onToggle,
  onClose,
}: {
  title: string;
  description?: string;
  items: PickerItem[];
  selected: Set<string>;
  pending?: boolean;
  error?: string | null;
  emptyText: string;
  searchPlaceholder: string;
  onToggle: (id: string, next: boolean) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) || item.hint?.toLowerCase().includes(needle),
      )
    : items;

  return (
    <Modal title={title} description={description} onClose={onClose}>
      {items.length === 0 ? (
        <p className="text-text-3 py-2 text-base">{emptyText}</p>
      ) : (
        <>
          <div className="relative">
            <Search
              size={15}
              aria-hidden
              className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              value={query}
              autoFocus
              placeholder={searchPlaceholder}
              aria-label={t.common.search}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 pl-9"
            />
          </div>

          <ul className="-mx-1 mt-3 max-h-[46vh] space-y-1 overflow-y-auto px-1">
            {matches.length === 0 ? (
              <li className="text-text-3 px-1 py-6 text-center text-base">{t.common.noMatches}</li>
            ) : (
              matches.map((item) => {
                const on = selected.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={on}
                      onClick={() => onToggle(item.id, !on)}
                      className={cn(
                        "rounded-control flex w-full items-center gap-2.5 border px-3 py-2 text-left transition-colors disabled:opacity-60",
                        on
                          ? "border-brand/45 bg-[var(--brand-tint)]"
                          : "hover:bg-surface-2 border-transparent shadow-[var(--highlight)]",
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">{item.label}</span>
                        {item.hint ? (
                          <span className="text-text-3 block truncate text-sm">{item.hint}</span>
                        ) : null}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                          on ? "bg-brand text-[var(--brand-ink)]" : "border-border border",
                        )}
                      >
                        {on ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}

      {error ? <p className="text-negative mt-3 text-sm font-medium">{error}</p> : null}

      <div className="border-border-soft mt-4 flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-text-3 tnum text-base">{t.common.chosen(selected.size)}</p>
        <Button type="button" onClick={onClose}>
          {t.common.done}
        </Button>
      </div>
    </Modal>
  );
}
