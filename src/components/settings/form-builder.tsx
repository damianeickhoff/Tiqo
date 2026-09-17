"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Copy,
  ExternalLink,
  Hash,
  Heading,
  Info,
  Layers,
  Link2,
  List,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Settings2,
  Trash2,
  Type,
} from "lucide-react";
import type { PortalFieldKind, PortalFieldTarget } from "@/generated/prisma/enums";
import {
  addField,
  addSection,
  deleteField,
  deleteForm,
  deleteSection,
  duplicateForm,
  moveField,
  saveFormTranslation,
  updateField,
  updateForm,
  updateSection,
} from "@/lib/actions/portal-admin";
import { CONTENT_LOCALES } from "@/lib/i18n";
import { PORTAL_ICONS, PortalIcon } from "@/components/portal/portal-icon";
import { PRIORITY_ORDER, TYPE_ORDER } from "@/lib/tickets";
import { Button, Card, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { SectionPicker } from "@/components/settings/section-picker";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<PortalFieldKind, typeof Type> = {
  TEXT: Type,
  TEXTAREA: Heading,
  SELECT: List,
  RADIO: CircleDot,
  CHECKBOX: CheckSquare,
  NUMBER: Hash,
  EMAIL: Mail,
  PHONE: Phone,
  DATE: Calendar,
};

const KINDS = Object.keys(KIND_ICONS) as PortalFieldKind[];
const TARGETS: PortalFieldTarget[] = ["NONE", "TITLE", "DESCRIPTION"];

/** One question's words in one other language. */
type FieldTranslation = {
  locale: string;
  label: string;
  hint: string | null;
  placeholder: string | null;
  options: string[];
};

export type BuilderField = {
  id: string;
  label: string;
  hint: string | null;
  placeholder: string | null;
  kind: PortalFieldKind;
  target: PortalFieldTarget;
  required: boolean;
  halfWidth: boolean;
  options: string[];
  sectionId: string | null;
  showWhenFieldId: string | null;
  showWhenValue: string | null;
  translations: FieldTranslation[];
};

export type BuilderSection = { id: string; title: string; description: string | null };

export type BuilderForm = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  confirmation: string | null;
  keywords: string[];
  icon: string | null;
  color: string;
  type: "QUESTION" | "INCIDENT" | "CHANGE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  categoryId: string | null;
  teamId: string | null;
  projectId: string | null;
  planId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  category: { name: string } | null;
  translations: {
    locale: string;
    name: string;
    summary: string | null;
    description: string | null;
  }[];
  sections: BuilderSection[];
  fields: BuilderField[];
};

type Option = { id: string; name: string };

/** One minute of somebody's afternoon per five questions, never nought. */
function minutesToFill(questions: number) {
  return Math.max(1, Math.round(questions / 5));
}

/**
 * The form builder.
 *
 * Three columns and one selected thing: a palette of what can be added, the
 * form itself as the requester will read it, and an inspector for whatever is
 * selected. Nothing is edited in a row — a row that carries five controls is
 * the version of this that was unreadable.
 */
