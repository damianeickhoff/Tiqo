"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eye, Plus, Trash2, X } from "lucide-react";
import type { CiFieldKind } from "@/generated/prisma/enums";
import {
  addCiField,
  createCiType,
  deleteCiField,
  deleteCiType,
  duplicateCiType,
  moveCiField,
  saveCiTypeDesign,
} from "@/lib/actions/cmdb";
import { CI_FIELD_KINDS, keyFromLabel } from "@/lib/cmdb";
import { useDraft, SaveBar } from "@/components/settings/draft";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CI_ICON_NAMES, CiGlyph } from "@/components/cmdb/ci-glyph";
import { CiTypeItemCard, CiTypePreview } from "@/components/settings/ci-type-preview";
import { Button, buttonClass, FieldError, FormError, Input, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type DesignerField = {
  id: string;
  key: string;
  label: string;
  kind: CiFieldKind;
  required: boolean;
  options: string[];
  isExpiry: boolean;
};

export type DesignerType = {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  color: string;
  namePattern: string | null;
  defaultColumns: string[];
  fields: DesignerField[];
  items: number;
};

/** The seven a desk actually uses, and a hex box for the eighth. A palette is a
 *  decision made once; a colour wheel is one made badly every time. */
const SWATCHES = ["#febe2e", "#6366f1", "#0ea5e9", "#10b981", "#f43f5e", "#f97316", "#9d9da6"];

/**
 * The draft is flat, because `useDraft` tells dirty from clean by comparing each
 * key with `!==`: an array of attributes would be a new reference on every
 * keystroke and the Save bar would never go quiet again. So the attributes
 * travel as JSON and the columns as a comma list, and both are parsed back the
 * moment anything wants to read them.
 */
type Draft = {
  name: string;
  key: string;
  icon: string;
  color: string;
  namePattern: string;
  columns: string;
  fields: string;
};

const draftFrom = (type: DesignerType): Draft => ({
  name: type.name,
  key: type.key,
  icon: type.icon ?? "",
  color: type.color,
  namePattern: type.namePattern ?? "",
  columns: type.defaultColumns.join(","),
  fields: JSON.stringify(type.fields),
});

/**
 * One designer for one type: what it is called, what it looks like, what it
 * records, and how its register reads.
 *
 * A selector rather than a side list, because a desk has four types and looks
 * at one of them at a time — a permanent list of four is a column of width
 * spent saying what a dropdown says in a line.
 *
 * One Save for all of it. Adding, removing and reordering an attribute are
 * verbs on their own and happen at once, which is why they are held back while
 * there is an unsaved draft: a row appearing underneath half-typed labels would
 * either lose them or silently save them.
 */
export function CiTypeDesigner({
  type,
  types,
  columns,
}: {
  type: DesignerType;
  /// Every type, for the selector and for an ITEM attribute to say what it
  /// points at.
  types: {
    id: string;
    key: string;
    name: string;
    icon: string | null;
    color: string;
    items: number;
  }[];
  /// Every column this type's register could offer, already named.
  columns: { id: string; label: string }[];
}) {
  const t = useMessages();
  const router = useRouter();
  const draft = useDraft<Draft>(draftFrom(type));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<"icon" | "colour" | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const fields: DesignerField[] = JSON.parse(draft.draft.fields);
  const chosen = draft.draft.columns ? draft.draft.columns.split(",") : [];

  const setFields = (next: DesignerField[]) => draft.set({ fields: JSON.stringify(next) });
  const patch = (id: string, values: Partial<DesignerField>) =>
    setFields(fields.map((field) => (field.id === id ? { ...field, ...values } : field)));

  function save(values: Draft) {
    return saveCiTypeDesign(type.id, {
      name: values.name,
      key: values.key,
      icon: values.icon || null,
      color: values.color,
      namePattern: values.namePattern,
      defaultColumns: values.columns ? values.columns.split(",") : [],
      fields: JSON.parse(values.fields),
    }).then((result) => {
      setErrors(result.ok ? {} : result.errors);
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.errors.form ?? t.errors.generic };
    });
  }

  /// Held back while the draft is dirty. A row arriving in the middle of a form
  /// somebody is typing into is the one way this screen could lose work.
  const listLevel = draft.dirty ? t.cmdb.saveFirst : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 lg:px-6">
        <Link
          href="/settings"
          className="text-text-3 hover:text-text inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={12} strokeWidth={2.5} />
          {t.nav.settings}
        </Link>
        <span aria-hidden className="bg-line h-4 w-px" />
        <span className="text-text-2 text-sm font-medium">{t.cmdb.typesTitle}</span>
        <span aria-hidden className="bg-line mx-1 h-4 w-px" />

        <CiGlyph icon={type.icon} color={type.color} size={13} />
        <Select
          aria-label={t.cmdb.typesTitle}
          value={type.key}
          className="h-8 w-auto"
          onChange={(event) => router.push(`/settings/cmdb?type=${event.target.value}`)}
        >
          {types.map((option) => (
            <option key={option.id} value={option.key}>
              {`${option.name} · ${t.cmdb.itemCount(option.items)}`}
            </option>
          ))}
        </Select>

        <NewTypeButton />

        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewing(true)}>
            <Eye size={13} />
            {t.cmdb.preview}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || draft.dirty}
            title={listLevel}
            onClick={() =>
              startTransition(async () => {
                const result = await duplicateCiType(type.id);
                if (result.ok) router.push(`/settings/cmdb?type=${result.key}`);
              })
            }
          >
            <Copy size={13} />
            {t.cmdb.duplicateType}
          </Button>
          <ConfirmDelete
            title={type.name}
            blurb={type.items > 0 ? t.errors.ciTypeInUse(type.items) : undefined}
            run={async () => {
              const result = await deleteCiType(type.id);
              if (result.ok) router.push("/settings/cmdb");
              return result;
            }}
          >
            {(ask) => (
              <button
                type="button"
                onClick={ask}
                className="text-negative hover:bg-negative/10 rounded-control flex h-8 items-center gap-1.5 px-2.5 text-sm font-medium transition-colors"
              >
                <Trash2 size={13} />
                {t.cmdb.deleteType}
              </button>
            )}
          </ConfirmDelete>
        </div>
      </div>

      {/* Two columns on a wide screen, because the three things that used to sit
          stacked underneath the card — what a register of this type starts with,
          what its names have to look like, and how an item of it will read — are
          all answers to the attributes on the left. Side by side they are read
          together; stacked they were a scroll away from the thing they describe,
          with a third of the page left blank.
          Only at `2xl`. Below it the card was already using what width there
          was, and an attributes row is six controls wide: taking 380px off it to
          put a preview beside it would buy the preview by wrapping every row. */}
      <div className="px-5 py-5 lg:px-6">
        <div className="grid max-w-5xl items-start gap-5 2xl:max-w-none 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-end gap-3 px-4 py-3.5">
              <label className="block min-w-[10rem] flex-1">
                <span className="label mb-1.5 block">{t.cmdb.name}</span>
                <Input
                  value={draft.draft.name}
                  maxLength={60}
                  onChange={(event) => draft.set({ name: event.target.value })}
                />
                <FieldError>{errors.name}</FieldError>
              </label>

              <label className="block w-44">
                <span className="label mb-1.5 block">{t.cmdb.key}</span>
                <Input
                  value={draft.draft.key}
                  maxLength={30}
                  className="font-mono text-sm"
                  onChange={(event) => draft.set({ key: event.target.value })}
                />
                <FieldError>{errors.key}</FieldError>
              </label>

              <div className="relative">
                <span className="label mb-1.5 block">{t.cmdb.icon}</span>
                <button
                  type="button"
                  onClick={() => setPicker(picker === "icon" ? null : "icon")}
                  aria-expanded={picker === "icon"}
                  className={cn(buttonClass("outline", "sm"), "h-9 gap-2")}
                >
                  <CiGlyph icon={draft.draft.icon || null} color={draft.draft.color} size={13} />
                  {draft.draft.icon || t.cmdb.unset}
                  <ChevronDown size={12} className="text-text-3" />
                </button>
                {picker === "icon" ? (
                  <IconPicker
                    chosen={draft.draft.icon}
                    colour={draft.draft.color}
                    onPick={(icon) => {
                      draft.set({ icon });
                      setPicker(null);
                    }}
                    onClose={() => setPicker(null)}
                  />
                ) : null}
              </div>

              <div className="relative">
                <span className="label mb-1.5 block">{t.cmdb.colour}</span>
                <button
                  type="button"
                  onClick={() => setPicker(picker === "colour" ? null : "colour")}
                  aria-expanded={picker === "colour"}
                  className={cn(buttonClass("outline", "sm"), "h-9 gap-2")}
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full"
                    style={{ background: draft.draft.color }}
                  />
                  <span className="font-mono text-sm">{draft.draft.color}</span>
                  <ChevronDown size={12} className="text-text-3" />
                </button>
                {picker === "colour" ? (
                  <ColourPicker
                    chosen={draft.draft.color}
                    onPick={(color) => draft.set({ color })}
                    onClose={() => setPicker(null)}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
              <h2 className="label">{t.cmdb.fields}</h2>
              <span className="text-text-3 text-xs">{t.cmdb.fieldOrderHint}</span>
            </div>

            <div className="mx-4 mb-3">
              <FormError>{errors.form}</FormError>

              {fields.length === 0 ? (
                <p className="border-border text-text-3 rounded-card border border-dashed px-4 py-6 text-center text-base">
                  {t.cmdb.noFields}
                </p>
              ) : (
                <ul className="rounded-card divide-line divide-y overflow-hidden">
                  {fields.map((field, index) => (
                    <li key={field.id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block min-w-[9rem] flex-1">
                          <span className="label mb-1 block">{t.cmdb.label}</span>
                          <Input
                            value={field.label}
                            maxLength={60}
                            className="h-8"
                            onChange={(event) => patch(field.id, { label: event.target.value })}
                          />
                        </label>

                        <label className="block w-40">
                          <span className="label mb-1 block">{t.cmdb.key}</span>
                          <Input
                            value={field.key}
                            maxLength={30}
                            className="h-8 font-mono text-sm"
                            onChange={(event) => patch(field.id, { key: event.target.value })}
                          />
                        </label>

                        <label className="block w-44">
                          <span className="label mb-1 block">{t.cmdb.kind}</span>
                          <Select
                            value={field.kind}
                            className="h-8"
                            onChange={(event) =>
                              patch(field.id, { kind: event.target.value as CiFieldKind })
                            }
                          >
                            {CI_FIELD_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {t.cmdb.fieldKind[kind]}
                              </option>
                            ))}
                          </Select>
                        </label>

                        <label className="flex items-center gap-2 pb-1.5">
                          <input
                            type="checkbox"
                            checked={field.required}
                            className="accent-brand size-4"
                            onChange={(event) =>
                              patch(field.id, { required: event.target.checked })
                            }
                          />
                          <span className="text-base font-medium">{t.cmdb.required}</span>
                        </label>

                        <span className="ml-auto flex items-center gap-0.5 pb-1">
                          <Move
                            disabled={index === 0 || pending || draft.dirty}
                            title={listLevel ?? t.common.moveUp(field.label)}
                            onClick={() =>
                              startTransition(
                                () => void moveCiField(field.id, "up").then(router.refresh),
                              )
                            }
                            up
                          />
                          <Move
                            disabled={index === fields.length - 1 || pending || draft.dirty}
                            title={listLevel ?? t.common.moveDown(field.label)}
                            onClick={() =>
                              startTransition(
                                () => void moveCiField(field.id, "down").then(router.refresh),
                              )
                            }
                          />
                          <ConfirmDelete
                            title={field.label}
                            run={async () => {
                              const result = await deleteCiField(field.id);
                              if (result.ok) router.refresh();
                              return result;
                            }}
                          >
                            {(ask) => (
                              <button
                                type="button"
                                onClick={ask}
                                disabled={draft.dirty}
                                aria-label={t.common.delete}
                                title={listLevel ?? t.common.delete}
                                className="text-text-3 hover:bg-surface-3 hover:text-negative rounded-control p-1 transition-colors disabled:opacity-30"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </ConfirmDelete>
                        </span>
                      </div>

                      {/* The one line that depends on what kind of thing this is.
                        Underneath rather than in the row, because it is an
                        answer to the kind rather than another column. */}
                      {field.kind === "CHOICE" ? (
                        <Options
                          options={field.options}
                          onChange={(options) => patch(field.id, { options })}
                        />
                      ) : null}

                      {field.kind === "DATE" ? (
                        <label className="mt-2 flex items-center gap-2 pl-0.5">
                          <input
                            type="checkbox"
                            checked={field.isExpiry}
                            className="accent-brand size-4"
                            onChange={(event) =>
                              patch(field.id, { isExpiry: event.target.checked })
                            }
                          />
                          <span className="text-text-2 text-sm">{t.cmdb.isExpiry}</span>
                        </label>
                      ) : null}

                      {field.kind === "ITEM" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-0.5">
                          <span className="text-text-3 text-xs">{t.cmdb.pointsAt}</span>
                          <Select
                            value={field.options[0] ?? ""}
                            aria-label={t.cmdb.pointsAt}
                            className="h-8 w-44"
                            onChange={(event) =>
                              patch(field.id, {
                                options: event.target.value ? [event.target.value] : [],
                              })
                            }
                          >
                            <option value="">{t.cmdb.anyType}</option>
                            {types.map((option) => (
                              <option key={option.id} value={option.key}>
                                {option.name}
                              </option>
                            ))}
                          </Select>
                          <span className="text-text-3 text-xs">{t.cmdb.pointsAtHint}</span>
                        </div>
                      ) : null}

                      <FieldError>{errors[`fields.${field.id}`]}</FieldError>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 pb-4">
              {adding ? (
                <NewFieldForm
                  typeId={type.id}
                  onDone={() => {
                    setAdding(false);
                    router.refresh();
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.dirty}
                  title={listLevel}
                  onClick={() => setAdding(true)}
                >
                  <Plus size={13} />
                  {t.cmdb.addField}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card space-y-4 p-4">
              <div>
                <span className="label mb-1.5 block">{t.cmdb.defaultColumns}</span>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((column) => {
                    const on = chosen.includes(column.id);
                    return (
                      <button
                        key={column.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          draft.set({
                            columns: (on
                              ? chosen.filter((id) => id !== column.id)
                              : [...chosen, column.id]
                            ).join(","),
                          })
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-sm font-medium transition-colors",
                          on
                            ? "text-brand-deep border-transparent bg-[var(--brand-tint)]"
                            : "bg-surface text-text-2 hover:text-text border-transparent shadow-[var(--highlight)]",
                        )}
                      >
                        {column.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-text-3 mt-1.5 block text-sm">
                  {t.cmdb.defaultColumnsHint}
                </span>
              </div>

              <label className="block">
                <span className="label mb-1.5 block">{t.cmdb.namePattern}</span>
                <Input
                  value={draft.draft.namePattern}
                  maxLength={200}
                  placeholder={t.cmdb.namePatternPlaceholder}
                  className="font-mono text-sm"
                  onChange={(event) => draft.set({ namePattern: event.target.value })}
                />
                <span className="text-text-3 mt-1.5 block text-sm">{t.cmdb.namePatternHint}</span>
                <FieldError>{errors.namePattern}</FieldError>
              </label>
            </div>

            {/* The popup is still there, for the register row and the card. This
                one is the item page, always on, following every keystroke: the
                question the designer keeps asking is what an attribute called
                that, in that order, will look like to somebody reading one. */}
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5">
                <h2 className="label">{t.cmdb.preview}</h2>
                <span className="text-text-3 text-xs">{t.cmdb.previewBlurb}</span>
              </div>
              <div className="bg-bg p-3">
                <CiTypeItemCard
                  name={draft.draft.name}
                  icon={draft.draft.icon || null}
                  colour={draft.draft.color}
                  fields={fields}
                  columns={1}
                />
              </div>
            </div>
          </div>
        </div>

        <SaveBar draft={draft} save={save} />
      </div>

      {previewing ? (
        <CiTypePreview
          name={draft.draft.name}
          icon={draft.draft.icon || null}
          colour={draft.draft.color}
          fields={fields}
          columns={chosen}
          columnLabels={columns}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </>
  );
}

function Move({
  disabled,
  title,
  onClick,
  up = false,
}: {
  disabled: boolean;
  title: string;
  onClick: () => void;
  up?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors disabled:opacity-30"
    >
      {up ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );
}

/** What a list attribute may be. Chips rather than a textarea, because a list of
 *  four is four things and not a paragraph. */
function Options({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const t = useMessages();
  const [adding, setAdding] = useState("");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0.5">
      <span className="text-text-3 shrink-0 text-xs">{t.cmdb.options}</span>
      {options.map((option) => (
        <span
          key={option}
          className="bg-surface text-text-2 inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-sm shadow-[var(--highlight)]"
        >
          {option}
          <button
            type="button"
            onClick={() => onChange(options.filter((one) => one !== option))}
            aria-label={t.common.deleteThing(option)}
            className="text-text-3 hover:text-negative transition-colors"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        value={adding}
        placeholder={t.common.add}
        aria-label={t.cmdb.options}
        maxLength={40}
        onChange={(event) => setAdding(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const wanted = adding.trim();
          if (!wanted || options.includes(wanted)) return;
          onChange([...options, wanted]);
          setAdding("");
        }}
        className="border-line placeholder:text-text-3 focus:border-brand w-28 rounded-full border border-dashed bg-transparent px-2.5 py-0.5 text-sm focus:outline-none"
      />
    </div>
  );
}

/** The type's mark, from the handful the app can draw. */
function IconPicker({
  chosen,
  colour,
  onPick,
  onClose,
}: {
  chosen: string;
  colour: string;
  onPick: (icon: string) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const matches = CI_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Popover onClose={onClose} className="w-60">
      <Input
        autoFocus
        value={query}
        placeholder={t.cmdb.findIcon}
        aria-label={t.cmdb.findIcon}
        className="mb-2 h-8"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid grid-cols-5 gap-1">
        {matches.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            onClick={() => onPick(name)}
            className={cn(
              "rounded-control flex size-10 items-center justify-center border transition-colors",
              name === chosen
                ? "border-brand bg-[var(--brand-tint)]"
                : "bg-surface border-transparent shadow-[var(--highlight)]",
            )}
          >
            <CiGlyph icon={name} color={colour} size={15} />
          </button>
        ))}
      </div>
      {matches.length === 0 ? (
        <p className="text-text-3 py-3 text-center text-sm">{t.common.noMatches}</p>
      ) : null}
    </Popover>
  );
}

/** Seven swatches and a hex box. */
function ColourPicker({
  chosen,
  onPick,
  onClose,
}: {
  chosen: string;
  onPick: (colour: string) => void;
  onClose: () => void;
}) {
  const t = useMessages();

  return (
    <Popover onClose={onClose} className="w-56">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            title={swatch}
            onClick={() => onPick(swatch)}
            className={cn(
              "size-7 rounded-full border-2 transition-transform",
              swatch.toLowerCase() === chosen.toLowerCase()
                ? "border-text scale-110"
                : "border-transparent",
            )}
            style={{ background: swatch }}
          />
        ))}
      </div>
      <Input
        value={chosen}
        maxLength={7}
        aria-label={t.cmdb.colour}
        className="h-8 font-mono text-sm"
        onChange={(event) => onPick(event.target.value)}
      />
    </Popover>
  );
}

/** A small panel under the control that opened it, closed by pressing anywhere
 *  else — the shape the project menu already uses. */
function Popover({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className={cn(
          "animate-rise bg-surface rounded-card absolute left-0 z-50 mt-2 p-2.5 shadow-[var(--shadow-float)]",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

/** A new attribute: a label, a kind, and it is there. The key is offered from
 *  the label so the common case is one box rather than two. */
function NewFieldForm({ typeId, onDone }: { typeId: string; onDone: () => void }) {
  const t = useMessages();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<string>("TEXT");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="pt-3">
      <FormError>{errors.form}</FormError>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[10rem] flex-1">
          <span className="label mb-1.5 block">{t.cmdb.label}</span>
          <Input
            value={label}
            autoFocus
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label className="block w-44">
          <span className="label mb-1.5 block">{t.cmdb.kind}</span>
          <Select value={kind} onChange={(event) => setKind(event.target.value)}>
            {CI_FIELD_KINDS.map((option) => (
              <option key={option} value={option}>
                {t.cmdb.fieldKind[option]}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          disabled={pending || !label.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await addCiField(typeId, { label, key: keyFromLabel(label), kind });
              if (!result.ok) {
                setErrors(result.errors);
                return;
              }
              setLabel("");
              onDone();
            })
          }
        >
          {t.cmdb.addField}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
      <FieldError>{errors.label ?? errors.key}</FieldError>
    </div>
  );
}

/** A whole new kind of thing. Only a name is asked for: everything else about a
 *  type is what the designer is for. */
function NewTypeButton() {
  const t = useMessages();
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!naming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setNaming(true)}>
        <Plus size={13} />
        {t.cmdb.newType}
      </Button>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const key = keyFromLabel(name);
        if (!key) return;
        startTransition(async () => {
          const result = await createCiType({ name, key, color: "#febe2e", icon: null });
          if (!result.ok) {
            setError(result.errors.name ?? result.errors.key ?? t.errors.generic);
            return;
          }
          setName("");
          setNaming(false);
          router.push(`/settings/cmdb?type=${key}`);
        });
      }}
    >
      <Input
        autoFocus
        value={name}
        maxLength={60}
        placeholder={t.cmdb.newType}
        aria-label={t.cmdb.newType}
        className="h-8 w-44"
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {t.common.add}
      </Button>
      <button
        type="button"
        onClick={() => setNaming(false)}
        aria-label={t.common.cancel}
        className="text-text-3 hover:text-text rounded-control p-1 transition-colors"
      >
        <X size={14} />
      </button>
      {error ? <span className="text-negative text-sm font-medium">{error}</span> : null}
    </form>
  );
}
