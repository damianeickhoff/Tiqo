"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/admin";
import { Field, FieldError, FormError, Input, Select } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { PanelCard } from "@/components/tickets/panel-card";
import { useDateLocale, useMessages } from "@/components/shell/instance-context";
import { DAY_NAMES } from "@/lib/clock";
import { CONTENT_LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Profile = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string | null;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  workDays: number[];
  workStart: number;
  workEnd: number;
  /// Empty when they have not chosen, and read the portal in the desk's own.
  locale: string;
};

const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Half-hours: finer than that is not a working day, it is a calendar. */
const TIMES = Array.from({ length: 48 }, (_, i) => i * 30);

function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The text fields, in the order they are drawn. */
type TextKey =
  "firstName" | "lastName" | "email" | "phone" | "company" | "department" | "jobTitle" | "username";

type Errors = Partial<Record<TextKey | "form", string>>;

/**
 * One form, three shapes. What the viewer may change decides which fields are
 * inputs and which are plain text — a disabled input reads as "temporarily
 * unavailable", which is not what a field someone will never own looks like.
 *
 * A draft with a Save, per the rule the rest of the app follows: a changed
 * field is tinted, Save is dead until something has changed, and the bar says
 * which field it is about to write. It used to be a bare "Save changes" that
 * was always live and never said what it would do.
 */
