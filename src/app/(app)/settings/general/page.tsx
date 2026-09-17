import type { Metadata } from "next";
import { getMessages, getSettings } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { BrandColorForm } from "@/components/settings/brand-color-form";
import { LocaleForm } from "@/components/settings/locale-form";
import { SelfRegistrationToggle } from "@/components/settings/self-registration-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.general };
}

export default async function GeneralSettingsPage() {
  const [settings, t] = await Promise.all([getSettings(), getMessages()]);

  return (
    <div className="space-y-5">
      <SettingsSection title={t.settings.brandTitle} description={t.settings.brandBlurb}>
        <BrandColorForm current={settings.brandColor} />
      </SettingsSection>

      <SettingsSection
        title={t.settings.localeTitle}
        index={1}
        description={t.settings.localeBlurb}
      >
        <LocaleForm current={settings.locale} dateFormat={settings.dateLocale ?? ""} />
      </SettingsSection>

      <SettingsSection
        title={t.settings.signUpsTitle}
        index={2}
        description={t.settings.signUpsBlurb}
      >
        <SelfRegistrationToggle open={settings.selfRegistration} />
      </SettingsSection>
    </div>
  );
}
