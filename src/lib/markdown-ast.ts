/**
 * The one grammar, as data.
 *
 * Two things need to understand our Markdown: the renderer that shows a saved
 * comment, and the editor someone writes it in. If each had its own parser they
 * would drift, and the drift would show up as "it looked different before I
 * saved". So the grammar lives here as plain data, and both sides are built on
 * it — the renderer turns it into React, the editor turns it into a document
 * and back.
 *
 * The subset is deliberately small: it is what the toolbar can write, which is
 * what a service desk actually needs. Nothing here produces HTML.
 */

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "strike" }
  | { type: "highlight" }
  | { type: "code" }
  | { type: "link"; href: string };

/**
 * A run of text carrying zero or more marks, a line break inside one, or a
 * picture.
 *
 * An image is its own kind rather than a mark on text, because there is no text
 * under it: a mark decorates words, and this stands where words would be. The
 * alt is what a screen reader says and what is shown when the file has gone.
 */
export type Inline =
  { text: string; marks: Mark[] } | { br: true } | { image: { src: string; alt: string } };

/**
 * The five callouts GitHub writes, and nothing else.
 *
 * A closed set rather than a free word: each one is a colour and an icon on the
 * other side, and a kind nobody has drawn is a callout that renders as nothing.
 */
export type Callout = "note" | "tip" | "important" | "warning" | "caution";

/** A cell's alignment, or nothing where the author asked for none. */
export type Align = "left" | "center" | "right" | null;

/**
 * One line of a list, and whatever hangs under it.
 *
 * The children are lists rather than blocks: an indented list is what people
 * actually write under a bullet, and everything else — a second paragraph, a
 * fence — flattens into the line above it the way it always has.
 */
export type ListItem = { content: Inline[]; children: ListBlock[] };

export type ListBlock = { kind: "list"; ordered: boolean; items: ListItem[] };

