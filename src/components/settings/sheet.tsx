import { cn } from "@/lib/utils";

/**
 * A settings page, on one white sheet.
 *
 * The surface ladder — ground, sheet, well — says a block sits one rung above
 * its parent and never on the same rung. The work area is the grey ground, so
 * a page of settings is a single sheet on it: what used to be a stack of
 * panels is now sections of this one, divided by a hairline rather than by
 * space between floating cards.
 *
 * The three rules that keep the inside of the sheet off its own rung live here
 * rather than in each form, because every one of them was breaking the same
 * way: a card drawn inside the sheet, and a control whose white fill is the
 * sheet's white. Both step down to a well instead.
 */
export function SettingsSheet({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sheet min-w-0",
        // A block inside the sheet steps down to a well rather than repeating
        // the sheet's own white, and so does a control.
        "[&_.card]:bg-surface-2 [&_.card]:shadow-none",
        "[&_input:where(:not([type=color]):not([type=checkbox]):not([type=radio]))]:bg-surface-2",
        "[&_input:where(:not([type=color]):not([type=checkbox]):not([type=radio]))]:shadow-none",
        "[&_textarea]:bg-surface-2 [&_textarea]:shadow-none",
        "[&_select]:bg-surface-2 [&_select]:shadow-none",
        // …and a control inside one of those wells steps back up, so a field
        // in a nested group is not grey on grey.
        "[&_.card_input]:bg-surface [&_.card_input]:shadow-[var(--highlight)]",
        "[&_.card_textarea]:bg-surface [&_.card_textarea]:shadow-[var(--highlight)]",
        "[&_.card_select]:bg-surface [&_.card_select]:shadow-[var(--highlight)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
