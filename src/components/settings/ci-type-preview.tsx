"use client";

import { useState } from "react";
import type { CiFieldKind } from "@/generated/prisma/enums";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LifecyclePill } from "@/components/cmdb/ci-lifecycle";
import { Modal } from "@/components/modal";
import type { DesignerField } from "@/components/settings/ci-type-designer";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Shape = "item" | "row" | "card";

/**
 * How an item of this type will read, before there is one.
 *
 * A popup rather than a pane that is always there, because the designer needs
 * the width and the question — "have I got this right" — is one somebody asks
 * once, at the end. It follows the draft rather than what is saved: a preview of
 * the version you are not looking at is worse than none.
 *
 * The values are stand-ins keyed to the attribute's kind. The point is the
 * shape — how many rows, in what order, how long the labels are — and made-up
 * serial numbers say that better than a column of dashes.
 */
export function CiTypePreview({
  name,
  icon,
  colour,
  fields,
  columns,
  columnLabels,
  onClose,
}: {
  name: string;
  icon: string | null;
  colour: string;
  fields: DesignerField[];
  /// The register columns the draft says this type starts with.
  columns: string[];
  columnLabels: { id: string; label: string }[];
  onClose: () => void;
}) {
  const t = useMessages();
  const [shape, setShape] = useState<Shape>("item");

  const example = t.cmdb.exampleName;
  const label = (id: string) => columnLabels.find((column) => column.id === id)?.label ?? id;

  return (
    <Modal
      title={t.cmdb.previewTitle(name)}
      description={t.cmdb.previewBlurb}
      // Wide, because the thing being previewed is a page: a two-column grid
      // squeezed into a dialog's width truncates every value in it, which is
      // the one thing a preview must not do.
      size="lg"
      onClose={onClose}
    >
      <div className="bg-surface-2 mb-4 flex w-fit gap-0.5 rounded-full p-0.5">
        {(["item", "row", "card"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={shape === option}
            onClick={() => setShape(option)}
            className={cn(
              "rounded-full px-2.5 py-1 text-sm font-medium transition-colors",
              shape === option
                ? "bg-surface text-text shadow-[var(--highlight)]"
                : "text-text-2 hover:text-text",
            )}
          >
            {t.cmdb.previewShape[option]}
          </button>
        ))}
      </div>

      <div className="bg-bg rounded-card border-line border p-4">
        {shape === "item" ? (
          <CiTypeItemCard name={name} icon={icon} colour={colour} fields={fields} />
        ) : null}

        {shape === "row" ? (
          <div className="border-border rounded-card bg-surface overflow-hidden border">
            <div className="border-line text-text-3 label flex items-center gap-3 border-b px-3.5 py-2">
              <span className="min-w-0 flex-1">{t.cmdb.name}</span>
              {columns.map((column) => (
                <span key={column} className="w-24 shrink-0 truncate">
                  {label(column)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 px-3.5 py-2">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <CiGlyph icon={icon} color={colour} />
                <span className="truncate text-base font-semibold">{example}</span>
              </span>
              {columns.map((column) => (
                <span key={column} className="text-text-2 w-24 shrink-0 truncate text-base">
                  {cell(column, name, fields, t)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {shape === "card" ? (
          <div className="border-border rounded-card bg-surface w-64 border p-3">
            <div className="flex items-center gap-2.5">
              <CiGlyph icon={icon} color={colour} size={18} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-base font-semibold">{example}</span>
                <span className="text-text-3 block truncate text-xs">{name}</span>
              </span>
            </div>
            <p className="text-text-2 mt-2 truncate text-sm">
              {fields
                .slice(0, 2)
                .map((field) => stand(field, t))
                .join(" · ") || t.cmdb.unset}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * The item page's own card, from the draft.
 *
 * Its own component because it is drawn in two places: inside the popup, and
 * permanently beside the designer, where it is what the width on the right is
 * for. The same card in both, so "have I got this right" gets the same answer
 * however it was asked.
 *
 * `columns` decides how many across the grid reads: two beside the designer is
 * a column of truncated values, and one is how a narrow rail actually renders.
 */
export function CiTypeItemCard({
  name,
  icon,
  colour,
  fields,
  columns = 2,
}: {
  name: string;
  icon: string | null;
  colour: string;
  fields: DesignerField[];
  columns?: 1 | 2;
}) {
  const t = useMessages();

  return (
    <div className="border-border rounded-card bg-surface overflow-hidden border">
      <div className="border-line flex items-center gap-2.5 border-b px-3.5 py-2.5">
        <CiGlyph icon={icon} color={colour} size={18} />
        <span className="min-w-0 leading-tight">
          <span className="text-md block truncate font-semibold">{t.cmdb.exampleName}</span>
          <span className="text-text-3 block truncate text-xs">{name}</span>
        </span>
        <LifecyclePill lifecycle="IN_SERVICE" label={t.cmdb.life.IN_SERVICE} className="ml-auto" />
      </div>
      <div className={cn("grid gap-x-8 px-3.5 py-2.5", columns === 2 && "sm:grid-cols-2")}>
        {fields.length === 0 ? (
          <p className="text-text-3 text-base">{t.cmdb.noAttributes}</p>
        ) : (
          fields.map((field) => (
            <div
              key={field.id}
              className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 py-1"
            >
              <span className="text-text-3 truncate text-sm">{field.label}</span>
              <span className="min-w-0 truncate text-base">{stand(field, t)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** A stand-in value for one kind of attribute. */
function stand(field: DesignerField, t: ReturnType<typeof useMessages>): string {
  const samples: Record<CiFieldKind, string> = {
    TEXT: t.cmdb.sampleText,
    NUMBER: "120",
    DATE: "11 Mar 2027",
    BOOLEAN: t.common.yes,
    CHOICE: field.options[0] ?? t.cmdb.unset,
    USER: t.cmdb.samplePerson,
    ITEM: t.cmdb.sampleItem,
  };
  return samples[field.kind];
}

/** One register cell, for the columns a register has whatever the type is. */
function cell(
  column: string,
  typeName: string,
  fields: DesignerField[],
  t: ReturnType<typeof useMessages>,
): string {
  if (column === "type") return typeName;
  if (column === "lifecycle") return t.cmdb.life.IN_SERVICE;
  if (column === "team") return t.cmdb.sampleTeam;
  if (column === "tickets") return t.cmdb.openTickets(2);

  const key = column.startsWith("attr:") ? column.slice(5) : null;
  const field = key ? fields.find((candidate) => candidate.key === key) : undefined;
  return field ? stand(field, t) : t.cmdb.unset;
}
