"use client";

import { Fragment, useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BookOpen, Send } from "lucide-react";
import type { PortalFieldKind, PortalFieldTarget } from "@/generated/prisma/enums";
import { readAnswer, submitForm, suggestAnswers } from "@/lib/actions/portal";
import type { SearchHit } from "@/lib/portal";
import { FieldError, FormError, Input, Select, Textarea } from "@/components/ui";
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
 * Round 12 draws every answer as a filled well rather than an outlined box: on
 * the portal's grey ground a card is already an edge, and a second edge inside
 * it turns a form into a grid of boxes. The fill is what says "you write here".
 */
const WELL =
  "bg-surface-2 rounded-card border-transparent px-3.5 text-[14.5px] shadow-none focus:border-brand";

/** A section of the form: one padded row of the card, ruled off from the last. */
const GROUP = "px-7 py-[26px]";

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
  /// Written by the page, in parts, so the three things somebody checks
  /// before sending — what it becomes, who answers it, where the answer goes —
  /// can carry the weight in a sentence that is otherwise quiet.
  footer: ReactNode[];
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
    // One card, not one per section: the sections of a form are steps through a
    // single question, and cutting them into separate cards would make each
    // read as its own decision.
    <form action={formAction} className="pcard animate-rise min-w-0 pt-1.5">
      <AttachmentsProvider>
        <DropZone>
          {errors.form ? (
            <div className="px-7 pt-[26px]">
              <FormError>{errors.form}</FormError>
            </div>
          ) : null}

          {groups.map(({ section, fields: group }, index) => (
            <fieldset
              key={section?.id ?? "loose"}
              className={cn(GROUP, index > 0 && "border-line border-t")}
            >
              {section ? (
                <legend className="mb-[18px] block">
                  <span className="block text-[17px] font-semibold tracking-[-0.015em]">
                    {section.title}
                  </span>
                  {section.description ? (
                    <span className="text-text-3 mt-[3px] block text-[13.5px]">
                      {section.description}
                    </span>
                  ) : null}
                </legend>
              ) : null}

              <div className="grid gap-x-[22px] gap-y-[18px] sm:grid-cols-2">
                {group.map((field) => (
                  <Fragment key={field.id}>
                    <div
                      className={cn(
                        "flex min-w-0 flex-col gap-[7px]",
                        field.halfWidth ? "sm:col-span-1" : "sm:col-span-2",
                      )}
                    >
                      {/* A question with nothing written in it draws no label
                          rather than a lone asterisk over an empty line. The
                          designer refuses a blank one now, but forms built
                          before it did are still out there. */}
                      {field.label.trim() ? (
                        <label htmlFor={field.id} className="flex items-baseline gap-0.5">
                          <span className="text-[13.5px] font-semibold">{field.label}</span>
                          {field.required ? (
                            <span className="text-negative text-[13.5px]" title={t.portal.required}>
                              *
                            </span>
                          ) : null}
                        </label>
                      ) : null}

                      {/* Pasting a screenshot into any answer attaches it, rather
                      than dropping nothing into the box. */}
                      <FieldInput
                        field={field}
                        value={answers[field.id] ?? ""}
                        onChange={(value) =>
                          setAnswers((current) => ({ ...current, [field.id]: value }))
                        }
                      />

                      {field.hint ? (
                        <p className="text-text-3 text-[12.5px]">{field.hint}</p>
                      ) : null}
                      <FieldError>{errors[field.id]}</FieldError>
                    </div>

                    {/* Under the subject and nowhere else: the answer is offered
                        at the moment the question has been named, while there is
                        still nothing else typed to throw away. */}
                    {field.id === subjectField?.id ? (
                      <Suggestions query={subject} className="sm:col-span-2" />
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Its own block rather than a question the desk has to remember to add
          to every form: a screenshot helps whatever was asked for. */}
          <fieldset className={cn(GROUP, "border-line border-t")}>
            <legend className="mb-[18px] block">
              <span className="block text-[17px] font-semibold tracking-[-0.015em]">
                {t.ticket.attachments}
              </span>
              <span className="text-text-3 mt-[3px] block text-[13.5px]">
                {t.ticket.attachHint}
              </span>
            </legend>

            <div className="flex min-w-0 flex-col gap-[7px]">
              <div className="flex flex-wrap items-center gap-2">
                <AttachButton
                  className="bg-surface text-text hover:bg-surface-2 inline-flex h-[34px] shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium shadow-[var(--highlight)] transition-colors"
                  showLabel
                />
                <AttachChips />
              </div>
              <FieldError>{errors.files}</FieldError>
            </div>
          </fieldset>

          <div className="border-line flex flex-wrap items-center gap-x-[18px] gap-y-4 border-t px-7 py-5">
            {/* What sending this actually does, said before it is done rather than
            on the confirmation screen afterwards. */}
            <div className="text-text-2 min-w-0 text-[13.5px] leading-[1.55]">
              {footer.map((line, index) => (
                <p key={index}>{line}</p>
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
function Suggestions({ query, className }: { query: string; className?: string }) {
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
    // The one amber thing on the page. It is an interruption, and it should
    // look like one — but a wash rather than a fill, because it is offering
    // help rather than asking for an answer.
    <section
      className={cn("animate-rise rounded-[14px] bg-[var(--brand-wash)] px-[18px] py-4", className)}
    >
      <div className="flex items-center gap-2">
        <BookOpen size={15} className="text-text-3 shrink-0" aria-hidden />
        <p className="text-base font-semibold">{t.portal.mightAnswer}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-3 hover:text-text ml-auto shrink-0 rounded-full px-2 py-1 text-sm font-medium transition-colors"
        >
          {t.portal.noneOfThese}
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            {/* Opened in place rather than followed: someone halfway through
                describing a problem should not have to lose the form to find
                out whether the answer is the one they need. */}
            <button
              type="button"
              onClick={() => setPeek(hit)}
              className="bg-surface rounded-card flex w-full items-start gap-3 px-3.5 py-3 text-left shadow-[var(--highlight)] transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <BookOpen size={15} className="text-text-3 mt-px shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block text-base font-medium">{hit.title}</span>
                {hit.summary ? (
                  <span className="text-text-2 mt-0.5 block truncate text-[12.5px]">
                    {hit.summary}
                  </span>
                ) : null}
              </span>
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
        className={cn(WELL, "h-[104px] py-[11px]")}
      />
    );
  }

  if (field.kind === "SELECT") {
    return (
      <Select
        {...shared}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(WELL, "h-11 pr-9")}
      >
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
      <div className="flex flex-col gap-2">
        {field.options.map((option) => (
          <label
            key={option}
            className={cn(
              "rounded-card flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[14.5px] transition-colors",
              value === option
                ? "bg-[var(--brand-wash)] shadow-[inset_0_0_0_1.5px_var(--brand)]"
                : "bg-surface-2 hover:bg-surface-3",
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
                grey ring with a grey centre. The chosen dot is the brand and
                not the brand's ink, because the ink is near-black and the wash
                behind it is near-black once the theme is dark. */}
            <span
              aria-hidden
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                value === option ? "border-brand bg-surface" : "border-line-strong bg-surface",
              )}
            >
              {value === option ? <span className="bg-brand size-[9px] rounded-full" /> : null}
            </span>
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (field.kind === "CHECKBOX") {
    return (
      <label className="bg-surface-2 hover:bg-surface-3 rounded-card flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[14.5px] transition-colors">
        <input
          {...shared}
          type="checkbox"
          checked={value === "on"}
          onChange={(event) => onChange(event.target.checked ? "on" : "")}
          className="size-4 shrink-0 accent-[var(--brand)]"
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
      className={cn(WELL, "h-11")}
    />
  );
}

function Submit() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    // Ink rather than amber: this is the one thing on the page that is finished
    // with, and the amber on the portal means "your turn" everywhere else.
    <button
      type="submit"
      disabled={pending}
      className="text-md ml-auto inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[var(--text)] px-[26px] font-semibold whitespace-nowrap text-[var(--bg)] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
    >
      <Send size={16} />
      {pending ? t.portal.sending : t.portal.send}
    </button>
  );
}
