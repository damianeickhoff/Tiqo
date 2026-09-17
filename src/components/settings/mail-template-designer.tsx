"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Loader2, RotateCcw, Send } from "lucide-react";
import { resetMailTemplate, sendMailTest, updateMailTemplate } from "@/lib/actions/mail";
import { firstLine, render, renderHtml, VARIABLES, type TemplateKind } from "@/lib/mail-templates";
import { mailDocument, plainDocument, LAYOUT_HOLES, MAIL_PAPER } from "@/lib/mail-layout";
import { Button, buttonClass, Input, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * One message, edited on a page of its own.
 *
 * The words on the left and what arrives on the right, because the whole
 * difficulty of a template editor is the gap between the two: a subject with a
 * variable in it is unreadable until something fills it in. The variables are
 * offered as something to click rather than as a list to copy from, for the
 * same reason.
 *
 * The left column is deliberately the narrow one. A message is a paragraph and
 * a half; the thing that needs the room is the mail itself, drawn at the width
 * it actually arrives at. Wording and layout are two segments of that one
 * column rather than two columns or two pages, so taking the document over
 * costs no space and one Save covers both — they are one decision.
 *
 * Save and Cancel are the only writes. Send me a test and Back to the shipped
 * wording are verbs on their own and happen on the click.
 */

export type DesignerTemplate = {
  subject: string;
  body: string;
  /// The document, always filled in: the desk's own where it has one, and the
  /// shipped one otherwise. What is *stored* is null until the two differ —
  /// see the save below, which is what keeps an untouched layout following the
  /// app through an upgrade.
  html: string;
  ownLayout: boolean;
  /// Whether this wording is the desk's own. A shipped one has no row behind
  /// it, which is what "back to the shipped wording" goes back to.
  edited: boolean;
  shipped: { subject: string; body: string; html: string };
};

export type DesignerChrome = {
  /// What every variable stands for, worked out on the server from a real
  /// ticket where the desk has one.
  sample: Record<string, string>;
  sampleReference: string | null;
  brandColor: string;
  /// The sentence the footer offers, or empty on an instance that collects no
  /// mail. Decided on the server, because only it knows whether replies would
  /// arrive anywhere.
  replyHint: string;
  /// The sentence inside the reply marker, or empty where replies go nowhere.
  replyAbove: string;
  /// The desk's sign-off, unrendered: the preview fills it in like the message.
  signature: string;
};

type Part = "wording" | "layout";

export function MailTemplateDesigner({
  kind,
  template,
  sent,
  chrome,
}: {
  kind: TemplateKind;
  template: DesignerTemplate;
  /// How often this message has actually gone out in the last month. The only
  /// thing on this page that says whether rewording it is a small decision.
  sent: number;
  chrome: DesignerChrome;
}) {
  const t = useMessages();
  const router = useRouter();
  const meta = t.mail.templates[kind];

  const draft = useDraft({ subject: template.subject, body: template.body, html: template.html });
  const { draft: d, committed, set, commit } = draft;

  const [part, setPart] = useState<Part>("wording");
  const [resetting, startReset] = useTransition();
  const [sending, startSend] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  // Which field the cursor was last in, so a clicked variable knows where to
  // land. A subject, a message and a document are all text; only one of them is
  // in front of somebody at any moment.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState<keyof typeof d>("body");

  function insert(token: string) {
    const field =
      focused === "subject"
        ? subjectRef.current
        : focused === "body"
          ? bodyRef.current
          : htmlRef.current;
    const text = d[focused];

    const from = field?.selectionStart ?? text.length;
    const to = field?.selectionEnd ?? from;
    const next = text.slice(0, from) + token + text.slice(to);

    if (focused === "subject") set({ subject: next });
    else if (focused === "body") set({ body: next });
    else set({ html: next });

    // Back where they were, with the cursor after what was just dropped in —
    // otherwise clicking three variables in a row puts them all in one place.
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(from + token.length, from + token.length);
    });
  }

  const changedWording = d.subject !== committed.subject || d.body !== committed.body;
  const changedLayout = d.html !== committed.html;
  const summary = changedLayout
    ? changedWording
      ? t.mail.changedWordingAndLayout
      : t.mail.changedLayout
    : d.subject !== committed.subject
      ? d.body !== committed.body
        ? t.mail.changedBoth
        : t.mail.changedSubject
      : d.body !== committed.body
        ? t.mail.changedBody
        : undefined;

  return (
    <>
      {/* Its own head rather than the settings one: this page has left that
          layout behind, and what belongs up here is the message's, not the
          settings area's. */}
      <div className="border-line flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-2 lg:px-6">
        <Link
          href="/settings/mail/templates"
          className="text-text-2 hover:text-text -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-base font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          {t.mail.backToWording}
        </Link>

        <span aria-hidden className="bg-line hidden h-[18px] w-px sm:block" />

        <h1 className="text-lg leading-tight font-semibold tracking-[-0.01em]">{meta.name}</h1>
        {template.edited ? <Pill>{t.mail.edited}</Pill> : null}
        {template.ownLayout ? <Pill>{t.mail.layoutOwn}</Pill> : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {said ? (
            <span
              className={cn(
                "animate-fade text-sm font-medium",
                said.ok ? "text-positive" : "text-negative",
              )}
            >
              {said.text}
            </span>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() =>
              startSend(async () => {
                setSaid(null);
                // The document on screen, saved or not: a layout is a thing you
                // judge in a real client, and testing the stored one would send
                // back the version somebody is in the middle of replacing.
                const result = await sendMailTest(kind, d.html);
                setSaid(
                  result.ok
                    ? { ok: true, text: t.mail.sentTest(result.to) }
                    : { ok: false, text: result.error ?? t.errors.generic },
                );
              })
            }
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? t.mail.sendingTest : t.mail.sendTest}
          </Button>

          {/* Only where there is something of the desk's own to drop. Dropping
              it puts the shipped text back on screen as well as deleting the
              row: watching it change is the confirmation that it did. */}
          {template.edited || template.ownLayout ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={resetting}
              onClick={() =>
                startReset(async () => {
                  const result = await resetMailTemplate(kind);
                  if (result.ok) commit(template.shipped);
                })
              }
            >
              <RotateCcw size={14} />
              {t.mail.shippedAgain}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 px-5 py-5 lg:px-6 xl:grid-cols-[520px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Segments
            options={[
              { value: "wording" as const, label: t.mail.segmentWording },
              { value: "layout" as const, label: t.mail.segmentLayout },
            ]}
            value={part}
            onChange={(next) => {
              setPart(next);
              // A clicked variable lands where the cursor is, and the field the
              // cursor was in has just left the screen. Aim it at the box that
              // is now in front of them.
              setFocused(next === "layout" ? "html" : "body");
            }}
          />

          {part === "wording" ? (
            <>
              <label className="block">
                <span className="label mb-1.5 block">{t.mail.subjectLabel}</span>
                <Input
                  ref={subjectRef}
                  value={d.subject}
                  maxLength={200}
                  onFocus={() => setFocused("subject")}
                  onChange={(event) => set({ subject: event.target.value })}
                  className="font-mono text-sm"
                />
              </label>

              <label className="block">
                <span className="label mb-1.5 block">{t.mail.bodyLabel}</span>
                {/* Never taller than the mail beside it: a box that outgrows
                    the preview turns the page back into the one this replaced,
                    where the words had all the room and the result had none. */}
                <Textarea
                  ref={bodyRef}
                  value={d.body}
                  maxLength={10_000}
                  onFocus={() => setFocused("body")}
                  onChange={(event) => set({ body: event.target.value })}
                  className="h-[300px] resize-none font-mono text-sm"
                />
              </label>

              <Chips label={t.mail.insert} onPick={insert} tokens={wordingTokens(kind)} />

              <p className="text-text-3 flex items-start gap-2 text-sm leading-relaxed">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {t.mail.designerHint} {t.mail.variablesHint}
                </span>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="label">{t.mail.layoutLabel}</span>
                {/* A draft change like any other in here: it puts the shipped
                    document back in the box, and Save is what makes it the one
                    that goes out. */}
                {d.html !== template.shipped.html ? (
                  <button
                    type="button"
                    onClick={() => set({ html: template.shipped.html })}
                    className="text-text-3 hover:text-text inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-medium transition-colors"
                  >
                    <RotateCcw size={13} />
                    {t.mail.shippedLayoutAgain}
                  </button>
                ) : null}
              </div>

              <CodeBox
                ref={htmlRef}
                value={d.html}
                onFocus={() => setFocused("html")}
                onChange={(next) => set({ html: next })}
              />

              <Chips
                label={t.mail.insert}
                onPick={insert}
                tokens={[...LAYOUT_HOLES.map((hole) => `{${hole}}`), ...wordingTokens(kind)]}
              />

              <p className="text-text-3 flex items-start gap-2 text-sm leading-relaxed">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t.mail.layoutHint}</span>
              </p>
            </>
          )}

          <section className="card overflow-hidden">
            <div className="border-line flex h-[34px] items-center border-b px-3.5">
              <h2 className="label">{t.mail.whenTitle}</h2>
            </div>
            <dl className="text-md grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-3.5 py-3">
              <dt className="text-text-3 text-sm">{t.mail.whenTrigger}</dt>
              <dd>{meta.trigger}</dd>
              <dt className="text-text-3 text-sm">{t.mail.whenTo}</dt>
              <dd>{meta.goesTo}</dd>
              <dt className="text-text-3 text-sm">{t.mail.whenNever}</dt>
              <dd>{meta.never}</dd>
              <dt className="text-text-3 text-sm">{t.mail.colSentIn30}</dt>
              <dd className="font-mono">{sent}</dd>
            </dl>
          </section>
        </div>

        <Preview kind={kind} subject={d.subject} body={d.body} layout={d.html} chrome={chrome} />
      </div>

      <div className="border-line bg-surface sticky bottom-0 border-t px-5 py-2.5 lg:px-6">
        <SaveBar
          draft={draft}
          save={(values) =>
            updateMailTemplate(kind, {
              ...values,
              // Still the shipped document means the desk has not taken it
              // over, and an empty one is stored as null — which is what lets
              // the next release improve it.
              html: values.html === template.shipped.html ? "" : values.html,
            })
          }
          summary={summary}
          onCancel={() => router.push("/settings/mail/templates")}
        />
      </div>
    </>
  );
}

/** The variables this message can name, as things to click. */
function wordingTokens(kind: TemplateKind) {
  return VARIABLES[kind].map((name) => `{{${name}}}`);
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-brand/40 text-brand-deep rounded-full border bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
      {children}
    </span>
  );
}