export function ProfileForm({
  userId,
  access,
  isSelf,
  memberSince,
  profile,
}: {
  userId: string;
  access: "all" | "contact" | "none";
  isSelf: boolean;
  /// Written as a date by the server, which owns the instance's locale.
  memberSince: string;
  profile: Profile;
}) {
  const t = useMessages();
  const dayNames = DAY_NAMES(useDateLocale());
  const [errors, setErrors] = useState<Errors>({});

  const draft = useDraft({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone ?? "",
    company: profile.company ?? "",
    department: profile.department ?? "",
    jobTitle: profile.jobTitle ?? "",
    username: profile.username,
    // Held as a string so the draft can compare it by value; a fresh array
    // every render would read as dirty on every keystroke elsewhere.
    workDays: profile.workDays.join(","),
    workStart: profile.workStart,
    workEnd: profile.workEnd,
    locale: profile.locale,
  });
  const { draft: d, set } = draft;

  const full = access === "all";
  const editable = access !== "none";

  const LABELS: Record<TextKey, string> = {
    firstName: t.auth.firstName,
    lastName: t.auth.lastName,
    email: t.auth.email,
    phone: t.people.phone,
    company: t.people.company,
    department: t.people.department,
    jobTitle: t.ticket.function,
    username: t.people.username,
  };

  const committed = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone ?? "",
    company: profile.company ?? "",
    department: profile.department ?? "",
    jobTitle: profile.jobTitle ?? "",
    username: profile.username,
    workDays: profile.workDays.join(","),
    workStart: profile.workStart,
    workEnd: profile.workEnd,
    locale: profile.locale,
  };

  const days = d.workDays ? d.workDays.split(",").map(Number) : [];
  const toggleDay = (day: number) =>
    set({
      workDays: (days.includes(day) ? days.filter((v) => v !== day) : [...days, day])
        .sort((a, b) => a - b)
        .join(","),
    });

  // What Save is about to write, named. "Phone changed" beats "unsaved
  // changes" by exactly the amount someone would otherwise have to go and look.
  const changedFields = (Object.keys(LABELS) as TextKey[]).filter(
    (key) => d[key] !== committed[key],
  );
  const hoursChanged =
    d.workDays !== committed.workDays ||
    d.workStart !== committed.workStart ||
    d.workEnd !== committed.workEnd;
  const named = [...changedFields.map((key) => LABELS[key])];
  if (hoursChanged) named.push(t.people.workingHours);
  if (d.locale !== committed.locale) named.push(t.people.language);
  const summary = named.length > 0 ? t.people.fieldsChanged(named.join(", ")) : undefined;

  async function save(values: typeof d) {
    // The action speaks FormData, which is right for a form that can be posted
    // without JavaScript. The draft speaks values, so this is the seam.
    const body = new FormData();
    for (const key of Object.keys(LABELS) as TextKey[]) body.set(key, values[key]);
    for (const day of values.workDays ? values.workDays.split(",") : []) {
      body.append("workDays", day);
    }
    body.set("workStart", String(values.workStart));
    body.set("workEnd", String(values.workEnd));
    body.set("locale", values.locale);

    const result = await updateProfile(userId, undefined, body);
    if (result?.errors) {
      setErrors(result.errors);
      return { ok: false as const, error: result.errors.form };
    }
    setErrors({});
    return { ok: true as const };
  }

  return (
    <PanelCard
      title={t.people.details}
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col p-4"
    >
      {/* The sentence sits in the body, not the header: a 34px header truncates
          it, and what it says is the whole reason some of these fields are
          plain text rather than inputs. */}
      <p className="text-text-3 mb-4 text-sm">
        {full
          ? isSelf
            ? t.people.ownDetails
            : t.people.youMaintain
          : editable
            ? t.people.contactOnly
            : t.people.readOnly}
      </p>

      <FormError>{errors.form}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(LABELS) as TextKey[]).map((key) => (
          <ProfileField
            key={key}
            label={LABELS[key]}
            name={key}
            value={d[key]}
            onChange={(next) => set({ [key]: next } as Partial<typeof d>)}
            dirty={d[key] !== committed[key]}
            // Everything but the address and the number is the desk's to keep.
            editable={key === "email" || key === "phone" ? editable : full}
            error={errors[key]}
            hint={key === "username" && full ? t.people.usernameHint : undefined}
          />
        ))}

        {/* Which language the portal speaks to them in. It sits with the rest
            of who they are rather than in a settings panel: it is a fact about
            the person, not a preference about the app. */}
        <label className="block">
          <span className="label mb-1.5 block">{t.people.language}</span>
          {editable ? (
            <Select
              value={d.locale}
              onChange={(event) => set({ locale: event.target.value })}
              className={cn(
                d.locale !== committed.locale && "border-brand/45 bg-[var(--brand-tint)]",
              )}
            >
              <option value="">{t.people.instanceLanguage}</option>
              {CONTENT_LOCALES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-md">
              {CONTENT_LOCALES.find((option) => option.code === d.locale)?.label ??
                t.people.instanceLanguage}
            </p>
          )}
          <span className="text-text-3 mt-1 block text-sm">{t.people.languageHint}</span>
        </label>
      </div>

      {/* When they are reachable. Kept beside the phone number rather than in
          a settings panel: it answers the same question those fields do — how
          and when to get hold of this person. */}
      <div className="border-line mt-4 border-t pt-4">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="label">{t.people.workingHours}</span>
          <span className="text-text-3 text-sm">{t.people.workingHoursHint}</span>
        </div>

        {full ? (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DAYS.map((day) => {
                const on = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "rounded-full border px-3 text-sm shadow-[var(--highlight)] transition-colors",
                      "flex h-7 items-center",
                      on
                        ? "border-brand/45 text-brand-deep bg-[var(--brand-tint)] font-semibold"
                        : "text-text-2 hover:bg-surface-2 border-transparent",
                    )}
                  >
                    {dayNames[day]}
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                "mt-3 grid max-w-sm gap-4 sm:grid-cols-2",
                days.length === 0 && "pointer-events-none opacity-50",
              )}
            >
              <Field label={t.settings.opens}>
                <Select
                  value={String(d.workStart)}
                  onChange={(e) => set({ workStart: Number(e.target.value) })}
                >
                  {TIMES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {clockLabel(minutes)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.settings.closes}>
                <Select
                  value={String(d.workEnd)}
                  onChange={(e) => set({ workEnd: Number(e.target.value) })}
                >
                  {TIMES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {clockLabel(minutes)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        ) : (
          <p className={cn("text-md mt-2", days.length === 0 && "text-text-3")}>
            {days.length > 0
              ? `${days.map((day) => dayNames[day]).join(", ")} · ${clockLabel(d.workStart)}–${clockLabel(d.workEnd)}`
              : t.people.noWorkingHours}
          </p>
        )}
      </div>

      {editable ? <SaveBar draft={draft} save={save} summary={summary} hideWhenIdle /> : null}

      {/* Pinned to the foot of the card rather than trailing the form: it is
          a footnote about the account, not the last field of the profile. */}
      <p className="border-line text-text-3 mt-auto border-t pt-3 text-sm">
        {t.people.memberSince} <span className="tnum font-mono">{memberSince}</span>
      </p>
    </PanelCard>
  );
}

function ProfileField({
  label,
  name,
  value,
  onChange,
  dirty,
  editable,
  error,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
  dirty: boolean;
  editable: boolean;
  error?: string;
  hint?: string;
}) {
  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="label">{label}</p>
        <p className={cn("flex min-h-9 items-center text-base", !value && "text-text-3")}>
          {value || "—"}
        </p>
      </div>
    );
  }

  return (
    <Field label={label} hint={hint} htmlFor={name}>
      <Input
        id={name}
        name={name}
        type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        // Tinted while it differs from what is stored, so the eye can find what
        // Save is about to write.
        className={cn(dirty && "border-brand/45 bg-[var(--brand-tint)]")}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}
