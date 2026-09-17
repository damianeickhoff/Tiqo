/**
 * Two versions of a page, lined up beside each other.
 *
 * Line by line, not word by word: a runbook is read as steps, and a highlight
 * inside a sentence tells somebody a word moved without telling them which step
 * changed. The unit somebody acts on is the line.
 *
 * Written here rather than pulled in. A diff of two documents is a textbook
 * longest-common-subsequence, forty lines of it, and a dependency for that is a
 * supply chain to keep an eye on for ever.
 */

/** One row of the side-by-side. A null side is a line the other version does
 *  not have — added on the right, or removed from the left. */
export type DiffRow = { left: string | null; right: string | null; changed: boolean };

/**
 * Past this, the table is quadratic in something nobody is reading anyway.
 *
 * A page that long compared against another that long is 640,000 cells, which
 * is fast; twice that is four times the work for a diff somebody would scroll
 * past. Beyond the cap the two sides are simply set beside each other and every
 * line that differs is marked, which is honest and cheap.
 */
const MAX_LINES = 800;

export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);

  if (a.length > MAX_LINES || b.length > MAX_LINES) return sideBySide(a, b);

  // Classic LCS table. `table[i][j]` is the length of the longest run of lines
  // common to `a` from `i` on and `b` from `j` on.
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ left: a[i]!, right: b[j]!, changed: false });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      rows.push({ left: a[i]!, right: null, changed: true });
      i += 1;
    } else {
      rows.push({ left: null, right: b[j]!, changed: true });
      j += 1;
    }
  }
  while (i < a.length) rows.push({ left: a[i++]!, right: null, changed: true });
  while (j < b.length) rows.push({ left: null, right: b[j++]!, changed: true });

  return rows;
}

/** The cheap answer for two very long versions: same position, same row. */
function sideBySide(a: string[], b: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  for (let at = 0; at < Math.max(a.length, b.length); at += 1) {
    const left = a[at] ?? null;
    const right = b[at] ?? null;
    rows.push({ left, right, changed: left !== right });
  }
  return rows;
}