export function FormBuilder({
  form,
  categories,
  teams,
  projects,
  plans,
  baseLocale,
}: {
  form: BuilderForm;
  categories: Option[];
  teams: Option[];
  projects: Option[];
  plans: Option[];
  /// The language the form itself is written in.
  baseLocale: string;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [writing, setWriting] = useState(baseLocale.split("-")[0] ?? "en");
  const [selected, setSelected] = useState<
    { kind: "form" } | { kind: "field"; id: string } | { kind: "section"; id: string }
  >({ kind: "form" });

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  // Adding selects what was added: the next thing anyone does to a new
  // question is name it, and that happens in the inspector.
  function add(kind: PortalFieldKind) {
    startTransition(async () => {
      const result = await addField(form.id, kind);
      if (result.ok && "id" in result && result.id) setSelected({ kind: "field", id: result.id });
      else setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  const groups = [
    ...form.sections.map((section) => ({
      section,
      fields: form.fields.filter((field) => field.sectionId === section.id),
    })),
    { section: null, fields: form.fields.filter((field) => !field.sectionId) },
  ].filter((group) => group.section || group.fields.length > 0);

  const activeField =
    selected.kind === "field" ? form.fields.find((field) => field.id === selected.id) : undefined;
  const activeSection =
    selected.kind === "section"
      ? form.sections.find((section) => section.id === selected.id)
      : undefined;

  const base = baseLocale.split("-")[0] ?? "en";
  const translating = writing !== base;

  return (
    <>
      {/* Its own head rather than the settings one: this page has left that
          layout behind, and the things it needs up here — live, preview, the
          rest — are the form's, not the settings area's. */}
      <div className="border-line flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-2 lg:px-6">
        <Link
          href="/settings/portal/forms"
          className="text-text-2 hover:text-text -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-base font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          {t.forms.tabForms}
        </Link>

        <span aria-hidden className="bg-line hidden h-[18px] w-px sm:block" />

        <h1 className="text-lg leading-tight font-semibold tracking-[-0.01em]">{form.name}</h1>
        {form.category ? <span className="tag">{form.category.name}</span> : null}

        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <span className="text-text-3 mr-1 flex items-center gap-1.5 text-sm">
              <span aria-hidden className="bg-brand size-1.5 rounded-full" />
              {t.common.unsaved}
            </span>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateForm(form.id, { isActive: !form.isActive }))}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition-colors",
              form.isActive
                ? "bg-positive/12 text-positive"
                : "bg-surface-3 text-text-2 hover:text-text",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {form.isActive ? t.forms.live : t.forms.hidden}
          </button>

          <PreviewDialog slug={form.slug} name={form.name} />

          <FormMenu form={form} />
        </div>
      </div>

      <div className="space-y-3 px-5 py-5 lg:px-6">
        {error ? (
          <p className="bg-negative/[0.06] text-negative rounded-control px-4 py-2 text-base font-medium">
            {error}
          </p>
        ) : null}

        {/* Which language you are editing. The original is the form itself; the
            others stand in for it when somebody reads the portal in them. */}
        <div className="bg-surface-2 flex w-fit items-center gap-0.5 rounded-full p-0.5">
          {CONTENT_LOCALES.map((option) => {
            const original = option.code === base;
            const written =
              original || form.translations.some((row) => row.locale.split("-")[0] === option.code);
            return (
              <button
                key={option.code}
                type="button"
                aria-current={writing === option.code}
                onClick={() => setWriting(option.code)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-medium transition-colors",
                  writing === option.code
                    ? "bg-surface text-text shadow-[var(--shadow-sm)]"
                    : "text-text-2 hover:text-text",
                )}
              >
                {option.label}
                {original ? (
                  <span className="text-text-3 text-xs">{t.forms.originalLanguage}</span>
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      written ? "bg-positive" : "bg-surface-3",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {translating ? (
          <TranslationPane key={writing} form={form} locale={writing} onDirty={setDirty} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[196px_minmax(0,1fr)_320px]">
            <Palette form={form} pending={pending} run={run} onAdd={add} />

            <Canvas
              form={form}
              groups={groups}
              selected={selected}
              pending={pending}
              run={run}
              onSelect={setSelected}
              onAdd={add}
            />

            <div className="animate-rise xl:sticky xl:top-4 xl:h-fit">
              {activeField ? (
                <FieldInspector
                  key={activeField.id}
                  field={activeField}
                  form={form}
                  onDirty={setDirty}
                />
              ) : activeSection ? (
                <SectionInspector
                  key={activeSection.id}
                  section={activeSection}
                  pending={pending}
                  run={run}
                  onDirty={setDirty}
                  onDeleted={() => setSelected({ kind: "form" })}
                />
              ) : (
                <FormInspector
                  form={form}
                  categories={categories}
                  teams={teams}
                  projects={projects}
                  plans={plans}
                  onDirty={setDirty}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

type Selection = { kind: "form" } | { kind: "field"; id: string } | { kind: "section"; id: string };
type Run = (work: () => Promise<{ ok: boolean; error?: string }>) => void;

/** Everything that can be added, as one 30px row each. */
function Palette({
  form,
  pending,
  run,
  onAdd,
}: {
  form: BuilderForm;
  pending: boolean;
  run: Run;
  onAdd: (kind: PortalFieldKind) => void;
}) {
  const t = useMessages();

  return (
    <Card className="animate-rise h-fit p-3">
      <p className="label px-1.5 pt-1 pb-2">{t.forms.addQuestion}</p>
      <ul className="grid grid-cols-2 gap-px xl:grid-cols-1">
        {KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <li key={kind}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onAdd(kind)}
                className="text-text-2 hover:bg-surface-2 hover:text-text group/add rounded-control flex h-[30px] w-full items-center gap-2.5 px-2 text-left text-base transition-colors"
              >
                <Icon size={14} className="text-text-3 shrink-0" />
                <span className="min-w-0 truncate">{t.forms.kinds[kind]}</span>
                <Plus
                  size={13}
                  aria-hidden
                  className="text-text-3 ml-auto shrink-0 opacity-50 transition-opacity group-hover/add:opacity-100"
                />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-line my-2 border-t" />

      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => addSection(form.id, t.forms.newSectionName))}
        className="text-text hover:bg-surface-2 group/add rounded-control flex h-[30px] w-full items-center gap-2.5 px-2 text-left text-base font-medium transition-colors"
      >
        <Layers size={14} aria-hidden className="text-text-3 shrink-0" />
        {/* No trailing plus on this one: at 196px the column has room for the
            icon, the label or the plus — and the label is the part that says
            what pressing it does. */}
        <span className="min-w-0 truncate">{t.forms.addGroup}</span>
      </button>
    </Card>
  );
}

/** The form as the requester will read it. */
function Canvas({
  form,
  groups,
  selected,
  pending,
  run,
  onSelect,
  onAdd,
}: {
  form: BuilderForm;
  groups: { section: BuilderSection | null; fields: BuilderField[] }[];
  selected: Selection;
  pending: boolean;
  run: Run;
  onSelect: (selection: Selection) => void;
  onAdd: (kind: PortalFieldKind) => void;
}) {
  const t = useMessages();
  const required = form.fields.filter((field) => field.required).length;

  return (
    <Card className="animate-rise h-fit overflow-hidden">
      <div
        className={cn(
          "border-line flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-4 py-3.5 transition-colors",
          selected.kind === "form" ? "bg-[var(--brand-wash)]" : null,
        )}
      >
        <span
          aria-hidden
          className="rounded-card flex size-10 shrink-0 items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${form.color} 15%, transparent)`,
            color: form.color,
          }}
        >
          <PortalIcon name={form.icon} size={19} />
        </span>

        <span className="min-w-[11rem] flex-1">
          <span className="text-md block truncate font-semibold">{form.name}</span>
          <span className="text-text-3 mt-px block truncate text-sm">
            {form.description || t.forms.noBlurbYet}
          </span>
        </span>

        {/* What it costs to fill in — the number nobody writing a form keeps in
            their head — and the way back into its own settings. They travel
            together onto a second line when the column is too narrow for both
            them and the name. */}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <span className="text-text-3 font-mono text-xs whitespace-nowrap">
            {t.forms.formReadout(form.fields.length, required, minutesToFill(form.fields.length))}
          </span>

          {/* It says what it opens rather than "Edit": the inspector on the
              right shows whatever is selected, and this is how you get the
              form itself back into it after selecting a question. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect({ kind: "form" })}
          >
            <Pencil size={13} />
            {t.forms.formSettings}
          </Button>
        </span>
      </div>

      <div className="px-5 pt-4 pb-5">
        {groups.length === 0 ? (
          <p className="text-text-3 py-8 text-center text-base">{t.forms.emptyForm}</p>
        ) : null}

        {groups.map(({ section, fields }, index) => (
          <section key={section?.id ?? "loose"} className={index > 0 ? "mt-5" : undefined}>
            {section ? (
              <button
                type="button"
                onClick={() => onSelect({ kind: "section", id: section.id })}
                className={cn(
                  "rounded-control -mx-2.5 mb-2.5 block w-full px-2.5 py-2 text-left transition-colors",
                  selected.kind === "section" && selected.id === section.id
                    ? "bg-[var(--brand-tint)]"
                    : "hover:bg-surface-2",
                )}
              >
                <span className="block text-base font-semibold">{section.title}</span>
                {section.description ? (
                  <span className="text-text-3 mt-px block text-sm">{section.description}</span>
                ) : null}
              </button>
            ) : null}

            <ul className="grid grid-cols-2 gap-2">
              {fields.map((field, position) => (
                <li key={field.id} className={cn(field.halfWidth ? "col-span-1" : "col-span-2")}>
                  <FieldCard
                    field={field}
                    selected={selected.kind === "field" && selected.id === field.id}
                    first={position === 0}
                    last={position === fields.length - 1}
                    pending={pending}
                    onSelect={() => onSelect({ kind: "field", id: field.id })}
                    onDeleted={() => onSelect({ kind: "form" })}
                    run={run}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* A button, not a drop zone. It used to say "drop a question here",
            which was a promise nothing kept — there is no dragging in this
            editor, and an affordance that does nothing is worse than none. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => onAdd("TEXT")}
          className="border-line-strong text-text-3 hover:border-brand/45 hover:text-brand-deep mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed text-sm transition-colors"
        >
          <Plus size={13} aria-hidden />
          {t.forms.addQuestionHere}
        </button>
      </div>
    </Card>
  );
}

function FieldCard({
  field,
  selected,
  first,
  last,
  pending,
  onSelect,
  onDeleted,
  run,
}: {
  field: BuilderField;
  selected: boolean;
  first: boolean;
  last: boolean;
  pending: boolean;
  onSelect: () => void;
  onDeleted: () => void;
  run: Run;
}) {
  const t = useMessages();
  const Icon = KIND_ICONS[field.kind];

  return (
    <div
      className={cn(
        "group rounded-card relative border px-3 py-2.5 transition-colors",
        selected ? "border-brand/50 bg-[var(--brand-tint)]" : "border-line hover:bg-surface-2",
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        {/* The three controls float over this line, so it keeps their width
            clear whether or not they are showing — a title that slides under a
            delete button on hover is unreadable at the moment it matters. */}
        <span className="flex items-center gap-2 pr-[68px]">
          <Icon size={13} className="text-text-3 shrink-0" />
          <span className="truncate text-base font-medium">
            {field.label || t.forms.untitledField}
          </span>
          {field.required ? <span className="text-negative text-base">*</span> : null}
        </span>

        <span className="text-text-3 mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
          {t.forms.kinds[field.kind]}
          {field.target !== "NONE" ? (
            <>
              <span aria-hidden>·</span>
              {t.forms.targets[field.target]}
            </>
          ) : null}
          {field.showWhenFieldId ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-brand-deep inline-flex items-center gap-1">
                <Link2 size={11} aria-hidden />
                {t.forms.conditional}
              </span>
            </>
          ) : null}
        </span>
      </button>

      <span
        className={cn(
          "absolute top-1.5 right-1.5 flex items-center gap-0.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
          selected ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          type="button"
          disabled={pending || first}
          onClick={() => run(() => moveField(field.id, "up"))}
          aria-label={t.common.moveUp(field.label)}
          className="border-line bg-surface text-text-3 hover:text-text rounded-control flex size-[22px] items-center justify-center border disabled:opacity-30"
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          disabled={pending || last}
          onClick={() => run(() => moveField(field.id, "down"))}
          aria-label={t.common.moveDown(field.label)}
          className="border-line bg-surface text-text-3 hover:text-text rounded-control flex size-[22px] items-center justify-center border disabled:opacity-30"
        >
          <ChevronDown size={12} />
        </button>

        {/* On the question rather than in the inspector: removing one is a
            thing you do to a row you can see, and it took two clicks and a
            change of pane to reach from over there. */}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await deleteField(field.id);
              if (result.ok) onDeleted();
              return result;
            })
          }
          aria-label={t.forms.deleteQuestion}
          title={t.forms.deleteQuestion}
          className="border-line bg-surface text-text-3 hover:border-negative/40 hover:text-negative rounded-control flex size-[22px] items-center justify-center border disabled:opacity-30"
        >
          <Trash2 size={11} />
        </button>
      </span>
    </div>
  );
}

/** Duplicate and delete, away from the things pressed every day. */
function FormMenu({ form }: { form: BuilderForm }) {
  const t = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteForm(form.id);
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setAsking(false);
      router.push("/settings/portal/forms");
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.common.more}
        className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="animate-rise border-line bg-surface rounded-card absolute right-0 z-50 mt-2 w-52 overflow-hidden border p-1 shadow-[var(--shadow-float)]"
          >
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  const result = await duplicateForm(form.id);
                  if (result.ok && "id" in result && result.id) {
                    router.push(`/settings/portal/forms/${result.id}`);
                  }
                });
              }}
              className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              <Copy size={14} className="text-text-3" />
              {t.forms.duplicate}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setAsking(true);
              }}
              className="text-negative hover:bg-negative/10 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              <Trash2 size={14} />
              {t.forms.deleteFormAction}
            </button>
          </div>
        </>
      ) : null}

      {asking ? (
        <Modal
          title={t.common.deleteThing(form.name)}
          description={t.forms.deleteFormBlurb}
          onClose={() => setAsking(false)}
        >
          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-4 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          <div className="border-border-soft flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="bg-negative rounded-control text-md inline-flex h-10 items-center gap-1.5 px-4 font-semibold text-white disabled:opacity-50"
            >
              <Trash2 size={14} />
              {pending ? t.common.saving : t.common.delete}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * The form as a requester meets it, without leaving the editor.
 *
 * The button used to walk out of the designer and into the portal, which meant
 * coming back was the browser's job and whatever was selected here was gone.
 */
function PreviewDialog({ slug, name }: { slug: string; name: string }) {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonClass("outline", "sm"), "h-7")}
      >
        <ExternalLink size={13} />
        {t.forms.preview}
      </button>

      {open ? (
        <Modal
          title={name}
          description={t.forms.previewBlurb}
          size="lg"
          onClose={() => setOpen(false)}
        >
          <iframe
            src={`/portal/f/${slug}`}
            title={name}
            className="border-line rounded-card h-[65vh] w-full border"
          />
        </Modal>
      ) : null}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 p-4">
      <p className="label flex items-center gap-1.5">
        <Settings2 size={13} />
        {title}
      </p>
      {children}
    </Card>
  );
}

