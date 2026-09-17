"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { InlineImage } from "@/components/editor/inline-image";
import { Callout, TONES } from "@/components/editor/callout";
import { TableNodes } from "@/components/editor/table";
import { Highlight } from "@tiptap/extension-highlight";
import {
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Bold,
  Code,
  Heading,
  Highlighter,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Rows3,
  Columns3,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import { docToMarkdown, markdownToDoc, type Node } from "@/lib/markdown-doc";
import {
  referenceSuggestion,
  type SuggestionState,
} from "@/components/editor/reference-suggestion";
import { ReferencePicker, type PickerAnchor } from "@/components/reference-picker";
import {
  AttachChips,
  useAttachments,
  usePasteAttachments,
  type Picked,
} from "@/components/tickets/file-picker";
import { suggestReferences, type Suggestion } from "@/lib/actions/references";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Writing, with the formatting already applied.
 *
 * Typing `**bold**` makes the words bold as you type rather than after you go
 * and look at a preview — the point of writing Markdown is the result, and the
 * symbols are only how you ask for it. The symbols are still available: the
 * source view shows exactly what will be stored, for anyone who would rather
 * work in it or needs to check what a paste actually contained.
 *
 * What is stored is Markdown, always. The document is only how it is held while
 * being edited; `markdown-doc` converts at both ends, over the same grammar the
 * renderer reads. Nothing here produces or stores HTML.
 */

type Tool = {
  icon: typeof Bold;
  label: (t: ReturnType<typeof useMessages>) => string;
  run: (editor: Editor) => void;
  active: (editor: Editor) => boolean;
};

const TOOLS: Tool[] = [
  {
    icon: Bold,
    label: (t) => t.editor.bold,
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold"),
  },
  {
    icon: Italic,
    label: (t) => t.editor.italic,
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic"),
  },
  {
    icon: Strikethrough,
    label: (t) => t.editor.strike,
    run: (e) => e.chain().focus().toggleStrike().run(),
    active: (e) => e.isActive("strike"),
  },
  {
    icon: Highlighter,
    label: (t) => t.editor.highlight,
    run: (e) => e.chain().focus().toggleHighlight().run(),
    active: (e) => e.isActive("highlight"),
  },
  {
    icon: Heading,
    label: (t) => t.editor.heading,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    icon: List,
    label: (t) => t.editor.bullets,
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    icon: ListOrdered,
    label: (t) => t.editor.numbers,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
  {
    icon: Quote,
    label: (t) => t.editor.quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote"),
  },
  {
    icon: Info,
    label: (t) => t.editor.callout,
    // A new one is a note; the kind is changed from the menu that appears once
    // the caret is inside it, where the five of them can be seen together.
    run: (e) => e.chain().focus().toggleCallout("note").run(),
    active: (e) => e.isActive("callout"),
  },
  {
    icon: TableIcon,
    label: (t) => t.editor.table,
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    active: (e) => e.isActive("table"),
  },
  {
    icon: Code,
    label: (t) => t.editor.code,
    run: (e) => e.chain().focus().toggleCode().run(),
    active: (e) => e.isActive("code"),
  },
  {
    icon: Link2,
    label: (t) => t.editor.link,
    run: (e) =>
      e.isActive("link")
        ? e.chain().focus().unsetLink().run()
        : e.chain().focus().setLink({ href: "https://" }).run(),
    active: (e) => e.isActive("link"),
  },
];

/** The five kinds, in the dictionary and in the palette. */
const CALLOUT_LABEL = {
  note: "calloutNote",
  tip: "calloutTip",
  important: "calloutImportant",
  warning: "calloutWarning",
  caution: "calloutCaution",
} as const;

const CALLOUT_COLOUR = {
  note: "--brand-deep",
  tip: "--positive",
  important: "--p-medium",
  warning: "--p-high",
  caution: "--negative",
} as const;

/** One control in the menu that follows the caret. */
function MenuButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "rounded-control flex size-7 items-center justify-center transition-colors",
        active
          ? "text-brand-deep bg-[var(--brand-tint)]"
          : "text-text-3 hover:bg-surface-3 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  name,
  value,
  onChange,
  rows = 5,
  placeholder,
  autoFocus,
  maxLength = 10_000,
  id,
  hint,
  className,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  /// A line in the toolbar saying what else the box can do. Only where there is
  /// room for one: a comment composer is narrow and the hint would push the
  /// source toggle off the end.
  hint?: React.ReactNode;
  className?: string;
}) {
  const t = useMessages();
  const [source, setSource] = useState(false);
  const onPasteFiles = usePasteAttachments();

  // The editor is built once, so its handlers close over the first render's
  // values. A ref is how a paste landing three minutes later still reaches the
  // list that is on screen now.
  const attachments = useAttachments();
  const addFiles = useRef(attachments?.add);
  useEffect(() => {
    addFiles.current = attachments?.add;
  });

  /// Filled in below, once there is an editor to insert into.
  const placeFiles = useRef<(picked: Picked[], at?: number) => void>(() => {});
  const [suggestion, setSuggestion] = useState<(SuggestionState & { anchor: PickerAnchor }) | null>(
    null,
  );

  /**
   * The list opens at the caret, whose rectangle the plugin measures for us at
   * the moment it opens — so nothing is measured while rendering, and it lands
   * where someone is actually looking. The old textarea could not say where its
   * caret was, which is the only reason the list used to be pinned to the box.
   */
  const showList = useCallback((state: SuggestionState | null) => {
    if (!state?.rect) {
      setSuggestion(null);
      return;
    }
    const { top, left, bottom } = state.rect;
    setSuggestion({ ...state, anchor: { top, left, bottom } });
  }, []);

  /// What we last handed to `onChange`. Anything different arriving in `value`
  /// came from outside — a reset after posting, a draft restored — and has to
  /// be put into the document; anything equal is our own echo and must not be,
  /// because replacing the document moves the caret to the end of it.
  const emitted = useRef(value);

  const load = useCallback(async (sigil: "#" | "@", query: string) => {
    // "## " is a heading, not a search, and neither is a hash with nothing but
    // space after it. Only a run that could name something is worth asking about.
    if (/^[#@\s]/.test(query) || query.length > 40) return [];
    return suggestReferences(sigil, query);
  }, []);

  const editor = useEditor({
    // Rendered on the client only: the document is built from a string at
    // mount, and rendering it on the server too is the shape of every Tiptap
    // hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // No Markdown says "underline", so the editor does not offer a format
        // that could not survive being saved.
        underline: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener" } },
      }),
      Highlight,
      InlineImage,
      Callout,
      ...TableNodes,
      referenceSuggestion("#", {
        load,
        onChange: showList,
      }),
      referenceSuggestion("@", {
        load,
        onChange: showList,
      }),
    ],
    content: markdownToDoc(value) as object,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "tiqo-prose focus:outline-none",
        style: `min-height:${rows * 1.6}rem`,
        ...(id ? { id } : {}),
      },
      // Alt+Enter posts. Enter has to stay a new paragraph in a rich editor,
      // so the shortcut the composer advertises is sent to the form the editor
      // sits in — which is the form that has the button it names.
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" || !event.altKey) return false;
        const form = view.dom.closest("form");
        if (!form) return false;
        event.preventDefault();
        form.requestSubmit();
        return true;
      },
      // A screenshot on the clipboard is the commonest attachment there is.
      // Only a clipboard carrying files is taken; pasting text, or a picture
      // copied as HTML from a web page, still pastes as it always did.
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.length || !addFiles.current) return false;
        placeFiles.current(addFiles.current(files));
        return true;
      },
      /**
       * A file dropped on the writing area lands where it was dropped, the same
       * way a pasted one lands at the caret: both chose a place. Dropped
       * anywhere else on the composer it is only attached, which the zone around
       * this handles.
       *
       * The event is stopped as well as prevented — the drop zone is an
       * ancestor, and without this it would take the same files a second time.
       */
      handleDrop: (view, event, _slice, moved) => {
        // Dragging a picture from one place in the text to another is the
        // editor's own business.
        if (moved) return false;

        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.length || !addFiles.current) return false;

        event.preventDefault();
        event.stopPropagation();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        placeFiles.current(addFiles.current(files), at?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = docToMarkdown(current.getJSON() as Node).slice(0, maxLength);
      emitted.current = markdown;
      onChange(markdown);
    },
  });

  /**
   * What the caret is standing in, for the controls that answer to it.
   *
   * Subscribed to rather than read while drawing: the editor does not re-render
   * this component on every transaction — deliberately, it would re-render the
   * whole composer — so a control that only asked `isActive` as it drew would
   * be drawn once, before the caret had ever been anywhere. The answer is one
   * small object and the subscription only wakes the component when it changes,
   * which is what a toolbar needs and a keystroke is not.
   */
  const caret = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            callout: current.isActive("callout"),
            table: current.isActive("table"),
            tone: String(current.getAttributes("callout").tone ?? ""),
            tools: TOOLS.map((tool) => tool.active(current)),
          }
        : null,
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(markdownToDoc(value) as object, { emitUpdate: false });
  }, [editor, value]);

  /**
   * The two views, kept the same text.
   *
   * Typing in the source box is the one edit the document does not hear about:
   * the box reports what it holds as ours, which is how the effect above knows
   * not to move the caret while somebody is typing in the rich view. So the
   * document is rebuilt on the way back rather than on every keystroke, and
   * what was written as Markdown is what comes back formatted.
   */
  const toggleSource = () => {
    if (source && editor) {
      emitted.current = value;
      editor.commands.setContent(markdownToDoc(value) as object, { emitUpdate: false });
    }
    setSource((on) => !on);
  };

  /**
   * Puts the pictures among the files just taken where the caret is.
   *
   * Only pictures, and only when a place was chosen by pasting into the text.
   * A zip has nothing to show, so inlining one would put a link in the middle of
   * a sentence where a listed file reads better — and a file picked with the
   * paperclip, or dropped on the composer rather than on the words, named no
   * position at all and is only attached.
   *
   * Each points at its draft key rather than at an address: nothing has been
   * uploaded yet, and the action swaps the tokens for real addresses once the
   * files are on disk. The object URL is only so the writer can see what they
   * pasted; it is never written down.
   */
  useEffect(() => {
    placeFiles.current = (picked, at) => {
      const images = picked.filter((item) => item.file.type.startsWith("image/"));
      if (!images.length || !editor) return;

      editor
        .chain()
        // Where it was dropped, or where the caret is for a paste.
        .focus(at)
        .insertContentAt(
          at ?? editor.state.selection.to,
          images.map((item) => ({
            type: "image",
            attrs: {
              src: `attachment:${item.key}`,
              alt: item.file.name,
              preview: URL.createObjectURL(item.file),
            },
          })),
        )
        .run();
    };
  }, [editor]);

  /**
   * Taking a file off the list takes its picture out of the words too.
   *
   * Positions are collected first and deleted last-first: every deletion shifts
   * everything after it, so walking forwards would aim the second cut at the
   * wrong place. An inline atom is one position wide.
   */
  const droppedKey = attachments?.droppedKey ?? null;
  useEffect(() => {
    if (!editor || !droppedKey) return;

    const at: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && node.attrs.src === `attachment:${droppedKey}`) {
        at.push(pos);
      }
    });
    if (!at.length) return;

    const tr = editor.state.tr;
    for (const pos of at.reverse()) tr.delete(pos, pos + 1);
    editor.view.dispatch(tr);
  }, [editor, droppedKey]);

  return (
    // One well, toolbar and writing area together: the box is something you
    // write *into*, and a raised white box has no edge at all once it is put on
    // a white card — which is where most of them sit. The toolbar carries no
    // fill of its own, only a hairline under it, so the two read as one object
    // rather than a grey strip on a white pad.
    //
    // The hairline around it is not decoration: a doc in edit mode puts this
    // box straight on the grey ground, where a grey fill alone would have no
    // edge either. The line is what makes one shape work on both surfaces.
    //
    // Clipped to the radius: the strip and the attachment row have square
    // corners of their own, and without this they fill in the rounded ones so
    // the box reads as cut off. The suggestion list is portalled to the body,
    // so it is not clipped by this.
    <div
      className={cn(
        "bg-surface-2 border-line rounded-card relative overflow-hidden border",
        className,
      )}
    >
      <div className="border-border-soft flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1.5">
        {TOOLS.map((tool, index) => (
          <button
            key={tool.label(t)}
            type="button"
            disabled={source || !editor}
            onClick={() => editor && tool.run(editor)}
            title={tool.label(t)}
            aria-label={tool.label(t)}
            aria-pressed={caret?.tools[index] ?? false}
            className={cn(
              "rounded-control flex size-7 items-center justify-center transition-colors disabled:opacity-30",
              caret?.tools[index]
                ? "text-brand-deep bg-[var(--brand-tint)]"
                : "text-text-3 hover:bg-surface-3 hover:text-text",
            )}
          >
            <tool.icon size={14} />
          </button>
        ))}

        {hint ? (
          <span className="text-text-3 ml-1.5 hidden items-center gap-1 text-sm sm:flex">
            {hint}
          </span>
        ) : null}

        <button
          type="button"
          onClick={toggleSource}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors",
            source
              ? "text-brand-deep bg-[var(--brand-tint)]"
              : "text-text-3 hover:bg-surface-3 hover:text-text",
          )}
        >
          {source ? <Pencil size={12} /> : <SquareCode size={12} />}
          {source ? t.editor.write : t.editor.source}
        </button>
      </div>

      {/* The controls that only exist while the caret is somewhere particular.
          They follow the caret rather than living in the toolbar, because a row
          of table commands that is dead nine times out of ten reads as chrome
          that does not work. */}
      {editor && !source ? (
        <BubbleMenu
          editor={editor}
          appendTo={() => document.body}
          options={{ placement: "top", offset: 8 }}
          shouldShow={({ editor: current }) =>
            current.isEditable && (current.isActive("callout") || current.isActive("table"))
          }
          className="bg-surface rounded-control flex items-center gap-0.5 p-1 shadow-lg"
        >
          {caret?.callout
            ? TONES.map((tone) => (
                <MenuButton
                  key={tone}
                  label={t.editor[CALLOUT_LABEL[tone]]}
                  active={caret?.tone === tone}
                  onClick={() => editor.chain().focus().setCalloutTone(tone).run()}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: `var(${CALLOUT_COLOUR[tone]})` }}
                  />
                </MenuButton>
              ))
            : null}

          {caret?.table ? (
            <>
              <MenuButton
                label={t.editor.rowAdd}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                <BetweenHorizontalStart size={14} />
              </MenuButton>
              <MenuButton
                label={t.editor.rowRemove}
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                <Rows3 size={14} />
              </MenuButton>
              <MenuButton
                label={t.editor.columnAdd}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                <BetweenVerticalStart size={14} />
              </MenuButton>
              <MenuButton
                label={t.editor.columnRemove}
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                <Columns3 size={14} />
              </MenuButton>
              <MenuButton
                label={t.editor.tableRemove}
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 size={14} />
              </MenuButton>
            </>
          ) : null}
        </BubbleMenu>
      ) : null}

      {suggestion && !source ? (
        <ReferencePicker
          sigil={suggestion.sigil}
          items={suggestion.items}
          active={suggestion.active}
          anchor={suggestion.anchor}
          onPick={(item: Suggestion) => suggestion.pick(item)}
          onHover={suggestion.highlight}
        />
      ) : null}

      {source ? (
        <textarea
          rows={rows}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => {
            emitted.current = event.target.value;
            onChange(event.target.value);
          }}
          onPaste={onPasteFiles}
          className="placeholder:text-text-3 block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-base leading-relaxed focus:outline-none"
        />
      ) : (
        <div className="text-md relative px-3.5 py-3 leading-relaxed">
          {!value.trim() && placeholder ? (
            <p className="text-text-3 text-md pointer-events-none absolute top-3 left-3.5">
              {placeholder}
            </p>
          ) : null}
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Inside the box and under what was written, because the files belong to
          the message rather than to the form around it. */}
      <AttachChips className="border-border-soft border-t px-3.5 py-2.5" />

      {/* The value posts from here rather than from the editor, so a plain form
          action keeps working and the source view needs no special case. */}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
