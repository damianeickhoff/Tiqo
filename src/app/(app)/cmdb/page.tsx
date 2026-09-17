import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Suspense } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditCis, canManageCis, canViewCis, ticketVisibilityFilter } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { readAttribute, type FieldSpec } from "@/lib/cmdb";
import { ciWhere } from "@/lib/ci-filter";
import { expiryWindow } from "@/lib/ci-expiry";
import { readViews } from "@/lib/ci-views";
import { CI_MODE_COOKIE, readCiMode } from "@/lib/ci-mode";
import { ALL_TYPES, attrKeyOf, availableColumns, readColumns, unionFields } from "@/lib/ci-columns";
import { PageHeader } from "@/components/shell/page-header";
import { CiFilterBar } from "@/components/cmdb/ci-filter-bar";
import { CiTypeSidebar } from "@/components/cmdb/ci-type-sidebar";
import {
  CiTable,
  ciFieldOf,
  type CiFieldsByType,
  type CiLookups,
} from "@/components/cmdb/ci-table";
import { CiSplitTable } from "@/components/cmdb/ci-split-table";
import { CiPeek } from "@/components/cmdb/ci-peek";
import { CiPeekKeys, CiViewMode } from "@/components/cmdb/ci-view-mode";
import { CiBulkBar, CiSelectionProvider } from "@/components/cmdb/ci-selection";
import { CiColumnsPicker } from "@/components/cmdb/ci-columns-picker";
import { NewCiButton } from "@/components/cmdb/new-ci-button";
import { buttonClass, EmptyState } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Fifty, like the queue: enough to scan, few enough to load. */
const PER_PAGE = 50;

/**
 * The register.
 *
 * Which kind of thing you are looking at is the question people arrive with, so
 * it is a place you stand rather than a filter you set — and standing in a type
 * is also what decides which attributes the table offers first. Every attribute
 * of every type can be a column, here as much as in the view that spans them
 * all; a licence simply leaves the serial number's cell empty.
 *
 * Two shapes. Split is the register beside a pane, which is how a register is
 * actually read: forty laptops looked at one after another without forty page
 * loads. List is the full column set, which is how it is audited and exported.
 * The choice sticks, because it is a habit rather than a decision.
 */
