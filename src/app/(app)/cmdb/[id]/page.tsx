import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditCis, canViewCis, ticketVisibilityFilter } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { lifespanOf, readAttribute, type FieldSpec } from "@/lib/cmdb";
import { labelsFor } from "@/lib/ci-labels";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LifecyclePill } from "@/components/cmdb/ci-lifecycle";
import { CiEditor } from "@/components/cmdb/ci-editor";
import { CiRow, CiValue, type CiNames } from "@/components/cmdb/ci-details";
import { CiRelations, type CiRelationRow } from "@/components/cmdb/ci-relations";
import { CiTickets } from "@/components/cmdb/ci-tickets";
import { CiLabelCard, CiLifecycleCard, CiNearby } from "@/components/cmdb/ci-rail";
import { CiDelete } from "@/components/cmdb/ci-delete";
import { ActivityFeed } from "@/components/tickets/activity";
import { buttonClass, Card } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const item = await prisma.configurationItem.findUnique({
    where: { id: (await params).id },
    select: { name: true },
  });
  return { title: item?.name ?? (await getMessages()).cmdb.title };
}

/** Enough of the far item for a relation row to be worth reading. */
const FAR_END = {
  id: true,
  name: true,
  lifecycle: true,
  type: { select: { name: true, color: true, icon: true } },
} as const;

/// The last five, and a way to the rest. A history is read for what happened
/// recently; the whole of it is a different question and has its own screen.
const RECENT_HISTORY = 5;

/**
 * One asset: what it is, what it is connected to, and what has been raised
 * against it.
 *
 * It reads first and edits second. Almost everybody arriving here is answering a
 * question — which server is this, whose laptop, when does the certificate run
 * out — and a page that opens as a form makes all of them read a form to find
 * out. Edit is one press away and swaps the grid for the fields in place.
 *
 * The tickets are the point of the whole register. A list of serial numbers is a
 * spreadsheet; a serial number with three open incidents against it is the
 * answer to a question somebody is asking right now.
 */
