import { Fragment, type ReactNode } from "react";
import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert } from "lucide-react";

import {
  parse,
  type Block,
  type Callout,
  type Inline,
  type ListBlock,
  type Mark,
} from "@/lib/markdown-ast";
import { ReferenceChip } from "@/components/reference-chip";
import { headingsIn } from "@/lib/docs";

/**
 * Markdown, as React elements.
 *
 * The grammar lives in `markdown-ast` and is shared with the editor, so what
 * someone writes and what they later read cannot drift apart. This file only
 * decides how each piece looks.
 *
 * Deliberately not HTML: everything here becomes elements React creates itself,
 * so there is no `dangerouslySetInnerHTML` and nothing for a requester to
 * smuggle into an operator's browser. Links are limited to http, https and
 * mailto for the same reason — `javascript:` in a comment is the oldest trick
 * there is.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** A link into the app itself: a reference to a ticket, a project, a person or
 *  a document. A document's address carries two segments; the rest carry one. */
const INTERNAL = /^\/(tickets|projects|people|cmdb)\/[^/]+$|^\/(docs)\/[^/]+\/[^/]+$/;

/** One of this instance's own attachments, and the only thing an `<img>` here
 *  is ever allowed to point at. */
const OWN_FILE = /^\/api\/files\/[a-z0-9]+$/i;

const KIND = {
  tickets: "ticket",
  projects: "project",
  people: "user",
  docs: "doc",
  cmdb: "asset",
} as const;

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text);
  if (blocks.length === 0) return null;
  const anchors = anchorsFor(text, blocks);

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} anchors={anchors} />
      ))}
    </div>
  );
}

/**
 * Which heading wears which anchor.
 *
 * The names come from `headingsIn`, which is what the index on a document page
 * is built from — the same function on the same text, rather than the same rule
 * written twice. Two copies of a slug rule is how an index ends up linking to
 * anchors that are not there, and only the second and third levels get one
 * because those are the levels that index lists.
 */
function anchorsFor(text: string, blocks: Block[]) {
  const names = headingsIn(text).map((heading) => heading.id);
  const anchors = new Map<Block, string>();
  let at = 0;

  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.kind === "callout") walk(block.content);
      else if (block.kind === "heading" && block.level > 1 && at < names.length) {
        anchors.set(block, names[at]!);
        at += 1;
      }
    }
  };

  walk(blocks);
  return anchors;
}

/* ------------------------------------------------------------------ blocks -- */

