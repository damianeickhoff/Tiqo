import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { MailLog } from "@/components/settings/mail-log";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.mail.logTitle };
}

/**
 * What the mailbox has actually done.
 *
 * Without it the outbox is a table nothing reads: a message that failed five
 * times is dead for ever and looks, from every other screen in the app, exactly
 * like a message nobody ever tried to send.
 */
export default async function MailLogPage() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [rows, sent, received, raised, failed] = await Promise.all([
    // Fifty, newest first. Enough to find the message somebody is asking about
    // and few enough that the page is still a settings page rather than a
    // second inbox.
    prisma.mailMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        direction: true,
        status: true,
        to: true,
        subject: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        ticket: { select: { number: true, reference: true } },
      },
    }),
    prisma.mailMessage.count({
      where: { direction: "OUT", status: "SENT", sentAt: { gte: midnight } },
    }),
    prisma.mailMessage.count({ where: { direction: "IN", createdAt: { gte: midnight } } }),
    // A mail that raised a ticket is one whose inbound row carries the ticket
    // it created — the same pair the inbox writes when it files a new one.
    prisma.mailMessage.count({
      where: { direction: "IN", createdAt: { gte: midnight }, ticketId: { not: null } },
    }),
    prisma.mailMessage.count({
      where: { direction: "OUT", status: "FAILED", createdAt: { gte: midnight } },
    }),
  ]);

  const t = await getMessages();

  return (
    <div className="space-y-4 px-5 py-5 lg:px-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Counter label={t.mail.countSent} value={sent} tone="text-positive" />
        <Counter label={t.mail.countReceived} value={received} tone="text-[var(--p-medium)]" />
        <Counter label={t.mail.countRaised} value={raised} tone="text-brand-deep" />
        <Counter label={t.mail.countFailed} value={failed} tone="text-text-3" />
      </div>

      <MailLog rows={rows} />
    </div>
  );
}

/** The day in one number. Four of them, because the question "is mail working"
 *  is answered by the shape of the day rather than by any single row. */
function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card px-3.5 py-3">
      <p className="label">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
