/**
 * Just enough CSV to read what a desk exports.
 *
 * Written here rather than pulled in: a dependency for this is a supply chain
 * for forty lines, and the dialect that matters is the one Excel writes —
 * quoted fields, doubled quotes inside them, commas and newlines inside those,
 * and CRLF at the end of every row.
 *
 * Pure, because the same parse has to run on the client to draw the preview and
 * on the server to do the writing, and two parsers is how a preview comes to
 * disagree with what was imported.
 */

/**
 * Which separator this file uses.
 *
 * Sniffed rather than assumed: a Dutch Excel writes semicolons, and a desk that
 * has to know that about its own export before the import will work is one that
 * gives up on the import. Counted outside quotes only, on the header line, and
 * the winner has to actually appear — otherwise a one-column file would be read
 * as whatever we guessed first.
 */
export function sniffDelimiter(text: string): string {
  const [line = ""] = text.split(/\r?\n/, 1);
  let best = ",";
  let most = 0;
  for (const candidate of [",", ";", "\t", "|"]) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') quoted = !quoted;
      else if (char === candidate && !quoted) count += 1;
    }
    if (count > most) {
      most = count;
      best = candidate;
    }
  }
  return best;
}

/**
 * Rows of fields. Blank trailing lines are dropped; a blank line in the middle
 * is kept as an empty row, because a file with a gap in it is a file somebody
 * should look at rather than one we quietly close up.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  // A byte-order mark at the front otherwise becomes part of the first header,
  // which is how "id" stops matching "id".
  const source = text.replace(/^﻿/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;

    if (quoted) {
      if (char !== '"') {
        field += char;
        continue;
      }
      // A doubled quote is one literal quote; a single one ends the field.
      if (source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1]!.every((cell) => cell.trim() === "")) {
    rows.pop();
  }

  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

/**
 * One row, written the way Excel reads one.
 *
 * Quoted only where it has to be — a file of quoted cells is unreadable in a
 * text editor — and always where the value carries the delimiter, a quote or a
 * newline. A leading `=` or `+` would be run as a formula by Excel, so anything
 * starting with one is quoted too and prefixed with a quote character: an asset
 * named `=cmd` is a name, not a command.
 */
export function csvRow(cells: (string | number | null | undefined)[], delimiter = ",") {
  return cells
    .map((cell) => {
      const value = cell === null || cell === undefined ? "" : String(cell);
      const risky = /^[=+\-@]/.test(value);
      const body = risky ? `'${value}` : value;
      return /["\n\r]/.test(body) || body.includes(delimiter) || risky
        ? `"${body.replace(/"/g, '""')}"`
        : body;
    })
    .join(delimiter);
}

/// What Excel needs at the front of a UTF-8 file before it believes the
/// encoding. Without it a Dutch desk exports "Beheerdersgroep" and opens
/// "Beheerdersgroep" spelled wrong.
export const CSV_BOM = "﻿";
