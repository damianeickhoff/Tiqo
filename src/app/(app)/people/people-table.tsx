"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Search, X } from "lucide-react";
import { CopyValue } from "@/components/copy-value";
import { shortAge } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell/page-header";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type Person = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  avatarVariant: number;
  lastSeenAt: Date | null;
  role: { name: string };
  teams: { id: string; name: string; color: string }[];
  /// Whether the desk's clock says they are at work right now, worked out on
  /// the server where the instance's hours live. Null when nobody has said.
  inOffice: boolean | null;
  /// Whether they work the queue rather than only raising tickets. Admins are
  /// operators too — the split is what someone does here, not their rank.
  isAgent: boolean;
  /// Assigned and unsettled. Null for a requester, who has no queue — a zero
  /// there would read as "nothing to do" rather than "not that kind of person".
  open: number | null;
};

type Segment = "operators" | "requesters" | "everyone";

const SEGMENTS: { id: Segment }[] = [{ id: "operators" }, { id: "requesters" }, { id: "everyone" }];

const ANY = "";

/**
 * The grid the heading row and every row share, so a column heading cannot
 * drift away from the column it names.
 */
const GRID =
  "grid grid-cols-[minmax(0,1fr)] items-center gap-4 px-5 lg:px-8 " +
  "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_96px_56px_84px]";

/**
 * The directory.
 *
 * Filtered here rather than on the server: a desk's directory is hundreds of
 * rows, not thousands, and typing into a box that answers on the keystroke is
 * worth far more than saving a few kilobytes of payload. It searches everything
 * on the row — a name, an address, a team, a job title — because someone
 * looking for "whoever runs payroll" does not know the name yet.
 */
