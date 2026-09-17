"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { peekPerson, type PersonPeek } from "@/lib/actions/peek";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { CopyValue } from "@/components/copy-value";
import { DAY_NAMES } from "@/lib/clock";
import { useDateLocale, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * A name that answers the question the click was actually asking.
 *
 * Reading a name on a ticket almost always means "who is this and how do I
 * reach them", not "take me away from what I am reading". So the name opens a
 * card in place, with everything known about the person on it, and the profile
 * page — which is where their history lives — is one button further on.
 *
 * Written as one component so a name behaves the same everywhere, rather than
 * the same in the three places somebody remembered.
 *
 * Without an id it degrades to plain text: a deleted account still has a name
 * in the trail, and that name has nowhere to go.
 */
export function PersonLink({
  id,
  name,
  className,
  children,
}: {
  id?: string | null;
  name: string;
  className?: string;
  /// What to render in place of the name, for a control that opens the same
  /// card but does not read as a name — a "Profile" button, say.
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!id) return <span className={className}>{children ?? name}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hover:text-brand-deep max-w-full cursor-pointer text-left underline-offset-2 transition-colors",
          className,
        )}
      >
        {children ?? name}
      </button>
      {open ? <PersonCard id={id} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The card itself: loaded when it opens, never before. */
function PersonCard({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const t = useMessages();
  const dayNames = DAY_NAMES(useDateLocale());
  const [person, setPerson] = useState<PersonPeek | null | "loading">("loading");

  // Fetched when the card opens rather than with the page: a queue of fifty
  // rows has fifty names on it, and none of them are worth a query until one
  // is clicked.
  useEffect(() => {
    let live = true;
    void peekPerson(id).then((row) => {
      if (live) setPerson(row);
    });
    return () => {
      live = false;
    };
  }, [id]);

  const rows: [string, React.ReactNode][] =
    person && person !== "loading"
      ? [
          [t.people.username, <CopyValue key="u" value={person.username} />],
          [t.auth.email, <CopyValue key="e" value={person.email} />],
          ...(person.phone
            ? ([[t.ticket.phone, <CopyValue key="p" value={person.phone} />]] as [
                string,
                React.ReactNode,
              ][])
            : []),
          ...(person.company
            ? ([[t.people.company, person.company]] as [string, React.ReactNode][])
            : []),
          ...(person.department
            ? ([[t.people.department, person.department]] as [string, React.ReactNode][])
            : []),
          [t.people.role, person.roleName],
          ...(person.teams.length
            ? ([[t.ticket.team, person.teams.join(", ")]] as [string, React.ReactNode][])
            : []),
          [
            t.people.workingHours,
            person.workDays.length
              ? `${person.workDays.map((day) => dayNames[day]).join(", ")} · ${clockLabel(person.workStart)}–${clockLabel(person.workEnd)}`
              : t.people.noWorkingHours,
          ],
        ]
      : [];

  return (
    <Modal title={name} onClose={onClose}>
      {person === "loading" ? (
        <p className="text-text-3 py-6 text-center text-base">{t.common.loading}</p>
      ) : !person ? (
        <p className="text-text-3 py-6 text-center text-base">{t.errors.accountGone}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={person.name} variant={person.avatarVariant} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-md truncate font-medium">
                {[person.jobTitle, person.department].filter(Boolean).join(" · ") ||
                  person.roleName}
              </p>
              <p className="text-text-3 truncate font-mono text-sm">@{person.username}</p>
            </div>
            {/* The page is still there for whoever wants the history; it is
                just no longer the only thing a name can do. */}
            <Link
              href={`/people/${person.id}`}
              onClick={onClose}
              aria-label={t.ticket.profileAction}
              title={t.ticket.profileAction}
              className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control flex size-9 shrink-0 items-center justify-center border transition-colors"
            >
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {person.isActive ? null : (
            <p className="bg-surface-2 text-text-2 rounded-control px-3 py-2 text-base">
              {t.people.deactivated}
            </p>
          )}

          <dl className="border-line divide-line rounded-card grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 border px-3.5 py-2 text-base">
            {rows.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </dl>

          {/* What they are carrying, on both sides of the desk. */}
          <div className="grid grid-cols-2 gap-3">
            <Tally label={t.people.openAssigned} value={person.openAssigned} />
            <Tally label={t.people.openRaised} value={person.openRaised} />
          </div>

          <div className="border-line flex gap-2 border-t pt-4">
            <a
              href={`mailto:${person.email}`}
              className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control flex h-9 flex-1 items-center justify-center gap-1.5 border text-base font-medium transition-colors"
            >
              <Mail size={14} />
              {t.ticket.emailAction}
            </a>
            {person.phone ? (
              <a
                href={`tel:${person.phone.replace(/\s/g, "")}`}
                className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text rounded-control flex h-9 flex-1 items-center justify-center gap-1.5 border text-base font-medium transition-colors"
              >
                <Phone size={14} />
                {t.ticket.callAction}
              </a>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-3 py-1.5 text-sm">{label}</dt>
      <dd className="min-w-0 truncate py-1.5">{value}</dd>
    </>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-line rounded-card border px-3 py-2">
      <p className="text-text-3 text-sm">{label}</p>
      <p className="tnum mt-0.5 text-xl leading-none font-semibold">{value}</p>
    </div>
  );
}