export default async function CmdbPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!canViewCis(user)) notFound();

  const [params, jar] = await Promise.all([searchParams, cookies()]);
  const typeKey = one(params.type);
  const lifecycle = one(params.life);
  const team = one(params.team);
  const q = one(params.q);
  const view = one(params.view);
  const sort = one(params.sort) ?? "name";
  const dir = one(params.dir) === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(one(params.page) ?? "1", 10) || 1);

  const mode = readCiMode(jar.get(CI_MODE_COOKIE)?.value);
  const split = mode === "split";

  const t = await getMessages();
  const visible = ticketVisibilityFilter(user);
  /// A ticket still in play, for whoever is looking. The same definition the
  /// counts use, because "with open tickets" and "2 open" must agree.
  const open = { status: { is: { settles: false } }, ...visible };

  /// What "expiring" means, once, for the filter and for the sidebar's count.
  /// Desk-wide when nothing is being stood in, which is what the shipped view
  /// asks: a month's renewals are certificates *and* licences.
  const window = await expiryWindow(typeKey);
  const deskWindow = typeKey ? await expiryWindow() : window;

  const where = ciWhere({ typeKey, lifecycle, team, q, view, expiry: window, open });

  /// Whether anything was asked of the list. Standing in a type is where you
  /// are, not a filter you set, so it does not count; standing in a view is the
  /// same kind of standing.
  const filtered = Boolean(lifecycle || team || q);

  // The type being stood in, with what it says a register of it should show
  // to somebody who has never opened the column picker.
  const standing = typeKey
    ? await prisma.ciType.findUnique({
        where: { key: typeKey },
        select: { id: true, defaultColumns: true },
      })
    : null;

  /**
   * Every attribute every type records, in the order a register reads them.
   *
   * All of them rather than the standing type's, because a column is worth
   * offering in the view that spans every type too: a laptop's warranty and a
   * certificate's renewal are the same question asked of two kinds of thing,
   * and a register that shows neither until you have picked a side is a
   * register somebody keeps a spreadsheet beside.
   *
   * Which type a value belongs to still decides how it is read, so the rows
   * keep their `typeId`: the same key can be a date on one type and a line of
   * text on another, and a cell is simply empty where the type has no such
   * field at all.
   */
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

  const fieldsByType: CiFieldsByType = {};
  for (const field of allFields) (fieldsByType[field.typeId] ??= []).push(field);

  /// What the columns of *this* view mean: the standing type's own attributes,
  /// or one of each across the lot.
  const fields = standing ? (fieldsByType[standing.id] ?? []) : unionFields(allFields);

  /// What goes under the name in Split: the model, and the first thing the type
  /// records in words. Every type's, because the pane can be standing in the
  /// view that spans all of them.
  const subtitleFields = split ? allFields.filter((field) => field.kind === "TEXT") : [];

  /**
   * What the register may be ordered by, and how.
   *
   * Name, type and lifecycle are columns of the table and the database can
   * order them. An attribute cannot: it lives in a JSON blob, and Prisma has no
   * way to say "order by this key inside it" — so those sorts go through the
   * one hand-written query below. It is the only raw SQL in the feature, and it
   * is why the list of what may be sorted on is closed rather than whatever
   * happened to be in the URL.
   */
  const sortField = fields.find((field) => attrKeyOf(sort) === field.key);
  const byAttribute = sortField && (sortField.kind === "DATE" || sortField.kind === "NUMBER");
  const column = byAttribute ? sort : ["name", "type", "lifecycle"].includes(sort) ? sort : "name";

  const orderBy: Prisma.ConfigurationItemOrderByWithRelationInput =
    column === "type"
      ? { type: { name: dir } }
      : column === "lifecycle"
        ? { lifecycle: dir }
        : { name: dir };

  /**
   * The page's worth of ids, ordered by an attribute.
   *
   * The filters are written out a second time here, in SQL, and that is a real
   * cost — but the alternative is sorting a page in memory, which sorts fifty
   * rows out of five hundred and is simply wrong. Nulls go last in both
   * directions: a warranty date nobody filled in is not the earliest one.
   */
  async function idsByAttribute(key: string, numeric: boolean) {
    const conditions: Prisma.Sql[] = [];
    if (typeKey) conditions.push(Prisma.sql`t."key" = ${typeKey}`);
    if (lifecycle) conditions.push(Prisma.sql`i."lifecycle"::text = ${lifecycle}`);
    if (team === "none") conditions.push(Prisma.sql`i."teamId" IS NULL`);
    else if (team) conditions.push(Prisma.sql`i."teamId" = ${team}`);
    if (q) conditions.push(Prisma.sql`i."name" ILIKE ${`%${q}%`}`);

    // Guarded, because the blob is not the schema: a value written before the
    // field was a number would otherwise take the whole page down with a cast
    // error rather than sorting last.
    const value = numeric
      ? Prisma.sql`CASE WHEN i."attributes"->>${key} ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (i."attributes"->>${key})::numeric END`
      : Prisma.sql`i."attributes"->>${key}`;

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT i."id"
      FROM "ConfigurationItem" i
      JOIN "CiType" t ON t."id" = i."typeId"
      ${conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
      ORDER BY ${value} ${dir === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`} NULLS LAST,
               i."name" ASC
      LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}
    `;
    return rows.map((row) => row.id);
  }

  // A sort by attribute and a view are two ways of narrowing the same list and
  // the raw query only knows about one of them, so the ordinary path wins while
  // standing in a view — the list is short by definition and the name order is
  // the one that reads.
  const orderedIds =
    byAttribute && !view
      ? await idsByAttribute(attrKeyOf(sort)!, sortField.kind === "NUMBER")
      : null;

  const [items, total, types, teams, preference, lifecycles, builtIn] = await Promise.all([
    prisma.configurationItem.findMany({
      // Either the filtered page in the database's own order, or exactly the
      // ids the raw query picked out — in which case the order is restored
      // below, because an IN clause does not keep one.
      where: orderedIds ? { id: { in: orderedIds } } : where,
      ...(orderedIds ? {} : { orderBy, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
      select: {
        id: true,
        name: true,
        lifecycle: true,
        attributes: true,
        typeId: true,
        type: { select: { name: true, color: true, icon: true } },
        team: { select: { name: true, color: true } },
        // The payoff, one number wide: "what else is broken on this host"
        // answered before anybody opens it. Counted through the same visibility
        // filter the queue uses: a number that counts tickets the reader may not
        // open is a number that tells them something about them.
        _count: { select: { tickets: { where: { ticket: open } } } },
      },
    }),
    prisma.configurationItem.count({ where }),
    // Counted unfiltered: the sidebar says how much of each kind the desk has,
    // which is a different question from how many match the filters right now.
    prisma.ciType.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        icon: true,
        color: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { ciColumns: true, ciViews: true },
    }),
    // The shape of the estate, for the strip at the foot of the sidebar. By
    // the type being stood in and nothing else: it answers "how much of this
    // kind is still alive", not "how much of what the filters left".
    prisma.configurationItem.groupBy({
      by: ["lifecycle"],
      where: typeKey ? { type: { is: { key: typeKey } } } : {},
      _count: { lifecycle: true },
    }),
    Promise.all([
      prisma.configurationItem.count({
        where: ciWhere({ view: "expiring", expiry: deskWindow }),
      }),
      prisma.configurationItem.count({ where: ciWhere({ view: "open", open }) }),
      prisma.configurationItem.count({ where: { lifecycle: "RETIRED" } }),
    ]),
  ]);

  const viewKey = typeKey ?? ALL_TYPES;
  /// Where this table's column widths are kept. Per type, like the columns
  /// themselves: what a serial number is worth in width is a fact about
  /// laptops, and a register of licences has no opinion on it.
  const columnStore = `cmdb:${viewKey}`;
  const available = availableColumns(fields);
  const columns = readColumns(
    preference?.ciColumns ?? null,
    viewKey,
    available,
    standing?.defaultColumns ?? [],
  );

  // `IN` returns rows in whatever order the database found them, so the order
  // the raw query worked out is put back here rather than trusted to survive.
  const rows = orderedIds
    ? orderedIds.flatMap((id) => items.filter((item) => item.id === id))
    : items;

  // The two attribute kinds that store an id rather than something readable.
  // Gathered across the page and resolved in two queries, so a column of people
  // does not become fifty lookups.
  const lookups: CiLookups = { people: {}, items: {} };
  const wanted = { people: new Set<string>(), items: new Set<string>() };
  for (const column of columns) {
    if (!attrKeyOf(column)) continue;
    for (const item of rows) {
      // Per row rather than per column: across all the types the same column can
      // be a person on one kind of thing and a date on another.
      const field = ciFieldOf(fieldsByType, item.typeId, column);
      if (!field || (field.kind !== "USER" && field.kind !== "ITEM")) continue;
      const value = readAttribute(field, item.attributes);
      if (typeof value === "string" && value) {
        wanted[field.kind === "USER" ? "people" : "items"].add(value);
      }
    }
  }

  if (wanted.people.size > 0 || wanted.items.size > 0) {
    const [people, referenced] = await Promise.all([
      wanted.people.size > 0
        ? prisma.user.findMany({
            where: { id: { in: [...wanted.people] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      wanted.items.size > 0
        ? prisma.configurationItem.findMany({
            where: { id: { in: [...wanted.items] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    for (const person of people) lookups.people[person.id] = person.name;
    for (const item of referenced) lookups.items[item.id] = item.name;
  }

  // Everything the register was asked, minus which page of it is on screen:
  // an export is the whole answer, not the fifty rows somebody is looking at.
  const exportQuery = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => {
      const first = one(value);
      return first && key !== "page" && key !== "peek" ? [[key, first] as [string, string]] : [];
    }),
  ).toString();

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  /// The row the pane is showing. The first one when nothing has been picked:
  /// an empty pane beside a full list is a control nobody knows to press.
  const peek = one(params.peek) ?? rows[0]?.id ?? null;

  /// Where a row goes. The same URL with one key changed, so every filter,
  /// every sort and the page somebody is on survive being clicked.
  const rowHref = (id: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const first = one(value);
      if (first && key !== "peek") query.set(key, first);
    }
    query.set("peek", id);
    return `/cmdb?${query.toString()}`;
  };

  return (
    /* The register fills the desk rather than ending where its rows do. Three
       columns that are each as tall as the screen — the types, the list, the
       pane — is what lets the sidebar's lifecycle strip sit at the foot of the
       sidebar instead of halfway up a short page, and what keeps the pane still
       while forty rows are read past it. Only above `lg`: on a phone the three
       are stacked and the page scrolls as one. */
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <PageHeader title={t.cmdb.title} />

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <Suspense
          fallback={<div className="border-line bg-chrome shrink-0 lg:w-[240px] lg:border-r" />}
        >
          <CiTypeSidebar
            types={types.map((type) => ({
              key: type.key,
              name: type.name,
              icon: type.icon,
              color: type.color,
              count: type._count.items,
            }))}
            views={readViews(preference?.ciViews)}
            builtInCounts={{ expiring: builtIn[0], open: builtIn[1], retired: builtIn[2] }}
            lifecycles={lifecycles.map((row) => ({
              lifecycle: row.lifecycle,
              count: row._count.lifecycle,
            }))}
          />
        </Suspense>

        <div className="flex min-w-0 flex-1 lg:min-h-0">
          <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
            <Suspense
              fallback={<div className="border-border bg-surface h-[61px] shrink-0 border-b" />}
            >
              <CiFilterBar
                teams={teams.map((group) => ({ id: group.id, label: group.name }))}
                shown={t.cmdb.shown(from, to, total)}
                modeToggle={<CiViewMode mode={mode} />}
                columnsPicker={
                  <CiColumnsPicker
                    typeKey={viewKey}
                    chosen={columns}
                    available={available.map((id) => ({ id, label: labelFor(id, fields, t) }))}
                  />
                }
                exportButton={
                  <a
                    href={`/api/cmdb/export${exportQuery ? `?${exportQuery}` : ""}`}
                    title={t.cmdb.exportHint}
                    className={buttonClass("outline", "sm")}
                  >
                    <Download size={13} />
                    {t.cmdb.exportCsv}
                  </a>
                }
                addButton={
                  canEditCis(user) ? (
                    <NewCiButton types={types.map((type) => ({ id: type.id, name: type.name }))} />
                  ) : null
                }
              />
            </Suspense>

            {/* The rows are the only part that scrolls, sideways as well as
                down: a column set wider than the pane is a register to push
                along, not one with columns quietly left out of it. */}
            <div className="min-w-0 max-lg:overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-auto">
              {items.length === 0 ? (
                <div className="px-5 py-6 lg:px-6">
                  {/* Two different emptinesses with two different answers: a
                    register nobody has filled in yet wants a way to start, and a
                    filter matching nothing wants to be widened. One state for
                    both told half the people the wrong thing. */}
                  {filtered || view ? (
                    <EmptyState title={t.cmdb.filteredTitle} body={t.cmdb.filteredBody} />
                  ) : (
                    <EmptyState
                      title={t.cmdb.emptyTitle}
                      body={t.cmdb.emptyBody}
                      action={
                        canEditCis(user) ? (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <NewCiButton
                              types={types.map((type) => ({ id: type.id, name: type.name }))}
                            />
                            {canManageCis(user) ? (
                              <Link href="/settings/cmdb" className={buttonClass("outline", "sm")}>
                                {t.cmdb.importTitle}
                              </Link>
                            ) : null}
                          </div>
                        ) : undefined
                      }
                    />
                  )}
                </div>
              ) : (
                <CiSelectionProvider>
                  {/* Only for the people who could act on a selection. Everyone else
                    gets the same table with no tick column, because the
                    checkboxes draw nothing outside the provider. */}
                  {canEditCis(user) ? (
                    <CiBulkBar teams={teams.map((group) => ({ id: group.id, name: group.name }))} />
                  ) : null}

                  {split ? (
                    <CiSplitTable
                      items={rows.map((item) => ({
                        id: item.id,
                        name: item.name,
                        lifecycle: item.lifecycle,
                        attributes: item.attributes,
                        typeId: item.typeId,
                        type: item.type,
                        team: item.team,
                        openTickets: item._count.tickets,
                        subtitle: subtitleOf(item, subtitleFields),
                      }))}
                      storeKey={columnStore}
                      columns={columns}
                      fields={fields}
                      fieldsByType={fieldsByType}
                      lookups={lookups}
                      peek={peek}
                      rowHref={rowHref}
                    />
                  ) : (
                    <CiTable
                      items={rows.map((item) => ({
                        id: item.id,
                        name: item.name,
                        lifecycle: item.lifecycle,
                        attributes: item.attributes,
                        typeId: item.typeId,
                        type: item.type,
                        team: item.team,
                        openTickets: item._count.tickets,
                      }))}
                      storeKey={columnStore}
                      columns={columns}
                      fields={fields}
                      fieldsByType={fieldsByType}
                      lookups={lookups}
                      sort={sort}
                      dir={dir}
                      sortHref={(next) => {
                        const query = new URLSearchParams();
                        for (const [key, value] of Object.entries(params)) {
                          const first = one(value);
                          if (first && key !== "page" && key !== "sort" && key !== "dir") {
                            query.set(key, first);
                          }
                        }
                        query.set("sort", next);
                        // Pressing the column you are already sorted by turns it round;
                        // pressing a different one starts it the way people expect that
                        // column to read.
                        if (next === sort && dir === "asc") query.set("dir", "desc");
                        return `/cmdb?${query.toString()}`;
                      }}
                    />
                  )}
                </CiSelectionProvider>
              )}
            </div>

            {pages > 1 ? (
              <nav className="border-line flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3 lg:px-6">
                <Step
                  params={params}
                  page={page - 1}
                  disabled={page === 1}
                  label={t.tickets.prev}
                />
                <p className="text-text-3 tnum text-base">{`${page} / ${pages}`}</p>
                <Step
                  params={params}
                  page={page + 1}
                  disabled={page === pages}
                  label={t.tickets.next}
                />
              </nav>
            ) : null}
          </div>

          {split && peek ? (
            <>
              <CiPeekKeys ids={rows.map((item) => item.id)} current={peek} />
              <Suspense
                key={peek}
                fallback={
                  <div className="border-line bg-chrome hidden w-[400px] border-l xl:block" />
                }
              >
                <CiPeek id={peek} user={user} />
              </Suspense>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * What goes under the name in Split.
 *
 * The model where the type records one, because that is what somebody says next
 * after a name — and the first thing it records in words otherwise, which on a
 * laptop is the serial. Both where a type has both, because "ThinkPad T14 ·
 * PF3K9X" is how a row is told from the thirty-nine others like it.
 */
function subtitleOf(
  item: { typeId: string; attributes: unknown },
  fields: { typeId: string; key: string; label: string }[],
): string | null {
  const mine = fields.filter((field) => field.typeId === item.typeId);
  if (mine.length === 0) return null;

  const named = (candidate: { key: string; label: string }) =>
    /model/i.test(candidate.key) || /model/i.test(candidate.label);
  const model = mine.find(named);
  const first = mine.find((field) => field !== model);

  const spec = (field: { key: string; label: string }) => ({
    key: field.key,
    label: field.label,
    kind: "TEXT" as const,
    required: false,
    options: [],
    isExpiry: false,
  });

  const parts = [model, first]
    .filter((field) => field !== undefined)
    .map((field) => readAttribute(spec(field), item.attributes))
    .filter((value): value is string => typeof value === "string" && value !== "");

  return parts.length ? parts.join(" · ") : null;
}

/** What a column is called in the picker: the attribute's own label where it has
 *  one, and the shared word where it does not. */
function labelFor(
  id: string,
  fields: FieldSpec[],
  t: Awaited<ReturnType<typeof getMessages>>,
): string {
  const key = attrKeyOf(id);
  if (key) return fields.find((field) => field.key === key)?.label ?? key;
  if (id === "type") return t.cmdb.type;
  if (id === "lifecycle") return t.cmdb.lifecycle;
  if (id === "team") return t.cmdb.team;
  return t.cmdb.openHeading;
}

/** One step through the register, or a dead end at either edge. */
function Step({
  params,
  page,
  disabled,
  label,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="border-border text-text-3 rounded-control h-9 border px-3 text-base leading-9 opacity-50">
        {label}
      </span>
    );
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = one(value);
    if (first && key !== "page" && key !== "peek") query.set(key, first);
  }
  if (page > 1) query.set("page", String(page));
  const search = query.toString();

  return (
    <Link
      href={search ? `/cmdb?${search}` : "/cmdb"}
      className="border-border hover:border-line-strong rounded-control h-9 border px-3 text-base leading-9 transition-colors"
    >
      {label}
    </Link>
  );
}
