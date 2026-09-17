import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Button -- */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand text-[var(--brand-ink)] font-semibold shadow-[0_1px_2px_rgba(9,9,11,0.1)] hover:bg-brand-hover",
  outline:
    "border border-line bg-surface text-text shadow-[var(--highlight)] hover:border-line-strong hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
  danger: "border border-negative/40 text-negative hover:bg-negative/10",
  /// Filled, for the one button in a dialog that is about to do the thing.
  /// Quiet everywhere else — a page of red buttons is a page nobody reads.
  dangerSolid: "bg-negative text-negative-ink font-semibold shadow-[0_1px_2px_rgba(9,9,11,0.1)]",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-2.5 text-sm gap-1.5 rounded-control",
  md: "h-9 px-3 text-base gap-2 rounded-control",
  lg: "h-9 px-4 text-md gap-2 rounded-control",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-[box-shadow,border-color,color] duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/** Same skin as Button, for anchors. */
export const buttonClass = (
  variant: keyof typeof BUTTON_VARIANTS = "primary",
  size: keyof typeof BUTTON_SIZES = "md",
) =>
  cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap",
    "transition-[box-shadow,border-color,color] duration-150",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
  );

/* --------------------------------------------------------------- Control -- */

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-3 text-base text-text " +
  "shadow-[var(--highlight)] placeholder:text-text-3 " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-line-strong " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)] " +
  "disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(CONTROL, "select-chevron h-9 cursor-pointer appearance-none pr-8", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="label block" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-text-3 text-sm">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  // Announced, not just drawn: a field error that only exists visually is one a
  // screen reader user submits into twice.
  return (
    <p role="alert" className="animate-fade text-negative text-sm font-medium">
      {children}
    </p>
  );
}

export function FormError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="animate-rise border-negative/35 bg-negative/[0.07] text-negative rounded-control border px-3 py-2 text-base font-medium"
    >
      {children}
    </p>
  );
}

/* ----------------------------------------------------------------- Card --- */

export function Card({
  className,
  interactive,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return <div className={cn("card", interactive && "card-interactive", className)} {...props} />;
}

export function CardHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 pt-3.5 pb-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {hint ? <p className="text-text-3 mt-0.5 text-sm">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------- Empty state -- */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-rise border-line bg-surface/60 rounded-panel flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-16 text-center">
      <span
        aria-hidden
        className="mb-1 flex size-11 items-center justify-center rounded-full"
        style={{ background: "var(--brand-tint)" }}
      >
        <span className="bg-brand size-2.5 rounded-full" />
      </span>
      <h3 className="text-md font-semibold">{title}</h3>
      <p className="text-text-2 text-md max-w-sm">{body}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ Picker row -- */

/**
 * One candidate in a picker.
 *
 * Every picker in the app asks the same question — which of these did you
 * mean — and answers it with the same row: a glyph that says what kind of thing
 * it is, a code or a name, a line of context under it, and sometimes a marker
 * on the right. Three copies of that had already drifted into three different
 * paddings.
 *
 * Events are the caller's. One picker commits on click and another on
 * mousedown, because a popover over a text editor has to act before the
 * selection is lost to a blur — and that difference is real, not incidental.
 */
export function PickerRow({
  selected,
  lead,
  title,
  hint,
  trail,
  mono = true,
  className,
  ...rest
}: {
  selected: boolean;
  lead?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  trail?: React.ReactNode;
  /// A reference or a key is a code and is read column-wise; a title is a
  /// sentence and reads badly in a monospace.
  mono?: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors",
        selected ? "bg-[var(--brand-tint)]" : "hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span
          className={cn("block truncate font-medium", mono ? "font-mono text-xs" : "text-base")}
        >
          {title}
        </span>
        {hint ? <span className="text-text-2 block truncate text-sm">{hint}</span> : null}
      </span>
      {trail}
    </button>
  );
}
