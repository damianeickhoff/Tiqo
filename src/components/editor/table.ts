import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";

/**
 * Tables, with the one thing GFM says about a cell that Tiptap does not.
 *
 * Markdown sets alignment per column, in the row of dashes under the header.
 * The document model has no column to hang that on, so every cell carries it —
 * same value down the column, written back out of the header row. Losing it
 * would mean a table of numbers coming back left-aligned the first time anyone
 * opened the page to fix a typo.
 *
 * Columns are not resizable: a width in pixels is not something Markdown can
 * say, so offering the handle would promise something the save could not keep.
 */
const alignment = {
  align: {
    default: null,
    parseHTML: (element: HTMLElement) => element.style.textAlign || null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.align ? { style: `text-align: ${attributes.align}` } : {},
  },
};

export const TableCellAligned = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...alignment };
  },
});

export const TableHeaderAligned = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...alignment };
  },
});

export const TableNodes = [
  Table.configure({ resizable: false }),
  TableRow,
  TableHeaderAligned,
  TableCellAligned,
];
