import Link from "next/link";
import { Maximize2, Pencil, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { ticketVisibilityFilter } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { daysUntil, lifespanOf, readAttribute, type FieldSpec } from "@/lib/cmdb";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LifecyclePill } from "@/components/cmdb/ci-lifecycle";
import { CiNames, CiRow, CiValue, WarrantyBar } from "@/components/cmdb/ci-details";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { Reference } from "@/components/tickets/ticket-row";
import { buttonClass, EmptyState } from "@/components/ui";

/**
 * The selected asset, beside the register rather than instead of it.
 *
 * Browsing forty laptops should not be forty page loads: the pane answers the
 * question people actually have of a row — what is it, what is it connected to,
 * what is open against it — and Open is there for the half of the time the
 * answer is "I need the whole page".
 *
 * It asks its own questions rather than being handed them, so the register's
 * own query does not grow a join for the one row somebody is looking at.
 */
export async function CiPeek({ id, user }: { id: string; user: SessionUser }) {
  const [t, settings] = await Promise.all([getMessages(), getSettings()]);

  const item = await prisma.configurationItem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      lifecycle: true,
      attributes: true,
      team: { select: { name: true } },
      type: {
        select: {
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

  if (!item) {
    return (
      <Pane>
        <EmptyState title={t.cmdb.peekGoneTitle} body={t.cmdb.peekGoneBody} />
      </Pane>
    );
  }

  const visible = ticketVisibilityFilter(user);
  const open = { status: { is: { settles: false } }, ...visible } as const;

  const [relations, tickets, openCount, totalCount] = await Promise.all([
    prisma.ciRelation.findMany({
      where: { OR: [{ sourceId: id }, { targetId: id }] },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        kind: true,
        sourceId: true,
        source: { select: { id: true, name: true, type: { select: { color: true, icon: true } } } },
        target: { select: { id: true, name: true, type: { select: { color: true, icon: true } } } },
      },
    }),
    prisma.ticketCi.findMany({
      where: { itemId: id, ticket: open },
      orderBy: { ticket: { createdAt: "desc" } },
      take: 4,
      select: {
        ticket: {
          select: {
            number: true,
            reference: true,
            title: true,
            priority: true,
            status: { select: { name: true, color: true, settles: true } },
          },
        },
      },
    }),
    prisma.ticketCi.count({ where: { itemId: id, ticket: open } }),
    prisma.ticketCi.count({ where: { itemId: id, ticket: visible } }),
  ]);

  // The one hop out, from the asset's side: something this depends on has a
  // ticket of its own. One level only, for the reason `ticket-assets.ts` gives.
  const dependsOn = relations
    .filter((relation) => relation.kind === "DEPENDS_ON" && relation.sourceId === id)
    .map((relation) => relation.target);

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

  const fields = item.type.fields as FieldSpec[];
  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const names = await resolveNames(fields, item.attributes);
  const span = lifespanOf(fields, item.attributes);
  const expiryKeys = new Set(fields.filter((field) => field.isExpiry).map((field) => field.key));

  return (
    <Pane>
      <div className="card overflow-hidden">
        <div className="flex items-start gap-3 p-3.5">
          <CiGlyph icon={item.type.icon} color={item.type.color} size={22} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-md truncate font-semibold">{item.name}</p>
            <p className="text-text-2 truncate text-sm">
              {item.team ? `${item.type.name} · ${item.team.name}` : item.type.name}
            </p>
          </div>
          <LifecyclePill lifecycle={item.lifecycle} label={t.cmdb.life[item.lifecycle]} />
        </div>

        <div className="flex gap-1.5 px-3.5 pb-3.5">
          <Link href={`/cmdb/${item.id}`} className={`${buttonClass("primary", "sm")} flex-1`}>
            <Maximize2 size={13} />
            {t.cmdb.openAsset}
          </Link>
          <Link
            href={`/cmdb/${item.id}?edit=1`}
            className={`${buttonClass("outline", "sm")} flex-1`}
          >
            <Pencil size={13} />
            {t.common.edit}
          </Link>
        </div>

        <div className="px-3.5 py-2.5">
          {fields.length === 0 ? (
            <p className="text-text-3 text-base">{t.cmdb.noAttributes}</p>
          ) : (
            fields
              .filter((field) => !(span && expiryKeys.has(field.key)))
              .map((field) => (
                <CiRow key={field.key} label={field.label}>
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
              ))
          )}

          {span ? (
            <div className="border-line mt-2 border-t pt-3">
              <WarrantyBar
                span={span}
                dateFormat={dateFormat}
                remaining={t.cmdb.until(daysUntil(span.to.value))}
              />
            </div>
          ) : null}
        </div>
      </div>

      <Section title={t.cmdb.related}>
        {relations.length === 0 ? (
          <p className="text-text-3 text-base">{t.cmdb.noRelations}</p>
        ) : (
          <ul className="space-y-1.5">
            {relations.map((relation) => {
              const incoming = relation.sourceId !== id;
              const far = incoming ? relation.source : relation.target;
              return (
                <li key={relation.id} className="flex items-center gap-2">
                  <CiGlyph icon={far.type.icon} color={far.type.color} size={11} />
                  <span className="min-w-0 leading-tight">
                    <span className="text-text-3 block text-xs">
                      {incoming ? t.cmdb.inverse[relation.kind] : t.cmdb.verb[relation.kind]}
                    </span>
                    <Link
                      href={`/cmdb/${far.id}`}
                      className="hover:text-brand-deep block truncate text-sm font-medium"
                    >
                      {far.name}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t.cmdb.openHeading} hint={t.cmdb.openOfAll(openCount, totalCount)}>
        {tickets.length === 0 ? (
          <p className="text-text-3 text-base">{t.cmdb.noOpenTickets}</p>
        ) : (
          <ul className="space-y-1.5">
            {tickets.map((row) => (
              <li key={row.ticket.number}>
                <Link
                  href={`/tickets/${row.ticket.number}`}
                  className="hover:bg-surface-2 rounded-control -mx-1.5 flex items-center gap-2 px-1.5 py-1 transition-colors"
                >
                  <StatusRing
                    status={row.ticket.status ? { ...row.ticket.status, id: "" } : null}
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <Reference reference={row.ticket.reference} />
                    <span className="block truncate text-sm font-medium">{row.ticket.title}</span>
                  </span>
                  <PriorityBars priority={row.ticket.priority} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* The reason the pane is worth having: the fault is on the box next
            door, and nothing on this row would ever have said so. */}
        {nearby ? (
          <p className="callout-brand mt-2.5 flex items-start gap-2 px-2.5 py-2 text-sm">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            <span>
              {t.cmdb.nearbyLine(
                nearby.ticket.reference,
                dependsOn.find((far) => far.id === nearby.itemId)?.name ?? "",
              )}
            </span>
          </p>
        ) : null}
      </Section>
    </Pane>
  );
}

/** The pane itself: a rail on the right at desk widths, and nothing at all
 *  below them — a 400px pane on a phone is the page. */
function Pane({ children }: { children: React.ReactNode }) {
  return (
    <aside className="hidden w-[340px] shrink-0 space-y-3 overflow-y-auto xl:block">
      {children}
    </aside>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2">
        <h3 className="label">{title}</h3>
        {hint ? <span className="text-text-3 tnum font-mono text-xs">{hint}</span> : null}
      </div>
      <div className="px-3.5 py-2.5">{children}</div>
    </section>
  );
}

/** The two attribute kinds that store an id rather than something readable. */
async function resolveNames(fields: FieldSpec[], attributes: unknown): Promise<CiNames> {
  const people = new Set<string>();
  const items = new Set<string>();
  for (const field of fields) {
    if (field.kind !== "USER" && field.kind !== "ITEM") continue;
    const value = readAttribute(field, attributes);
    if (typeof value === "string" && value) (field.kind === "USER" ? people : items).add(value);
  }

  const names: CiNames = { people: {}, items: {} };
  if (people.size === 0 && items.size === 0) return names;

  const [accounts, referenced] = await Promise.all([
    people.size
      ? prisma.user.findMany({
          where: { id: { in: [...people] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    items.size
      ? prisma.configurationItem.findMany({
          where: { id: { in: [...items] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  for (const person of accounts) names.people[person.id] = person.name;
  for (const row of referenced) names.items[row.id] = row.name;
  return names;
}
