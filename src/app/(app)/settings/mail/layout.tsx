import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { canCollectMail, canSendMail, getMailSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mail";
import { TEMPLATE_KINDS } from "@/lib/mail-templates";
import { MailHealthStrip } from "@/components/settings/mail-health";
import { MailTabs } from "@/components/settings/mail-tabs";

/**
 * Mail settings: the health strip, then the tabs, then whichever of them you
 * are standing on.
 *
 * The gate is here rather than on each page for the same reason the settings
 * layout has one — four pages is four places to forget it — and the strip is
 * here because whether mail is working does not depend on which tab is open.
 */
export default async function MailSettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!can(user, "settings.mail")) notFound();

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [mail, sentToday, failed, pending, logged] = await Promise.all([
    getMailSettings(),
    prisma.mailMessage.count({
      where: { direction: "OUT", status: "SENT", sentAt: { gte: midnight } },
    }),
    prisma.mailMessage.count({ where: { direction: "OUT", status: "FAILED" } }),
    prisma.mailMessage.count({
      where: { direction: "OUT", status: { in: ["PENDING", "SENDING"] } },
    }),
    prisma.mailMessage.count(),
  ]);

  return (
    <div className="space-y-5">
      <MailHealthStrip
        health={{
          canSend: canSendMail(mail),
          canCollect: canCollectMail(mail),
          lastSentAt: mail.lastSentAt,
          lastPolledAt: mail.lastPolledAt,
          sentToday,
          poll: mail.lastPollSummary,
          failed,
          pending,
          pollUrl: `${appUrl()}/api/mail/poll`,
          tokenSet: Boolean(process.env.MAIL_POLL_TOKEN),
        }}
      />

      {/* The log's number is what is under the tab, not the size of the table:
          fifty is all it shows. */}
      <MailTabs wording={TEMPLATE_KINDS.length} log={Math.min(logged, 50)} />

      <div className="min-w-0">{children}</div>
    </div>
  );
}
