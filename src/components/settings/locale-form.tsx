"use client";

import { updateLocale } from "@/lib/actions/settings";
import { DATE_FORMATS, LOCALES } from "@/lib/validation";
import { Select } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useMessages } from "@/components/shell/instance-context";

const sample = new Date("2026-09-02T14:30:00Z");

export function LocaleForm({
  current,
  dateFormat,
}: {
  current: string;
  /// Empty string when dates follow the language.
  dateFormat: string;
}) {
  const t = useMessages();
  const draft = useDraft({ locale: current, dateLocale: dateFormat });

  // Formatted in the browser with the locale being considered: the point of the
  // setting is what dates look like, so show that rather than describe it.
  const preview = new Intl.DateTimeFormat(draft.draft.dateLocale || draft.draft.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(sample);

  return (
    <div className="space-y-4">
      <label className="block max-w-sm">
        <span className="label mb-1.5 block">{t.settings.locale}</span>
        <Select
          value={draft.draft.locale}
          onChange={(event) => draft.set({ locale: event.target.value })}
        >
          {LOCALES.map((locale) => (
            <option key={locale.value} value={locale.value}>
              {locale.label}
            </option>
          ))}
        </Select>
      </label>

      {/* Which language the app speaks and how it writes a date are two
          questions. Tying them together means an English desk in Amsterdam has
          to choose between the interface it wants and the dates it reads. */}
      <label className="block max-w-sm">
        <span className="label mb-1.5 block">{t.settings.dateFormat}</span>
        <Select
          value={draft.draft.dateLocale}
          onChange={(event) => draft.set({ dateLocale: event.target.value })}
        >
          {DATE_FORMATS.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </Select>
      </label>

      <p className="bg-surface-2 text-text-2 rounded-control px-3 py-2.5 text-base">
        {t.settings.localePreview("")}
        <span className="text-text font-medium">{preview}</span>
      </p>

      <SaveBar
        draft={draft}
        label={t.settings.localeSave}
        save={(values) => updateLocale(values.locale, values.dateLocale)}
      />
    </div>
  );
}
