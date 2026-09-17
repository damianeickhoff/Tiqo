import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, canOpenSettings } from "@/lib/permissions";
import {
  canCollectMail,
  getMailSettings,
  getMailTemplates,
  getMessages,
  getSettings,
} from "@/lib/settings";
import { previewValues } from "@/lib/mail";
import { shippedTemplate, TEMPLATE_KINDS, type TemplateKind } from "@/lib/mail-templates";
import { shippedLayout } from "@/lib/mail-layout";
import { MailTemplateDesigner } from "@/components/settings/mail-template-designer";

type Params = Promise<{ kind: string }>;

function kindOf(value: string): TemplateKind | null {
  return (TEMPLATE_KINDS as readonly string[]).includes(value) ? (value as TemplateKind) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getMessages();
  const kind = kindOf((await params).kind);
  return { title: kind ? t.mail.templates[kind].name : t.mail.tabWording };
}

/**
 * One message, on a page of its own.
 *
 * It sits in the `(editors)` group so it gets the app's chrome and none of
 * settings' — a subject, a tall body and a live preview squeezed beside a 220px
 * side-nav is the version of this nobody could use. Leaving that layout also
 * leaves the two gates in front of it, so both are run here, exactly as the
 * form designer does.
 */
export default async function MailTemplatePage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!canOpenSettings(user) || !can(user, "settings.mail")) notFound();

  const kind = kindOf((await params).kind);
  if (!kind) notFound();

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() - 30);

  const [templates, mail, preview, settings, t, sent] = await Promise.all([
    getMailTemplates(),
    getMailSettings(),
    previewValues(user),
    getSettings(),
    getMessages(),
    prisma.mailMessage.count({
      where: { direction: "OUT", kind, createdAt: { gte: thirtyDays } },
    }),
  ]);

  const shipped = shippedTemplate(kind, t);
  const own = templates[kind];

  // The document Tiqo would send for this message, as something to edit. Built
  // here rather than in the browser because its shape depends on settings —
  // whether replies land anywhere, whether the desk signs off — and the editor
  // should start from what is actually going out, not from a general case.
  const collects = canCollectMail(mail);
  const layout = shippedLayout({
    withTicket: kind !== "BOUNCE",
    withReply: collects,
    withSignature: Boolean(mail.signature),
    labels: { openTicket: t.mail.openTicket, replyHint: collects ? t.mail.replyHint : "" },
  });

  return (
    <MailTemplateDesigner
      kind={kind}
      template={{
        ...(own ?? shipped),
        html: own?.html ?? layout,
        ownLayout: Boolean(own?.html),
        edited: Boolean(own),
        shipped: { ...shipped, html: layout },
      }}
      sent={sent}
      chrome={{
        sample: preview.values,
        sampleReference: preview.reference,
        brandColor: settings.brandColor,
        // Both said only where a reply would land somewhere: the footer must
        // not offer one on an instance that collects no mail.
        replyHint: collects ? t.mail.replyHint : "",
        replyAbove: collects ? t.mail.replyAbove : "",
        signature: mail.signature ?? "",
      }}
    />
  );
}
