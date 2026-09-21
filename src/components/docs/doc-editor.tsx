"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Hash, Loader2, Pencil } from "lucide-react";
import { saveDoc } from "@/lib/actions/docs";
import { Markdown } from "@/components/markdown";
import { MarkdownEditor } from "@/components/markdown-editor";
import { DocOutline, type Heading } from "@/components/docs/doc-outline";
import { AttachmentsProvider, DropZone, useAttachments } from "@/components/tickets/file-picker";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** What the editor holds, which is exactly what a save writes. */
type Draft = { title: string; summary: string; body: string };

/**
 * The page, and the draft of the page.
 *
 * Reading and writing are the same component because they are the same thing
 * seen twice: the words on screen while editing have to be the words that were
 * there a moment ago, or somebody has to go and find their place again. What
 * changes is only whether the title is an input and the body is an editor.
 *
 * The toolbar belongs to it for the same reason — Edit is the control that
 * turns one into the other, and a button that lives outside the thing it
 * changes is a button wired through a third component.
 *
 * Nothing here is written until Save — no save on blur, no save on change. That
 * is the house rule, and it is the one a page like this breaks most easily,
 * because every field looks like it could stand alone.
 */
export function DocArticle({
  docId,
  /// This page's own address. Only used to open it in a second tab when
  /// somebody else's save has arrived under an open draft.
  docPath,
  title,
  summary,
  body,
  updatedAt,
  canEdit,
  openEditor = false,
  reviewByDefault,
  /// Where the page sits, drawn on the left of the toolbar.
  breadcrumb,
  /// Pinning, reading mode and the rest of the menu: server-rendered, because
  /// they are about the page rather than about the draft.
  actions,
  /// The rest of what can be done to the page, which sits after Edit because
  /// it is everything Edit is not.
  menu,
  /// Whether both rails are away. The words then get more of the width they
  /// have been given, which is the whole reason somebody turned it on.
  reading = false,
  /// The page's own headings, drawn as a button on the title's line while
  /// reading. Here rather than on the rail because it is the one thing beside
  /// the page that is used *while* reading it — and here rather than in the
  /// page beneath, because this component is the one that knows whether the
  /// words on screen are the page or a draft of it. Writing takes it away: an
  /// index of headings that are being rewritten is worse than no index.
  outline = [],
  /// Drawn beside the title when the page is not being edited: the review
  /// state, who owns it, when it was last touched. Hidden while writing,
  /// where it is noise around the thing being worked on.
  meta,
  /// Sub-pages and anything else that belongs under the words. Out of the way
  /// while the words are being written.
  below,
}: {
  docId: string;
  docPath: string;
  title: string;
  summary: string | null;
  body: string;
  /// The version this page was loaded at. Sent with the save so a page two
  /// people had open at once cannot be written over without anybody noticing.
  updatedAt: string;
  canEdit: boolean;
  /// Straight into the editor, for somebody who arrived from a list of pages
  /// that need rewriting rather than from a link to read one.
  openEditor?: boolean;
  /// Whether the tick in the footer starts on, from the desk's own setting.
  reviewByDefault: boolean;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  menu?: React.ReactNode;
  reading?: boolean;
  outline?: Heading[];
  meta?: React.ReactNode;
  below?: React.ReactNode;
}) {
  const t = useMessages();
  const router = useRouter();

  const incoming: Draft = { title, summary: summary ?? "", body };
  const [committed, setCommitted] = useState<Draft>(incoming);
  const [draft, setDraft] = useState<Draft>(incoming);
  const [note, setNote] = useState("");
  const [review, setReview] = useState(reviewByDefault);
  const [editing, setEditing] = useState(openEditor && canEdit);

  /**
   * What the server last said, so the page follows it.
   *
   * The words on screen are held here rather than read from the props on every
   * render, which is what lets the draft survive. But a restore from the
   * history panel — or anybody else's save arriving through a revalidation —
   * changes the props underneath us, and without this the page would go on
   * showing text that is no longer in the database.
   *
   * Somebody halfway through writing keeps what they have written: the editor
   * holds a draft, and a draft is not something a background refresh may take.
   */
  const [fromServer, setFromServer] = useState<Draft>(incoming);
  // Not refreshed while somebody is writing: that is the whole point of holding
  // it. A save arriving underneath an open editor has to make the next save
  // fail, not quietly become the version it is measured against.
  const [version, setVersion] = useState(updatedAt);
  if (
    incoming.title !== fromServer.title ||
    incoming.summary !== fromServer.summary ||
    incoming.body !== fromServer.body
  ) {
    setFromServer(incoming);
    setCommitted(incoming);
    if (!editing) {
      setDraft(incoming);
      setVersion(updatedAt);
    }
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Somebody else saved while this draft was open. Held apart from the other
  // form errors because it is the only one with a way out to offer.
  const [conflict, setConflict] = useState(false);
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  // Wide enough to hold a table and a code sample without folding them, and no
  // wider: a line of prose that runs the whole of a 1920 screen is a line
  // nobody finds the start of again. Reading mode, which has just taken both
  // rails away, gets the extra.
  const measure = reading ? "max-w-[72rem]" : "max-w-[60rem]";

  const dirty =
    draft.title !== committed.title ||
    draft.summary !== committed.summary ||
    draft.body !== committed.body;

  function set(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function leave() {
    setDraft(committed);
    setNote("");
    setReview(reviewByDefault);
    setErrors({});
    setConflict(false);
    setEditing(false);
  }

  function send(data: FormData) {
    startTransition(async () => {
      const result = await saveDoc(docId, data);
      if (!result.ok) {
        setErrors(result.errors);
        setConflict("conflict" in result && result.conflict === true);
        return;
      }
      setCommitted(draft);
      setVersion(result.updatedAt);
      setNote("");
      setReview(reviewByDefault);
      setErrors({});
      setConflict(false);
      setEditing(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 2400);
      // Renaming the page moved its address. Replaced rather than pushed: the
      // page the browser is standing on is this one, and Back should go where
      // somebody came from rather than to the name it used to have.
      if (result.href) router.replace(result.href);
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(new FormData(event.currentTarget));
  }

  /**
   * Save over the version that arrived while this draft was open.
   *
   * Dropping `loadedAt` is what tells the server to stop checking, and it is
   * safe to offer because a save keeps what it replaced: the other version
   * becomes the newest entry in the history rather than disappearing. The
   * guard exists so nobody does this without being told, not so that nobody
   * can do it.
   */
  function saveAnyway() {
    if (!form.current) return;
    const data = new FormData(form.current);
    data.delete("loadedAt");
    send(data);
  }

  if (!editing) {
    return (
      <>
        {/* The toolbar spans the sheet, not the page's measure: it acts on
            the document as a whole and belongs at the corner of the sheet
            holding it. Tying it to the words' own width to line it up with
            the index below dragged the whole row inwards on a wide screen,
            which is a worse thing to look at than two right edges that do
            not agree. */}
        <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-5 py-2 lg:px-6">
          {breadcrumb}
          <span className="ml-auto flex items-center gap-2">
            {flash ? (
              <span className="animate-fade text-positive inline-flex items-center gap-1 text-sm font-medium">
                <Check size={13} strokeWidth={2.5} />
                {t.common.saved}
              </span>
            ) : null}
            {actions}
            {canEdit ? (
              <Button type="button" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={13} />
                {t.docs.edit}
              </Button>
            ) : null}
            {menu}
          </span>
        </div>

        <div className="px-5 pt-2 pb-6 lg:px-6">
          <article className={measure}>
            <header>
              {/* The index belongs to the words, not to the row of things you
                  can do to them, so it stands at the end of the title's own
                  line. */}
              <div className="flex items-start gap-3">
                <h1 className="min-w-0 flex-1 text-xl leading-tight font-semibold tracking-[-0.02em] text-balance">
                  {committed.title}
                </h1>
                <DocOutline headings={outline} />
              </div>
              {committed.summary ? (
                <p className="text-text-2 text-md mt-2 leading-relaxed">{committed.summary}</p>
              ) : null}

              {meta ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">{meta}</div>
              ) : null}
            </header>

            <div className="border-line mt-5 border-t pt-5">
              {committed.body.trim() ? (
                <Markdown text={committed.body} className="tiqo-prose text-md leading-relaxed" />
              ) : (
                <p className="text-text-3 text-md italic">{t.docs.emptyDoc}</p>
              )}
            </div>

            {below}
          </article>
        </div>
      </>
    );
  }

  return (
    <form ref={form} onSubmit={submit} noValidate>
      <AttachmentsProvider>
        <DropZone>
          <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-5 py-2 lg:px-6">
            {breadcrumb}
            {/* Said plainly, because the whole of this screen is a draft and
                nothing on it has been written down yet. */}
            <span className="text-brand-deep inline-flex items-center gap-1.5 text-sm font-medium">
              <span className="bg-brand size-1.5 rounded-full" aria-hidden />
              {dirty ? t.docs.editingUnsaved : t.docs.editing}
            </span>
          </div>

          <div className="space-y-3 px-5 py-5 lg:px-6">
            <FormError>{errors.form}</FormError>
            {conflict ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* A new tab, because reading the other version must not cost
                    this draft — which is exactly what made the refusal a dead
                    end before. */}
                <a
                  href={docPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-deep inline-flex items-center gap-1 text-base font-medium hover:underline"
                >
                  <ExternalLink size={13} />
                  {t.docs.openTheirs}
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveAnyway}
                  className="text-text-3 hover:text-text rounded-full px-2 py-1 text-base font-medium transition-colors disabled:opacity-50"
                >
                  {t.docs.saveAnyway}
                </button>
              </div>
            ) : null}
            <input type="hidden" name="loadedAt" value={version} />

            <div>
              <Input
                name="title"
                value={draft.title}
                maxLength={160}
                autoFocus
                aria-label={t.docs.docTitle}
                placeholder={t.docs.docTitle}
                onChange={(event) => set({ title: event.target.value })}
                className="h-11 text-xl font-semibold tracking-[-0.02em]"
              />
              <FieldError>{errors.title}</FieldError>
            </div>

            <div>
              <Input
                name="summary"
                value={draft.summary}
                maxLength={240}
                aria-label={t.docs.summary}
                placeholder={t.docs.summaryHint}
                onChange={(event) => set({ summary: event.target.value })}
              />
              <FieldError>{errors.summary}</FieldError>
            </div>

            <MarkdownEditor
              name="body"
              value={draft.body}
              onChange={(value) => set({ body: value })}
              rows={18}
              maxLength={100_000}
              placeholder={t.docs.bodyPlaceholder}
              hint={
                <>
                  <Hash size={11} aria-hidden />
                  {t.docs.hashHint}
                </>
              }
            />
            <FieldError>{errors.body}</FieldError>

            <SaveRow
              written={dirty}
              pending={pending}
              note={note}
              onNote={setNote}
              review={review}
              onReview={setReview}
              onCancel={leave}
            />
          </div>
        </DropZone>
      </AttachmentsProvider>
    </form>
  );
}

/**
 * Save, Cancel, a line about what changed, and whether this counts as a review.
 *
 * Its own component only so that it sits *under* the attachments provider and
 * can ask it what has been picked: a diagram dropped on a page nobody has
 * retyped is still a change, and a Save that stays greyed out while a file is
 * sitting in the list is a Save that looks broken.
 */
function SaveRow({
  written,
  pending,
  note,
  onNote,
  review,
  onReview,
  onCancel,
}: {
  /// Whether the words themselves have changed.
  written: boolean;
  pending: boolean;
  note: string;
  onNote: (value: string) => void;
  review: boolean;
  onReview: (value: boolean) => void;
  onCancel: () => void;
}) {
  const t = useMessages();
  const attachments = useAttachments();
  const dirty = written || (attachments?.files.length ?? 0) > 0;

  return (
    // Sticks to the foot of the scrollport: a page long enough to be worth
    // writing is long enough to hide its own Save.
    <div className="bg-surface rounded-card sticky bottom-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2 shadow-[var(--shadow-float)]">
      <Button type="submit" size="sm" disabled={!dirty || pending}>
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
        {pending ? t.common.saving : t.docs.saveDoc}
      </Button>

      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-text-3 hover:text-text rounded-full px-2 py-1 text-base font-medium transition-colors"
      >
        {t.common.cancel}
      </button>

      {/* What changed, in a few words, for whoever reads the history in six
          months. Optional on purpose: making it compulsory produces a column of
          rows that all say "update". */}
      <input
        name="note"
        value={note}
        maxLength={120}
        placeholder={t.docs.notePlaceholder}
        aria-label={t.docs.note}
        onChange={(event) => onNote(event.target.value)}
        className={cn(
          "bg-surface-2 placeholder:text-text-3 focus:border-brand rounded-control border-transparent",
          "h-8 w-full min-w-0 border px-2.5 text-base transition-colors focus:outline-none sm:w-64",
        )}
      />

      {/* Rewriting a page is usually the strongest possible statement that it
          is correct — but fixing a typo is not, which is why this is a tick
          somebody can clear rather than something the save decides for them. */}
      <label className="text-text-2 ml-auto flex items-center gap-2 text-base">
        <input
          type="checkbox"
          name="review"
          checked={review}
          onChange={(event) => onReview(event.target.checked)}
          className="accent-brand size-4"
        />
        {t.docs.countsAsReview}
      </label>
    </div>
  );
}
