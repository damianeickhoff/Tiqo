import { Node, mergeAttributes } from "@tiptap/core";

import type { Callout as Tone } from "@/lib/markdown-ast";

/**
 * A callout, while it is being written.
 *
 * The same five kinds the reader draws, held as one attribute rather than five
 * node types: switching a warning to a note is then a change of mind about the
 * same block instead of a different block with the same words in it.
 *
 * The title is an attribute too, and a plain one: it is a label, and the reader
 * shows the kind's own word when it is empty. Somebody who wants a different
 * one writes it after the marker in the source view — which is the only place
 * the syntax is ever visible, and where they are already looking at it.
 */
export const TONES: Tone[] = ["note", "tip", "important", "warning", "caution"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps what is selected in a callout, or unwraps the one it is in. */
      toggleCallout: (tone: Tone) => ReturnType;
      /** Changes the kind of the callout the caret is in. */
      setCalloutTone: (tone: Tone) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "note",
        parseHTML: (element) => element.getAttribute("data-tone") ?? "note",
        renderHTML: (attributes) => ({ "data-tone": attributes.tone }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") ?? "",
        renderHTML: (attributes) => ({ "data-title": attributes.title ?? "" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "callout" }), 0];
  },

  addCommands() {
    return {
      toggleCallout:
        (tone) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { tone }),
      setCalloutTone:
        (tone) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { tone }),
    };
  },
});
