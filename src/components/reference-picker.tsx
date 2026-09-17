"use client";

import { createPortal } from "react-dom";
import { AtSign, BookText, Boxes, FolderKanban, Hash, Ticket } from "lucide-react";
import type { Suggestion } from "@/lib/actions/references";
import { PickerRow } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

const ICON = {
  ticket: Ticket,
  project: FolderKanban,
  user: AtSign,
  doc: BookText,
  asset: Boxes,
};

/** Where the caret is, in viewport pixels. */
export type PickerAnchor = { top: number; left: number; bottom: number };

const WIDTH = 320;
const GAP = 8;

/**
 * What you might mean, under the caret.
 *
 * Presentational: the suggestion plugin owns which item is highlighted, because
 * the same arrow keys have to work inside a document that is itself listening
 * for them.
 *
 * Drawn against the viewport rather than against a parent — a parent with a
 * z-index of its own would otherwise decide whether the list is visible, which
 * is how it once ended up painted underneath a sticky toolbar.
 */
export function ReferencePicker({
  sigil,
  items,
  active,
  anchor,
  onPick,
  onHover,
}: {
  sigil: "#" | "@";
  items: Suggestion[];
  active: number;
  anchor: PickerAnchor;
  onPick: (suggestion: Suggestion) => void;
  onHover: (index: number) => void;
}) {
  const t = useMessages();
  if (items.length === 0 || typeof document === "undefined") return null;

  // Above the caret when there is room, below it when there is not — near the
  // top of a window, "above" is off screen.
  const height = 56 + items.length * 46;
  const above = anchor.top > height + GAP * 2;
  // Kept on screen: a caret near the right edge would otherwise push the list
  // off it.
  const left = Math.max(GAP, Math.min(anchor.left, window.innerWidth - WIDTH - GAP));

  return createPortal(
    <div
      className="animate-rise bg-surface rounded-card fixed z-[200] overflow-hidden p-1 shadow-[var(--shadow-float)]"
      style={{
        left,
        width: WIDTH,
        ...(above
          ? { bottom: window.innerHeight - anchor.top + GAP }
          : { top: anchor.bottom + GAP }),
      }}
    >
      <p className="text-text-3 flex items-center gap-1.5 px-2.5 py-1.5 text-xs">
        {sigil === "#" ? <Hash size={11} /> : <AtSign size={11} />}
        {sigil === "#" ? t.editor.referHint : t.editor.mentionHint}
      </p>

      <ul role="listbox">
        {items.map((suggestion, index) => {
          const Icon = ICON[suggestion.kind];
          return (
            <li key={`${suggestion.kind}-${suggestion.id}`}>
              <PickerRow
                role="option"
                selected={index === active}
                aria-selected={index === active}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  // Before blur: the document must still hold the selection when
                  // the reference is written into it.
                  event.preventDefault();
                  onPick(suggestion);
                }}
                mono={suggestion.kind !== "doc"}
                lead={<Icon size={14} className="text-text-3 shrink-0" />}
                title={suggestion.label}
                hint={suggestion.hint}
              />
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