export type Block =
  | { kind: "p"; content: Inline[] }
  | { kind: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { kind: "quote"; content: Inline[] }
  /// A blockquote opening with `[!NOTE]`. The title is what the author wrote
  /// after the marker; without one the reader shows the kind's own word.
  | { kind: "callout"; tone: Callout; title: Inline[] | null; content: Block[] }
  | { kind: "code"; text: string }
  | ListBlock
  /// `head` is the row above the dashes, `align` is one entry per column.
  | { kind: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { kind: "rule" };

/* -------------------------------------------------------------- reading -- */

const RULE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^ {0,3}(#{1,3})\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?/;
const BULLET = /^ {0,3}[-*]\s+(.*)$/;
const NUMBERED = /^ {0,3}\d+[.)]\s+(.*)$/;
const STARTS_BLOCK = /^ {0,3}(#{1,3}\s|>|```|:::|\||[-*]\s|\d+[.)]\s|(-{3,}|\*{3,}|_{3,})\s*$)/;

/** A list line at any depth: the indent is what decides which list it joins. */
const ITEM = /^([ \t]*)([-*+]|\d+[.)])\s+(.*)$/;

/** The first line of a callout, inside a blockquote whose `>` is already off. */
const CALLOUT = /^\[!(note|tip|important|warning|caution)\]\s*(.*)$/i;

/**
 * The other way a callout is written.
 *
 * Not ours and not GitHub's — it is what the pages imported from the old wiki
 * are full of, and a page that renders as `:::warning` on a line of its own is
 * the whole reason this exists. Read, never written: everything leaves here in
 * the one form above.
 */
const DIRECTIVE = /^ {0,3}:::[ \t]*([a-z]+)[ \t]*(.*)$/i;
const DIRECTIVE_END = /^ {0,3}:::\s*$/;
const DIRECTIVE_TONE: Record<string, Callout> = {
  note: "note",
  info: "note",
  tip: "tip",
  success: "tip",
  important: "important",
  warning: "warning",
  caution: "caution",
  danger: "caution",
};

/** A table's second line: pipes, dashes and the colons that set alignment. */
const DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?\s*$/;

export function parse(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    // An escaped marker is not a marker: `\# urgent` is somebody typing a hash,
    // not asking for a heading. Skipping the block tests for such a line is
    // what lets `literal` below promise that text stays text.
    if (/^ {0,3}\\/.test(line)) {
      const escaped: string[] = [];
      while (
        index < lines.length &&
        lines[index]!.trim() &&
        (/^ {0,3}\\/.test(lines[index]!) || !STARTS_BLOCK.test(lines[index]!))
      ) {
        escaped.push(lines[index]!);
        index += 1;
      }
      blocks.push({ kind: "p", content: joinLines(escaped) });
      continue;
    }

    // A fence runs to the closing fence, or to the end if nobody closed it.
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.trimStart().startsWith("```")) {
        body.push(lines[index]!);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        content: parseInline(heading[2]!.trim()),
      });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index]!)) {
        body.push(lines[index]!.replace(QUOTE, ""));
        index += 1;
      }

      // A quote opening with `[!NOTE]` is a callout: the rest of it is a
      // document in its own right, so the same reader reads it.
      const marker = CALLOUT.exec(body[0] ?? "");
      if (marker) {
        blocks.push({
          kind: "callout",
          tone: marker[1]!.toLowerCase() as Callout,
          title: marker[2]!.trim() ? parseInline(marker[2]!.trim()) : null,
          content: parse(body.slice(1).join("\n")),
        });
        continue;
      }

      blocks.push({ kind: "quote", content: joinLines(body) });
      continue;
    }

    const directive = DIRECTIVE.exec(line);
    if (directive && DIRECTIVE_TONE[directive[1]!.toLowerCase()]) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !DIRECTIVE_END.test(lines[index]!)) {
        body.push(lines[index]!);
        index += 1;
      }
      index += 1;
      blocks.push({
        kind: "callout",
        tone: DIRECTIVE_TONE[directive[1]!.toLowerCase()]!,
        title: directive[2]!.trim() ? parseInline(directive[2]!.trim()) : null,
        content: parse(body.join("\n")),
      });
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      lines[index + 1]!.includes("|") &&
      DELIMITER.test(lines[index + 1]!)
    ) {
      const head = splitRow(line);
      const align = splitRow(lines[index + 1]!).map(alignOf);
      index += 2;

      const rows: Inline[][][] = [];
      while (index < lines.length && lines[index]!.includes("|") && lines[index]!.trim()) {
        rows.push(cells(splitRow(lines[index]!), head.length));
        index += 1;
      }
      blocks.push({
        kind: "table",
        align: head.map((_, column) => align[column] ?? null),
        head: cells(head, head.length),
        rows,
      });
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      // The whole list, nesting included: every following line that is an item
      // at any depth belongs to it, and so do the blank lines between them.
      const first = ITEM.exec(line)!;
      const ordered = NUMBERED.test(line);
      const raw: { indent: number; ordered: boolean; text: string }[] = [];
      let at = index;

      while (at < lines.length) {
        if (!lines[at]!.trim()) {
          // A blank line only stays inside the list if another item follows it.
          let ahead = at;
          while (ahead < lines.length && !lines[ahead]!.trim()) ahead += 1;
          if (ahead >= lines.length || !ITEM.test(lines[ahead]!)) break;
          at = ahead;
          continue;
        }

        const item = ITEM.exec(lines[at]!);
        if (!item) break;

        // A top-level item written with the other kind of marker starts its own
        // list, the way it always has.
        const indent = widthOf(item[1]!);
        const numbered = /\d/.test(item[2]!);
        if (indent <= 3 && numbered !== ordered) break;

        raw.push({ indent, ordered: numbered, text: item[3]! });
        at += 1;
      }

      index = at;
      blocks.push(nest(raw, widthOf(first[1]!), ordered));
      continue;
    }

    // Everything else is a paragraph, running to the next blank line.
    const body: string[] = [];
    while (index < lines.length && lines[index]!.trim() && !STARTS_BLOCK.test(lines[index]!)) {
      body.push(lines[index]!);
      index += 1;
    }
    if (body.length === 0) {
      body.push(lines[index]!);
      index += 1;
    }
    blocks.push({ kind: "p", content: joinLines(body) });
  }

  return blocks;
}

