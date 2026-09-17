import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewCis, ticketVisibilityFilter } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { readAttribute, type FieldSpec } from "@/lib/cmdb";
import { ciWhere } from "@/lib/ci-filter";
import { expiryWindow } from "@/lib/ci-expiry";
import { ALL_TYPES, attrKeyOf, availableColumns, readColumns, unionFields } from "@/lib/ci-columns";
import { csvRow, CSV_BOM } from "@/lib/csv";

export const runtime = "nodejs";

/// Enough for any desk's register in one file, and a ceiling rather than a
/// page: an export that silently stopped at fifty rows is worse than no export.
const LIMIT = 5000;

/**
 * The register as a spreadsheet.
 *
 * The same rows and the same columns as the screen it was pressed from — the
 * filters come in on the query string and the columns out of the same stored
 * preference the table reads, because an export that shows different columns is
 * a second register to explain.
 *
 * A route rather than a server action: an action cannot hand back a file, and a
 * download needs a real response with a filename on it.
 *
 * The order is the register's own for the columns the database can sort, and by
 * name for the two that live inside the JSON blob. Sorting a spreadsheet is
 * what a spreadsheet is for; being handed the wrong rows is not.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewCis(user)) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const typeKey = params.get("type")?.trim() || undefined;
  const sort = params.get("sort")?.trim() ?? "name";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  // A selection overrules the filters entirely: "export the rows I ticked" is
  // a different request from "export what the register is showing", and
  // narrowing one by the other would hand back fewer rows than were ticked.
  const ids = params
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, LIMIT);

  const view = params.get("view")?.trim() || undefined;
  const where = ids?.length
    ? { id: { in: ids } }
    : ciWhere({
        typeKey,
        lifecycle: params.get("life")?.trim() || undefined,
        team: params.get("team")?.trim() || undefined,
        q: params.get("q")?.trim() || undefined,
        view,
        expiry: view === "expiring" ? await expiryWindow(typeKey) : undefined,
        open: { status: { is: { settles: false } }, ...ticketVisibilityFilter(user) },
      });

  const t = await getMessages();

  // Every type's attributes, as the register offers them: standing in a type it
  // is that type's, and in the view that spans them all it is one of each. The
  // rows keep their `typeId`, because which kind a value is read as is the row's
  // answer and not the heading's.
  const allFields = (await prisma.ciTypeField.findMany({
    orderBy: [{ type: { position: "asc" } }, { position: "asc" }],
    select: {
      typeId: true,
      key: true,
      label: true,
      kind: true,
      required: true,
      options: true,
      isExpiry: true,
    },
  })) as (FieldSpec & { typeId: string })[];

  const fieldsByType: Record<string, FieldSpec[]> = {};
  for (const field of allFields) (fieldsByType[field.typeId] ??= []).push(field);

  const [preference, standing] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { ciColumns: true } }),
    typeKey
      ? prisma.ciType.findUnique({
          where: { key: typeKey },
          select: { id: true, defaultColumns: true },
        })
      : Promise.resolve(null),
  ]);

  const fields = standing ? (fieldsByType[standing.id] ?? []) : unionFields(allFields);

  const columns = readColumns(
    preference?.ciColumns ?? null,
    typeKey ?? ALL_TYPES,
    availableColumns(fields),
    standing?.defaultColumns ?? [],
  );

  const items = await prisma.configurationItem.findMany({
    where,
    orderBy:
      sort === "type"
        ? { type: { name: dir } }
        : sort === "lifecycle"
          ? { lifecycle: dir }
          : { name: dir },
    take: LIMIT,
    select: {
      id: true,
      name: true,
      lifecycle: true,
      attributes: true,
      typeId: true,
      type: { select: { name: true } },
      team: { select: { name: true } },
      _count: {
        select: { tickets: { where: { ticket: { status: { is: { settles: false } } } } } },
      },
    },
  });

  // The two attribute kinds that store an id. Resolved for the whole file in
  // two queries rather than one lookup per cell.
  const wanted = { people: new Set<string>(), items: new Set<string>() };
  for (const column of columns) {
    const key = attrKeyOf(column);
    if (!key) continue;
    for (const item of items) {
      const field = fieldsByType[item.typeId]?.find((candidate) => candidate.key === key);
      if (!field || (field.kind !== "USER" && field.kind !== "ITEM")) continue;
      const value = readAttribute(field, item.attributes);
      if (typeof value === "string" && value) {
        wanted[field.kind === "USER" ? "people" : "items"].add(value);
      }
    }
  }

  const names: Record<string, string> = {};
  const [people, referenced] = await Promise.all([
    wanted.people.size
      ? prisma.user.findMany({
          where: { id: { in: [...wanted.people] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    wanted.items.size
      ? prisma.configurationItem.findMany({
          where: { id: { in: [...wanted.items] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  for (const person of people) names[person.id] = person.name;
  for (const item of referenced) names[item.id] = item.name;

  function heading(column: string) {
    const key = attrKeyOf(column);
    if (key) return fields.find((field) => field.key === key)?.label ?? key;
    if (column === "type") return t.cmdb.type;
    if (column === "lifecycle") return t.cmdb.lifecycle;
    if (column === "team") return t.cmdb.team;
    return t.cmdb.openHeading;
  }

  function cell(item: (typeof items)[number], column: string) {
    const key = attrKeyOf(column);
    if (!key) {
      if (column === "type") return item.type.name;
      if (column === "lifecycle") return t.cmdb.life[item.lifecycle];
      if (column === "team") return item.team?.name ?? "";
      return item._count.tickets;
    }

    // The row's own type decides what the key means, and a type that has no
    // such attribute leaves the cell blank — the same empty the register draws.
    const field = fieldsByType[item.typeId]?.find((candidate) => candidate.key === key);
    if (!field) return "";

    const value = readAttribute(field, item.attributes);
    if (value === null) return "";
    // Dates and numbers go out as they are stored: an ISO date sorts in a
    // spreadsheet and a formatted one does not. Yes and no are words, because
    // "true" in a column of Dutch is not an answer anybody wrote.
    if (typeof value === "boolean") return value ? t.common.yes : t.common.no;
    if (field.kind === "USER" || field.kind === "ITEM") return names[String(value)] ?? "";
    return value;
  }

  const lines = [
    csvRow([t.cmdb.name, ...columns.map(heading)]),
    ...items.map((item) => csvRow([item.name, ...columns.map((column) => cell(item, column))])),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`${CSV_BOM}${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${typeKey ?? "assets"}-${stamp}.csv"`,
      // Nothing about a register is worth a cached copy of yesterday's rows.
      "cache-control": "no-store",
    },
  });
}
