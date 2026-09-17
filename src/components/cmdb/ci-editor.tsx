"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { CiLifecycle } from "@/generated/prisma/enums";
import { ciDependants, searchCiItems, updateCiItem, type CiCandidate } from "@/lib/actions/cmdb";
import { CI_LIFECYCLES, readAttribute, type AttributeValue, type FieldSpec } from "@/lib/cmdb";
import { useDraft, SaveBar } from "@/components/settings/draft";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { Button, Card, FieldError, FormError, Input, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

type Option = { id: string; name: string };

export type CiEditable = {
  id: string;
  name: string;
  typeId: string;
  lifecycle: CiLifecycle;
  teamId: string | null;
  attributes: unknown;
};

/**
 * The draft is flat — one scalar per key, attributes included under an `attr:`
 * prefix — because `useDraft` tells dirty from clean by comparing each key with
 * `!==`. A nested attributes object would be a new reference on every keystroke
 * and the Save bar would never go quiet again.
 */
const ATTR = "attr:";

type Draft = Record<string, string | number | boolean | null>;

function draftFrom(item: CiEditable, fields: FieldSpec[]): Draft {
  const draft: Draft = {
    name: item.name,
    lifecycle: item.lifecycle,
    teamId: item.teamId ?? "",
  };
  for (const field of fields) {
    draft[ATTR + field.key] = readAttribute(field, item.attributes);
  }
  return draft;
}

function attributesFrom(draft: Draft, fields: FieldSpec[]) {
  const attributes: Record<string, AttributeValue> = {};
  for (const field of fields) {
    attributes[field.key] = draft[ATTR + field.key] ?? null;
  }
  return attributes;
}

/**
 * What an asset is: a grid until somebody presses Edit, a form until they press
 * Save.
 *
 * One card either way, because it is one thing being looked at. The grid is
 * drawn by the page and handed in — it needs the desk's date format and the
 * names behind half a dozen ids, and neither of those belongs on the client.
 *
 * Nothing here writes until Save. That is the rule for everything with a text
 * field next to it, and it is why Edit is a mode rather than a form that was
 * always there waiting to be typed into.
 */
export function CiEditor({
  item,
  fields,
  people,
  teams,
  itemNames,
  canEdit,
  readView,
  startEditing = false,
}: {
  item: CiEditable;
  fields: FieldSpec[];
  people: Option[];
  teams: Option[];
  /// What the assets this item's ITEM attributes point at are called.
  itemNames: Record<string, string>;
  canEdit: boolean;
  /// The same attributes, read rather than edited. Rendered by the page, which
  /// is where the desk's date format and the names behind the ids live.
  readView: ReactNode;
  /// Opened straight into the form, for the Edit beside a row in the register.
  startEditing?: boolean;
}) {
  const t = useMessages();
  const draft = useDraft<Draft>(draftFrom(item, fields));
  const [editing, setEditing] = useState(startEditing && canEdit);
  const [saved, setSaved] = useState(false);
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // What goes with the asset if it goes. Asked when the question is asked, not
  // on every render of a page nobody is retiring anything on.
  const [weight, setWeight] = useState<{ tickets: number; dependants: number } | null>(null);

  // Retiring is how an asset stops being looked after, and the same numbers
  // decide whether it matters. Asked once, when the draft first says RETIRED —
  // not on every keystroke afterwards.
  const retiring = draft.draft.lifecycle === "RETIRED" && item.lifecycle !== "RETIRED";
  useEffect(() => {
    if (retiring) void ciDependants(item.id).then(setWeight);
  }, [retiring, item.id]);

  function save(values: Draft) {
    return updateCiItem(item.id, {
      // Sent because the shape asks for it; the action writes the item's own
      // type regardless, which is what makes re-typing impossible rather than
      // merely unavailable.
      name: String(values.name ?? ""),
      typeId: item.typeId,
      lifecycle: values.lifecycle,
      teamId: values.teamId || null,
      attributes: attributesFrom(values, fields),
    }).then((result) => {
      setErrors(result.ok ? {} : result.errors);
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.errors.form ?? t.errors.generic };
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2">
        <h2 className="label">{t.cmdb.details}</h2>
        {/* The Save bar's own tick goes with the form it was in, so the
            confirmation moves up here: a save with nothing to show for it is a
            save people repeat. */}
        {saved ? (
          <span className="animate-fade text-positive inline-flex items-center gap-1 text-sm font-medium">
            <Check size={13} strokeWidth={2.5} />
            {t.common.saved}
          </span>
        ) : null}
        {canEdit && !editing && !saved ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-brand-deep flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <Pencil size={12} strokeWidth={2.5} />
            {t.common.edit}
          </button>
        ) : null}
      </div>

      {editing ? (
        <>
          <div className="px-3.5 py-3">
            <FormError>{errors.form}</FormError>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label mb-1.5 block">{t.cmdb.name}</span>
                <Input
                  value={String(draft.draft.name ?? "")}
                  maxLength={120}
                  onChange={(event) => draft.set({ name: event.target.value })}
                />
                <FieldError>{errors.name}</FieldError>
              </label>

              <label className="block">
                <span className="label mb-1.5 block">{t.cmdb.team}</span>
                <Select
                  value={String(draft.draft.teamId ?? "")}
                  onChange={(event) => draft.set({ teamId: event.target.value })}
                >
                  <option value="">{t.cmdb.noTeam}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="label mb-1.5 block">{t.cmdb.lifecycle}</span>
                <Select
                  value={String(draft.draft.lifecycle ?? "IN_SERVICE")}
                  onChange={(event) => draft.set({ lifecycle: event.target.value })}
                >
                  {CI_LIFECYCLES.map((life) => (
                    <option key={life} value={life}>
                      {t.cmdb.life[life]}
                    </option>
                  ))}
                </Select>
                {/* Before Save rather than after it: what depends on this does
                    not stop depending on it because the register says it is
                    retired. */}
                {retiring && weight && (weight.dependants > 0 || weight.tickets > 0) ? (
                  <p className="callout-brand mt-2 px-3 py-2 text-sm">
                    {t.cmdb.retireWarning(weight.tickets, weight.dependants)}
                  </p>
                ) : null}
              </label>
            </div>

            {fields.length === 0 ? (
              <p className="text-text-3 mt-4 text-base">{t.cmdb.noAttributes}</p>
            ) : (
              <>
                <h3 className="label border-line mt-5 mb-3 border-t pt-4">{t.cmdb.attributes}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <AttributeField
                      key={field.key}
                      field={field}
                      value={draft.draft[ATTR + field.key] ?? null}
                      disabled={false}
                      error={errors[`attributes.${field.key}`]}
                      people={people}
                      itemNames={itemNames}
                      onChange={(next) => draft.set({ [ATTR + field.key]: next })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Cancel rather than the bar's own Discard, because leaving the form
              is part of what is being abandoned — and so are the refusals from
              the last attempt: a grid still marked red under three fields
              nobody is editing any more reads as broken. */}
          <SaveBar
            draft={draft}
            save={save}
            variant="footer"
            summary={summarise(draft.draft, draft.committed, fields, {
              name: t.cmdb.name,
              teamId: t.cmdb.team,
              lifecycle: t.cmdb.lifecycle,
            })}
            onCancel={() => {
              setErrors({});
              setEditing(false);
            }}
            onSaved={() => {
              setEditing(false);
              setSaved(true);
              if (flash.current) clearTimeout(flash.current);
              flash.current = setTimeout(() => setSaved(false), 2400);
            }}
          />
        </>
      ) : (
        readView
      )}
    </Card>
  );
}

/**
 * What is about to change, in a few words.
 *
 * Named rather than counted: "2 unsaved" makes somebody go back and find out
 * which two. One change gets its before and after, because that is the sentence
 * they would say out loud; more than one gets the list of names, because three
 * arrows do not fit on a footer.
 */
function summarise(
  draft: Draft,
  committed: Draft,
  fields: FieldSpec[],
  common: Record<string, string>,
): string | undefined {
  const labels: Record<string, string> = { ...common };
  for (const field of fields) labels[ATTR + field.key] = field.label;

  const changed = Object.keys(draft).filter((key) => draft[key] !== committed[key]);
  if (changed.length === 0) return undefined;

  if (changed.length === 1) {
    const key = changed[0]!;
    const kind = fields.find((field) => ATTR + field.key === key)?.kind;
    const was = committed[key];
    const now = draft[key];
    // Only where both ends read as themselves. An id changing to another id is
    // "Primary user", not one cuid arrowing to another.
    const opaque = key === "teamId" || kind === "USER" || kind === "ITEM";
    if (!opaque && was !== null && was !== "" && now !== null && now !== "") {
      return `${labels[key] ?? key}: ${was} → ${now}`;
    }
  }

  return changed.map((key) => labels[key] ?? key).join(" · ");
}

/** One attribute, drawn as whatever its kind says it is. */
function AttributeField({
  field,
  value,
  disabled,
  error,
  people,
  itemNames,
  onChange,
}: {
  field: FieldSpec;
  value: string | number | boolean | null;
  disabled: boolean;
  error?: string;
  people: Option[];
  /// What the ids an ITEM attribute already holds are called, resolved by the
  /// page. Without it the field would draw a cuid, which is what it did before.
  itemNames: Record<string, string>;
  onChange: (next: string | number | boolean | null) => void;
}) {
  const t = useMessages();
  const label = (
    <span className="label mb-1.5 block">
      {field.label}
      {field.required ? <span className="text-negative ml-1">*</span> : null}
    </span>
  );

  if (field.kind === "BOOLEAN") {
    return (
      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-brand size-4"
        />
        <span className="text-base font-medium">{field.label}</span>
      </label>
    );
  }

  if (field.kind === "CHOICE") {
    return (
      <label className="block">
        {label}
        <Select
          value={value === null ? "" : String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{t.cmdb.unset}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <FieldError>{error}</FieldError>
      </label>
    );
  }

  if (field.kind === "ITEM") {
    return (
      <div className="block">
        {label}
        <ItemPicker
          value={value === null ? null : String(value)}
          name={value === null ? null : (itemNames[String(value)] ?? null)}
          typeKey={field.options[0] ?? null}
          disabled={disabled}
          onChange={onChange}
        />
        <FieldError>{error}</FieldError>
      </div>
    );
  }

  if (field.kind === "USER") {
    return (
      <label className="block">
        {label}
        <Select
          value={value === null ? "" : String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{t.cmdb.unset}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
        <FieldError>{error}</FieldError>
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      <Input
        type={field.kind === "DATE" ? "date" : field.kind === "NUMBER" ? "number" : "text"}
        value={value === null ? "" : String(value)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") return onChange(null);
          onChange(field.kind === "NUMBER" ? Number(raw) : raw);
        }}
      />
      <FieldError>{error}</FieldError>
    </label>
  );
}

/**
 * An attribute that points at another asset.
 *
 * A search rather than a dropdown, because the thing it points at is one row in
 * a register that may hold thousands — and narrowed to the type the field says
 * it points at, so a field called "Rack" does not offer every laptop the desk
 * owns. It is a draft field like any other: picking changes what is on screen,
 * and Save is what writes it.
 */
function ItemPicker({
  value,
  name,
  typeKey,
  disabled,
  onChange,
}: {
  value: string | null;
  name: string | null;
  typeKey: string | null;
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  const t = useMessages();
  const [picked, setPicked] = useState(name);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CiCandidate[]>([]);

  // Debounced for the same reason the relate dialog is: the search runs against
  // the whole register, and a query per character is a query per character.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      searchCiItems(query, undefined, typeKey).then((rows) => {
        if (live) setResults(rows);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, query, typeKey]);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-base">
          {value ? (picked ?? value) : <span className="text-text-3">{t.cmdb.unset}</span>}
        </span>
        {disabled ? null : (
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
              {value ? t.cmdb.changeItem : t.cmdb.pickItem}
            </Button>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  onChange(null);
                }}
                aria-label={t.cmdb.clearItem}
                title={t.cmdb.clearItem}
                className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control p-1 transition-colors"
              >
                <X size={13} />
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.cmdb.searchItems}
        aria-label={t.cmdb.searchItems}
      />
      <div className="rounded-card max-h-48 space-y-1 overflow-y-auto p-1">
        {results.length === 0 ? (
          <p className="text-text-3 py-4 text-center text-base">{t.common.noMatches}</p>
        ) : (
          results.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                setPicked(candidate.name);
                onChange(candidate.id);
                setOpen(false);
                setQuery("");
              }}
              className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors"
            >
              <CiGlyph icon={candidate.type.icon} color={candidate.type.color} size={13} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{candidate.name}</span>
                <span className="text-text-3 block truncate text-sm">{candidate.type.name}</span>
              </span>
            </button>
          ))
        )}
      </div>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        {t.common.cancel}
      </Button>
    </div>
  );
}
