import type { CiLifecycle } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The register's own four stages, in tokens.
 *
 * Not the status colours: a lifecycle is not a workflow state, and borrowing the
 * queue's palette would say a retired laptop is a closed ticket.
 */
export const LIFE_TOKEN: Record<CiLifecycle, string> = {
  PLANNED: "--p-medium",
  IN_SERVICE: "--positive",
  MAINTENANCE: "--brand",
  RETIRED: "--text-3",
};

/** Where an asset is in its life, as one readable mark. A dot and a word rather
 *  than a coloured pill, because four filled pills in a column read as four
 *  warnings. */
export function LifecyclePill({
  lifecycle,
  label,
  className,
}: {
  lifecycle: CiLifecycle;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-surface text-text inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-sm font-medium whitespace-nowrap shadow-[var(--highlight)]",
        className,
      )}
    >
      <i
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: `var(${LIFE_TOKEN[lifecycle]})` }}
      />
      {label}
    </span>
  );
}