/** A tab is four columns, which is what an editor writing one meant by it. */
function widthOf(indent: string) {
  return [...indent].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);
}

/**
 * Flat items, by indent, into the tree they were drawn as.
 *
 * Depth is relative rather than absolute: what matters is that a line is
 * further in than the one above it, not by how much. Two spaces, four, or a
 * tab all read as "under that one", because all three are how people write it
 * and none of them is wrong.
 */
function nest(
  raw: { indent: number; ordered: boolean; text: string }[],
  indent: number,
  ordered: boolean,
): ListBlock {
  const root: ListBlock = { kind: "list", ordered, items: [] };
  const open = [{ indent, list: root }];

  for (const item of raw) {
    while (open.length > 1 && item.indent < open[open.length - 1]!.indent) open.pop();

    let level = open[open.length - 1]!;
    if (item.indent > level.indent && level.list.items.length) {
      const nested: ListBlock = { kind: "list", ordered: item.ordered, items: [] };
      level.list.items[level.list.items.length - 1]!.children.push(nested);
      level = { indent: item.indent, list: nested };
      open.push(level);
    }

    level.list.items.push({ content: parseInline(item.text), children: [] });
  }

  return root;
}

/**
 * One table line into its cells.
 *
 * The outer pipes are decoration and come off; an escaped one is a pipe in
 * somebody's sentence and stays, which is the only reason this is not a split.
 */
function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cell = "";

  for (let at = 0; at < body.length; at += 1) {
    if (body[at] === "\\" && body[at + 1] === "|") {
      cell += "|";
      at += 1;
    } else if (body[at] === "|") {
      out.push(cell);
      cell = "";
    } else {
      cell += body[at];
    }
  }

  out.push(cell);
  return out.map((value) => value.trim());
}

const alignOf = (dashes: string): Align =>
  dashes.startsWith(":") && dashes.endsWith(":")
    ? "center"
    : dashes.endsWith(":")
      ? "right"
      : dashes.startsWith(":")
        ? "left"
        : null;

/** Every row is as wide as the header: a short one is padded, a long one cut. */
const cells = (row: string[], width: number): Inline[][] =>
  Array.from({ length: width }, (_, column) => parseInline(row[column] ?? ""));

/** Soft line breaks inside one paragraph are kept: people press Enter. */
function joinLines(lines: string[]): Inline[] {
  const content: Inline[] = [];
  lines.forEach((line, index) => {
    if (index > 0) content.push({ br: true });
    content.push(...parseInline(line));
  });
  return content;
}

/**
 * One pass over the line, taking whichever mark starts earliest. Code spans win
 * before anything inside them is looked at, which is what makes it possible to
 * write `**` without it turning bold.
 *
 * Marks accumulate rather than nest, because that is how a document model holds
 * them: "bold and italic" is one run wearing two marks, not one inside another.
 */