function Labelled({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">
        {label}
        {required ? <span className="text-negative"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

/**
 * Tells the page head that something is waiting to be saved.
 *
 * The head is above all three columns and the drafts live in one of them, so
 * the state has to travel up. It is reported rather than lifted because the
 * draft belongs to whichever thing is selected — moving it up would mean
 * rebuilding it on every selection.
 */
function useReportDirty(dirty: boolean, onDirty: (dirty: boolean) => void) {
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
}

function FieldInspector({
  field,
  form,
  onDirty,
}: {
  field: BuilderField;
  form: BuilderForm;
  onDirty: (dirty: boolean) => void;
}) {
  const t = useMessages();

  // Keyed on the field id by the caller, so selecting another question starts a
  // fresh draft rather than carrying the previous one's text into it.
  const draft = useDraft({
    label: field.label,
    kind: field.kind,
    hint: field.hint ?? "",
    placeholder: field.placeholder ?? "",
    options: field.options.join("\n"),
    required: field.required,
    halfWidth: field.halfWidth,
    target: field.target,
    sectionId: field.sectionId ?? "",
    showWhenFieldId: field.showWhenFieldId ?? "",
    showWhenValue: field.showWhenValue ?? "",
  });
  const { draft: d, set } = draft;
  useReportDirty(draft.dirty, onDirty);

  const earlier = form.fields.slice(
    0,
    form.fields.findIndex((row) => row.id === field.id),
  );
  const condition = form.fields.find((row) => row.id === d.showWhenFieldId);
  // Only a question with a fixed set of answers can be matched on; an exact
  // match against free text is a trap, so those are not offered.
  const conditionable = earlier.filter(
    (row) =>
      row.kind === "SELECT" ||
      row.kind === "RADIO" ||
      row.kind === "CHECKBOX" ||
      row.id === d.showWhenFieldId,
  );
  const hasOptions = d.kind === "SELECT" || d.kind === "RADIO";

  return (
    <div className="space-y-3">
      <Panel title={t.forms.question}>
        <Labelled label={t.forms.label} required>
          <Input
            value={d.label}
            autoFocus
            required
            maxLength={120}
            onChange={(event) => set({ label: event.target.value })}
          />
        </Labelled>

        <div className="grid grid-cols-2 gap-2.5">
          <Labelled label={t.forms.kind}>
            <Select
              value={d.kind}
              onChange={(event) => set({ kind: event.target.value as PortalFieldKind })}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.forms.kinds[kind]}
                </option>
              ))}
            </Select>
          </Labelled>

          {!hasOptions && d.kind !== "CHECKBOX" ? (
            <Labelled label={t.forms.placeholder}>
              <Input
                value={d.placeholder}
                maxLength={120}
                placeholder={t.common.optional}
                onChange={(event) => set({ placeholder: event.target.value })}
              />
            </Labelled>
          ) : null}
        </div>

        <Labelled label={t.forms.helpText}>
          <Input
            value={d.hint}
            maxLength={240}
            placeholder={t.common.optional}
            onChange={(event) => set({ hint: event.target.value })}
          />
        </Labelled>

        {hasOptions ? (
          <Labelled label={t.forms.optionsHint}>
            <Textarea
              value={d.options}
              rows={4}
              onChange={(event) => set({ options: event.target.value })}
              className="text-base"
            />
          </Labelled>
        ) : null}

        <div className="flex flex-wrap gap-4 pt-0.5">
          <label className="text-text-2 flex items-center gap-2 text-base">
            <input
              type="checkbox"
              checked={d.required}
              onChange={(event) => set({ required: event.target.checked })}
              className="size-4 accent-[var(--brand)]"
            />
            {t.forms.required}
          </label>

          <label className="text-text-2 flex items-center gap-2 text-base">
            <input
              type="checkbox"
              checked={d.halfWidth}
              onChange={(event) => set({ halfWidth: event.target.checked })}
              className="size-4 accent-[var(--brand)]"
            />
            {t.forms.halfWidth}
          </label>
        </div>
      </Panel>

      <Panel title={t.forms.whereItGoes}>
        <Labelled label={t.forms.target}>
          <Select
            value={d.target}
            onChange={(event) => set({ target: event.target.value as PortalFieldTarget })}
          >
            {TARGETS.map((target) => (
              <option key={target} value={target}>
                {t.forms.targets[target]}
              </option>
            ))}
          </Select>
        </Labelled>

        {form.sections.length > 0 ? (
          <Labelled label={t.forms.group}>
            <Select
              value={d.sectionId}
              onChange={(event) => set({ sectionId: event.target.value })}
            >
              <option value="">{t.forms.noGroup}</option>
              {form.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </Select>
          </Labelled>
        ) : null}
      </Panel>

      <Panel title={t.forms.onlyShowWhen}>
        <div className="grid grid-cols-2 gap-2.5">
          <Labelled label={t.forms.dependsOn}>
            <Select
              value={d.showWhenFieldId}
              disabled={conditionable.length === 0}
              onChange={(event) =>
                set({
                  showWhenFieldId: event.target.value,
                  showWhenValue: event.target.value ? d.showWhenValue : "",
                })
              }
            >
              <option value="">{t.forms.alwaysShown}</option>
              {conditionable.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label || t.forms.untitledField}
                </option>
              ))}
            </Select>
          </Labelled>

          {condition ? (
            <Labelled label={t.forms.equals}>
              {condition.options.length > 0 ? (
                <Select
                  value={d.showWhenValue}
                  onChange={(event) => set({ showWhenValue: event.target.value })}
                >
                  <option value="">{t.portal.choose}</option>
                  {condition.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : condition.kind === "CHECKBOX" ? (
                <Select
                  value={d.showWhenValue}
                  onChange={(event) => set({ showWhenValue: event.target.value })}
                >
                  <option value="on">{t.common.yes}</option>
                  <option value="">{t.common.no}</option>
                </Select>
              ) : (
                <Input
                  value={d.showWhenValue}
                  onChange={(event) => set({ showWhenValue: event.target.value })}
                />
              )}
            </Labelled>
          ) : null}
        </div>

        <p className="text-text-3 flex items-start gap-1.5 text-sm leading-snug">
          <Info size={13} aria-hidden className="mt-px shrink-0" />
          {t.forms.conditionNote}
        </p>
      </Panel>

      <SaveBar
        draft={draft}
        save={(values) =>
          updateField(field.id, {
            label: values.label,
            kind: values.kind,
            hint: values.hint,
            placeholder: values.placeholder,
            options: values.options,
            required: values.required,
            halfWidth: values.halfWidth,
            target: values.target,
            sectionId: values.sectionId || null,
            showWhenFieldId: values.showWhenFieldId || null,
            showWhenValue: values.showWhenFieldId ? values.showWhenValue : null,
          })
        }
      />
    </div>
  );
}

