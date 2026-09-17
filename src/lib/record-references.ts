import "server-only";

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { docHref } from "@/lib/docs";
import { referencesIn, type Reference } from "@/lib/references";

/** Where a piece of writing lives, and what it is called there. */
type Origin = { kind: "ticket" | "project" | "doc"; id: string; label: string; href: string };

/**
 * What a thing is called in a sentence about it.
 *
 * A ticket's reference *is* its name — "INC-2609 0011" is how people say it out
 * loud, so the text that was written stands. A project's key is not: "INF" is a
 * filing code, and the trail is prose, so it is named. A document is already
 * named by its title, and the title may have changed since somebody wrote the
 * link, so the row is preferred there too. The chip in the body of a comment
 * still reads "#INF", because that is what was typed there. An asset goes with
 * the row for the same reason a document does: a laptop gets renamed.
 */
function labelFor(reference: Reference, target?: { label: string }) {
  return reference.kind !== "ticket" && target ? target.label : reference.label;
}

/**
 * What a piece of writing pointed at, written into the trail — at both ends.
 *
 * A reference is a fact about two things, so it is recorded on two histories:
 *
 *   · on the item it was written in — "Ada referred CHG-2609 0002", so the
 *     connection is not buried in a paragraph;
 *   · on the item it points at — "Ada referred this in INC-2609 0011", which is
 *     the half that matters when you are reading the *other* ticket and want to
 *     know who else is depending on it.
 *
 * A mention of a person has only one end: the notification is the record. So
 * does a document as the origin — a document keeps its history as revisions
 * rather than as a trail, and what it points at is right there in the body.
 *
 * Failure is swallowed. A reference that did not get written down is a footnote
 * missing from a history; a comment that failed to save because of one is a
 * person losing what they wrote.
 */
export async function recordReferences({
  body,
  actorId,
  ticketId,
  projectId,
  docId,
}: {
  body: string;
  actorId: string;
  ticketId?: string;
  projectId?: string;
  docId?: string;
}) {
  const references = referencesIn(body);
  // A page that used to name three tickets and now names none still has three
  // rows to take away, so a document goes on even with nothing to record. A
  // comment with no references has nothing to reconcile and stops here rather
  // than paying for two queries to find that out.
  if (references.length === 0 && !docId) return;

  try {
    const origin = await describeOrigin(ticketId, projectId, docId);
    const targets = await resolveTargets(references);

    const outgoing = references.filter(
      // Something that no longer exists still reads fine in the sentence, but
      // there is nothing to point the other half of the pair at.
      (reference) => reference.kind === "user" || targets.has(key(reference)),
    );

    // Only the two that keep a trail. A document's outgoing half is the chip in
    // its own body, which is a better record than a row saying it is there.
    if (origin && origin.kind !== "doc") {
      await prisma.activity.createMany({
        data: outgoing.map((reference) => ({
          [origin.kind === "ticket" ? "ticketId" : "projectId"]: origin.id,
          actorId,
          type: "REFERENCED" as const,
          field: reference.kind,
          newValue: labelFor(reference, targets.get(key(reference))),
          link: reference.href,
        })),
      });
    }

    // What this piece of writing points at now, one entry per thing however
    // many times it was named: the far end's history answers "who is depending
    // on this", and eight rows saying the same document is still one document.
    const wanted = new Map<string, keyof typeof COLUMN>();

    for (const reference of references) {
      if (reference.kind === "user") {
        await notify({ userId: reference.id, actorId, ticketId, projectId, kind: "MENTIONED" });
        continue;
      }

      const target = targets.get(key(reference));
      // Naming the thing you are standing in is not a connection between two
      // things, and would read as "referred this in itself".
      if (!target || !origin || target.id === origin.id) continue;

      wanted.set(target.id, reference.kind);
    }

    if (!origin) return;

    /**
     * A page is saved over and over; a comment is written once.
     *
     * So a document reconciles: the rows it left last time are compared with
     * what it says now, new ones are added, dropped ones are taken away, and
     * an unchanged one is left exactly where it is. Everything else appends,
     * because each call is a new comment — and a second comment naming a
     * second ticket must not delete the row the first one left.
     */
    const standing =
      origin.kind === "doc"
        ? await prisma.activity.findMany({
            // `newValue: null` is what tells an incoming row from an outgoing
            // one: a ticket that mentioned this page keeps a row with the same
            // field and the same link, and that row is the ticket's, not ours.
            where: {
              type: "REFERENCED",
              field: origin.kind,
              link: origin.href,
              newValue: null,
            },
            select: { id: true, ticketId: true, projectId: true, docId: true },
          })
        : [];

    const already = new Set<string>();
    const stale: string[] = [];
    for (const row of standing) {
      const target = row.ticketId ?? row.projectId ?? row.docId;
      // The outgoing half a ticket keeps about itself carries the same link;
      // it is not an incoming row and is not this function's to reconcile.
      if (!target || target === origin.id) continue;
      if (wanted.has(target) && !already.has(target)) already.add(target);
      else stale.push(row.id);
    }

    if (stale.length) await prisma.activity.deleteMany({ where: { id: { in: stale } } });

    for (const [targetId, kind] of wanted) {
      if (already.has(targetId)) continue;

      await prisma.activity.create({
        data: {
          [COLUMN[kind]]: targetId,
          actorId,
          type: "REFERENCED",
          field: origin.kind,
          // The incoming half is told apart from the outgoing one by which side
          // of the change is filled in: where it came *from*, not what it went to.
          oldValue: origin.label,
          link: origin.href,
        },
      });
    }
  } catch {
    // Nothing here is worth taking someone's writing down for.
  }
}

