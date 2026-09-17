"use client";

import { createPortal } from "react-dom";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Portalled to <body> so the dialog centres on the viewport rather than inside
 * whatever card opened it. Rendered in place, a `fixed` overlay is trapped by
 * any ancestor that establishes a containing block for fixed positioning — a
 * card carrying a transform animation is enough to do that.
 *
 * Dialogs only ever open from a click, so there is nothing to render on the
 * server and no hydration to mismatch.
 */
export function Modal({
  title,
  description,
  size = "md",
  onClose,
  children,
}: {
  title: string;
  description?: string;
  /// "lg" is for dialogs that are really a small page — a plan editor, a list
  /// with its own controls.
  size?: "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useMessages();
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        aria-label={t.common.closeDialog}
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade fixed inset-0 cursor-default bg-[rgba(20,18,16,0.5)] backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "animate-rise border-border bg-surface rounded-panel relative w-full overflow-hidden border shadow-[var(--shadow-lg)]",
          size === "lg" ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="border-border-soft border-b px-5 py-4">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {description ? <p className="text-text-2 mt-1 text-base">{description}</p> : null}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