export default async function CiPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (!canViewCis(user)) notFound();

  const [{ id }, query] = await Promise.all([params, searchParams]);

  const item = await prisma.configurationItem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      attributes: true,
      lifecycle: true,
      teamId: true,
      externalSource: true,
      externalId: true,
      team: { select: { name: true } },
      type: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
          fields: {
            orderBy: { position: "asc" },
            select: {
              key: true,
              label: true,
              kind: true,
              required: true,
              options: true,
              isExpiry: true,
            },
          },
        },
      },
    },
  });
  if (!item) notFound();

  const visible = ticketVisibilityFilter(user);
  const open = { status: { is: { settles: false } }, ...visible } as const;

  const [settings, t, people, teams, relations, tickets, history, historyCount] = await Promise.all(
    [
      getSettings(),
      getMessages(),
      // Only when the type records one. A directory of four hundred accounts
      // loaded to fill a dropdown that this kind of asset does not have is a
      // query paid for on every certificate and every licence in the register.
      item.type.fields.some((field) => field.kind === "USER")
        ? prisma.user.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
      // Both directions in one query, for the same reason ticket links are: the
      // row is stored once, from the item it was made on.
      prisma.ciRelation.findMany({
        where: { OR: [{ sourceId: id }, { targetId: id }] },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          sourceId: true,
          source: { select: FAR_END },
          target: { select: FAR_END },
        },
      }),
      // Open first, because "what is broken on this now" is the question; settled
      // ones are history and can wait below them.
      prisma.ticketCi.findMany({
        // Through the ticket's own visibility rule. `ci.view` says somebody may
        // read the register; it does not say they may read the title of every
        // ticket ever raised against a server.
        where: { itemId: id, ticket: visible },
        orderBy: { ticket: { createdAt: "desc" } },
        // A ceiling, because a server the desk has had for three years has
        // hundreds and the card is a rail card. The newest two hundred are the
        // history anybody reads; beyond that it is an archive, not a card.
        take: 200,
        select: {
          ticket: {
            select: {
              number: true,
              reference: true,
              title: true,
              priority: true,
              createdAt: true,
              status: { select: { name: true, color: true, settles: true } },
            },
          },
        },
      }),
      // What has been done to this asset, newest first. The same append-only trail
      // a ticket keeps: a register nobody can ask "when did this become retired,
      // and who said so" of is one people stop believing.
      prisma.activity.findMany({
        where: { itemId: id },
        orderBy: { createdAt: "desc" },
        take: RECENT_HISTORY,
        select: {
          id: true,
          type: true,
          field: true,
          oldValue: true,
          newValue: true,
          link: true,
          createdAt: true,
          actor: { select: { id: true, name: true, avatarVariant: true } },
        },
      }),
      prisma.activity.count({ where: { itemId: id } }),
    ],
  );

  const fields = item.type.fields as FieldSpec[];

  // What the ids in this item's USER and ITEM attributes are called. Resolved
  // here so the grid and the editor can show a name where a cuid is stored, and
  // in two queries whatever the type records.
  const names: CiNames = { people: {}, items: {} };
  const wanted = { people: new Set<string>(), items: new Set<string>() };
  for (const field of fields) {
    if (field.kind !== "USER" && field.kind !== "ITEM") continue;
    const value = readAttribute(field, item.attributes);
    if (typeof value === "string" && value) {
      wanted[field.kind === "USER" ? "people" : "items"].add(value);
    }
  }
  if (wanted.people.size || wanted.items.size) {
    const [accounts, referenced] = await Promise.all([
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
    for (const person of accounts) names.people[person.id] = person.name;
    for (const row of referenced) names.items[row.id] = row.name;
  }

  const canEdit = canEditCis(user);
  const dateLocale = dateLocaleOf(settings);
  const dateFormat = new Intl.DateTimeFormat(dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const rows: CiRelationRow[] = relations.map((relation) => {
    const incoming = relation.sourceId !== id;
    return {
      id: relation.id,
      kind: relation.kind,
      incoming,
      item: incoming ? relation.source : relation.target,
    };
  });

  const ordered = [...tickets].sort((a, b) => {
    const settledA = a.ticket.status?.settles ?? false;
    const settledB = b.ticket.status?.settles ?? false;
    return settledA === settledB ? 0 : settledA ? 1 : -1;
  });

  // One hop out: something this asset depends on has a ticket of its own. One
  // level only — a full transitive closure on every render is a query nobody
  // should pay for, and two levels of indirection is where the guesses start.
  const dependsOn = rows
    .filter((relation) => relation.kind === "DEPENDS_ON" && !relation.incoming)
    .map((relation) => relation.item);

  const nearby = dependsOn.length
    ? await prisma.ticketCi.findFirst({
        where: { itemId: { in: dependsOn.map((far) => far.id) }, ticket: open },
        orderBy: { ticket: { createdAt: "desc" } },
        select: {
          itemId: true,
          ticket: { select: { number: true, reference: true, title: true } },
        },
      })
    : null;

  const span = lifespanOf(fields, item.attributes);

  // The same code the printed label carries, built the same way — a glance at
  // what is about to come out of the printer is only worth having if it is the
  // same thing.
  const [label] = await labelsFor([item.id]);

  /// What this asset says about itself, as a grid. Two columns because the
  /// labels are short and the values are shorter, and a single column of eight
  /// rows is a page of whitespace with facts down one edge.
  const readView = (
    <div className="px-3.5 py-2.5">
      {fields.length === 0 ? (
        <p className="text-text-3 text-base">{t.cmdb.noAttributes}</p>
      ) : (
        <div className="grid gap-x-8 sm:grid-cols-2">
          {fields.map((field) => (
            <CiRow key={field.key} label={field.label} className="break-inside-avoid">
              <CiValue
                field={field}
                attributes={item.attributes}
                names={names}
                dateFormat={dateFormat}
                unset={t.cmdb.unset}
                yes={t.common.yes}
                no={t.common.no}
              />
            </CiRow>
          ))}
        </div>
      )}

      {item.externalSource ? (
        <p className="text-text-3 border-line mt-3 border-t pt-2.5 font-mono text-xs">
          {item.externalSource}
          {item.externalId ? ` · ${item.externalId}` : null}
        </p>
      ) : null}
    </div>
  );

  const subtitle = [
    item.type.name,
    ...fields
      .filter((field) => field.kind === "TEXT")
      .slice(0, 2)
      .map((field) => readAttribute(field, item.attributes))
      .filter((value): value is string => typeof value === "string" && value !== ""),
    item.team?.name,
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={item.name} />

      {/* The band under the bar, not the bar itself: the header takes a plain
          title everywhere else in the app, and one page with a differently
          shaped one reads as a different product. */}
      <div className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-3.5 lg:px-6">
        <Link
          href="/cmdb"
          aria-label={t.cmdb.title}
          title={t.cmdb.title}
          className="text-text-3 hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
        </Link>
        <CiGlyph icon={item.type.icon} color={item.type.color} size={24} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{item.name}</h1>
          <p className="text-text-2 truncate text-base">{subtitle.join(" · ")}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LifecyclePill lifecycle={item.lifecycle} label={t.cmdb.life[item.lifecycle]} />
          <Link href={`/cmdb/${item.id}/label`} className={buttonClass("outline", "sm")}>
            <QrCode size={13} />
            {t.cmdb.printLabel}
          </Link>
          {canEdit ? <CiDelete itemId={item.id} name={item.name} /> : null}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
        <div className="space-y-4">
          <CiEditor
            item={{
              id: item.id,
              name: item.name,
              typeId: item.type.id,
              lifecycle: item.lifecycle,
              teamId: item.teamId,
              attributes: item.attributes,
            }}
            fields={fields}
            people={people}
            teams={teams}
            itemNames={names.items}
            canEdit={canEdit}
            readView={readView}
            startEditing={query.edit === "1"}
          />

          <CiTickets
            itemId={item.id}
            all={query.tickets === "all"}
            canRaise={canEdit}
            tickets={ordered.map((row) => ({
              ...row.ticket,
              when: dateFormat.format(row.ticket.createdAt),
            }))}
          />

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="label">{t.cmdb.history}</h2>
              {historyCount > RECENT_HISTORY ? (
                <Link
                  href={`/cmdb/${item.id}/history`}
                  className="text-brand-deep text-sm font-medium hover:underline"
                >
                  {t.cmdb.allHistory(historyCount)}
                </Link>
              ) : null}
            </div>
            {/* Never removable from here. `activity.delete` exists for a ticket's
                conversation, where a comment somebody regrets is a real problem;
                an asset's history is the thing being kept. */}
            <ActivityFeed
              events={history}
              canRemove={false}
              locale={settings.locale}
              dateLocale={dateLocale}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <CiRelations itemId={item.id} relations={rows} canEdit={canEdit} />

          {nearby ? (
            <CiNearby
              reference={nearby.ticket.reference}
              title={nearby.ticket.title}
              number={nearby.ticket.number}
              asset={dependsOn.find((far) => far.id === nearby.itemId)?.name ?? ""}
            />
          ) : null}

          {span ? (
            <CiLifecycleCard
              span={span}
              dateFormat={dateFormat}
              itemId={item.id}
              canEdit={canEdit}
              retired={item.lifecycle === "RETIRED"}
            />
          ) : null}

          <CiLabelCard itemId={item.id} path={label?.path ?? null} size={label?.size ?? 0} />
        </div>
      </div>
    </>
  );
}
