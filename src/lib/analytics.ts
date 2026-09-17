import "server-only";

import { prisma } from "@/lib/prisma";
import { ticketVisibilityFilter } from "@/lib/permissions";
import { getClock, getPriorityTargets } from "@/lib/settings";
import type { SessionUser } from "@/lib/auth";
import type { Priority } from "@/generated/prisma/enums";
import { PRIORITY_ORDER, hasResponseTarget, isSettled } from "@/lib/tickets";
import { workingMinutesBetween } from "@/lib/clock";

const DAY = 86_400_000;

/**
 * The dashboard aggregates are computed in memory from one scoped query.
 * That is the right trade at this size — a single round trip instead of six,
 * and every figure is derived from exactly the same snapshot, so the donut and
 * the KPI tiles can never disagree. Move to SQL aggregates if a queue ever gets
 * big enough for this to matter.
 */
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/**
 * How long the open work has been waiting. Fixed edges rather than quantiles:
 * "three days old" means the same thing on a quiet week as on a busy one, and a
 * bucket that moves with the data cannot be compared with yesterday's.
 */
const AGE_BUCKETS = [
  { key: "d1", upToHours: 24 },
  { key: "d3", upToHours: 72 },
  { key: "d7", upToHours: 168 },
  { key: "w2", upToHours: 336 },
  { key: "older", upToHours: Infinity },
] as const;

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]["key"];