/** Which column on the trail row holds a target of this kind. */
const COLUMN = {
  ticket: "ticketId",
  project: "projectId",
  doc: "docId",
  asset: "itemId",
} as const;

const key = (reference: Reference) => `${reference.kind}:${reference.id}`;

/** What the thing being written in is called, so the other end can name it. */
async function describeOrigin(
  ticketId?: string,
  projectId?: string,
  docId?: string,
): Promise<Origin | null> {
  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, reference: true },
    });
    return ticket
      ? {
          kind: "ticket",
          id: ticket.id,
          label: ticket.reference,
          href: `/tickets/${ticket.number}`,
        }
      : null;
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, key: true, name: true },
    });
    return project
      ? {
          kind: "project",
          id: project.id,
          label: project.name,
          href: `/projects/${project.key}`,
        }
      : null;
  }

  if (docId) {
    const doc = await prisma.doc.findUnique({
      where: { id: docId },
      select: { id: true, slug: true, title: true, space: { select: { key: true } } },
    });
    return doc
      ? {
          kind: "doc",
          id: doc.id,
          label: doc.title,
          href: docHref(doc.space.key, doc.slug),
        }
      : null;
  }

  return null;
}

/**
 * The rows behind the references, by kind. A reference carries the number, key
 * or address someone can see, and the trail needs the row it belongs to.
 */
async function resolveTargets(references: Reference[]) {
  const numbers = references
    .filter((reference) => reference.kind === "ticket")
    .map((reference) => Number(reference.id))
    .filter(Number.isInteger);
  const keys = references
    .filter((reference) => reference.kind === "project")
    .map((reference) => reference.id);
  // "OPS/vpn-box" — the shelf and the page, which is what makes a slug unique.
  const addresses = references
    .filter((reference) => reference.kind === "doc")
    .map((reference) => reference.id.split("/"))
    .filter((parts): parts is [string, string] => parts.length === 2);
  const assetIds = references
    .filter((reference) => reference.kind === "asset")
    .map((reference) => reference.id);

  const [tickets, projects, docs, assets] = await Promise.all([
    numbers.length
      ? prisma.ticket.findMany({
          where: { number: { in: numbers } },
          select: { id: true, number: true, reference: true },
        })
      : Promise.resolve([]),
    keys.length
      ? prisma.project.findMany({
          where: { key: { in: keys } },
          select: { id: true, key: true, name: true },
        })
      : Promise.resolve([]),
    addresses.length
      ? prisma.doc.findMany({
          where: {
            OR: addresses.map(([spaceKey, slug]) => ({ slug, space: { is: { key: spaceKey } } })),
          },
          select: { id: true, slug: true, title: true, space: { select: { key: true } } },
        })
      : Promise.resolve([]),
    assetIds.length
      ? prisma.configurationItem.findMany({
          where: { id: { in: assetIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // The label travels with the row, so the sentence can name the thing the way
  // a person would rather than the way it was typed.
  const found = new Map<string, { id: string; label: string }>();
  for (const ticket of tickets) {
    found.set(`ticket:${ticket.number}`, { id: ticket.id, label: ticket.reference });
  }
  for (const project of projects) {
    found.set(`project:${project.key}`, { id: project.id, label: project.name });
  }
  for (const doc of docs) {
    found.set(`doc:${doc.space.key}/${doc.slug}`, { id: doc.id, label: doc.title });
  }
  for (const asset of assets) {
    found.set(`asset:${asset.id}`, { id: asset.id, label: asset.name });
  }
  return found;
}
