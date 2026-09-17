import {
  parse,
  stringify,
  type Align,
  type Block,
  type Callout,
  type Inline,
  type ListBlock,
  type ListItem,
  type Mark,
} from "@/lib/markdown-ast";

/**
 * Markdown in, editor document out, and back again.
 *
 * The editor holds a document; the database holds Markdown. This is the only
 * place the two meet, and it goes through the same grammar the renderer uses —
 * so what the editor lets you write is exactly what a saved comment can show.
 *
 * Deliberately hand-written rather than taken off the shelf. Our subset is
 * small and already defined by `markdown-ast`, an off-the-shelf bridge would
 * bring its own idea of the grammar to disagree with ours, and this is the one
 * seam where a disagreement shows up as someone's words changing under them.
 */

/** The shape Tiptap hands back, in the parts of it we use. */
export type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

/* -------------------------------------------------------------- into it -- */

function inlineToNodes(content: Inline[]): Node[] {
  return content.map((piece) => {
    if ("br" in piece) return { type: "hardBreak" };
    if ("image" in piece) {
      return { type: "image", attrs: { src: piece.image.src, alt: piece.image.alt } };
    }
    return {
      type: "text",
      text: piece.text,
      ...(piece.marks.length ? { marks: piece.marks.map(markToNode) } : {}),
    };
  });
}

function markToNode(mark: Mark) {
  return mark.type === "link" ? { type: "link", attrs: { href: mark.href } } : { type: mark.type };
}

/** A list and everything under it, since an item may hold one of its own. */
function listToNode(block: ListBlock): Node {
  return {
    type: block.ordered ? "orderedList" : "bulletList",
    content: block.items.map((item) => ({
      type: "listItem",
      content: [para(item.content), ...item.children.map(listToNode)],
    })),
  };
}

/** The words in a run of inline, with the formatting left behind. */
const flatten = (content: Inline[]) =>
  content.map((piece) => ("text" in piece ? piece.text : "")).join("");

/** One paragraph, used wherever the schema needs block content around inline. */
const para = (content: Inline[]): Node => ({
  type: "paragraph",
  ...(content.length ? { content: inlineToNodes(content) } : {}),
});

function blockToNode(block: Block): Node {
  switch (block.kind) {
    case "rule":
      return { type: "horizontalRule" };
    case "code":
      return {
        type: "codeBlock",
        ...(block.text ? { content: [{ type: "text", text: block.text }] } : {}),
      };
    case "heading":
      return {
        type: "heading",
        attrs: { level: block.level },
        ...(block.content.length ? { content: inlineToNodes(block.content) } : {}),
      };
    case "quote":
      return { type: "blockquote", content: [para(block.content)] };
    case "callout":
      return {
        type: "callout",
        // The title is held as plain words: it is a label, and a schema that
        // let it carry marks would be a second place formatting can live.
        attrs: { tone: block.tone, title: block.title ? flatten(block.title) : "" },
        content: block.content.length ? block.content.map(blockToNode) : [{ type: "paragraph" }],
      };
    case "list":
      return listToNode(block);
    case "table":
      return {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: block.head.map((cell, column) => ({
              type: "tableHeader",
              attrs: { align: block.align[column] ?? null },
              content: [para(cell)],
            })),
          },
          ...block.rows.map((row) => ({
            type: "tableRow",
            content: row.map((cell, column) => ({
              type: "tableCell",
              attrs: { align: block.align[column] ?? null },
              content: [para(cell)],
            })),
          })),
        ],
      };
    default:
      return para(block.content);
  }
}

export function markdownToDoc(markdown: string): Node {
  const blocks = parse(markdown).map(blockToNode);
  // Never empty: the schema requires at least one block, and an editor opened
  // on nothing still has to have somewhere to put the caret.
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

/* -------------------------------------------------------------- out of it -- */

function nodesToInline(nodes: Node[] | undefined): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") out.push({ br: true });
    else if (node.type === "image") {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      if (src) out.push({ image: { src, alt } });
    } else if (node.type === "text" && node.text) {
      out.push({ text: node.text, marks: (node.marks ?? []).flatMap(nodeToMark) });
    }
  }
  return out;
}