function Chips({
  label,
  tokens,
  onPick,
}: {
  label: string;
  tokens: string[];
  onPick: (token: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-text-3 mr-1 text-sm">{label}</span>
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          onClick={() => onPick(token)}
          className="border-border text-text-2 hover:border-line-strong hover:bg-surface-2 hover:text-text rounded-control border px-2 py-1 font-mono text-xs transition-colors"
        >
          {token}
        </button>
      ))}
    </div>
  );
}

/**
 * The document, in a box that counts its lines.
 *
 * A textarea and a gutter that follows it, rather than an editor library: what
 * this holds is two hundred lines of table HTML somebody nudges twice a year,
 * and a syntax highlighter is a megabyte and a second dependency for that.
 * Tab types two spaces, because the alternative in a textarea is leaving the
 * box altogether halfway through a nested table.
 */
function CodeBox({
  ref,
  value,
  onChange,
  onFocus,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onFocus: () => void;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;

  return (
    <div className="border-border rounded-control bg-surface flex h-[300px] overflow-hidden border font-mono text-xs leading-5">
      <div
        ref={gutter}
        aria-hidden
        className="text-text-3 border-line bg-surface-2 shrink-0 overflow-hidden border-r px-2 py-2 text-right select-none"
      >
        {Array.from({ length: lines }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>

      <textarea
        ref={ref}
        value={value}
        spellCheck={false}
        wrap="off"
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab" || event.shiftKey) return;
          event.preventDefault();
          const field = event.currentTarget;
          const from = field.selectionStart;
          const to = field.selectionEnd;
          onChange(`${value.slice(0, from)}  ${value.slice(to)}`);
          requestAnimationFrame(() => field.setSelectionRange(from + 2, from + 2));
        }}
        className="text-text w-full resize-none bg-transparent px-2.5 py-2 leading-5 outline-none"
      />
    </div>
  );
}

/**
 * The message as it will arrive.
 *
 * In an iframe, because that is the only honest way to show it: the mail has
 * its own stylesheet-free, inline-styled world, and anything else would be the
 * settings page's typography wearing the mail's words. `srcDoc` with no sandbox
 * privileges keeps it a picture rather than a page.
 *
 * Six hundred pixels wide, on the ground a client puts behind it, because that
 * is the mail — a preview squeezed into a side rail answers "does the wording
 * read" and nothing at all about the document somebody is editing beside it.
 *
 * The plain-text half is one click away rather than hidden, because it is a
 * real message that real people receive — every mail goes out as both, and a
 * preview that only ever shows the pretty one lets the other rot.
 */
function Preview({
  kind,
  subject,
  body,
  layout,
  chrome,
}: {
  kind: TemplateKind;
  subject: string;
  body: string;
  layout: string;
  chrome: DesignerChrome;
}) {
  const t = useMessages();
  const [plain, setPlain] = useState(false);
  const [dark, setDark] = useState(false);

  /**
   * The words as they were a third of a second ago.
   *
   * The laid-out half is an iframe, and an iframe whose `srcDoc` changes is an
   * iframe that reloads — so typing a sentence into the box rebuilt a whole
   * document per keystroke and flickered while it did. A preview is a glance at
   * the result, not a mirror.
   */
  const [settled, setSettled] = useState({ subject, body, layout });
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ subject, body, layout }), 300);
    return () => clearTimeout(timer);
  }, [subject, body, layout]);

  // The bounce is the one message with no ticket behind it, so it gets neither
  // the card nor the button — the same decision the sender makes.
  const withTicket = kind !== "BOUNCE";
  const line = render(settled.subject, chrome.sample);
  const signature = render(chrome.signature, chrome.sample);

  const plainText = render(settled.body, chrome.sample);
  const html = mailDocument({
    content: renderHtml(settled.body, chrome.sample),
    preheader: firstLine(plainText),
    values: chrome.sample,
    brandColor: chrome.brandColor,
    withTicket,
    signature,
    subject: line,
    layout: settled.layout,
    labels: {
      openTicket: t.mail.openTicket,
      replyHint: chrome.replyHint,
      replyAbove: chrome.replyAbove,
    },
  });

  return (
    <section className="card flex min-w-0 flex-col overflow-hidden">
      <div className="border-line flex h-[34px] items-center gap-2 border-b px-3.5">
        <h2 className="label">{t.mail.preview}</h2>

        <div className="ml-auto flex items-center gap-1.5">
          <Toggle
            options={[
              { on: false, label: t.mail.previewRich },
              { on: true, label: t.mail.previewPlain },
            ]}
            value={plain}
            onChange={setPlain}
          />
          {/* Not a dark mail: the message declares itself light, deliberately,
              because a half-supported dark mail is a broken one. What this
              swaps is the ground a dark client puts behind it — which is the
              only part of "how it looks in dark mode" this side actually
              decides. */}
          <Toggle
            options={[
              { on: false, label: t.mail.previewLight },
              { on: true, label: t.mail.previewDark },
            ]}
            value={dark}
            onChange={setDark}
          />
        </div>
      </div>

      <div className="border-line bg-surface-2 border-b px-3.5 py-2">
        <p className="text-md font-semibold break-words">{line}</p>
      </div>

      {plain ? (
        <pre className="text-text-2 bg-surface min-h-[620px] flex-1 overflow-auto px-3.5 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {plainDocument({
            content: plainText,
            values: chrome.sample,
            withTicket,
            replyHint: chrome.replyHint,
            replyAbove: chrome.replyAbove,
            signature,
          })}
        </pre>
      ) : (
        <div
          className="flex-1 overflow-x-auto py-3"
          style={{ background: dark ? "#1c1917" : MAIL_PAPER }}
        >
          <iframe
            title={t.mail.preview}
            srcDoc={html}
            sandbox=""
            className="mx-auto block h-[620px] w-[600px] max-w-full border-0"
          />
        </div>
      )}

      <p className="text-text-3 border-line border-t px-3.5 py-2 text-sm">
        {chrome.sampleReference ? t.mail.previewOf(chrome.sampleReference) : t.mail.previewSample}
      </p>
    </section>
  );
}

/** Two words, one of them on. The same shape as every other segmented control
 *  in settings. */
function Toggle({
  options,
  value,
  onChange,
}: {
  options: { on: boolean; label: string }[];
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="border-border rounded-control flex border p-0.5">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.on)}
          aria-pressed={value === option.on}
          className={cn(
            buttonClass(value === option.on ? "outline" : "ghost", "sm"),
            "h-6 border-0 px-2 text-xs shadow-none",
            value === option.on && "bg-surface-3 text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Which half of the template is in the box. The same control as the preview's
 *  toggles, a step larger, because this one decides what the column is. */
function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="border-border rounded-control flex w-fit border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            buttonClass(value === option.value ? "outline" : "ghost", "sm"),
            "border-0 shadow-none",
            value === option.value && "bg-surface-3 text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
