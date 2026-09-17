import "server-only";

import { prisma } from "@/lib/prisma";
import { looseReferencesIn, replaceRange } from "@/lib/references";

/**
 * Turns what someone wrote into what the app can follow.
 *
 * Most references are picked from the list under the caret and arrive already
 * linked. The rest are pasted — a ticket number copied out of an email, a
 * number typed from memory — and those are just as much a reference as the
 * ones that went through the picker. This resolves them on the way in, once,
 * so everything downstream sees one shape.
 *
 * Only things that exist are linked. An unknown number stays exactly as typed
 * rather than becoming a link to nowhere.
 */
export async function linkBareReferences(body: string): Promise<string> {
  const loose = looseReferencesIn(body);
  if (loose.length === 0) return body;

  const wanted = (kind: string) => [
    ...new Set(loose.filter((one) => one.kind === kind).map((one) => one.needle)),
  ];

  const [tickets, projects, people] = await Promise.all([
    findAll(wanted("ticket"), (references) =>
      prisma.ticket.findMany({
        where: { reference: { in: references } },
        select: { reference: true, number: true },
      }),
    ),
    findAll(wanted("project"), (keys) =>
      prisma.project.findMany({
        where: { key: { in: keys }, isArchived: false },
        select: { key: true },
      }),
    ),
    findAll(wanted("user"), (names) =>
      prisma.user.findMany({
        where: { username: { in: names }, isActive: true },
        select: { id: true, username: true },
      }),
    ),
  ]);

  const href = new Map<string, string>();
  for (const ticket of tickets) href.set(`ticket:${ticket.reference}`, `/tickets/${ticket.number}`);
  for (const project of projects) href.set(`project:${project.key}`, `/projects/${project.key}`);
  for (const person of people) href.set(`user:${person.username}`, `/people/${person.id}`);

  // Back to front, so each replacement leaves the offsets before it untouched.
  let next = body;
  for (const one of [...loose].reverse()) {
    const to = href.get(`${one.kind}:${one.needle}`);
    if (!to) continue;
    const sigil = one.kind === "user" ? "@" : "#";
    next = replaceRange(next, one.from, one.to, `[${sigil}${one.needle}](${to})`);
  }

  return next;
}

/** Skips the query entirely when there is nothing of that kind to look up. */
function findAll<T>(needles: string[], load: (needles: string[]) => Promise<T[]>): Promise<T[]> {
  return needles.length ? load(needles) : Promise.resolve([]);
}