function nodeToMark(mark: { type: string; attrs?: Record<string, unknown> }): Mark[] {
  switch (mark.type) {
    case "bold":
    case "italic":
    case "strike":
    case "highlight":
    case "code":
      return [{ type: mark.type }];
    case "link": {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
      return href ? [{ type: "link", href }] : [];
    }
    // Anything the schema allows but our Markdown cannot say — underline is the
    // one — is dropped rather than written as something it is not.
    default:
      return [];
  }
}

/** Everything inline under a node, however deeply the schema nests it. */
function inlineWithin(node: Node): Inline[] {
  if (node.type === "text" || node.type === "hardBreak" || node.type === "image") {
    return nodesToInline([node]);
  }

  const out: Inline[] = [];
  (node.content ?? []).forEach((child, index) => {
    // A block boundary inside something that flattens to one line — a second
    // paragraph in a list item — becomes a line break rather than vanishing.
    if (index > 0 && !["text", "hardBreak", "image"].includes(child.type)) out.push({ br: true });
    out.push(...inlineWithin(child));
  });
  return out;
}

const TONES: Callout[] = ["note", "tip", "important", "warning", "caution"];

const alignOf = (value: unknown): Align =>
  value === "left" || value === "center" || value === "right" ? value : null;

/**
 * A list out of the editor.
 *
 * An item's own lines and the list hanging under it are separated here: the
 * words flatten to one line the way they always did, and a nested list stays a
 * list rather than being flattened into the line above it.
 */
function nodeToList(node: Node): ListBlock {
  const items: ListItem[] = (node.content ?? []).map((item) => {
    const children: ListBlock[] = [];
    const own: Node[] = [];
    for (const child of item.content ?? []) {
      if (child.type === "bulletList" || child.type === "orderedList")
        children.push(nodeToList(child));
      else own.push(child);
    }
    return { content: inlineWithin({ type: "listItem", content: own }), children };
  });

  return { kind: "list", ordered: node.type === "orderedList", items };
}

function nodeToBlocks(node: Node): Block[] {
  switch (node.type) {
    case "horizontalRule":
      return [{ kind: "rule" }];
    case "codeBlock":
      return [{ kind: "code", text: (node.content ?? []).map((c) => c.text ?? "").join("") }];
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      return [
        {
          kind: "heading",
          level: (level >= 1 && level <= 3 ? level : 3) as 1 | 2 | 3,
          content: nodesToInline(node.content),
        },
      ];
    }
    case "blockquote":
      return [{ kind: "quote", content: inlineWithin(node) }];
    case "callout": {
      const tone = String(node.attrs?.tone ?? "note");
      const title = typeof node.attrs?.title === "string" ? node.attrs.title.trim() : "";
      return [
        {
          kind: "callout",
          tone: (TONES.includes(tone as Callout) ? tone : "note") as Callout,
          title: title ? [{ text: title, marks: [] }] : null,
          content: (node.content ?? []).flatMap(nodeToBlocks),
        },
      ];
    }
    case "bulletList":
    case "orderedList":
      return [nodeToList(node)];
    case "table": {
      const rows = (node.content ?? []).filter((row) => row.type === "tableRow");
      if (!rows.length) return [];
      const head = rows[0]!.content ?? [];
      return [
        {
          kind: "table",
          align: head.map((cell) => alignOf(cell.attrs?.align)),
          head: head.map(inlineWithin),
          rows: rows.slice(1).map((row) => (row.content ?? []).map(inlineWithin)),
        },
      ];
    }
    case "paragraph":
      return [{ kind: "p", content: nodesToInline(node.content) }];
    // A node kind we do not know cannot be written as Markdown, but the words
    // inside it can — losing formatting beats losing what someone wrote.
    default:
      return node.content ? node.content.flatMap(nodeToBlocks) : [];
  }
}

export function docToMarkdown(doc: Node): string {
  const blocks = (doc.content ?? []).flatMap(nodeToBlocks);
  // An editor left empty holds one empty paragraph, which is not content.
  const written = stringify(blocks).trim();
  return written;
}
