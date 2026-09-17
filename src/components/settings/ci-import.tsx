"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CircleAlert, Upload } from "lucide-react";
import { importCiItems, type ImportReport } from "@/lib/actions/cmdb";
import { parseCsv, sniffDelimiter } from "@/lib/csv";
import { Button, Card, FieldError, FormError, Input, Select, Textarea } from "@/components/ui";
import { PanelCard } from "@/components/tickets/panel-card";
import { useMessages } from "@/components/shell/instance-context";

type TypeOption = {
  id: string;
  name: string;
  fields: { key: string; label: string; required: boolean }[];
};

const SEPARATORS = [
  { value: ",", label: "," },
  { value: ";", label: ";" },
  { value: "\t", label: "\\t" },
  { value: "|", label: "|" },
];

/** How many rows the preview is worth. Enough to see the mapping is right. */
const PREVIEW = 5;

/**
 * Columns to attributes, then run it.
 *
 * The file is parsed here to draw the preview and parsed again on the server to
 * do the writing, both by the same pure function — a preview drawn by different
 * code from the import is a preview that can lie.
 */
export function CiImport({ types }: { types: TypeOption[] }) {
  const t = useMessages();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [source, setSource] = useState("csv");
  const [text, setText] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  const type = types.find((option) => option.id === typeId);
  const rows = useMemo(() => (text ? parseCsv(text, delimiter) : []), [text, delimiter]);
  const header = hasHeader ? (rows[0] ?? []) : [];
  const body = hasHeader ? rows.slice(1) : rows;

  /**
   * What each column probably is, from what it is called.
   *
   * A guess, not a decision: every select below can be changed. It exists
   * because a forty-column export mapped entirely by hand is an import nobody
   * finishes.
   */
  function guess(columns: string[], forType: TypeOption | undefined): string[] {
    return columns.map((raw) => {
      const name = raw.trim().toLowerCase();
      if (["name", "naam", "hostname", "asset", "title"].includes(name)) return "name";
      if (["id", "key", "external id", "externalid", "asset id", "sleutel"].includes(name)) {
        return "externalId";
      }
      if (["lifecycle", "status", "state", "levensfase"].includes(name)) return "lifecycle";
      if (["team", "group", "operator group"].includes(name)) return "team";
      const field = forType?.fields.find(
        (candidate) =>
          candidate.key === name.replace(/[^a-z0-9]+/g, "_") ||
          candidate.label.toLowerCase() === name,
      );
      return field ? `attr:${field.key}` : "ignore";
    });
  }

  /**
   * A whole file arriving, which is the only time anything may be re-guessed.
   *
   * Typing in the box is *editing* a file, not loading a new one: re-sniffing
   * the delimiter there overwrote a separator somebody had just chosen by hand,
   * and re-guessing the mapping threw away forty columns of work on the
   * keystroke after it.
   */
  function load(next: string) {
    const separator = sniffDelimiter(next);
    setText(next);
    setDelimiter(separator);
    setMapping(guess(parseCsv(next, separator)[0] ?? [], type));
    setReport(null);
    setErrors({});
  }

  /**
   * Editing what is already there.
   *
   * The mapping is left alone unless the shape of the file changed — a paste
   * over the top of one file with another is a new file, and a first paste has
   * nothing to protect. Everything in between is somebody typing, and their
   * columns are their own.
   */
  function edit(next: string) {
    setText(next);
    setReport(null);

    const columns = parseCsv(next, delimiter)[0] ?? [];
    if (columns.length !== mapping.length) setMapping(guess(columns, type));
  }

  function run() {
    startTransition(async () => {
      const result = await importCiItems({
        typeId,
        source,
        text,
        delimiter,
        hasHeader,
        mapping,
      });
      if (!result.ok) {
        setErrors(result.errors);
        setReport(null);
        return;
      }
      setErrors({});
      setReport(result.report);
    });
  }

  const columnCount = Math.max(
    header.length,
    ...body.slice(0, PREVIEW).map((row) => row.length),
    0,
  );

  /**
   * Two columns pointed at the same field.
   *
   * The import takes the first and drops the second in silence, which is how
   * somebody ends up with a register full of the wrong serial numbers and no
   * idea why. Said here rather than refused, because the file may genuinely
   * carry the same thing twice and only the person looking at it knows which
   * one they meant.
   */
  const duplicates = [
    ...new Set(
      mapping.filter((target, at) => target !== "ignore" && mapping.indexOf(target) !== at),
    ),
  ];

  if (types.length === 0) return <p className="text-text-3 text-base">{t.cmdb.noTypes}</p>;

  return (
    <div className="space-y-5">
      <FormError>{errors.form}</FormError>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label mb-1.5 block">{t.cmdb.type}</span>
          <Select
            value={typeId}
            onChange={(event) => {
              const next = event.target.value;
              setTypeId(next);
              setMapping(
                guess(
                  header,
                  types.find((option) => option.id === next),
                ),
              );
            }}
          >
            {types.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
          <FieldError>{errors.typeId}</FieldError>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.cmdb.importSource}</span>
          <Input
            value={source}
            maxLength={60}
            onChange={(event) => setSource(event.target.value)}
          />
          <span className="text-text-3 mt-1 block text-sm">{t.cmdb.importSourceHint}</span>
          <FieldError>{errors.source}</FieldError>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="border-border hover:border-line-strong rounded-control inline-flex cursor-pointer items-center gap-2 border px-3 py-2 text-base font-medium transition-colors">
          <Upload size={14} />
          {t.cmdb.importFile}
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) load(await file.text());
            }}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(event) => setHasHeader(event.target.checked)}
            className="accent-brand size-4"
          />
          <span className="text-base font-medium">{t.cmdb.importHasHeader}</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="label">{t.cmdb.importSeparator}</span>
          <Select
            value={delimiter}
            onChange={(event) => setDelimiter(event.target.value)}
            className="w-20"
          >
            {SEPARATORS.map((separator) => (
              <option key={separator.value} value={separator.value}>
                {separator.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <label className="block">
        <span className="label mb-1.5 block">{t.cmdb.importOrPaste}</span>
        <Textarea
          rows={5}
          value={text}
          onChange={(event) => edit(event.target.value)}
          className="font-mono text-sm"
        />
        <FieldError>{errors.text}</FieldError>
      </label>

      {columnCount > 0 ? (
        <PanelCard
          title={t.cmdb.importMapping}
          action={<span className="text-text-3 text-sm">{t.cmdb.importPreview(body.length)}</span>}
        >
          {duplicates.length ? (
            <p className="border-line text-text-2 border-b px-3.5 py-2 text-sm">
              {t.cmdb.importDuplicateColumns(duplicates.length)}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-line border-b">
                  {Array.from({ length: columnCount }, (_, index) => (
                    <th key={index} className="min-w-[170px] p-2 align-top font-normal">
                      <span className="text-text-3 mb-1 block truncate text-xs">
                        {header[index] || `#${index + 1}`}
                      </span>
                      <Select
                        value={mapping[index] ?? "ignore"}
                        aria-label={header[index] || `#${index + 1}`}
                        onChange={(event) => {
                          const next = [...mapping];
                          next[index] = event.target.value;
                          setMapping(next);
                        }}
                      >
                        <option value="ignore">{t.cmdb.importIgnore}</option>
                        <option value="name">{t.cmdb.importAsName}</option>
                        <option value="externalId">{t.cmdb.importAsKey}</option>
                        <option value="lifecycle">{t.cmdb.importAsLifecycle}</option>
                        <option value="team">{t.cmdb.importAsTeam}</option>
                        {type?.fields.map((field) => (
                          <option key={field.key} value={`attr:${field.key}`}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </option>
                        ))}
                      </Select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.slice(0, PREVIEW).map((row, index) => (
                  <tr key={index} className="border-line border-b last:border-b-0">
                    {Array.from({ length: columnCount }, (_, at) => (
                      <td key={at} className="text-text-2 max-w-[240px] truncate p-2">
                        {row[at] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      ) : null}

      <Button type="button" onClick={run} disabled={pending || body.length === 0}>
        {pending ? t.common.saving : t.cmdb.importRun}
      </Button>

      {report ? <Report report={report} /> : null}
    </div>
  );
}

/** What the run did, in the three numbers the plan asks for, plus what it could
 *  not do and why. */
function Report({ report }: { report: ImportReport }) {
  const t = useMessages();

  return (
    <Card className="p-4">
      <h3 className="label mb-3 flex items-center gap-1.5">
        <Check size={13} strokeWidth={2.5} className="text-positive" />
        {t.cmdb.importDone}
      </h3>

      <div className="flex flex-wrap gap-4 text-base font-medium">
        <span className="text-positive">{t.cmdb.importCreated(report.created)}</span>
        <span>{t.cmdb.importUpdated(report.updated)}</span>
        <span className={report.skipped.length > 0 ? "text-negative" : "text-text-3"}>
          {t.cmdb.importSkipped(report.skipped.length)}
        </span>
      </div>

      {report.skipped.length > 0 ? (
        <ul className="border-line mt-3 space-y-1 border-t pt-3">
          {report.skipped.map((note) => (
            <li key={`skip-${note.row}`} className="text-text-2 flex gap-2 text-sm">
              <span className="text-text-3 shrink-0 font-mono">{t.cmdb.importRow(note.row)}</span>
              {note.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {report.warnings.length > 0 ? (
        <div className="border-line mt-3 border-t pt-3">
          <p className="text-text-2 mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <CircleAlert size={12} strokeWidth={2.5} />
            {t.cmdb.importWarnings(report.warnings.length)}
          </p>
          <ul className="space-y-1">
            {report.warnings.map((note) => (
              <li key={`warn-${note.row}`} className="text-text-2 flex gap-2 text-sm">
                <span className="text-text-3 shrink-0 font-mono">{t.cmdb.importRow(note.row)}</span>
                {note.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
