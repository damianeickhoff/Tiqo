import { en } from "@/lib/i18n/en";
import { nl } from "@/lib/i18n/nl";

/**
 * The English dictionary is the shape every other one must have. Writing it as
 * a type rather than a runtime check means a half-translated language is a
 * build failure, not something a Dutch user finds first.
 */
type Widen<T> = T extends string
  ? string
  : // Functions before objects: a function is an object too, and matching it as
    // one would strip its signature.
    T extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : { [Key in keyof T]: Widen<T[Key]> };

export type Messages = Widen<typeof en>;

/**
 * Regional variants share a dictionary: a Belgian desk and a Dutch one want the
 * same words and only differ in how dates are written, which `Intl` already
 * knows from the locale tag.
 */
const BY_LANGUAGE: Record<string, Messages> = {
  en: en as Messages,
  nl,
};

/** Falls back to English rather than showing a key: an untranslated sentence is
 *  readable, `settings.brandTitle` is not. */
export function messagesFor(locale: string): Messages {
  return BY_LANGUAGE[locale.split("-")[0]!.toLowerCase()] ?? (en as Messages);
}

/**
 * The languages content can be written in.
 *
 * The same two the interface speaks, because an answer in a language the app
 * cannot label is one nobody will find. Region-less: a translation is written
 * per language, and `Intl` handles the regional differences that are left.
 */
export const CONTENT_LOCALES = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
] as const;

export { en };

/* ------------------------------------------------------- validation notes -- */

/**
 * Zod messages are fixed when a schema is defined, which is once per process —
 * long before a request knows what language to answer in. So a schema carries a
 * *token* naming its message, and `translate` turns it into a sentence at the
 * point the answer is written.
 *
 * The prefix is a control character no message would ever start with, so a
 * plain string passes through untouched.
 */
const TOKEN = "\u0001";

type Notes = Messages["errors"];

/** A note key, followed by whatever that particular note asks for. */
type Note = {
  [Key in keyof Notes]: Notes[Key] extends (...args: infer Args) => string ? [Key, ...Args] : [Key];
}[keyof Notes];

export function note(...parts: Note): string {
  return TOKEN + JSON.stringify(parts);
}

export function translate(message: string, t: Messages): string {
  if (!message.startsWith(TOKEN)) return message;

  const [key, ...args] = JSON.parse(message.slice(TOKEN.length)) as [keyof Notes, ...unknown[]];
  const entry = t.errors[key];
  return typeof entry === "function" ? (entry as (...args: unknown[]) => string)(...args) : entry;
}
