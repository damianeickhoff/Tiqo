"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CLOCK, type Clock } from "@/lib/tickets";
import { messagesFor } from "@/lib/i18n";

/**
 * The instance settings a client component needs while rendering: the clock
 * behind every countdown — response targets and opening hours — and the locale
 * every date is written in.
 *
 * They are the same for everyone and change about once a year, so they ride
 * down with the shell rather than being fetched. Server components read the
 * same values straight from `getClock()` — this is only the client's copy.
 */
type InstanceValue = {
  clock: Clock;
  locale: string;
  /// What dates are written in. Usually the language, but a desk can say
  /// otherwise, and then every date in the client follows this instead.
  dateLocale?: string;
};

const InstanceContext = createContext<InstanceValue>({
  clock: DEFAULT_CLOCK,
  locale: "en-GB",
});

export function InstanceProvider({
  clock,
  locale,
  dateLocale,
  children,
}: InstanceValue & { children: React.ReactNode }) {
  // The object would otherwise be new on every shell render, which would
  // invalidate every consumer for nothing.
  const value = useMemo(() => ({ clock, locale, dateLocale }), [clock, locale, dateLocale]);
  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

export function useClock() {
  return useContext(InstanceContext).clock;
}

/** The response targets alone, for the places that only label them. */
export function usePriorityTargets() {
  return useClock().targets;
}

export function useLocale() {
  return useContext(InstanceContext).locale;
}

/** The locale for dates, which is the language unless the desk said otherwise. */
export function useDateLocale() {
  const value = useContext(InstanceContext);
  return value.dateLocale || value.locale;
}

/**
 * The interface, in whatever language the instance runs in.
 *
 * Looked up here rather than handed down from the server: the dictionaries hold
 * functions for the sentences that take a value, and a function cannot cross
 * the server/client boundary. Two languages of strings in the client bundle is
 * a cheaper price than losing the compiler's check on their arguments.
 */
export function useMessages() {
  return messagesFor(useLocale());
}

/** A memoised formatter, so a list of fifty comments builds one and not fifty. */
export function useDateFormat(options: Intl.DateTimeFormatOptions) {
  const locale = useDateLocale();
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key is the options
  return useMemo(() => new Intl.DateTimeFormat(locale, options), [locale, key]);
}
