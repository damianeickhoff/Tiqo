import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { shippedTemplate, TEMPLATE_KINDS } from "@/lib/mail-templates";
import { MailTemplatesTable } from "@/components/settings/mail-templates-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.mail.tabWording };
}

/**
 * Every kind of mail the desk sends, as one table.
 *
 * Nothing edits in place: a row says what the message is, who gets it and how
 * often it has gone out, and Edit opens it on a page of its own. A settings
 * screen where seven textareas can all be half-written at once is a screen
 * where somebody loses one.
 */
export default async function MailTemplatesPage() {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() - 30);

  const [rows, counts, t] = await Promise.all([
    prisma.mailTemplate.findMany({ select: { kind: true, subject: true, updatedAt: true } }),
    // What each kind has actually done lately. The column is the only thing on
    // this screen that says whether a message anybody is about to reword is one
    // people are receiving daily or one that has never gone out.
    prisma.mailMessage.groupBy({
      by: ["kind"],
      where: { direction: "OUT", createdAt: { gte: thirtyDays }, kind: { not: null } },
      _count: { _all: true },
    }),
    getMessages(),
  ]);

  const edited = new Map(rows.map((row) => [row.kind as string, row]));
  const sent = new Map(counts.map((row) => [row.kind as string, row._count._all]));

  const templates = TEMPLATE_KINDS.map((kind) => {
    const own = edited.get(kind);
    return {
      kind,
      subject: own?.subject ?? shippedTemplate(kind, t).subject,
      edited: Boolean(own),
      updatedAt: own?.updatedAt ?? null,
      sent: sent.get(kind) ?? 0,
    };
  });

  return (
    <div className="px-5 py-5 lg:px-6">
      <MailTemplatesTable templates={templates} />
    </div>
  );
}
