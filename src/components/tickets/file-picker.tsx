"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";
import { formatSize, MAX_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "@/lib/attachments";

/**
 * Files picked to go with whatever is being written.
 *
 * Three pieces rather than one control, because the two halves belong in
 * different places: the paperclip sits in the writing box's own toolbar, beside
 * bold and italic, where somebody looks when they are composing — and the list
 * of what has been picked belongs under the box, where it can take a line of
 * its own. A context is what lets them be apart and still be one thing.
 *
 * Everything here is a draft. Nothing leaves the browser until the form is
 * submitted, which is why a file can be taken off the list again without
 * anything having to be undone.
 */

/**
 * A picked file and the name the body can call it by before it has an address.
 *
 * Nothing is uploaded until the form is submitted, so a picture placed in the
 * text cannot point at `/api/files/<id>` — there is no id yet. It points at
 * `attachment:<key>` instead, and the action swaps the tokens for real
 * addresses once the files are on disk. The keys travel with the files in a
 * parallel field, in the same order.
 */
export type Picked = { file: File; key: string };

type Attachments = {
  items: Picked[];
  files: File[];
  /** Returns what it accepted, so a caller placing a picture in the text knows
   *  which key to point it at. */
  add: (picked: FileList | File[] | null | undefined) => Picked[];
  remove: (file: File) => void;
  problem: string | null;
  /** Opens the file dialog. On the context rather than reached for through the
   *  DOM, so the button and the input it drives are one thing. */
  open: () => void;
  /**
   * The key of the file most recently taken off the list, or null.
   *
   * Taking a file off has to take its picture out of the words with it, or the
   * text keeps a hole where something used to be. Said as state rather than as
   * a callback the editor lends back: the list knows nothing about documents,
   * the editor knows nothing about the list, and a fact both can read is a
   * smaller arrangement than two objects holding each other.
   */
  droppedKey: string | null;
};

const AttachmentsCtx = createContext<Attachments | null>(null);

/** Null where there is no provider — most writing boxes in the app carry no
 *  files, and they should show no paperclip. */
export function useAttachments() {
  return useContext(AttachmentsCtx);
}

/** A stable empty list, so the effect that syncs the input can compare by
 *  identity and not run on every render. */
const NONE: Picked[] = [];

export function AttachmentsProvider({
  name = "files",
  result,
  children,
}: {
  name?: string;
  /// The action's own result, when the form stays mounted across a submit. A
  /// new result carrying no errors means everything was posted, so the list
  /// empties — while a rejected post keeps every file, exactly as it keeps
  /// every word. Leave it out where the form unmounts or redirects instead.
  result?: { errors?: unknown };
  children: React.ReactNode;
}) {
  const m = useMessages();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /// Which picked file was last taken off the list. A form with only a plain
  /// field has no pictures in its text, so nothing reads this.
  const [droppedKey, setDroppedKey] = useState<string | null>(null);

  // What was picked, stored beside the action result it was picked against.
  const [picked, setPicked] = useState<{ from: unknown; items: Picked[] }>({
    from: undefined,
    items: NONE,
  });
  const posted = result !== undefined && !result.errors && picked.from !== result;
  const items = posted ? NONE : picked.items;
  const files = useMemo(() => items.map((item) => item.file), [items]);

  /**
   * The input is what the form actually submits, so the list drawn and the list
   * it holds are made identical rather than merely kept in step. A `FileList`
   * cannot be edited, so it is rebuilt from scratch each time.
   */
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const data = new DataTransfer();
    for (const file of files) data.items.add(file);
    input.files = data.files;
  }, [files]);

  const apply = (next: Picked[]) => setPicked({ from: result, items: next });

  /**
   * The limits are checked here as well as in the action, and not only to save
   * a round trip: a body over Next's own cap is refused by the framework before
   * any of our code runs, and what somebody would see then is a stack trace
   * rather than a sentence. Refusing the file as it is picked is also simply
   * kinder — nobody should upload 30 MB to be told it was too big.
   */
  const add: Attachments["add"] = (incoming) => {
    const arriving = incoming ? [...incoming] : [];
    if (!arriving.length) return [];

    // Picking twice from the same folder is how a file gets chosen twice, and
    // two identical attachments are never what anybody meant.
    const seen = new Set(files.map((file) => `${file.name}:${file.size}`));
    const extra = arriving.filter(
      (file) => file.size > 0 && !seen.has(`${file.name}:${file.size}`),
    );
    if (!extra.length) return [];

    const tooBig = extra.find((file) => file.size > MAX_UPLOAD_BYTES);

    // The same ceiling for the list as for one file, because the request body
    // is what both are really being measured against: five files of six
    // megabytes each is over Next's cap even though none of them is.
    let budget = MAX_UPLOAD_BYTES - files.reduce((sum, file) => sum + file.size, 0);
    let overflowed = false;
    const accepted: Picked[] = [];
    for (const file of extra) {
      if (file.size > MAX_UPLOAD_BYTES) continue;
      if (file.size > budget) {
        overflowed = true;
        continue;
      }
      budget -= file.size;
      accepted.push({ file, key: crypto.randomUUID().slice(0, 8) });
    }

    const next = [...items, ...accepted];

    setProblem(
      tooBig
        ? m.errors.fileTooLarge(tooBig.name, MAX_UPLOAD_BYTES / (1024 * 1024))
        : overflowed
          ? m.errors.filesTooLarge(MAX_UPLOAD_BYTES / (1024 * 1024))
          : next.length > MAX_UPLOAD_COUNT
            ? m.errors.tooManyFiles(MAX_UPLOAD_COUNT)
            : null,
    );

    // Whatever was fine still goes on the list. Throwing away four good files
    // because a fifth was too large is a second mistake on top of the first.
    const kept = next.slice(0, MAX_UPLOAD_COUNT);
    apply(kept);
    return accepted.filter((item) => kept.includes(item));
  };

  return (
    <AttachmentsCtx.Provider
      value={{
        items,
        files,
        add,
        remove: (file) => {
          // The picture goes with the file. Leaving it behind would leave the
          // words pointing at something that is no longer being sent.
          const going = items.find((item) => item.file === file);
          if (going) setDroppedKey(going.key);
          apply(items.filter((item) => item.file !== file));
        },
        problem: posted ? null : problem,
        open: () => inputRef.current?.click(),
        droppedKey,
      }}
    >
      {/* Inside the form, because this is the field that carries the bytes. */}
      <input
        ref={inputRef}
        type="file"
        name={name}
        multiple
        className="hidden"
        onChange={(event) => add(event.target.files)}
      />
      {/* The keys, in the same order as the files, so the action can match a
          token in the body to the file it names. */}
      {items.map((item) => (
        <input key={item.key} type="hidden" name="fileKeys" value={item.key} />
      ))}
      {children}
    </AttachmentsCtx.Provider>
  );
}

