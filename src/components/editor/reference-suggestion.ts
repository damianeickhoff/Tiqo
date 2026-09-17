import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { Suggestion as Item } from "@/lib/actions/references";
import { referenceLabel } from "@/lib/references";

/** What the editor needs to know while a list is open under the caret. */
export type SuggestionState = {
  sigil: "#" | "@";
  items: Item[];
  active: number;
  rect: DOMRect | null;
  pick: (item: Item) => void;
  /// The mouse moving over a row. Handed back to the plugin rather than kept
  /// in React, so hovering and the arrow keys move the same highlight.
  highlight: (index: number) => void;
};

type Handlers = {
  /** Ask for candidates. Returns nothing while the query is not worth asking. */
  load: (sigil: "#" | "@", query: string) => Promise<Item[]>;
  /** Told whenever the list opens, changes or closes. */
  onChange: (state: SuggestionState | null) => void;
};

/**
 * `#` and `@` under the caret.
 *
 * The plugin owns detection and keys; React owns the list that is drawn. Two
 * reasons the keyboard belongs here rather than on `document`: the editor is
 * listening for the same arrow keys, and a capture-phase listener fighting it
 * is how a picker ends up stealing Enter from a form.
 *
 * A reference is written as a link over its own label rather than as a node of
 * its own, so what is stored stays ordinary Markdown that reads correctly
 * anywhere — including in an email, or in a database someone is looking at.
 */
export function referenceSuggestion(sigil: "#" | "@", handlers: Handlers) {
  return Extension.create({
    name: sigil === "#" ? "referenceHash" : "referenceAt",

    addProseMirrorPlugins() {
      const options: Omit<SuggestionOptions<Item>, "editor"> = {
        char: sigil,
        pluginKey: new PluginKey(sigil === "#" ? "referenceHash" : "referenceAt"),
        // A reference in this app has a space in it — "INC-2609 0011" — so the
        // run cannot end at the first one.
        allowSpaces: true,
        // Only at the start of a word: an email address is not a mention.
        allowedPrefixes: [" ", "\\(", "\\["],
        startOfLine: false,

        items: ({ query }) => handlers.load(sigil, query),

        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "text",
                text: referenceLabel(props),
                marks: [{ type: "link", attrs: { href: props.href } }],
              },
              // Its own run with no marks, so what is typed next is not swept
              // into the reference.
              { type: "text", text: " " },
            ])
            .run();
        },

        render: () => {
          // A key event carries only the key. What is on screen when it arrives
          // is held here, put there by the last open or update.
          let showing: { items: Item[]; rect: DOMRect | null; command: (item: Item) => void } = {
            items: [],
            rect: null,
            command: () => {},
          };
          // The highlight lives here rather than in React: the same index has to
          // answer to arrow keys arriving at the document and to the mouse
          // arriving at the list, and one owner is the only way those agree.
          let at = 0;

          const publish = (index: number) => {
            at = index;
            handlers.onChange({
              sigil,
              items: showing.items,
              active: at,
              rect: showing.rect,
              pick: showing.command,
              highlight: publish,
            });
          };

          const take = (props: {
            items: Item[];
            clientRect?: (() => DOMRect | null) | null;
            command: (item: Item) => void;
          }) => {
            showing = {
              items: props.items,
              rect: props.clientRect?.() ?? null,
              command: props.command,
            };
          };

          return {
            onStart: (props) => {
              take(props);
              publish(0);
            },

            onUpdate: (props) => {
              take(props);
              // The list changed under the highlight: keep it in range rather
              // than pointing past the end of a shorter list.
              publish(Math.min(at, Math.max(props.items.length - 1, 0)));
            },

            onKeyDown: ({ event }) => {
              const count = showing.items.length;
              if (count === 0) return false;

              if (event.key === "ArrowDown") {
                publish((at + 1) % count);
                return true;
              }
              if (event.key === "ArrowUp") {
                publish((at === 0 ? count : at) - 1);
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                const chosen = showing.items[at];
                if (!chosen) return false;
                showing.command(chosen);
                return true;
              }
              if (event.key === "Escape") {
                handlers.onChange(null);
                return true;
              }
              return false;
            },

            onExit: () => handlers.onChange(null),
          };
        },
      };

      return [Suggestion({ editor: this.editor, ...options })];
    },
  });
}