function SectionInspector({
  section,
  pending,
  run,
  onDirty,
  onDeleted,
}: {
  section: BuilderSection;
  pending: boolean;
  run: Run;
  onDirty: (dirty: boolean) => void;
  onDeleted: () => void;
}) {
  const t = useMessages();
  const draft = useDraft({
    title: section.title,
    description: section.description ?? "",
  });
  const { draft: d, set } = draft;
  useReportDirty(draft.dirty, onDirty);

  return (
    <div className="space-y-3">
      <Panel title={t.forms.group}>
        <Labelled label={t.settings.name}>
          <Input
            value={d.title}
            autoFocus
            maxLength={80}
            onChange={(event) => set({ title: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.forms.helpText}>
          <Textarea
            value={d.description}
            rows={2}
            maxLength={300}
            placeholder={t.common.optional}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Labelled>
      </Panel>

      <SaveBar
        draft={draft}
        save={(values) =>
          updateSection(section.id, { title: values.title, description: values.description })
        }
      />

      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result = await deleteSection(section.id);
            if (result.ok) onDeleted();
            return result;
          })
        }
        className="text-negative w-full"
      >
        <Trash2 size={14} />
        {t.forms.deleteGroup}
      </Button>
    </div>
  );
}

function FormInspector({
  form,
  categories,
  teams,
  projects,
  plans,
  onDirty,
}: {
  form: BuilderForm;
  categories: Option[];
  teams: Option[];
  projects: Option[];
  plans: Option[];
  onDirty: (dirty: boolean) => void;
}) {
  const t = useMessages();

  const draft = useDraft({
    name: form.name,
    summary: form.summary ?? "",
    description: form.description ?? "",
    confirmation: form.confirmation ?? "",
    keywords: form.keywords.join(", "),
    icon: form.icon ?? "help",
    color: form.color,
    categoryId: form.categoryId ?? "",
    isFeatured: form.isFeatured,
    type: form.type,
    priority: form.priority,
    teamId: form.teamId ?? "",
    projectId: form.projectId ?? "",
    planId: form.planId ?? "",
  });
  const { draft: d, set } = draft;
  useReportDirty(draft.dirty, onDirty);

  return (
    <div className="space-y-3">
      <Panel title={t.forms.aboutForm}>
        <Labelled label={t.settings.name}>
          <Input
            value={d.name}
            maxLength={80}
            onChange={(event) => set({ name: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.forms.cardLine}>
          <Input
            value={d.summary}
            maxLength={200}
            placeholder={t.forms.cardLineHint}
            onChange={(event) => set({ summary: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.forms.intro}>
          <Textarea
            value={d.description}
            rows={3}
            maxLength={600}
            placeholder={t.common.optional}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Labelled>

        {/* Icon and colour are one decision — the tile on the card — so they
            are shown as one row, with the colour as a swatch rather than a
            control that looks like a text field. */}
        <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2.5">
          <Labelled label={t.forms.icon}>
            <Select value={d.icon} onChange={(event) => set({ icon: event.target.value })}>
              {Object.keys(PORTAL_ICONS).map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label={t.settings.colour}>
            <input
              type="color"
              value={d.color}
              onChange={(event) => set({ color: event.target.value })}
              className="border-line rounded-control h-9 w-full cursor-pointer border bg-transparent p-1"
            />
          </Labelled>
        </div>
      </Panel>

      <Panel title={t.forms.findability}>
        <Labelled label={t.forms.section}>
          <SectionPicker
            value={d.categoryId}
            sections={categories}
            onChange={(categoryId) => set({ categoryId })}
          />
        </Labelled>

        <Labelled label={t.forms.keywords}>
          <Input
            value={d.keywords}
            placeholder={t.forms.keywordsHint}
            onChange={(event) => set({ keywords: event.target.value })}
          />
        </Labelled>

        <label className="text-text-2 flex items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={d.isFeatured}
            onChange={(event) => set({ isFeatured: event.target.checked })}
            className="size-4 accent-[var(--brand)]"
          />
          {t.forms.featureIt}
        </label>
        <p className="text-text-3 text-sm leading-snug">{t.forms.featureHint}</p>
      </Panel>

      <Panel title={t.forms.raisesTitle}>
        <div className="grid grid-cols-2 gap-2.5">
          <Labelled label={t.ticket.type}>
            <Select
              value={d.type}
              onChange={(event) => set({ type: event.target.value as BuilderForm["type"] })}
            >
              {TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {t.vocab.type[type]}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label={t.ticket.priority}>
            <Select
              value={d.priority}
              onChange={(event) => set({ priority: event.target.value as BuilderForm["priority"] })}
            >
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {t.vocab.priority[priority]}
                </option>
              ))}
            </Select>
          </Labelled>
        </div>

        <Labelled label={t.ticket.team}>
          <Select value={d.teamId} onChange={(event) => set({ teamId: event.target.value })}>
            <option value="">{t.tickets.unrouted}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Labelled>

        <Labelled label={t.ticket.project}>
          <Select value={d.projectId} onChange={(event) => set({ projectId: event.target.value })}>
            <option value="">{t.ticket.noProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Labelled>

        {d.type === "CHANGE" ? (
          <Labelled label={t.plan.title}>
            <Select value={d.planId} onChange={(event) => set({ planId: event.target.value })}>
              <option value="">{t.plan.noTemplateChosen}</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
          </Labelled>
        ) : null}
      </Panel>

      <Panel title={t.forms.afterSending}>
        <Labelled label={t.forms.confirmation}>
          <Textarea
            value={d.confirmation}
            rows={3}
            maxLength={400}
            placeholder={t.forms.confirmationHint}
            onChange={(event) => set({ confirmation: event.target.value })}
          />
        </Labelled>
      </Panel>

      <SaveBar
        draft={draft}
        save={(values) =>
          updateForm(form.id, {
            name: values.name,
            summary: values.summary,
            description: values.description,
            confirmation: values.confirmation,
            keywords: values.keywords,
            icon: values.icon,
            color: values.color,
            categoryId: values.categoryId || null,
            isFeatured: values.isFeatured,
            type: values.type,
            priority: values.priority,
            teamId: values.teamId || null,
            projectId: values.projectId || null,
            planId: values.planId || null,
          })
        }
      />
    </div>
  );
}

/**
 * The same form, in another language.
 *
 * One draft and one Save for the whole thing: a form half in Dutch reads worse
 * than one entirely in English, so the words are committed together. Anything
 * left blank falls back to the original, and clearing everything takes the
 * translation back.
 */
function TranslationPane({
  form,
  locale,
  onDirty,
}: {
  form: BuilderForm;
  locale: string;
  onDirty: (dirty: boolean) => void;
}) {
  const t = useMessages();

  const said = form.translations.find((row) => row.locale.split("-")[0] === locale);
  const saidField = (field: BuilderField) =>
    field.translations.find((row) => row.locale.split("-")[0] === locale);

  const draft = useDraft({
    name: said?.name ?? "",
    summary: said?.summary ?? "",
    description: said?.description ?? "",
    fields: form.fields.map((field) => {
      const row = saidField(field);
      return {
        id: field.id,
        label: row?.label ?? "",
        hint: row?.hint ?? "",
        placeholder: row?.placeholder ?? "",
        options: (row?.options ?? []).join("\n"),
      };
    }),
  });
  const { draft: d, set } = draft;
  useReportDirty(draft.dirty, onDirty);

  function setField(id: string, patch: Partial<(typeof d.fields)[number]>) {
    set({ fields: d.fields.map((row) => (row.id === id ? { ...row, ...patch } : row)) });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className="text-text-3 text-base">{t.forms.translateForm}</p>

      <Panel title={t.forms.aboutForm}>
        <Labelled label={t.settings.name}>
          <Input
            value={d.name}
            maxLength={80}
            placeholder={form.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.forms.cardLine}>
          <Input
            value={d.summary}
            maxLength={200}
            placeholder={form.summary ?? t.common.optional}
            onChange={(event) => set({ summary: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.forms.intro}>
          <Textarea
            value={d.description}
            rows={3}
            maxLength={600}
            placeholder={form.description ?? t.common.optional}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Labelled>
      </Panel>

      <Panel title={t.forms.translateQuestions}>
        {form.fields.length === 0 ? (
          <p className="text-text-3 text-base">{t.forms.emptyForm}</p>
        ) : null}

        {form.fields.map((field) => {
          const row = d.fields.find((entry) => entry.id === field.id);
          if (!row) return null;
          const hasOptions = field.kind === "SELECT" || field.kind === "RADIO";

          return (
            <div key={field.id} className="border-line rounded-card space-y-2.5 border p-3">
              <p className="text-text-3 text-sm">
                {field.label || t.forms.untitledField}
                {field.required ? <span className="text-negative"> *</span> : null}
              </p>

              <Input
                value={row.label}
                maxLength={120}
                placeholder={field.label}
                aria-label={t.forms.label}
                onChange={(event) => setField(field.id, { label: event.target.value })}
              />

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input
                  value={row.hint}
                  maxLength={240}
                  placeholder={field.hint ?? t.forms.helpText}
                  aria-label={t.forms.helpText}
                  onChange={(event) => setField(field.id, { hint: event.target.value })}
                />
                {!hasOptions && field.kind !== "CHECKBOX" ? (
                  <Input
                    value={row.placeholder}
                    maxLength={120}
                    placeholder={field.placeholder ?? t.forms.placeholder}
                    aria-label={t.forms.placeholder}
                    onChange={(event) => setField(field.id, { placeholder: event.target.value })}
                  />
                ) : null}
              </div>

              {hasOptions ? (
                <Textarea
                  value={row.options}
                  rows={Math.max(2, field.options.length)}
                  placeholder={field.options.join("\n")}
                  aria-label={t.forms.optionsHint}
                  className="text-base"
                  onChange={(event) => setField(field.id, { options: event.target.value })}
                />
              ) : null}
            </div>
          );
        })}
      </Panel>

      <SaveBar
        draft={draft}
        save={(values) =>
          saveFormTranslation(form.id, locale, {
            name: values.name,
            summary: values.summary,
            description: values.description,
            fields: values.fields,
          })
        }
      />
    </div>
  );
}