export async function getDashboard(user: SessionUser, days = 90) {
  const since = new Date(Date.now() - (days - 1) * DAY);
  since.setHours(0, 0, 0, 0);

  const myTeams = await prisma.team.findMany({
    where: { members: { some: { id: user.id } } },
    select: { id: true },
  });
  const myTeamIds = new Set(myTeams.map((team) => team.id));

  const tickets = await prisma.ticket.findMany({
    where: ticketVisibilityFilter(user),
    select: {
      id: true,
      teamId: true,
      status: { select: { id: true, name: true, color: true, settles: true, isDefault: true } },
      priority: true,
      type: true,
      createdAt: true,
      resolvedAt: true,
      pausedMinutes: true,
      pausedSince: true,
      closedAt: true,
      assigneeId: true,
      assignee: { select: { name: true, avatarVariant: true } },
      project: { select: { key: true, name: true } },
      labels: { select: { id: true, name: true, color: true } },
    },
  });

  // "Waiting on me" means a ticket that came back to the desk. Which status
  // that is, is the desk's own decision: a status is a reply-received one when
  // some other status points at it as where a requester's reply should land.
  // Read rather than named, so renaming "Reply received" cannot break this.
  const replyStatuses = await prisma.status.findMany({
    where: { precededBy: { some: {} } },
    select: { id: true },
  });
  const replyStatusIds = new Set(replyStatuses.map((status) => status.id));

  // Projects sit in the same overview as tickets, so they are counted the same
  // four ways. A project has no assignee — it has a lead and a roster — so
  // "mine" means either, and "unassigned" means nobody has taken the lead.
  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    select: {
      teamId: true,
      leadId: true,
      members: { select: { id: true } },
    },
  });

  const projectCounts = {
    mine: projects.filter(
      (project) =>
        project.leadId === user.id || project.members.some((member) => member.id === user.id),
    ).length,
    team: projects.filter(
      (project) =>
        project.leadId === user.id ||
        project.members.some((member) => member.id === user.id) ||
        (project.teamId && myTeamIds.has(project.teamId)),
    ).length,
    all: projects.length,
    unassigned: projects.filter((project) => !project.leadId).length,
  };

  const targets = await getPriorityTargets();
  const now = Date.now();

  const ageHours = (t: (typeof tickets)[number]) => {
    const settledAt = t.closedAt ?? t.resolvedAt;
    const until = isSettled(t.status) && settledAt ? settledAt.getTime() : now;
    return (until - t.createdAt.getTime()) / 36e5;
  };

  // Only incidents can breach: nothing else has a target to breach.
  const breached = (t: (typeof tickets)[number]) =>
    hasResponseTarget(t.type) && ageHours(t) >= targets[t.priority];

  /* ---------------------------------------------------------- headline -- */

  const open = tickets.filter((t) => !isSettled(t.status));
  const overdue = open.filter(breached);
  const assignedToMe = open.filter((t) => t.assigneeId === user.id);
  // "Being worked on" is no longer one named status: it is anything open that
  // is not the stage tickets start in.
  const inProgress = open.filter((t) => t.status && !t.status.isDefault);

  // High priority, plus anything past its target whatever its priority — a
  // breached Low is more urgent than an untouched High.
  const highPriority = open.filter(
    (t) => t.priority === "URGENT" || t.priority === "HIGH" || breached(t),
  );
  const waitingOnMe = assignedToMe.filter((t) => t.status && replyStatusIds.has(t.status.id));
  const unassigned = open.filter((t) => !t.assigneeId);

  const weekAgo = now - 7 * DAY;
  const resolvedThisWeek = tickets.filter(
    (t) => t.resolvedAt && t.resolvedAt.getTime() >= weekAgo,
  ).length;
  const resolvedPrevWeek = tickets.filter(
    (t) =>
      t.resolvedAt &&
      t.resolvedAt.getTime() >= weekAgo - 7 * DAY &&
      t.resolvedAt.getTime() < weekAgo,
  ).length;

  /* ------------------------------------------------- volume over time -- */

  const buckets = new Map<string, { date: string; created: number; resolved: number }>();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(since.getTime() + i * DAY);
    buckets.set(dayKey(day), { date: dayKey(day), created: 0, resolved: 0 });
  }

  for (const ticket of tickets) {
    const created = buckets.get(dayKey(ticket.createdAt));
    if (created) created.created += 1;

    if (ticket.resolvedAt) {
      const resolved = buckets.get(dayKey(ticket.resolvedAt));
      if (resolved) resolved.resolved += 1;
    }
  }

  const volume = [...buckets.values()];

  /* --------------------------------------------- created vs resolved -- */

  const weeks = new Map<string, { week: string; created: number; resolved: number }>();
  const weekKey = (date: Date) => {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    // getDay() is 0 on Sunday, which belongs to the week that started six days
    // earlier rather than to the one starting tomorrow.
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return dayKey(monday);
  };

  const firstMonday = new Date(since);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  for (let i = 0; i * 7 * DAY <= now - firstMonday.getTime(); i += 1) {
    const key = dayKey(new Date(firstMonday.getTime() + i * 7 * DAY));
    weeks.set(key, { week: key, created: 0, resolved: 0 });
  }

  for (const ticket of tickets) {
    const raised = weeks.get(weekKey(ticket.createdAt));
    if (raised) raised.created += 1;
    if (ticket.resolvedAt) {
      const settled = weeks.get(weekKey(ticket.resolvedAt));
      if (settled) settled.resolved += 1;
    }
  }
  const throughput = [...weeks.values()].slice(-12);

  /* ------------------------------------------------------ by category -- */

  // Tags are the nearest thing this desk has to a category: type is three
  // values and a team is who, not what. A ticket wearing several tags counts
  // once under each — it genuinely is in both.
  const tagCounts = new Map<string, { id: string; name: string; color: string; count: number }>();
  for (const ticket of open) {
    for (const label of ticket.labels) {
      const row = tagCounts.get(label.id) ?? { ...label, count: 0 };
      row.count += 1;
      tagCounts.set(label.id, row);
    }
  }
  const untagged = open.filter((ticket) => ticket.labels.length === 0).length;
  const byCategory = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  /* ----------------------------------------------------- distributions -- */

  // Every status the desk defines gets a slice, including the empty ones — a
  // stage nobody is in is worth seeing — plus one for tickets left without.
  const statuses = await prisma.status.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true, color: true },
  });

  const unset = tickets.filter((t) => !t.status).length;
  const byStatus = [
    ...statuses.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      count: tickets.filter((t) => t.status?.id === status.id).length,
    })),
    // The name is filled in by whoever draws it: "no status" is interface copy,
    // and this file does not know what language the desk speaks.
    ...(unset > 0 ? [{ id: "none", name: "", color: "var(--text-3)", count: unset }] : []),
  ];

  const byPriority = PRIORITY_ORDER.map((priority) => ({
    priority,
    count: open.filter((t) => t.priority === priority).length,
    breached: open.filter((t) => t.priority === priority && breached(t)).length,
  }));

  /* --------------------------------------------------------- workload -- */

  const workloadMap = new Map<
    string,
    { id: string | null; name: string; avatarVariant: number | null; open: number; overdue: number }
  >();
  for (const ticket of open) {
    // Keyed by id, so the unassigned pile is a row with no person rather than a
    // person named after an English word.
    const key = ticket.assigneeId ?? "none";
    const row = workloadMap.get(key) ?? {
      id: ticket.assigneeId,
      name: ticket.assignee?.name ?? "",
      avatarVariant: ticket.assignee?.avatarVariant ?? null,
      open: 0,
      overdue: 0,
    };
    row.open += 1;
    if (breached(ticket)) row.overdue += 1;
    workloadMap.set(key, row);
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open).slice(0, 6);

  /* -------------------------------------------------------- overviews -- */

  // The four piles an operator actually thinks in, each split by kind of work.
  // Counted over open tickets only: a closed ticket is not on anyone's plate.
  const byType = (list: typeof open) => ({
    QUESTION: list.filter((ticket) => ticket.type === "QUESTION").length,
    INCIDENT: list.filter((ticket) => ticket.type === "INCIDENT").length,
    CHANGE: list.filter((ticket) => ticket.type === "CHANGE").length,
    total: list.length,
  });

  const overviews = {
    mine: { ...byType(assignedToMe), project: projectCounts.mine },
    // Mine plus whatever landed on a desk I am on — the wider circle someone
    // covering for a colleague needs, without being the whole instance.
    team: {
      ...byType(
        open.filter(
          (ticket) =>
            ticket.assigneeId === user.id || (ticket.teamId && myTeamIds.has(ticket.teamId)),
        ),
      ),
      project: projectCounts.team,
    },
    all: { ...byType(open), project: projectCounts.all },
    unassigned: {
      ...byType(open.filter((ticket) => !ticket.assigneeId)),
      project: projectCounts.unassigned,
    },
  };

  /* ----------------------------------------------------------- ageing -- */

  // Bucketed here rather than in the chart: the boundaries are a statement
  // about the desk, not about the drawing.
  const ageing = AGE_BUCKETS.map((bucket, index) => {
    const from = index === 0 ? 0 : AGE_BUCKETS[index - 1]!.upToHours;
    const inBucket = open.filter((t) => {
      const age = ageHours(t);
      return age >= from && age < bucket.upToHours;
    });

    return {
      key: bucket.key,
      count: inBucket.length,
      breached: inBucket.filter(breached).length,
    };
  });

  /* ------------------------------------------------------- compliance -- */

  // Only what could actually breach counts. Questions and changes carry no
  // response target, so scoring them as "met" would flatter every figure here.
  const settled = tickets.filter((t) => isSettled(t.status) && hasResponseTarget(t.type));
  const withinTarget = settled.filter((t) => !breached(t)).length;
  const compliance = {
    withinTarget,
    total: settled.length,
    pct: settled.length ? Math.round((withinTarget / settled.length) * 100) : 100,
    byPriority: PRIORITY_ORDER.map((priority) => {
      const forPriority = settled.filter((t) => t.priority === priority);
      return {
        priority,
        met: forPriority.filter((t) => !breached(t)).length,
        total: forPriority.length,
      };
    }).filter((row) => row.total > 0),
  };

  /* ------------------------------------------------- time to resolve -- */

  // The median, not the mean: one ticket that sat over a holiday would drag an
  // average somewhere no ticket has ever been.
  const resolutionHours = tickets
    .filter((t) => t.resolvedAt)
    .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 36e5)
    .sort((a, b) => a - b);

  const medianResolutionHours =
    resolutionHours.length === 0 ? null : resolutionHours[Math.floor(resolutionHours.length / 2)]!;

  return {
    open: open.length,
    overdue: overdue.length,
    highPriority: highPriority.length,
    waitingOnMe: waitingOnMe.length,
    unassigned: unassigned.length,
    assignedToMe: assignedToMe.length,
    inProgress: inProgress.length,
    resolvedThisWeek,
    resolvedDelta: resolvedThisWeek - resolvedPrevWeek,
    total: tickets.length,
    overviews,
    hasTeam: myTeamIds.size > 0,
    volume,
    throughput,
    byCategory,
    untagged,
    byStatus,
    byPriority,
    ageing,
    workload,
    compliance,
    medianResolutionHours,
  };
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export type VolumePoint = { date: string; created: number; resolved: number };
export type StatusSlice = { id: string; name: string; color: string; count: number };
export type PrioritySlice = { priority: Priority; count: number; breached: number };

