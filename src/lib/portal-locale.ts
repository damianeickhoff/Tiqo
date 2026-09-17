import { getSettings } from "@/lib/settings";

/** What a translated row looks like, whatever it is a translation of. */
type Translated = { locale: string };

/**
 * The language this person reads the portal in.
 *
 * Their own choice where they have made one, the instance's otherwise — which
 * is what almost everyone gets, and what nobody has to set.
 */
export async function readerLocale(user: { locale?: string | null }) {
  if (user.locale) return user.locale;
  return (await getSettings()).locale;
}

/**
 * The row written in `locale`, or nothing.
 *
 * Matched on the language before the region: someone reading `nl-BE` should get
 * the Dutch article rather than the English one, because a Belgian spelling is
 * a smaller difference than a different language.
 */
export function pickTranslation<T extends Translated>(rows: T[], locale: string): T | null {
  const exact = rows.find((row) => row.locale === locale);
  if (exact) return exact;

  const language = locale.split("-")[0];
  return rows.find((row) => row.locale.split("-")[0] === language) ?? null;
}

/**
 * The article's words in the reader's language, falling back to what is on the
 * article itself.
 *
 * The article carries the copy it was written in and translations carry the
 * rest, so there is always something to show: an answer with no Dutch version
 * is still an answer, and a blank page would be a worse outcome than an English
 * one.
 */
export function localised<
  Row extends Translated & Partial<Fields>,
  Fields extends Record<string, unknown>,
>(base: Fields, translations: Row[], locale: string): Fields {
  const found = pickTranslation(translations, locale);
  if (!found) return base;

  const merged = { ...base };
  for (const key of Object.keys(base) as (keyof Fields)[]) {
    const value = found[key as keyof Row];
    // An empty translation is not a translation: a Dutch article with no
    // summary should borrow the original's rather than show nothing.
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value as Fields[keyof Fields];
    }
  }
  return merged;
}