export function PeopleTable({
  people,
  viewerId,
  action,
}: {
  people: Person[];
  viewerId: string;
  /// The New person control, which only the server knows whether to build.
  action?: React.ReactNode;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(ANY);
  const [team, setTeam] = useState(ANY);
  // Operators first: the desk's own people are the set anyone scans, and the
  // requesters are the set they search. Two kinds of person in one list made
  // both harder to read.
  const [segment, setSegment] = useState<Segment>("operators");

  const inSegment = useMemo(
    () =>
      people.filter(
        (person) =>
          segment === "everyone" || (segment === "operators" ? person.isAgent : !person.isAgent),
      ),
    [people, segment],
  );

  const roles = useMemo(
    () => [...new Set(inSegment.map((person) => person.role.name))].sort(),
    [inSegment],
  );
  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const person of inSegment) for (const row of person.teams) seen.set(row.id, row.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [inSegment]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inSegment.filter((person) => {
      if (role && person.role.name !== role) return false;
      if (team && !person.teams.some((row) => row.id === team)) return false;
      if (!needle) return true;
      return [
        person.name,
        person.email,
        person.phone,
        person.company,
        person.department,
        person.jobTitle,
        person.role.name,
        ...person.teams.map((row) => row.name),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [inSegment, query, role, team]);

  const filtered = Boolean(query.trim() || role || team);

  return (
    <>
      <PageHeader
        title={t.people.title}
        actions={
          <>
            <div
              role="group"
              aria-label={t.people.title}
              className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
            >
              {SEGMENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-current={segment === option.id}
                  onClick={() => setSegment(option.id)}
                  className={cn(
                    "h-7 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow]",
                    segment === option.id
                      ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                      : "text-text-2 hover:text-text",
                  )}
                >
                  {t.people[option.id]}
                </button>
              ))}
            </div>

            <label className="relative hidden sm:block">
              <Search
                size={14}
                aria-hidden
                className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.people.search}
                aria-label={t.people.search}
                className="border-line bg-surface rounded-control focus:border-brand h-8 w-[260px] border pr-2.5 pl-8 text-base transition-[border-color] placeholder:text-[var(--text-3)] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
              />
            </label>

            <ChipSelect label={t.people.anyRole} value={role} onChange={setRole}>
              {roles.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </ChipSelect>

            <ChipSelect label={t.people.anyTeam} value={team} onChange={setTeam}>
              {teams.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </ChipSelect>

            {filtered ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setRole(ANY);
                  setTeam(ANY);
                }}
                className="text-brand-deep flex h-7 items-center gap-1.5 rounded-full bg-[var(--brand-tint)] px-2.5 text-sm font-semibold"
              >
                <X size={12} strokeWidth={2.5} />
                {t.tickets.clear}
              </button>
            ) : null}

            <span className="text-text-3 tnum font-mono text-xs">
              {t.people.showing(shown.length, inSegment.length)}
            </span>

            {action}
          </>
        }
      />

      {shown.length === 0 ? (
        <p className="text-text-3 text-md px-5 py-10 text-center lg:px-8">{t.common.noMatches}</p>
      ) : (
        <>
          <div
            aria-hidden
            className={cn(
              GRID,
              "label border-line bg-surface sticky top-0 z-10 hidden h-9 border-b xl:grid",
            )}
          >
            <span className="truncate">{t.people.person}</span>
            <span className="truncate">{t.people.contact}</span>
            <span className="truncate">{t.people.organisation}</span>
            <span className="truncate">{t.people.teams}</span>
            <span className="truncate">{t.people.role}</span>
            <span className="truncate text-right">{t.people.colOpen}</span>
            <span className="truncate text-right">{t.people.lastSeen}</span>
          </div>

          <ul>
            {shown.map((person) => (
              <Row key={person.id} person={person} you={person.id === viewerId} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** A filter that reads as a word rather than a form control. */
function ChipSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "select-chevron border-line bg-surface h-7 max-w-[9rem] cursor-pointer appearance-none truncate",
        "rounded-full border pr-6 pl-2.5 text-sm font-medium transition-colors",
        "hover:border-line-strong focus:outline-none",
        value ? "text-brand-deep" : "text-text-2",
      )}
    >
      <option value={ANY}>{label}</option>
      {children}
    </select>
  );
}

function Row({ person, you }: { person: Person; you: boolean }) {
  const t = useMessages();

  return (
    // The row is a link, but the contact cell holds real buttons — and a button
    // inside an anchor is neither valid nor clickable. So the anchor covers the
    // row with a stretched overlay instead, and the cell that needs to be
    // clicked for itself sits above it.
    <li
      className={cn(
        "border-line hover:bg-surface-2 relative border-b transition-[background-color] duration-100",
        !person.isActive && "opacity-55",
      )}
    >
      <div className={cn(GRID, "min-h-[56px] py-2")}>
        <span className="flex min-w-0 items-center gap-3">
          <Avatar
            name={person.name}
            variant={person.avatarVariant}
            size={28}
            className="shrink-0"
          />

          <Link
            href={`/people/${person.id}`}
            className="min-w-0 after:absolute after:inset-0 after:content-['']"
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate text-base font-semibold">{person.name}</span>
              {you ? (
                <span className="tag text-brand-deep shrink-0 bg-[var(--brand-tint)]">
                  {t.common.you}
                </span>
              ) : null}
              {person.isActive ? null : <span className="tag shrink-0">{t.people.inactive}</span>}
            </span>
            {/* Whether a message now would be read now. Under the name rather
                than as a dot on the face: a dot can only say "yes", and the
                interesting half of the answer is often "no". */}
            {person.inOffice === null ? null : (
              <span className="text-text-3 mt-0.5 flex items-center gap-1.5 text-sm">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: person.inOffice ? "var(--positive)" : "var(--text-3)" }}
                />
                {person.inOffice ? t.ticket.inOffice : t.ticket.outOfHours}
              </span>
            )}
          </Link>
        </span>

        {/* Above the row's overlay, so tapping a value copies it rather than
            opening the person. The icon in front of each value is the other
            thing anyone wants from a contact — the app, rather than the
            clipboard. */}
        <span className="text-text-3 relative z-10 hidden min-w-0 flex-col gap-0.5 font-mono text-xs xl:flex">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Reach href={`mailto:${person.email}`} label={t.ticket.emailAction}>
              <Mail size={11} />
            </Reach>
            <CopyValue value={person.email} />
          </span>
          {person.phone ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Reach href={`tel:${person.phone.replace(/\s/g, "")}`} label={t.ticket.callAction}>
                <Phone size={11} />
              </Reach>
              <CopyValue value={person.phone} />
            </span>
          ) : null}
        </span>

        <span className="hidden min-w-0 flex-col xl:flex">
          <span className="truncate text-base">
            {person.company ?? <span className="text-text-3">—</span>}
          </span>
          {person.jobTitle || person.department ? (
            <span className="text-text-3 truncate text-sm">
              {[person.jobTitle, person.department].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>

        <span className="hidden flex-wrap gap-1 xl:flex">
          {person.teams.length === 0 ? (
            <span className="text-text-3 text-base">—</span>
          ) : (
            // No colour: a group is a queue, not a category, and a dot per
            // group turned a row of them into a palette.
            person.teams.map((team) => (
              <span key={team.id} className="tag">
                {team.name}
              </span>
            ))
          )}
        </span>

        <span className="text-text-2 hidden truncate text-base xl:block">{person.role.name}</span>

        <span className="text-text-2 tnum hidden text-right font-mono text-sm xl:block">
          {person.open ?? <span className="text-text-3">—</span>}
        </span>

        <span
          className={cn(
            "tnum hidden text-right font-mono text-sm xl:block",
            person.lastSeenAt ? "text-text-2" : "text-text-3",
          )}
        >
          {person.lastSeenAt
            ? t.common.ago(shortAge(person.lastSeenAt, undefined, t))
            : t.common.never}
        </span>
      </div>
    </li>
  );
}

/**
 * A way to reach someone in the app that handles it, above the row link. The
 * icon is small, so the hit area is padded out around it without moving it.
 */
function Reach({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className="hover:bg-surface-3 hover:text-text -m-1 flex shrink-0 items-center justify-center rounded-sm p-1 transition-colors"
    >
      {children}
    </a>
  );
}
