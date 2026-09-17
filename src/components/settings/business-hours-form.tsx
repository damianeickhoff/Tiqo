"use client";

import { updateBusinessHours } from "@/lib/actions/settings";
import type { InstanceSettings } from "@/lib/settings";
import { Select } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

/** Half-hours across the day: finer than that is not an opening time. */
const TIMES = Array.from({ length: 48 }, (_, i) => i * 30);

function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The zones a desk is plausibly run from. Typing one is not a thing anyone
 *  should have to get exactly right. */
const ZONES = [
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Warsaw",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function BusinessHoursForm({ settings }: { settings: InstanceSettings }) {
  const t = useMessages();

  // The days are compared by their joined form: a draft holds values, and two
  // arrays with the same days in them are the same answer.
  const draft = useDraft({
    businessHours: settings.businessHours,
    days: settings.businessDays.join(","),
    businessStart: settings.businessStart,
    businessEnd: settings.businessEnd,
    timeZone: settings.timeZone,
  });
  const { draft: d, set } = draft;

  const days = d.days ? d.days.split(",").map(Number) : [];

  function toggleDay(day: number) {
    const next = days.includes(day)
      ? days.filter((value) => value !== day)
      : [...days, day].sort((a, b) => a - b);
    set({ days: next.join(",") });
  }

  return (
    <div className="space-y-4">
      <label className="text-md flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={d.businessHours}
          onChange={(event) => set({ businessHours: event.target.checked })}
          className="size-4 accent-[var(--brand)]"
        />
        {t.settings.businessToggle}
      </label>

      <div className={cn("space-y-4", !d.businessHours && "pointer-events-none opacity-50")}>
        <div>
          <span className="label mb-1.5 block">{t.settings.openOn}</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day) => {
              const on = days.includes(day.value);
              return (
                <label
                  key={day.value}
                  className={cn(
                    "rounded-control cursor-pointer border px-3 py-2 text-base transition-colors",
                    on
                      ? "border-brand/45 text-brand-deep bg-[var(--brand-tint)] font-semibold"
                      : "border-border text-text-2 hover:bg-surface-2",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleDay(day.value)}
                    className="sr-only"
                  />
                  {day.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.opens}</span>
            <Select
              value={String(d.businessStart)}
              onChange={(event) => set({ businessStart: Number(event.target.value) })}
            >
              {TIMES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {clockLabel(minutes)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="label mb-1.5 block">{t.settings.closes}</span>
            <Select
              value={String(d.businessEnd)}
              onChange={(event) => set({ businessEnd: Number(event.target.value) })}
            >
              {TIMES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {clockLabel(minutes)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="label mb-1.5 block">{t.settings.timeZone}</span>
            <Select value={d.timeZone} onChange={(event) => set({ timeZone: event.target.value })}>
              {ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace("_", " ")}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <SaveBar
        draft={draft}
        label={t.settings.saveHours}
        save={(values) =>
          updateBusinessHours({
            businessHours: values.businessHours,
            businessDays: values.days ? values.days.split(",").map(Number) : [],
            businessStart: values.businessStart,
            businessEnd: values.businessEnd,
            timeZone: values.timeZone,
          })
        }
      />
    </div>
  );
}
