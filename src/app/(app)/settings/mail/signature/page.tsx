import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getMailSettings, getMessages, getSettings } from "@/lib/settings";
import { previewValues } from "@/lib/mail";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { MailSignatureForm } from "@/components/settings/mail-signature";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.mail.signatureTitle };
}

/**
 * What the desk signs off with.
 *
 * One setting rather than a line at the foot of each template: a desk that
 * moves office changes its address once, and a sign-off repeated ten times is
 * nine places to forget.
 */
export default async function MailSignaturePage() {
  const user = await requireUser();
  const [mail, preview, settings, t] = await Promise.all([
    getMailSettings(),
    previewValues(user),
    getSettings(),
    getMessages(),
  ]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.mail.signatureTitle} description={t.mail.signatureBlurb}>
        <MailSignatureForm
          signature={mail.signature ?? ""}
          sample={preview.values}
          brandColor={settings.brandColor}
        />
      </SettingsSection>
    </SettingsSheet>
  );
}