const INLINE =
  // The image alternative comes before the link one: `![x](y)` also matches a
  // link with a stray `!` in front of it, and the first alternative to match at
  // the earliest position is the one that wins.
  /(\\[\\*_~=`[\]#>+\-.)(!:|])|(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\*\*(?:[^*]|\*(?!\*))+?\*\*)|(__(?:[^_]|_(?!_))+?__)|(~~[^~]+~~)|(==[^=]+==)|(\*[^*\n]+\*)|((?<![A-Za-z0-9])_[^_\n]+_(?![A-Za-z0-9]))|(\[[^\]]+\]\([^)\s]+\))|(\bhttps?:\/\/[^\s<]*[^\s<.,;:!?)\]])/;

export function parseInline(text: string, marks: Mark[] = []): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  const push = (value: string, extra: Mark[] = []) => {
    if (value) out.push({ text: value, marks: [...marks, ...extra] });
  };

  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      push(rest);
      break;
    }

    if (match.index > 0) push(rest.slice(0, match.index));
    const token = match[0];
    rest = rest.slice(match.index + token.length);

    // An escaped mark is the character itself, with no meaning attached.
    if (token.startsWith("\\")) {
      push(token.slice(1));
      continue;
    }

    if (token.startsWith("`")) {
      push(token.slice(1, -1), [{ type: "code" }]);
      continue;
    }

    // A picture carries no marks: whatever it sits inside decorates the words
    // around it, and there are none under this.
    if (token.startsWith("![")) {
      const split = token.indexOf("](");
      out.push({ image: { alt: token.slice(2, split), src: token.slice(split + 2, -1) } });
      continue;
    }

    const wrapped = (inner: string, mark: Mark) =>
      out.push(...parseInline(inner, [...marks, mark]));

    if (token.startsWith("**") || token.startsWith("__")) {
      wrapped(token.slice(2, -2), { type: "bold" });
    } else if (token.startsWith("~~")) {
      wrapped(token.slice(2, -2), { type: "strike" });
    } else if (token.startsWith("==")) {
      wrapped(token.slice(2, -2), { type: "highlight" });
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      wrapped(token.slice(1, split), { type: "link", href: token.slice(split + 2, -1) });
    } else if (token.startsWith("http")) {
      push(token, [{ type: "link", href: token }]);
    } else {
      wrapped(token.slice(1, -1), { type: "italic" });
    }
  }

  return out;
}

/* -------------------------------------------------------------- writing -- */

/**
 * Text that will read back exactly as it was written.
 *
 * Only what could actually start a construct is escaped: a lone `=` or `~`
 * means nothing — only the doubled forms do — so escaping every one of them
 * would litter ordinary prose for no gain.
 *
 * Used by the writer below for its own output, and by anything storing text
 * that must not be read as Markdown when it is shown again.
 */
