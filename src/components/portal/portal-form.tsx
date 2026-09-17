"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookOpen, Send } from "lucide-react";
import type { PortalFieldKind, PortalFieldTarget } from "@/generated/prisma/enums";
import { readAnswer, submitForm, suggestAnswers } from "@/lib/actions/portal";
import type { SearchHit } from "@/lib/portal";
import {
  Button,
  buttonClass,
  FieldError,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  AttachButton,
  AttachChips,
  AttachmentsProvider,
  DropZone,
} from "@/components/tickets/file-picker";
import { useMessages } from "@/components/shell/instance-context";
import { Markdown } from "@/components/markdown";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";

export type PortalField = {
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
};

export type PortalSection = { id: string; title: string; description: string | null };

/**
 * The form a requester fills in.
 *
 * Answers are held here rather than left to the DOM, because a question can
 * depend on an earlier answer: a field whose condition is unmet is not rendered
 * at all, and the action applies the same rule again so a hidden question can
 * never be required — or smuggled in.
 *
 * Field ids are the input names, so the action pairs an answer with the
 * question that asked it without a schema built at runtime.
 */
export function PortalForm({
  formId,
  sections,
  fields,
  footer,
}: {
  formId: string;
  sections: PortalSection[];
  fields: PortalField[];
  /// What happens when this is sent, written by the server: it knows the
  /// desk"s clock, the group behind the form and who is signed in.
  footer: string[];
}) {
  const t = useMessages();
  const submit = submitForm.bind(null, formId);
  const [state, formAction] = useActionState(submit, undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const errors = state?.errors ?? {};

  // Whichever question becomes the ticket's subject is the one worth searching
  // on; failing that, the first thing they type.
  const subjectField =
    fields.find((field) => field.target === "TITLE") ??
    fields.find((field) => field.kind === "TEXT") ??
    null;
  const subject = subjectField ? (answers[subjectField.id] ?? "") : "";

  const visible = (field: PortalField) =>
    !field.showWhenFieldId ||
    (answers[field.showWhenFieldId] ?? "") === (field.showWhenValue ?? "");

  const groups = [
    ...sections.map((section) => ({
      section,
      fields: fields.filter((field) => field.sectionId === section.id && visible(field)),
    })),
    { section: null, fields: fields.filter((field) => !field.sectionId && visible(field)) },
  ].filter((group) => group.fields.length > 0);

  return (
    <form action={formAction} className="space-y-7">
      <AttachmentsProvider>
        <DropZone className="-m-2 space-y-7 p-2">
          <FormError>{errors.form}</FormError>

          <Suggestions query={subject} />

          {groups.map(({ section, fields: group }) => (
            <fieldset key={section?.id ?? "loose"} className="space-y-4">
              {section ? (
                <legend className="mb-3">
                  <span className="text-md block font-semibold">{section.title}</span>
                  {section.description ? (
                    <span className="text-text-3 mt-0.5 block text-base">
                      {section.description}
                    </span>
                  ) : null}
                </legend>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                {group.map((field) => (
                  <div
                    key={field.id}
                    className={cn("min-w-0", field.halfWidth ? "sm:col-span-1" : "sm:col-span-2")}
                  >
                    <label htmlFor={field.id} className="mb-1.5 flex items-baseline gap-1.5">
                      <span className="text-md font-medium">{field.label}</span>
                      {field.required ? (
                        <span className="text-negative text-base" title={t.portal.required}>
                          *
                        </span>
                      ) : null}
                    </label>

                    {/* Pasting a screenshot into any answer attaches it, rather
                    than dropping nothing into the box. */}
                    <FieldInput
                      field={field}
                      value={answers[field.id] ?? ""}
                      onChange={(value) =>
                        setAnswers((current) => ({ ...current, [field.id]: value }))
                      }
                    />

                    {field.hint ? <p className="text-text-3 mt-1.5 text-sm">{field.hint}</p> : null}
                    <FieldError>{errors[field.id]}</FieldError>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Its own block rather than a question the desk has to remember to add
          to every form: a screenshot helps whatever was asked for. */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-md font-medium">{t.ticket.attachments}</span>
              <AttachButton className={buttonClass("outline", "sm")} showLabel />
            </div>
            <p className="text-text-3 text-sm">{t.ticket.attachHint}</p>
            <FieldError>{errors.files}</FieldError>
            <AttachChips />
          </div>

          <div className="border-line flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t pt-5">
            {/* What sending this actually does, said before it is done rather than
            on the confirmation screen afterwards. */}
            <div className="text-text-3 min-w-0 space-y-0.5 text-sm">
              {footer.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Submit />
          </div>
        </DropZone>
      </AttachmentsProvider>
    </form>
  );
}

/**
 * "Before you send this." Articles that match what the subject line says so
 * far, offered once there is enough of it to mean anything.
 */
function Suggestions({ query }: { query: string }) {
  const t = useMessages();
  const [found, setFound] = useState<SearchHit[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [peek, setPeek] = useState<SearchHit | null>(null);

  const wanted = query.trim();

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 5) return;

    // Long enough that a sentence is not searched on every keystroke, short
    // enough that the answer is there before the description is written.
    const timer = setTimeout(() => {
      suggestAnswers(needle).then(setFound);
    }, 450);

    return () => clearTimeout(timer);
  }, [query]);

  // Held rather than cleared while the subject is being edited: results that
  // blink out between keystrokes are worse than results a word behind.
  const hits = wanted.length >= 5 ? found : [];

  if (dismissed || hits.length === 0) return null;

  return (
    <section className="animate-rise border-border bg-surface-2 rounded-card border p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <BookOpen size={15} className="text-text-3 shrink-0" aria-hidden />
        <p className="text-base font-semibold">{t.portal.mightAnswer}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-3 hover:bg-surface-3 hover:text-text ml-auto rounded-full px-2.5 py-1 text-sm font-medium transition-colors"
        >
          {t.portal.noneOfThese}
        </button>
      </div>

      <ul className="space-y-1.5">
        {hits.map((hit) => (
          <li key={hit.id}>
            {/* Opened in place rather than followed: someone halfway through
                describing a problem should not have to lose the form to find
                out whether the answer is the one they need. */}
            <button
              type="button"
              onClick={() => setPeek(hit)}
              className="border-border-soft bg-surface hover:border-brand/45 rounded-control block w-full border px-3 py-2.5 text-left transition-colors"
            >
              <span className="block text-base font-medium">{hit.title}</span>
              {hit.summary ? (
                <span className="text-text-3 mt-0.5 block truncate text-sm">{hit.summary}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {peek ? <AnswerPeek hit={peek} onClose={() => setPeek(null)} /> : null}
    </section>
  );
}

/**
 * A suggested answer, read without leaving the form.
 *
 * The words of the article and nothing else: no shelf of related answers, no
 * "still stuck" cards. Both of those are ways out of an article, and this
 * reader already has one — the form behind the dialog.
 */
function AnswerPeek({ hit, onClose }: { hit: SearchHit; onClose: () => void }) {
  const t = useMessages();
  const [words, setWords] = useState<{
    title: string;
    summary: string | null;
    body: string;
  } | null>(null);

  useEffect(() => {
    let live = true;
    readAnswer(hit.slug).then((found) => {
      if (live) setWords(found);
    });
    return () => {
      live = false;
    };
  }, [hit.slug]);

  return (
    <Modal
      title={words?.title ?? hit.title}
      description={words?.summary ?? hit.summary ?? undefined}
      size="lg"
      onClose={onClose}
    >
      {words ? (
        <Markdown
          text={words.body}
          className="text-md max-h-[60vh] overflow-y-auto leading-[1.75]"
        />
      ) : (
        <p className="text-text-3 text-base">{t.common.loading}</p>
      )}
    </Modal>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PortalField;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useMessages();
  const shared = { id: field.id, name: field.id };

  if (field.kind === "TEXTAREA") {
    // Deliberately a plain box. Somebody describing a broken laptop is not
    // writing a document, and a formatting toolbar in front of them turns a
    // stray asterisk into a heading — the request then arrives at the desk
    // looking like a mistake. See `submitForm`, which stores what they typed
    // so it cannot be read as Markdown later either.
    return (
      <Textarea
        {...shared}
        rows={4}
        maxLength={10_000}
        placeholder={field.placeholder ?? undefined}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      />
    );
  }

  if (field.kind === "SELECT") {
    return (
      <Select {...shared} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t.portal.choose}</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  if (field.kind === "RADIO") {
    return (
      <div className="space-y-1.5">
        {field.options.map((option) => (
          <label
            key={option}
            className={cn(
              "rounded-control text-md flex cursor-pointer items-center gap-2.5 border px-3 py-2 transition-colors",
              value === option
                ? "border-brand/45 bg-[var(--brand-tint)]"
                : "border-border hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name={field.id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            {/* Drawn rather than accented: a native radio picks its own dot
                colour per platform, and on a dark ground that came out as a
                grey ring with a grey centre. */}
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                value === option ? "bg-brand border-brand" : "border-line-strong",
              )}
            >
              {value === option ? <span className="size-1.5 rounded-full bg-white" /> : null}
            </span>
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (field.kind === "CHECKBOX") {
    return (
      <label className="border-border hover:bg-surface-2 rounded-control text-md flex cursor-pointer items-center gap-2.5 border px-3 py-2.5 transition-colors">
        <input
          {...shared}
          type="checkbox"
          checked={value === "on"}
          onChange={(event) => onChange(event.target.checked ? "on" : "")}
          className="size-4 accent-[var(--brand)]"
        />
        {field.placeholder ?? field.hint ?? field.label}
      </label>
    );
  }

  const type =
    field.kind === "DATE"
      ? "date"
      : field.kind === "NUMBER"
        ? "number"
        : field.kind === "EMAIL"
          ? "email"
          : field.kind === "PHONE"
            ? "tel"
            : "text";

  return (
    <Input
      {...shared}
      type={type}
      maxLength={300}
      placeholder={field.placeholder ?? undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function Submit() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Send size={15} />
      {pending ? t.portal.sending : t.portal.send}
    </Button>
  );
}
