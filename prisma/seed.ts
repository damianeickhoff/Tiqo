import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = "Tiqo!2345";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

/// A date a few weeks out, as an attribute stores one. Relative rather than
/// fixed so a seeded certificate is still about to expire next year, which is
/// the whole of what the expiry column is there to show.
const soonIso = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

type SeedComment = { authorId: string; body: string; isInternal?: boolean; ageHours: number };

type TicketSpec = {
  project: { id: string } | null;
  title: string;
  description: string;
  status:
    "status_open" | "status_in_progress" | "status_blocked" | "status_resolved" | "status_closed";
  type: "QUESTION" | "INCIDENT" | "CHANGE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  ageHours: number;
  reporterId: string;
  assigneeId: string | null;
  labels: string[];
  comments: SeedComment[];
  dueDate?: Date;
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const [admin, agent, requester] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@tiqo.local" },
      update: {},
      create: {
        email: "admin@tiqo.local",
        username: "admin",
        firstName: "Ada",
        lastName: "Admin",
        name: "Ada Admin",
        phone: "+31 6 1234 5678",
        company: "Tiqo",
        department: "IT",
        jobTitle: "Service desk manager",
        passwordHash,
        roleId: "role_admin",
      },
    }),
    prisma.user.upsert({
      where: { email: "agent@tiqo.local" },
      update: {},
      create: {
        email: "agent@tiqo.local",
        username: "agent",
        firstName: "Sam",
        lastName: "Support",
        name: "Sam Support",
        phone: "+31 6 2345 6789",
        company: "Tiqo",
        department: "IT",
        jobTitle: "Service desk operator",
        passwordHash,
        roleId: "role_operator",
      },
    }),
    prisma.user.upsert({
      where: { email: "user@tiqo.local" },
      update: {},
      create: {
        email: "user@tiqo.local",
        username: "user",
        firstName: "Rick",
        lastName: "Requester",
        name: "Rick Requester",
        phone: "+31 6 3456 7890",
        company: "Northwind Logistics",
        department: "Warehouse",
        jobTitle: "Shift lead",
        passwordHash,
        roleId: "role_requester",
      },
    }),
  ]);

  const support = await prisma.project.upsert({
    where: { key: "SUP" },
    update: {},
    create: {
      key: "SUP",
      name: "Service Desk",
      description: "First-line support for internal staff.",
      color: "#6366f1",
    },
  });

  const infra = await prisma.project.upsert({
    where: { key: "INF" },
    update: {},
    create: {
      key: "INF",
      name: "Infrastructure",
      description: "Servers, network and everything that hums in a rack.",
      color: "#14b8a6",
    },
  });

  // Tags are instance-wide, not owned by a project.
  const labelSpecs = [
    { name: "hardware", color: "#f59e0b" },
    { name: "account", color: "#8b5cf6" },
    { name: "how-to", color: "#0ea5e9" },
    { name: "network", color: "#14b8a6" },
    { name: "outage", color: "#ef4444" },
  ];

  const labels = await Promise.all(
    labelSpecs.map((spec) =>
      prisma.label.upsert({ where: { name: spec.name }, update: {}, create: spec }),
    ),
  );
  const labelByName = new Map(labels.map((l) => [l.name, l]));

  // `ageHours` backdates each ticket. Without it every seeded ticket is seconds
  // old, the heat spines all render empty, and the queue looks nothing like one.
  const ticketSpecs: TicketSpec[] = [
    {
      project: null,
      title: "Password reset link never arrives",
      type: "INCIDENT" as const,
      description: "Requested a reset three times this morning, nothing in the inbox or spam.",
      status: "status_open" as const,
      priority: "URGENT" as const,
      ageHours: 6,
      reporterId: requester.id,
      assigneeId: null,
      labels: ["account"],
      comments: [] as SeedComment[],
    },
    {
      project: infra,
      title: "Nightly backup job failed twice this week",
      type: "INCIDENT" as const,
      description:
        "Job exits with a timeout against the NAS target. No alert was raised either time.",
      status: "status_open" as const,
      priority: "HIGH" as const,
      ageHours: 19,
      reporterId: admin.id,
      assigneeId: agent.id,
      labels: ["outage"],
      comments: [
        {
          authorId: agent.id,
          body: "Target volume was at 98% both nights. Freeing space now and re-running by hand.",
          ageHours: 4,
        },
        {
          authorId: agent.id,
          body: "Alerting is misconfigured too — the job never had a failure hook. Separate ticket coming.",
          isInternal: true,
          ageHours: 3,
        },
      ],
    },
    {
      project: support,
      title: "Laptop will not connect to the docking station",
      type: "INCIDENT" as const,
      description:
        "Since the Windows update the external monitors stay black when docking. Undocking and replugging the USB-C cable works about one time in five.",
      status: "status_in_progress" as const,
      priority: "HIGH" as const,
      ageHours: 30,
      reporterId: requester.id,
      assigneeId: agent.id,
      labels: ["hardware"],
      comments: [
        {
          authorId: agent.id,
          body: "Can you tell me which dock model it is? There should be a sticker underneath.",
          ageHours: 26,
        },
        {
          authorId: requester.id,
          body: "It says WD19TB. Two colleagues on this floor have the same problem.",
          ageHours: 22,
        },
        {
          authorId: agent.id,
          body: "Batch of WD19TB docks from the March order — firmware 1.0.7. Do not mention the recall to the requester until procurement confirms.",
          isInternal: true,
          ageHours: 6,
        },
        {
          authorId: agent.id,
          body: "Known firmware issue on that batch. Rolling out the update floor-wide tomorrow morning.",
          ageHours: 5,
        },
      ],
    },
    {
      project: infra,
      title: "Wi-Fi drops on the second floor around 14:00",
      type: "INCIDENT" as const,
      description:
        "Reproducible most afternoons. Access point AP-2F-03 shows a client count spike right before the drop.",
      status: "status_blocked" as const,
      priority: "MEDIUM" as const,
      ageHours: 96,
      reporterId: agent.id,
      assigneeId: admin.id,
      labels: ["network"],
      comments: [
        {
          authorId: admin.id,
          body: "Waiting on the vendor to confirm whether the controller firmware is the cause. Blocked until they answer.",
          ageHours: 40,
        },
      ],
    },
    {
      project: null,
      title: "Shared mailbox missing from Outlook after the migration",
      type: "CHANGE" as const,
      dueDate: new Date(Date.now() + 3 * 86_400_000),
      description:
        "The Finance shared mailbox no longer appears for three people on the team. It is still visible in the web client.",
      status: "status_open" as const,
      priority: "MEDIUM" as const,
      ageHours: 52,
      reporterId: requester.id,
      assigneeId: null,
      labels: ["account"],
      comments: [],
    },
    {
      project: infra,
      title: "Rack B switch running hot",
      type: "INCIDENT" as const,
      description: "Inlet temperature has been above 34°C for two days. The rear fan sounds wrong.",
      status: "status_in_progress" as const,
      priority: "URGENT" as const,
      ageHours: 3,
      reporterId: admin.id,
      assigneeId: admin.id,
      labels: ["outage"],
      comments: [],
    },
    {
      project: null,
      title: "How do I share a calendar with an external guest?",
      type: "QUESTION" as const,
      description: "Need to give a supplier read access to the project calendar.",
      status: "status_resolved" as const,
      priority: "LOW" as const,
      ageHours: 200,
      reporterId: requester.id,
      assigneeId: agent.id,
      labels: ["how-to"],
      comments: [
        {
          authorId: agent.id,
          body: "Open the calendar, Sharing and permissions, then add their address with 'Can view all details'.",
          ageHours: 190,
        },
      ],
    },
    {
      project: null,
      title: "Second monitor flickers on the loan laptop",
      type: "QUESTION" as const,
      description: "Only on the loan unit, and only with the HDMI cable. DisplayPort is fine.",
      status: "status_closed" as const,
      priority: "LOW" as const,
      ageHours: 340,
      reporterId: requester.id,
      assigneeId: agent.id,
      labels: ["hardware"],
      comments: [],
    },
  ];

  for (const spec of ticketSpecs) {
    const existing = await prisma.ticket.findFirst({ where: { title: spec.title } });
    if (existing) continue;

    const counter = await prisma.counter.upsert({
      where: { id: "ticket" },
      update: { value: { increment: 1 } },
      create: { id: "ticket", value: 1 },
    });
    const number = counter.value;
    const createdAt = hoursAgo(spec.ageHours);

    const period = `${String(createdAt.getFullYear() % 100).padStart(2, "0")}${String(
      createdAt.getMonth() + 1,
    ).padStart(2, "0")}`;
    const prefix = spec.type === "INCIDENT" ? "INC" : spec.type === "QUESTION" ? "QST" : "CHG";
    const bucket = await prisma.counter.upsert({
      where: { id: `ticket:${prefix}:${period}` },
      update: { value: { increment: 1 } },
      create: { id: `ticket:${prefix}:${period}`, value: 1 },
    });
    const settledAt =
      spec.status === "status_resolved" || spec.status === "status_closed"
        ? hoursAgo(Math.max(1, Math.round(spec.ageHours * 0.2)))
        : null;

    await prisma.ticket.create({
      data: {
        number,
        reference: `${prefix}-${period} ${String(bucket.value).padStart(4, "0")}`,
        title: spec.title,
        description: spec.description,
        statusId: spec.status,
        priority: spec.priority,
        type: spec.type,
        // Most tickets stand alone; only some belong to a project.
        projectId: spec.project?.id ?? null,
        reporterId: spec.reporterId,
        createdById: spec.reporterId,
        assigneeId: spec.assigneeId,
        createdAt,
        dueDate: spec.dueDate ?? null,
        resolvedAt: settledAt,
        closedAt: spec.status === "status_closed" ? settledAt : null,
        labels: {
          connect: spec.labels.map((name) => ({ id: labelByName.get(name)!.id })),
        },
        activities: {
          create: { type: "CREATED", actorId: spec.reporterId, createdAt },
        },
        comments: {
          create: (spec.comments as SeedComment[]).map((comment) => ({
            authorId: comment.authorId,
            body: comment.body,
            isInternal: comment.isInternal ?? false,
            createdAt: hoursAgo(comment.ageHours),
          })),
        },
      },
    });
  }

  /* ------------------------------------------------------------------ cmdb -- */

  /**
   * Three types, because the register is invisible without any and because
   * these three are the argument for typed attributes: a laptop has a serial,
   * a certificate has an expiry, a licence has a seat count, and one table of
   * nullable columns covering all three is a table nobody can query.
   */
  const CI_TYPES = [
    {
      key: "hardware",
      name: "Hardware",
      icon: "Laptop",
      color: "#febe2e",
      fields: [
        { key: "serial", label: "Serial number", kind: "TEXT" as const, required: true },
        { key: "model", label: "Model", kind: "TEXT" as const },
        {
          key: "form_factor",
          label: "Form factor",
          kind: "CHOICE" as const,
          options: ["Laptop", "Desktop", "Server", "Phone", "Printer", "Network"],
        },
        { key: "purchased", label: "Purchased", kind: "DATE" as const },
        { key: "warranty_until", label: "Warranty until", kind: "DATE" as const, isExpiry: true },
      ],
    },
    {
      key: "certificate",
      name: "Certificate",
      icon: "ShieldCheck",
      color: "#6aa9ff",
      fields: [
        { key: "common_name", label: "Common name", kind: "TEXT" as const, required: true },
        { key: "issuer", label: "Issuer", kind: "TEXT" as const },
        { key: "expires", label: "Expires", kind: "DATE" as const, required: true, isExpiry: true },
        { key: "wildcard", label: "Wildcard", kind: "BOOLEAN" as const },
      ],
    },
    {
      key: "licence",
      name: "Licence",
      icon: "KeyRound",
      color: "#7bd88f",
      fields: [
        { key: "vendor", label: "Vendor", kind: "TEXT" as const, required: true },
        { key: "seats", label: "Seats", kind: "NUMBER" as const },
        { key: "renews", label: "Renews", kind: "DATE" as const, isExpiry: true },
        {
          key: "billing",
          label: "Billing",
          kind: "CHOICE" as const,
          options: ["Monthly", "Yearly", "Perpetual"],
        },
      ],
    },
  ];

  for (const [position, spec] of CI_TYPES.entries()) {
    const { fields, ...type } = spec;
    await prisma.ciType.upsert({
      where: { key: type.key },
      update: {},
      create: {
        ...type,
        position,
        fields: {
          create: fields.map((field, index) => ({
            ...field,
            options: "options" in field ? field.options : [],
            required: "required" in field ? field.required : false,
            isExpiry: "isExpiry" in field ? field.isExpiry : false,
            position: index,
          })),
        },
      },
    });
  }

  const hardware = await prisma.ciType.findUniqueOrThrow({ where: { key: "hardware" } });
  const certificate = await prisma.ciType.findUniqueOrThrow({ where: { key: "certificate" } });
  const licence = await prisma.ciType.findUniqueOrThrow({ where: { key: "licence" } });

  /// Enough of an estate to show the register doing its job: two machines that
  /// depend on one another, a certificate that sits on one of them, and a
  /// licence nobody would otherwise remember renewing.
  const CI_ITEMS = [
    {
      key: "srv-app-01",
      name: "SRV-APP-01",
      typeId: hardware.id,
      attributes: {
        serial: "5CG2140XYZ",
        model: "HPE ProLiant DL360",
        form_factor: "Server",
        purchased: "2024-03-11",
        warranty_until: "2027-03-11",
      },
    },
    {
      key: "srv-db-01",
      name: "SRV-DB-01",
      typeId: hardware.id,
      attributes: {
        serial: "5CG2140ABC",
        model: "HPE ProLiant DL380",
        form_factor: "Server",
        purchased: "2024-03-11",
        warranty_until: "2027-03-11",
      },
    },
    {
      key: "lt-ada",
      name: "LT-ADA",
      typeId: hardware.id,
      attributes: {
        serial: "PF3RJ8K2",
        model: "ThinkPad X1 Carbon",
        form_factor: "Laptop",
        purchased: "2025-01-20",
        warranty_until: "2028-01-20",
      },
    },
    {
      key: "star-tiqo-it",
      name: "*.tiqo.it",
      typeId: certificate.id,
      attributes: {
        common_name: "*.tiqo.it",
        issuer: "Let's Encrypt",
        expires: "2026-12-01",
        wildcard: true,
      },
    },
    {
      key: "m365-e3",
      name: "Microsoft 365 E3",
      typeId: licence.id,
      attributes: { vendor: "Microsoft", seats: 120, renews: "2027-01-01", billing: "Yearly" },
    },
    // Enough of the rest of an estate that the register reads as a register:
    // a type filter with one row in it, a lifecycle column where everything
    // says the same thing, and a search box with nothing to find are all ways
    // of not being able to tell whether the feature works.
    {
      key: "sw-rack-b",
      name: "SW-RACK-B",
      typeId: hardware.id,
      attributes: {
        serial: "FDO2318X0AB",
        model: "Catalyst 9300",
        form_factor: "Network",
        purchased: "2023-06-02",
        warranty_until: "2026-06-02",
      },
    },
    {
      key: "lt-sam",
      name: "LT-SAM",
      typeId: hardware.id,
      attributes: {
        serial: "PF41NN09",
        model: "ThinkPad T14",
        form_factor: "Laptop",
        purchased: "2024-09-30",
        warranty_until: "2027-09-30",
      },
    },
    {
      key: "lt-loan-02",
      name: "LT-LOAN-02",
      typeId: hardware.id,
      lifecycle: "MAINTENANCE" as const,
      attributes: {
        serial: "PF2BB741",
        model: "ThinkPad L14",
        form_factor: "Laptop",
        purchased: "2022-02-14",
        warranty_until: "2025-02-14",
      },
    },
    {
      key: "prn-2f",
      name: "PRN-2F",
      typeId: hardware.id,
      attributes: {
        serial: "CN8CK2M0P1",
        model: "HP LaserJet M507",
        form_factor: "Printer",
        purchased: "2023-11-08",
        warranty_until: "2026-11-08",
      },
    },
    {
      key: "srv-mail-01",
      name: "SRV-MAIL-01",
      typeId: hardware.id,
      lifecycle: "RETIRED" as const,
      attributes: {
        serial: "5CG1907QQZ",
        model: "Dell PowerEdge R640",
        form_factor: "Server",
        purchased: "2019-04-22",
        warranty_until: "2024-04-22",
      },
    },
    {
      key: "vpn-tiqo-it",
      name: "vpn.tiqo.it",
      typeId: certificate.id,
      attributes: {
        common_name: "vpn.tiqo.it",
        issuer: "DigiCert",
        // Inside the month on purpose: it is what an expiry column is for.
        expires: soonIso(21),
        wildcard: false,
      },
    },
    {
      key: "adobe-cc",
      name: "Adobe Creative Cloud",
      typeId: licence.id,
      attributes: { vendor: "Adobe", seats: 6, renews: soonIso(26), billing: "Monthly" },
    },
    {
      key: "atlassian-jsm",
      name: "Atlassian JSM",
      typeId: licence.id,
      lifecycle: "RETIRED" as const,
      attributes: { vendor: "Atlassian", seats: 15, renews: "2026-04-30", billing: "Yearly" },
    },
  ];

  const items = new Map<string, string>();
  for (const spec of CI_ITEMS) {
    const { key, ...data } = spec;
    const item = await prisma.configurationItem.upsert({
      where: { externalSource_externalId: { externalSource: "seed", externalId: key } },
      update: {},
      create: { ...data, externalSource: "seed", externalId: key },
      select: { id: true },
    });
    items.set(key, item.id);
  }

  const CI_RELATIONS = [
    { source: "srv-app-01", target: "srv-db-01", kind: "DEPENDS_ON" as const },
    { source: "star-tiqo-it", target: "srv-app-01", kind: "RUNS_ON" as const },
  ];

  for (const relation of CI_RELATIONS) {
    const sourceId = items.get(relation.source)!;
    const targetId = items.get(relation.target)!;
    await prisma.ciRelation.upsert({
      where: {
        sourceId_targetId_kind: { sourceId, targetId, kind: relation.kind },
      },
      update: {},
      create: { sourceId, targetId, kind: relation.kind },
    });
  }

  /**
   * What the register is actually for: three incidents against one server.
   *
   * A register of serial numbers is a spreadsheet. A serial number with three
   * open incidents against it is the answer to "why does this keep happening",
   * and the count on the register row is the only place anybody would see it —
   * so there has to be something to count.
   */
  const TICKET_ASSETS: { title: string; item: string }[] = [
    { title: "Rack B switch running hot", item: "srv-app-01" },
    { title: "Nightly backup job failed twice this week", item: "srv-app-01" },
    { title: "Wi-Fi drops on the second floor around 14:00", item: "srv-app-01" },
    { title: "Laptop will not connect to the docking station", item: "lt-loan-02" },
    { title: "Shared mailbox missing from Outlook after the migration", item: "srv-mail-01" },
  ];

  for (const spec of TICKET_ASSETS) {
    const ticket = await prisma.ticket.findFirst({
      where: { title: spec.title },
      select: { id: true },
    });
    const itemId = items.get(spec.item);
    if (!ticket || !itemId) continue;

    await prisma.ticketCi.upsert({
      where: { ticketId_itemId: { ticketId: ticket.id, itemId } },
      update: {},
      create: { ticketId: ticket.id, itemId },
    });
  }

  /**
   * Two links, because a Links card that is empty on every ticket says nothing
   * about what links are for — and the blocked marker on the queue cannot be
   * seen at all until something is blocking something.
   */
  const TICKET_LINKS = [
    {
      source: "Rack B switch running hot",
      target: "Wi-Fi drops on the second floor around 14:00",
      kind: "BLOCKS" as const,
    },
    {
      source: "Nightly backup job failed twice this week",
      target: "Rack B switch running hot",
      kind: "CAUSED_BY" as const,
    },
  ];

  for (const spec of TICKET_LINKS) {
    const [source, target] = await Promise.all([
      prisma.ticket.findFirst({ where: { title: spec.source }, select: { id: true } }),
      prisma.ticket.findFirst({ where: { title: spec.target }, select: { id: true } }),
    ]);
    if (!source || !target) continue;

    await prisma.ticketLink.upsert({
      where: {
        sourceId_targetId_kind: { sourceId: source.id, targetId: target.id, kind: spec.kind },
      },
      update: {},
      create: { sourceId: source.id, targetId: target.id, kind: spec.kind },
    });
  }

  /* ------------------------------------------------------------------ docs -- */

  // Two shelves and a short tree, because an empty documentation section says
  // nothing about what it is for — and the one page that has already gone stale
  // is what shows the review marker doing its job.
  const opsSpace = await prisma.docSpace.upsert({
    where: { key: "OPS" },
    update: {},
    create: {
      key: "OPS",
      name: "Operations",
      description: "Runbooks for the things that break, and what to do at two in the morning.",
      color: "#14b8a6",
      position: 0,
    },
  });

  const deskSpace = await prisma.docSpace.upsert({
    where: { key: "DESK" },
    update: {},
    create: {
      key: "DESK",
      name: "How the desk works",
      description: "Procedures, standing arrangements and the things nobody writes down.",
      color: "#febe2e",
      position: 1,
    },
  });

  type DocSpec = {
    slug: string;
    spaceId: string;
    parent?: string;
    title: string;
    summary: string;
    body: string;
    ownerId: string;
    reviewDays?: number;
    /// Days ago the content was last confirmed. Past the interval and the page
    /// shows as stale, which is the state worth having an example of.
    confirmedDaysAgo?: number;
  };

  const docSpecs: DocSpec[] = [
    {
      slug: "vpn-concentrator",
      spaceId: opsSpace.id,
      title: "The VPN concentrator",
      summary: "What it is, where it is, and what to do when it stops answering.",
      ownerId: agent.id,
      reviewDays: 90,
      confirmedDaysAgo: 12,
      body: [
        "The concentrator terminates every remote session for staff and for the two",
        "suppliers with standing access. It is the single point of failure nobody has",
        "got round to removing, so it is the first thing to check when several people",
        "report the same thing at once.",
        "",
        "## Where it is",
        "",
        "Rack 4, top unit. Management is on the out-of-band network only — the",
        "management address is **not** reachable from the office LAN, which is",
        "deliberate and catches somebody about once a year.",
        "",
        "## When it stops answering",
        "",
        "1. Check whether the office itself is affected — if only remote sessions are down, it is almost always the concentrator.",
        "2. Open a session on the out-of-band jump host.",
        "3. Read the tunnel count. Under twenty on a weekday morning means sessions are being dropped rather than refused.",
        "4. If the count is climbing again on its own, wait five minutes before doing anything else — restarting during recovery costs another twenty minutes.",
        "",
        "Restarting is in [Restarting the concentrator](/docs/OPS/restarting-the-concentrator).",
      ].join("\n"),
    },
    {
      slug: "restarting-the-concentrator",
      spaceId: opsSpace.id,
      parent: "vpn-concentrator",
      title: "Restarting the concentrator",
      summary: "The last resort, and the two things to do before it and after it.",
      ownerId: agent.id,
      reviewDays: 90,
      confirmedDaysAgo: 12,
      body: [
        "> Everybody's session drops. Say so first, in the ticket and on the notice",
        "> board, or the desk takes forty calls about something it did on purpose.",
        "",
        "1. Announce it. A one-line notice is enough.",
        "2. `system restart` from the management console. It takes about ninety seconds.",
        "3. Watch the tunnel count come back. If it is still under twenty after five minutes, the problem was never the concentrator.",
        "4. Say it is done, in the same two places.",
      ].join("\n"),
    },
    {
      slug: "nightly-backups",
      spaceId: opsSpace.id,
      title: "Nightly backups",
      summary: "What runs, where it writes, and what a failure actually means.",
      ownerId: admin.id,
      reviewDays: 30,
      // Older than its own interval: this is the page that shows as stale.
      confirmedDaysAgo: 210,
      body: [
        "Three jobs run between 01:00 and 04:00. Two of them write to the NAS and one",
        "writes offsite. A failure on the offsite job is the one that matters — the NAS",
        "copies are a convenience, the offsite copy is the actual backup.",
        "",
        "## The jobs",
        "",
        "- **01:00** file shares, to the NAS.",
        "- **02:00** databases, to the NAS.",
        "- **03:00** offsite sync. This is the one that matters.",
        "",
        "## When one fails",
        "",
        "- Check free space on the target first. It is the cause more often than everything else put together.",
        "- Re-run by hand before raising anything: a job that succeeds on a re-run is worth a note, not a ticket.",
        "- Two failures in a week is a ticket, whatever the cause.",
      ].join("\n"),
    },
    {
      slug: "out-of-hours",
      spaceId: deskSpace.id,
      title: "Out of hours",
      summary: "Who is reachable after six, and what is worth reaching them for.",
      ownerId: admin.id,
      reviewDays: 180,
      confirmedDaysAgo: 20,
      body: [
        "The desk is open 08:30–17:30 on weekdays. Outside that there is one person on",
        "call, and the list is on the wall by the kettle as well as here.",
        "",
        "## What is worth a call",
        "",
        "- Anything that stops a shift working — the scanners, the VPN, the phone system.",
        "- A suspected compromise, at any hour, without hesitating.",
        "",
        "## What is not",
        "",
        "- A single person who cannot get into something they do not need until morning.",
        "- Anything a note in the ticket answers just as well.",
      ].join("\n"),
    },
    {
      slug: "supplier-northwind",
      spaceId: deskSpace.id,
      title: "Standing arrangement: Northwind",
      summary: "What they do for us, who to ask, and the response times we actually have.",
      ownerId: admin.id,
      reviewDays: 365,
      confirmedDaysAgo: 40,
      body: [
        "Northwind maintain the warehouse scanners and the label printers. They do not",
        "touch anything else, whatever the person on the phone offers.",
        "",
        "Their response target is four working hours for a stopped line and next",
        "working day for everything else. Quote the site name, not the contract",
        "number — their own desk searches by site.",
      ].join("\n"),
    },
  ];

  const docIds = new Map<string, string>();
  for (const spec of docSpecs) {
    const { slug, spaceId, parent, confirmedDaysAgo, ...rest } = spec;
    const doc = await prisma.doc.upsert({
      where: { spaceId_slug: { spaceId, slug } },
      update: {},
      create: {
        ...rest,
        slug,
        spaceId,
        parentId: parent ? (docIds.get(parent) ?? null) : null,
        position: docIds.size,
        createdById: rest.ownerId,
        updatedById: rest.ownerId,
        reviewedAt: new Date(Date.now() - (confirmedDaysAgo ?? 1) * 86_400_000),
      },
      select: { id: true },
    });
    docIds.set(slug, doc.id);
  }

  // One page with a history, so the History panel has something in it on a
  // fresh instance — a feature that only appears after somebody uses it twice
  // is a feature nobody finds.
  const backups = docIds.get("nightly-backups")!;
  if ((await prisma.docRevision.count({ where: { docId: backups } })) === 0) {
    await prisma.docRevision.create({
      data: {
        docId: backups,
        title: "Nightly backups",
        body: "Three jobs run overnight. Check free space on the target when one fails.",
        note: "Listed the jobs and named the offsite copy",
        authorId: agent.id,
        createdAt: hoursAgo(24 * 30),
      },
    });
  }

  console.log(`Seeded. Sign in with any of:
  admin@tiqo.local  (ADMIN)
  agent@tiqo.local  (AGENT)
  user@tiqo.local   (REQUESTER)
Password for all three: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
