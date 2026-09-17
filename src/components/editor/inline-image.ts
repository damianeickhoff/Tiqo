import { Node } from "@tiptap/core";

/**
 * A picture in the middle of what is being written.
 *
 * Hand-rolled rather than `@tiptap/extension-image`, for one attribute's worth
 * of difference: a picture that has only just been pasted has no address yet.
 * Nothing is uploaded until the form is submitted — that is the rule the whole
 * composer follows — so the node carries `src`, which is a promise of where the
 * file will live, and `preview`, which is a local object URL so the writer can
 * see what they pasted in the meantime. Only `src` is ever written to Markdown;
 * `preview` dies with the tab.
 */
export const InlineImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  // Nothing inside it, and the caret treats it as one character.
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      // Never rendered into the document the editor serialises, and never
      // written to Markdown: it is a handle on a blob in this browser.
      preview: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ node }) {
    const { src, alt, preview } = node.attrs as {
      src: string;
      alt: string;
      preview: string | null;
    };
    return [
      "img",
      {
        src: preview ?? src,
        alt,
        class: "rounded-card border border-line my-1 max-h-64 max-w-full",
      },
    ];
  },
});