function BlockView({ block, anchors }: { block: Block; anchors: Map<Block, string> }) {
  if (block.kind === "rule") return <hr className="border-border-soft my-3" />;

  if (block.kind === "heading") {
    const size =
      block.level === 1
        ? "text-lg mt-4 first:mt-0"
        : block.level === 2
          ? "text-lg mt-3.5 first:mt-0"
          : "text-md mt-3 first:mt-0";
    // A real heading, so the index can link to it and a screen reader can
    // list it. The size and weight are the classes it always had — a comment
    // must not start looking like a document because its markup changed.
    const Tag = `h${block.level}` as "h1" | "h2" | "h3";
    return (
      <Tag id={anchors.get(block)} className={`${size} scroll-mt-20 font-bold tracking-[-0.01em]`}>
        <InlineView content={block.content} />
      </Tag>
    );
  }

  if (block.kind === "code") {
    return (
      <pre className="bg-surface-3 rounded-control my-2 overflow-x-auto px-3 py-2.5 font-mono text-sm leading-relaxed">
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.kind === "quote") {
    return (
      <blockquote className="border-border text-text-2 my-2 border-l-2 pl-3 italic">
        <InlineView content={block.content} />
      </blockquote>
    );
  }

  if (block.kind === "callout") return <CalloutView block={block} anchors={anchors} />;

  if (block.kind === "list") return <ListView block={block} />;

  if (block.kind === "table") {
    return (
      // The scroller is the block, not the table: a wide table pushes the
      // column it sits in otherwise, and a comment thread has no width to give.
      <div className="border-line rounded-card my-3 overflow-x-auto border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              {block.head.map((cell, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`border-line border-b px-3 py-2 font-semibold ${alignClass(block.align[index])}`}
                >
                  <InlineView content={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-line border-b last:border-0">
                {row.map((cell, index) => (
                  <td
                    key={index}
                    className={`px-3 py-2 align-top ${alignClass(block.align[index])}`}
                  >
                    <InlineView content={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p className="my-2 first:mt-0 last:mb-0">
      <InlineView content={block.content} />
    </p>
  );
}

const alignClass = (align: "left" | "center" | "right" | null | undefined) =>
  align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

/**
 * A list, and any list hanging under it.
 *
 * The nested one is inside the item it belongs to rather than after it, which
 * is what keeps the numbering of each level its own: an ordered list nested in
 * an ordered list counts from one again, because it is a different list.
 */
function ListView({ block }: { block: ListBlock }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag
      className={`my-2 space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-text-3`}
    >
      {block.items.map((item, index) => (
        <li key={index}>
          <InlineView content={item.content} />
          {item.children.map((child, at) => (
            <ListView key={at} block={child} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

/**
 * A callout: a paragraph the writer wanted read differently from the ones
 * around it.
 *
 * Each kind borrows a colour the rest of the desk already uses for that
 * feeling — the brand for a note, the priorities for the two middles, the two
 * outcome colours for the ends — so a warning in a document and a high-priority
 * ticket say "look at this" in the same voice. The band is mixed from the
 * colour rather than being a colour of its own, which is what keeps it legible
 * on both grounds without a second set of tokens.
 */
const CALLOUTS = {
  note: { icon: Info, token: "--brand-deep", title: "Note" },
  tip: { icon: Lightbulb, token: "--positive", title: "Tip" },
  important: { icon: MessageSquareWarning, token: "--p-medium", title: "Important" },
  warning: { icon: TriangleAlert, token: "--p-high", title: "Warning" },
  caution: { icon: OctagonAlert, token: "--negative", title: "Caution" },
} as const satisfies Record<Callout, { icon: typeof Info; token: string; title: string }>;

function CalloutView({
  block,
  anchors,
}: {
  block: Extract<Block, { kind: "callout" }>;
  anchors: Map<Block, string>;
}) {
  const { icon: Icon, token, title } = CALLOUTS[block.tone];
  const colour = `var(${token})`;

  return (
    <div
      className="rounded-card my-3 border-l-2 py-2.5 pr-3.5 pl-3"
      style={{
        borderColor: colour,
        background: `color-mix(in oklab, ${colour} 8%, transparent)`,
      }}
    >
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: colour }}>
        <Icon size={14} aria-hidden />
        {/* The kind's own word, unless the writer put one of their own after
            the marker. It is the word they typed to ask for the block, so it
            is what they wrote rather than a label the interface supplies. */}
        {block.title ? <InlineView content={block.title} /> : title}
      </p>
      {block.content.map((child, index) => (
        <BlockView key={index} block={child} anchors={anchors} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ inline -- */

function InlineView({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((piece, index) =>
        "br" in piece ? (
          <br key={index} />
        ) : "image" in piece ? (
          <Picture key={index} image={piece.image} />
        ) : (
          <Run key={index} piece={piece} />
        ),
      )}
    </>
  );
}

/**
 * A picture in the middle of what somebody wrote.
 *
 * Only ever one of this instance's own attachments. An address from anywhere
 * else is shown as its words instead, because an image the browser fetches is a
 * request the writer chose and the reader makes: a comment could otherwise tell
 * whoever opens the ticket to call a stranger's server, which is how you learn
 * that the desk read your message and roughly where from. The download route
 * has already decided whether this reader may see the file, so a picture nobody
 * is entitled to simply does not load.
 */
function Picture({ image }: { image: { src: string; alt: string } }) {
  if (!OWN_FILE.test(image.src)) return <Fragment>{image.alt}</Fragment>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt}
      className="border-line rounded-card my-2 block max-h-[28rem] max-w-full border"
    />
  );
}

/**
 * A run of text wears its marks from the inside out. A link is applied last so
 * it is the element carrying the click, whatever formatting is on the text
 * inside it.
 */
function Run({ piece }: { piece: { text: string; marks: Mark[] } }) {
  const link = piece.marks.find(
    (mark): mark is Extract<Mark, { type: "link" }> => mark.type === "link",
  );

  let node: ReactNode = piece.text;

  for (const mark of piece.marks) {
    if (mark.type === "code") {
      node = (
        <code className="bg-surface-3 rounded px-1 py-0.5 font-mono text-[0.9em]">{node}</code>
      );
    } else if (mark.type === "bold") {
      node = <strong className="font-semibold">{node}</strong>;
    } else if (mark.type === "italic") {
      node = <em>{node}</em>;
    } else if (mark.type === "strike") {
      node = <s className="text-text-2">{node}</s>;
    } else if (mark.type === "highlight") {
      node = (
        <mark className="text-brand-deep rounded bg-[var(--brand-tint)] px-0.5 font-medium">
          {node}
        </mark>
      );
    }
  }

  if (!link) return <Fragment>{node}</Fragment>;

  // A link into the app itself is a reference to something in it, and reads as
  // a chip rather than as prose with an underline through it.
  const internal = INTERNAL.exec(link.href);
  if (internal) {
    const segment = internal[1] ?? internal[2]!;
    return (
      <ReferenceChip
        href={link.href}
        label={piece.text}
        kind={KIND[segment as keyof typeof KIND]}
      />
    );
  }

  // An address we do not recognise loses its link and keeps its words.
  if (!SAFE_LINK.test(link.href)) return <Fragment>{node}</Fragment>;

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-brand-deep break-all underline underline-offset-2"
    >
      {node}
    </a>
  );
}