/**
 * The paperclip. Absent where nothing can be attached.
 *
 * Bare in a toolbar, where the icons around it say what kind of control it is;
 * named on a form, where it stands on its own and an unlabelled icon is a
 * guess.
 */
export function AttachButton({
  className,
  showLabel,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const attachments = useAttachments();
  const m = useMessages();
  if (!attachments) return null;

  return (
    <button
      type="button"
      // The provider owns the input, so it owns opening it. Reaching through
      // the form for `input[type=file]` worked only until a form had two.
      onClick={attachments.open}
      title={m.ticket.attach}
      aria-label={m.ticket.attach}
      className={
        className ??
        "text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors"
      }
    >
      <Paperclip size={14} />
      {showLabel ? m.ticket.attach : null}
    </button>
  );
}

/**
 * Dropping files onto whatever is being written — and pasting them into it.
 *
 * The whole composer is the target, not a strip of it: somebody dragging a file
 * at a box aims at the box. `dragover` has to be cancelled for a drop to happen
 * at all — a browser's default is to navigate to the file, which loses the
 * half-written reply — and the counter is what stops the highlight flickering
 * off every time the pointer crosses a child element.
 *
 * Paste is caught on the same area rather than by a second wrapper around one
 * field. A screenshot on the clipboard is the commonest attachment there is,
 * and the two components were always placed together anyway.
 */
export function DropZone({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const attachments = useAttachments();
  const onPaste = usePasteAttachments();
  const m = useMessages();
  const [depth, setDepth] = useState(0);

  if (!attachments) return <>{children}</>;

  const carriesFiles = (event: React.DragEvent) => [...event.dataTransfer.types].includes("Files");

  return (
    <div
      className={cn("relative", className)}
      onPaste={onPaste}
      onDragEnter={(event) => {
        if (carriesFiles(event)) setDepth((open) => open + 1);
      }}
      onDragOver={(event) => {
        if (carriesFiles(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={() => setDepth((open) => Math.max(0, open - 1))}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setDepth(0);
        attachments.add(event.dataTransfer.files);
      }}
    >
      {children}

      {depth > 0 ? (
        // Over the box rather than in it: nothing below moves while a file is
        // being held over the composer, so the target cannot slide away from
        // under the pointer.
        <div
          className="rounded-card border-brand pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed bg-[var(--brand-tint)]/85"
          aria-hidden
        >
          <p className="text-brand-deep text-md flex items-center gap-2 font-semibold">
            <Paperclip size={15} />
            {m.ticket.dropHere}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** What has been picked, and why something was not. */
export function AttachChips({ className }: { className?: string }) {
  const attachments = useAttachments();
  const m = useMessages();
  if (!attachments || (!attachments.files.length && !attachments.problem)) return null;

  return (
    <div className={className}>
      {attachments.problem ? (
        <p className="text-negative mb-1.5 text-sm font-medium">{attachments.problem}</p>
      ) : null}

      {attachments.files.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {attachments.files.map((file) => (
            <li
              key={`${file.name}:${file.size}`}
              className="bg-surface-2 text-text-2 flex max-w-full items-center gap-1.5 rounded-full border border-transparent py-1 pr-1 pl-2.5 text-sm"
            >
              {/* A ceiling as well as a floor. Without the cap one long
                  filename takes the whole row; without the truncation a narrow
                  screen squeezes every chip down to nothing at all. */}
              <span className="max-w-[14rem] truncate">{file.name}</span>
              <span className="text-text-3 shrink-0">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => attachments.remove(file)}
                aria-label={m.ticket.dropFile}
                className="text-text-3 hover:bg-surface-3 hover:text-text inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Pasting a file into a plain box.
 *
 * A screenshot on the clipboard is the commonest attachment there is, and
 * asking somebody to save it to disk first so they can pick it again is a
 * detour. Text pastes are left alone: only a clipboard carrying files is ours.
 */
export function usePasteAttachments() {
  const attachments = useAttachments();

  return (event: React.ClipboardEvent) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!attachments || !files.length) return;
    event.preventDefault();
    attachments.add(files);
  };
}
