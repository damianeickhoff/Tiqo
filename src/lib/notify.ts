import "server-only";

import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/live";
import { mailNotification } from "@/lib/mail";
import type { NotificationKind } from "@/generated/prisma/enums";

/**
 * Writing a notification is one line at every call site, and the two rules that
 * make notifications bearable live here rather than at each of them:
 *
 *   · nobody is told about their own doing, and
 *   · nobody is told about a ticket with no one on it.
 *
 * Both are silent no-ops, so a caller never has to ask before telling.
 */
export async function notify({
  userId,
  actorId,
  ticketId,
  projectId,
  docId,
  kind,
}: {
  userId: string | null | undefined;
  /// Null where nothing did it: the stale sweep is the desk noticing, not
  /// somebody acting, and a notice signed by a person who did nothing is a
  /// notice somebody answers to the wrong person.
  actorId: string | null;
  /// One of the two. A mention written in a project's conversation has no
  /// ticket behind it, and pointing at one would send people somewhere they
  /// have never been.
  ticketId?: string | null;
  projectId?: string | null;
  /// The third thing a notice can point at. A page has no ticket and no project
  /// behind it, and a space is not a project.
  docId?: string | null;
  kind: NotificationKind;
}) {
  if (!userId || (actorId && userId === actorId)) return;
  if (!ticketId && !projectId && !docId) return;

  await prisma.notification.create({
    data: {
      userId,
      actorId,
      ticketId: ticketId ?? null,
      projectId: projectId ?? null,
      docId: docId ?? null,
      kind,
    },
  });

  // And straight out to whatever they have open. The row is written first, so
  // the bell asking on the back of this always finds it.
  await publish(prisma, userId, "notification");

  // And into their inbox, if the desk has a mail server. Here rather than at
  // each call site so the two rules above govern the mail as well, and a call
  // site added later cannot forget it. Only for tickets: a mention in a
  // project's conversation has no reference to sign a mail with.
  if (ticketId && actorId) {
    try {
      await mailNotification({ userId, actorId, ticketId, kind });
    } catch {
      // The notice is written and the bell has rung. A mail server that is
      // refusing connections must not take the action down with it.
    }
  }
}
