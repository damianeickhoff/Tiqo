import type { Metadata } from "next";
import { getMailSettings, getMessages } from "@/lib/settings";
import { appUrl } from "@/lib/mail";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { MailCollectingForm, MailSendingForm } from "@/components/settings/mail-forms";
import { MailPollingCard } from "@/components/settings/mail-polling";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.mail };
}

/**
 * How this desk reaches a mail server: sending, collecting, and the route that
 * makes either of them happen.
 *
 * Three cards because they are three decisions — plenty of desks send through a
 * relay with no mailbox on it — and each is its own draft, so testing a changed
 * port does not commit a half-typed username.
 *
 * The passwords stay on this side of the wire: the forms are told only whether
 * one is stored, never what it is.
 */
export default async function MailConnectionPage() {
  const [mail, t] = await Promise.all([getMailSettings(), getMessages()]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.mail.sendTitle} description={t.mail.sendBlurb}>
        <MailSendingForm
          settings={{
            smtpHost: mail.smtpHost ?? "",
            smtpPort: mail.smtpPort,
            smtpSecure: mail.smtpSecure,
            smtpUser: mail.smtpUser ?? "",
            hasPassword: Boolean(mail.smtpPass),
            fromName: mail.fromName,
            fromEmail: mail.fromEmail ?? "",
          }}
        />
      </SettingsSection>

      <SettingsSection title={t.mail.collectTitle} description={t.mail.collectBlurb}>
        <MailCollectingForm
          settings={{
            imapHost: mail.imapHost ?? "",
            imapPort: mail.imapPort,
            imapSecure: mail.imapSecure,
            imapUser: mail.imapUser ?? "",
            hasPassword: Boolean(mail.imapPass),
            imapFolder: mail.imapFolder,
            archiveFolder: mail.archiveFolder ?? "",
          }}
        />
      </SettingsSection>

      {/* Not a setting — the one operating instruction this feature cannot work
          without. Mail that is configured and never polled looks exactly like
          mail that is broken. */}
      <SettingsSection title={t.mail.pollTitle} description={t.mail.pollBlurb}>
        <MailPollingCard
          url={`${appUrl()}/api/mail/poll`}
          tokenSet={Boolean(process.env.MAIL_POLL_TOKEN)}
          /* Quiet until there is something to be quiet about: a fresh instance
             with no mailbox has no reason to be polled, and a red line on it
             reads as a fault somebody caused. */
          tokenMatters={Boolean(mail.imapHost && mail.imapUser)}
          lastPolledAt={mail.lastPolledAt}
          summary={mail.lastPollSummary}
        />
      </SettingsSection>
    </SettingsSheet>
  );
}