export function escapeMarkdown(text: string) {
  return text.replace(/([\\*_`[\]])/g, "\\$1").replace(/(~~|==)/g, (m) => `\\${m[0]}\\${m[1]}`);
}

const WRAP: Record<string, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  strike: ["~~", "~~"],
  highlight: ["==", "=="],
  code: ["`", "`"],
};

/**
 * Outermost first.
 *
 * Bold sits outside a link so that a bold sentence containing one stays a
 * single pair of asterisks — "**bold [link](/x) inside**" rather than the
 * three separate bold runs you get if the link is allowed to break it.
 */
const ORDER = ["bold", "italic", "strike", "highlight", "link", "code"] as const;

const markKey = (mark: Mark) => (mark.type === "link" ? `link:${mark.href}` : mark.type);

/**
 * Marks are opened and closed as a stack across runs rather than wrapped around
 * each one, so a mark spanning several runs is written once.
 */
function writeInline(content: Inline[]): string {
  let out = "";
  let open: Mark[] = [];

  const close = (downTo: number) => {
    // Whitespace is moved outside the closing mark: "**bold **" is not bold in
    // any Markdown reader, because the space breaks the closing run.
    for (let i = open.length - 1; i >= downTo; i -= 1) {
      const trailing = /\s+$/.exec(out)?.[0] ?? "";
      if (trailing) out = out.slice(0, -trailing.length);
      const mark = open[i]!;
      out += mark.type === "link" ? `](${mark.href})` : WRAP[mark.type]![1];
      out += trailing;
    }
    open = open.slice(0, downTo);
  };

  for (const piece of content) {
    if ("br" in piece) {
      close(0);
      out += "\n";
      continue;
    }

    if ("image" in piece) {
      // Whatever marks are open stay open across it. A picture carries none of
      // its own — the reader drops them — so closing them here would split one
      // bold sentence into two every time it contained a screenshot, and the
      // words would come back wearing a different shape than they were saved in.
      //
      // The alt is stripped rather than escaped: it is read back raw, so a
      // backslash written here would come back as part of the words. Brackets
      // and newlines are the only characters that could break the syntax.
      out += `![${piece.image.alt.replace(/[[\]\n]/g, " ").trim()}](${piece.image.src})`;
      continue;
    }

    if (!piece.text) continue;

    // A bare URL is left bare: rewriting it as a link to itself is noise in
    // text a person also reads.
    const link = piece.marks.find((mark) => mark.type === "link");
    if (link?.type === "link" && link.href === piece.text && piece.marks.length === 1) {
      close(0);
      out += piece.text;
      continue;
    }

    const want = ORDER.flatMap((type) => piece.marks.filter((mark) => mark.type === type));

    let shared = 0;
    while (
      shared < open.length &&
      shared < want.length &&
      markKey(open[shared]!) === markKey(want[shared]!)
    ) {
      shared += 1;
    }

    close(shared);
    for (const mark of want.slice(shared)) {
      out += mark.type === "link" ? "[" : WRAP[mark.type]![0];
      open.push(mark);
    }

    // Code is literal by definition, so its content is never escaped.
    out += piece.marks.some((mark) => mark.type === "code")
      ? piece.text
      : escapeMarkdown(piece.text);
  }

  close(0);
  return out;
}

/**
 * A list, its children under it.
 *
 * Four spaces a level rather than two: under `1. ` the content column is three,
 * and a two-space child is a nested list to some readers and a lazy
 * continuation to others. Four is past both marks, so it nests everywhere.
 */
function writeList(block: ListBlock, depth: number): string {
  return block.items
    .map((item, at) => {
      const marker = block.ordered ? `${at + 1}.` : "-";
      const line = `${"    ".repeat(depth)}${marker} ${writeInline(item.content)}`;
      return [line, ...item.children.map((child) => writeList(child, depth + 1))].join("\n");
    })
    .join("\n");
}

/** A cell is one line: a pipe inside it would end it, a break would end the row. */
const writeCell = (content: Inline[]) =>
  writeInline(content).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

const writeRow = (row: Inline[][]) => `| ${row.map(writeCell).join(" | ")} |`;

const DASHES: Record<string, string> = {
  left: ":---",
  center: ":---:",
  right: "---:",
};

export function stringify(blocks: Block[]): string {
  const out: string[] = [];

  for (const block of blocks) {
    if (block.kind === "rule") out.push("---");
    else if (block.kind === "code") out.push(`\`\`\`\n${block.text}\n\`\`\``);
    else if (block.kind === "heading")
      out.push(`${"#".repeat(block.level)} ${writeInline(block.content)}`);
    else if (block.kind === "quote")
      out.push(
        writeInline(block.content)
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      );
    else if (block.kind === "callout") {
      const head = `[!${block.tone.toUpperCase()}]${
        block.title ? ` ${writeInline(block.title)}` : ""
      }`;
      const body = stringify(block.content);
      out.push(
        [head, ...(body ? ["", body] : [])]
          .join("\n")
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n"),
      );
    } else if (block.kind === "table")
      out.push(
        [
          writeRow(block.head),
          `| ${block.align.map((align) => (align ? DASHES[align]! : "---")).join(" | ")} |`,
          ...block.rows.map(writeRow),
        ].join("\n"),
      );
    else if (block.kind === "list") out.push(writeList(block, 0));
    else out.push(writeInline(block.content));
  }

  return out.join("\n\n");
}

/**
 * Text stored so that it can only ever read as itself.
 *
 * `escapeMarkdown` covers the inline marks. A line *opening* with a block
 * marker is a separate problem, because "# urgent" and "- broken" are how
 * people write when they are not thinking about Markdown at all — and both
 * halves are needed: without the second, somebody typing a hash into a plain
 * box still gets a heading on the other side of it.
 *
 * A bare URL is deliberately still auto-linked. Somebody pasting a link wants
 * a link, and it is the one piece of formatting nobody produces by accident.
 */
export function literal(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      escapeMarkdown(line)
        // A table's first line and a directive's fence are block markers too,
        // and both only mean anything at the start of a line.
        .replace(/^(\s*)([#>\-+|:])/, "$1\\$2")
        .replace(/^(\s*)(\d+)([.)])/, "$1$2\\$3"),
    )
    .join("\n");
}
