import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  PERMISSION_KEYS,
  can,
  canChangeRole,
  canDeactivate,
  canViewDirectory,
  isStaff,
  profileAccess,
} from "@/lib/permissions";
import { shortAge } from "@/lib/tickets";
import { getClock, getMessages, getSettings } from "@/lib/settings";
import { clockTime, describeHours, minutesLeftToday } from "@/lib/clock";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/ui";
import { PanelCard } from "@/components/tickets/panel-card";
import { ProfileForm } from "./profile-form";
import { AccountControls } from "./account-controls";
import { PersonTeams } from "./person-teams";
import { AssignedNow } from "./assigned-now";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const person = await prisma.user.findUnique({
    where: { id: (await params).id },
    select: { name: true },
  });
  return { title: person ? person.name : (await getMessages()).people.profile };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

/** Three rows: a summary of the person, not a second queue. */
const OPEN_PREVIEW = 3;

export default async function ProfilePage({ params }: { params: Params }) {
  const viewer = await requireUser();
  const { id } = await params;
  const [{ locale }, t, clock] = await Promise.all([getSettings(), getMessages(), getClock()]);
  const dateFormat = new Intl.DateTimeFormat(locale, DATE_FORMAT);

  // Everyone can reach their own profile; reaching someone else's is a
  // directory privilege.
  if (id !== viewer.id && !canViewDirectory(viewer)) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      phone: true,
      company: true,
      department: true,
      jobTitle: true,
      workDays: true,
      workStart: true,
      workEnd: true,
      locale: true,
      isActive: true,
      roleId: true,
      role: { select: { id: true, name: true, isMaster: true, permissions: true } },
      teams: { select: { id: true, name: true, color: true } },
      avatarVariant: true,
      createdAt: true,
      lastSeenAt: true,
      _count: { select: { assignedTickets: true, reportedTickets: true, comments: true } },
    },
  });
  if (!person) notFound();

  const target = { id: person.id, isMaster: person.role.isMaster };
  const access = profileAccess(viewer, target);
  const isSelf = person.id === viewer.id;

  // Only permissions the catalogue still knows about: a role saved before one
  // was renamed should not render a blank chip.
  const granted = PERMISSION_KEYS.filter((key) => person.role.permissions.includes(key));

  // Their own hours where they have given them; otherwise the desk's stand in,
  // since it is the desk's clock that decides whether a message now lands now.
  // The closing time only appears when their day is nearly over — printing it
  // all day is a clock nobody asked for.
  const workHours =
    person.workDays.length > 0
      ? {
          enabled: true,
          days: person.workDays,
          start: person.workStart,
          end: person.workEnd,
          timeZone: clock.hours.timeZone,
        }
      : clock.hours;
  const inOffice = describeHours(workHours).open;
  const minutesLeft = inOffice ? minutesLeftToday(workHours) : null;
  const closesAt = minutesLeft !== null && minutesLeft <= 60 ? clockTime(workHours.end) : null;

  // What they have open, hottest first. An operator's is what is assigned to
  // them; a requester has no queue, so theirs is what they asked for.
  const isAgent = isStaff({
    id: person.id,
    isMaster: person.role.isMaster,
    permissions: person.role.permissions,
  });
  const openWhere = {
    status: { is: { settles: false } },
    ...(isAgent ? { assigneeId: person.id } : { reporterId: person.id }),
  };
  const [openWork, openTotal] = await Promise.all([
    prisma.ticket.findMany({
      where: openWhere,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: OPEN_PREVIEW,
      select: {
        id: true,
        number: true,
        reference: true,
        title: true,
        priority: true,
        type: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedMinutes: true,
        pausedSince: true,
        status: {
          select: { id: true, name: true, color: true, settles: true, pausesClock: true },
        },
      },
    }),
    prisma.ticket.count({ where: openWhere }),
  ]);

  const mayChangeRole = canChangeRole(viewer, target);
  const mayDeactivate = canDeactivate(viewer, target);

  // Unlike a role, a desk is not a privilege — putting yourself on one is
  // ordinary, so this is the one account control that is not withheld from you.
  const mayChangeTeams = can(viewer, "team.manage");

  const allTeams = mayChangeTeams
    ? await prisma.team.findMany({
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true },
      })
    : [];

  // Roles are only fetched when they can be offered, and a role nobody may
  // grant is not offered: a non-master never sees the master role in the list.
  const roles = mayChangeRole
    ? await prisma.role.findMany({
        where: viewer.isMaster ? {} : { isMaster: false },
        orderBy: { position: "asc" },
        select: { id: true, name: true, isMaster: true },
      })
    : [];

  return (
    <>
      <header className="px-5 py-5 lg:px-8">
        {/* Only offered to someone who can actually open the directory. */}
        {canViewDirectory(viewer) ? (
          <Link
            href="/people"
            className="text-text-2 hover:text-text inline-flex items-center gap-1.5 text-base font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            {t.people.allPeople}
          </Link>
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-4">
          <Avatar name={person.name} variant={person.avatarVariant} size={64} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em]">
                {person.name}
              </h1>
              <span className="tag text-brand-deep bg-[var(--brand-tint)]">{person.role.name}</span>
              {person.isActive ? null : (
                <span className="bg-negative/12 text-negative rounded-full px-2 py-0.5 text-sm font-semibold">
                  {t.people.deactivated}
                </span>
              )}
            </div>

            <p className="text-text-2 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <span className="text-text-3 font-mono text-sm">@{person.username}</span>
              {[person.jobTitle, person.department].filter(Boolean).map((part) => (
                <span key={part}>· {part}</span>
              ))}
              {/* Whether writing to them now will be read now, and how much of
                  their day is left to answer in. */}
              {inOffice === null ? null : (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>·</span>
                  <span
                    aria-hidden
                    className="size-[7px] rounded-full"
                    style={{ background: inOffice ? "var(--positive)" : "var(--text-3)" }}
                  />
                  {inOffice ? t.ticket.inOffice : t.ticket.outOfHours}
                  {closesAt ? ` · ${t.ticket.untilTime(closesAt)}` : null}
                </span>
              )}
            </p>
          </div>

          {/* Ways to reach them above the numbers about them: one is a thing to
              do, the other is background, and the doing should come first. */}
          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex items-center gap-1.5">
              <a href={`mailto:${person.email}`} className={buttonClass("outline", "sm")}>
                <Mail size={13} />
                {t.ticket.emailAction}
              </a>
              {person.phone ? (
                <a
                  href={`tel:${person.phone.replace(/\s/g, "")}`}
                  className={buttonClass("outline", "sm")}
                >
                  <Phone size={13} />
                  {t.ticket.callAction}
                </a>
              ) : null}
            </div>

            {/* One size for all three readouts, mono throughout: they are read
                as a row, and a row whose figures are set differently reads as
                three unrelated facts. */}
            <dl className="flex flex-wrap items-start gap-x-9 gap-y-4">
              <div>
                <dt className="label">{t.people.assigned}</dt>
                <dd className="tnum mt-1.5 text-lg font-semibold tracking-[-0.01em]">
                  {person._count.assignedTickets}
                </dd>
              </div>
              <div>
                <dt className="label">{t.people.raisedCount}</dt>
                <dd className="tnum mt-1.5 text-lg font-semibold tracking-[-0.01em]">
                  {person._count.reportedTickets}
                </dd>
              </div>
              <div>
                <dt className="label">{t.people.lastSeen}</dt>
                <dd className="tnum mt-1.5 text-lg font-semibold tracking-[-0.01em]">
                  {person.lastSeenAt
                    ? t.common.ago(shortAge(person.lastSeenAt, undefined, t))
                    : t.common.never}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <ProfileForm
          userId={person.id}
          access={access}
          isSelf={isSelf}
          memberSince={dateFormat.format(person.createdAt)}
          profile={{
            firstName: person.firstName,
            lastName: person.lastName,
            username: person.username,
            email: person.email,
            phone: person.phone,
            company: person.company,
            department: person.department,
            jobTitle: person.jobTitle,
            locale: person.locale ?? "",
            workDays: person.workDays,
            workStart: person.workStart,
            workEnd: person.workEnd,
          }}
        />

        {/* Two sections, because they answer two different questions: who this
            person is, and what their account may do. The controls that change
            the second live in it, next to what they change. */}
        <div className="flex flex-col gap-5">
          <PanelCard title={t.people.accessTitle} className="h-fit" bodyClassName="p-4">
            <p className="text-text-3 mb-4 text-sm">{t.people.accessBlurb}</p>

            <dl className="text-md space-y-4">
              <div>
                <dt className="label mb-1 flex items-center gap-1.5">
                  <Shield size={11} />
                  {t.people.role}
                </dt>
                <dd className="font-medium">{person.role.name}</dd>
              </div>

              <div>
                <dt className="label mb-1.5">{t.people.permissionsLabel}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {person.role.isMaster ? (
                    <span className="text-brand-deep rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-sm font-medium">
                      {t.settings.everyPermission}
                    </span>
                  ) : granted.length === 0 ? (
                    <span className="text-text-3 text-base">{t.people.noPermissions}</span>
                  ) : (
                    granted.map((permission) => (
                      <span key={permission} className="tag">
                        {t.permissions[permission].label}
                      </span>
                    ))
                  )}
                </dd>
              </div>

              {/* Only for operators: a group is a queue the desk hands work
                  to, and a requester has no queue to be handed anything. */}
              {isAgent ? (
                <div>
                  <dt className="label mb-1">{t.people.teams}</dt>
                  <dd>
                    <PersonTeams
                      userId={person.id}
                      name={person.firstName}
                      teams={person.teams}
                      all={allTeams}
                      editable={mayChangeTeams}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>

            {mayChangeRole || mayDeactivate ? (
              <div className="border-border-soft mt-4 border-t pt-4">
                <AccountControls
                  userId={person.id}
                  roleId={person.roleId}
                  roles={roles}
                  isActive={person.isActive}
                  canChangeRole={mayChangeRole}
                  canDeactivate={mayDeactivate}
                  deletable={
                    person._count.reportedTickets +
                      person._count.assignedTickets +
                      person._count.comments ===
                    0
                  }
                />
              </div>
            ) : (
              <p className="border-border-soft text-text-3 mt-4 border-t pt-3 text-sm">
                {isSelf
                  ? t.people.neverByYou
                  : access === "all"
                    ? t.people.maintainNotAccount
                    : access === "contact"
                      ? t.people.contactOnly
                      : t.people.readOnly}
              </p>
            )}
          </PanelCard>

          {/* What they have on right now, under what their account may do —
              the two together answer "who is this, and can they take another
              one". */}
          <AssignedNow
            tickets={openWork}
            total={openTotal}
            raised={!isAgent}
            href={
              isAgent
                ? `/tickets?assignee=${person.id}&open=1`
                : `/tickets?q=${encodeURIComponent(person.email)}&open=1`
            }
          />
        </div>
      </div>
    </>
  );
}