/* ------------------------------------------------------------ reply time -- */

/**
 * How long somebody waited for an answer.
 *
 * Measured from the conversation rather than from the status field. A wait
 * starts when a ticket is raised and again every time the requester writes
 * something; it ends at the next public reply from anyone else. That covers
 * both cases worth measuring — a new ticket nobody has answered, and a ticket
 * that came back to the desk — without depending on a status being named a
 * particular thing, or on the trail having recorded the move.
 *
 * Counted in working minutes, like every other clock in the app: a ticket that
 * arrived at 17:55 was not ignored for fifteen hours.
 *
 * Internal notes are excluded. A note the requester cannot read is not a reply
 * to them, and counting it would make every figure here flattering and wrong.
 */
export async function getReplyTimes(user: SessionUser, days = 30) {
  const since = new Date(Date.now() - (days - 1) * DAY);
  since.setHours(0, 0, 0, 0);

  const [tickets, clock] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...ticketVisibilityFilter(user), createdAt: { gte: since } },
      select: {
        createdAt: true,
        reporterId: true,
        comments: {
          where: { isInternal: false, stepId: null },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true, authorId: true },
        },
      },
    }),
    getClock(),
  ]);

  /** One answered wait: when it started, and how long it took to end. */
  const answered: { at: Date; minutes: number }[] = [];

  for (const ticket of tickets) {
    // Raising a ticket is itself a question, so the clock starts there.
    let waitingSince: Date | null = ticket.createdAt;

    for (const comment of ticket.comments) {
      const fromRequester = comment.authorId === ticket.reporterId;

      if (fromRequester) {
        // Two messages in a row from the requester are one wait, not two —
        // adding a detail does not reset how long they have been waiting.
        waitingSince ??= comment.createdAt;
        continue;
      }

      if (waitingSince) {
        answered.push({
          at: comment.createdAt,
          minutes: workingMinutesBetween(waitingSince, comment.createdAt, clock.hours),
        });
        waitingSince = null;
      }
    }
  }

  // Bucketed by the day the reply landed: this measures the desk answering, so
  // it belongs on the day the answer was given.
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < days; i += 1) {
    buckets.set(dayKey(new Date(since.getTime() + i * DAY)), []);
  }
  for (const reply of answered) {
    buckets.get(dayKey(reply.at))?.push(reply.minutes);
  }

  const series = [...buckets.entries()].map(([date, minutes]) => ({
    date,
    hours: minutes.length ? median(minutes) / 60 : null,
    replies: minutes.length,
  }));

  const all = answered.map((reply) => reply.minutes);

  return {
    series,
    // The median, not the mean: one ticket answered after a long weekend would
    // drag an average somewhere no requester has ever actually waited.
    medianHours: all.length ? median(all) / 60 : null,
    answered: all.length,
    waiting: tickets.filter((ticket) => {
      const last = ticket.comments.at(-1);
      return !last || last.authorId === ticket.reporterId;
    }).length,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export type ReplyTimes = Awaited<ReturnType<typeof getReplyTimes>>;
