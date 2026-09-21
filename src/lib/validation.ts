import { z } from "zod";
import { note, translate, type Messages } from "@/lib/i18n";

/**
 * A schema is built once, at import; the language is only known per request. So
 * every message here is a `note(...)` naming a sentence rather than the sentence
 * itself, and `fieldErrors` writes it out in whatever language the desk runs in.
 */

export const emailSchema = z.email(note("notEmail")).trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(10, note("passwordShort"))
  .max(200, note("tooLong", 200));

const firstNameField = z
  .string()
  .trim()
  .min(1, note("enterFirstName"))
  .max(60, note("tooLong", 60));

const lastNameField = z.string().trim().min(1, note("enterLastName")).max(60, note("tooLong", 60));

export const registerSchema = z.object({
  firstName: firstNameField,
  lastName: lastNameField,
  email: emailSchema,
  password: passwordSchema,
});

/** An optional directory field: blank in the form means "not set", never "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, note("tooLong", max))
    .nullable()
    .default(null)
    .transform((value) => value || null);

const hexColour = (example = false) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, note(example ? "hexColourExample" : "hexColour"));

/**
 * Everything a profile holds. Which of these a given editor may actually send
 * is decided by `profileAccess` — the schema only says what a valid value is.
 */
export const profileSchema = z.object({
  firstName: firstNameField,
  lastName: lastNameField,
  email: emailSchema,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, note("usernameShort"))
    .max(30, note("tooLong", 30))
    .regex(/^[a-z0-9._-]+$/, note("usernameChars")),
  phone: optionalText(30),
  company: optionalText(80),
  department: optionalText(80),
  jobTitle: optionalText(80),
});

/** What someone may change about themselves without help. */
export const contactSchema = profileSchema.pick({ email: true, phone: true });

/**
 * A new account. The username is derived from the address rather than asked
 * for — one less thing to invent when someone is being added in a hurry — and
 * the role is checked against the creator's own in the action, not here.
 */
export const newUserSchema = profileSchema.omit({ username: true }).extend({
  roleId: z.string().min(1, note("pickRole")),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, note("enterPassword")),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, note("titleShort")).max(160),
  description: z.string().trim().max(10_000).default(""),
  /// Optional: a ticket may be filed against a project, or stand on its own.
  /// An empty value means "none", never an id of "".
  projectId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  type: z.enum(["QUESTION", "INCIDENT", "CHANGE"]).default("QUESTION"),
  /// Who the ticket is for. Agents may raise one on someone else's behalf;
  /// null means "me", which is the only option a requester has.
  reporterId: z.string().nullable().default(null),
  assigneeId: z.string().nullable().default(null),
  labelIds: z.array(z.string()).default([]),
  dueDate: z.coerce.date().nullable().default(null),
  /// The plan a change follows. Required for a change when the desk has any —
  /// checked in the action, which is the only place that knows whether it does.
  planId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// The dated point in the project it is filed against, if the project has any.
  milestoneId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(10_000).optional(),
  statusId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  type: z.enum(["QUESTION", "INCIDENT", "CHANGE"]).optional(),
  projectId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

/**
 * Asking for a decision. One person by name rather than a group or a role: a
 * decision somebody has to be accountable for is one person's to make, and
 * "who has not answered yet" is only answerable of a name.
 */
export const approvalSchema = z.object({
  /// The plan phase this gates, by name. Empty means the whole ticket waits.
  phase: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// Required when a person asks. A name and a date are not something anybody
  /// can answer with, and "the Deploy phase" is a label, not a question. The
  /// sign-offs a plan lays down fill this in from the gate they hold, which is
  /// why the column itself is still nullable.
  question: z.string().trim().min(1, note("writeQuestion")).max(1000, note("tooLong", 1000)),
  dueAt: z.coerce.date().nullable().default(null),
  approverId: z.string().min(1, note("pickApprover")),
});

export const ticketLinkSchema = z.object({
  targetId: z.string().min(1, note("pickLinkTarget")),
  kind: z.enum(["RELATES_TO", "DUPLICATES", "BLOCKS", "CAUSED_BY", "PARENT_OF"]),
});

/* -------------------------------------------------------------------- cmdb -- */

/// Lowercase and stable: the key is what a CSV import matches a column to, so it
/// has to survive the label being reworded.
const ciKeyField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, note("ciKeyShort"))
  .max(30, note("tooLong", 30))
  .regex(/^[a-z][a-z0-9_]*$/, note("ciKeyChars"));

export const ciTypeSchema = z.object({
  key: ciKeyField,
  name: z.string().trim().min(1, note("nameCiType")).max(60, note("tooLong", 60)),
  icon: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .default(null)
    .transform((value) => value || null),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, note("hexColourExample")),
});

export const ciTypeFieldSchema = z.object({
  key: ciKeyField,
  label: z.string().trim().min(1, note("labelCiField")).max(60, note("tooLong", 60)),
  kind: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "CHOICE", "USER", "ITEM"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1)).max(40).default([]),
  /// Only ever true of a DATE. The action clears it for every other kind rather
  /// than refusing, because changing a date to a text field is an edit somebody
  /// meant and a refusal for a flag they cannot see is not an answer.
  isExpiry: z.boolean().default(false),
});

/**
 * The whole of a type, as one designer saves it.
 *
 * The type and its attributes travel together because they are described
 * together — deciding a laptop records a serial number and deciding what to call
 * that field is one afternoon's thought, and two Saves for it is two ways to
 * leave it half done.
 */
export const ciTypeDesignSchema = ciTypeSchema.extend({
  defaultColumns: z.array(z.string().trim().min(1)).max(30).default([]),
  /// A regex, kept as somebody typed it. Checked for being a regex at all in the
  /// action, where the message can name it.
  namePattern: z
    .string()
    .trim()
    .max(200, note("tooLong", 200))
    .nullable()
    .default(null)
    .transform((value) => value || null),
  fields: z
    .array(ciTypeFieldSchema.extend({ id: z.string().min(1) }))
    .max(60)
    .default([]),
});

export const ciItemSchema = z.object({
  name: z.string().trim().min(1, note("nameCi")).max(120, note("tooLong", 120)),
  typeId: z.string().min(1, note("pickCiType")),
  lifecycle: z.enum(["PLANNED", "IN_SERVICE", "MAINTENANCE", "RETIRED"]).default("IN_SERVICE"),
  teamId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// Checked against the type's own fields in the action, not here: a schema
  /// built once at import cannot know what a laptop records.
  attributes: z.record(z.string(), z.unknown()).default({}),
});

/**
 * A change made to several assets at once.
 *
 * Both halves optional and told apart by absence rather than by emptiness: no
 * lifecycle means "leave it alone", where an empty team means "nobody operates
 * these" — which is a change somebody may well want to make.
 */
export const ciBulkSchema = z.object({
  lifecycle: z.enum(["PLANNED", "IN_SERVICE", "MAINTENANCE", "RETIRED"]).optional(),
  teamId: z.string().nullable().optional(),
});

/// What each CSV column becomes. `attr:<key>` points at one of the type's own
/// attributes; the rest are the columns every item has.
const importTargetSchema = z.union([
  z.enum(["ignore", "name", "externalId", "lifecycle", "team"]),
  z.string().regex(/^attr:[a-z][a-z0-9_]*$/),
]);

export const ciImportSchema = z.object({
  typeId: z.string().min(1, note("pickCiType")),
  /// Where this file came from, and half of what makes a re-run an update
  /// rather than a second copy of the estate.
  source: z.string().trim().min(1, note("nameImportSource")).max(60, note("tooLong", 60)),
  text: z.string().min(1, note("noCsvRows")).max(8_000_000),
  delimiter: z.string().min(1).max(1),
  hasHeader: z.boolean().default(true),
  mapping: z.array(importTargetSchema).max(200),
});

export const ciRelationSchema = z.object({
  targetId: z.string().min(1, note("pickCiTarget")),
  kind: z.enum(["DEPENDS_ON", "CONNECTS_TO", "RUNS_ON", "PART_OF"]),
});

/* -------------------------------------------------------------------- docs -- */

/// The shelf's short name, and the first segment of every URL under it. Upper
/// case because it is read as a code beside a document's own name — the same
/// shape as a project key, for the same reason.
const spaceKeyField = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, note("spaceKeyLength"))
  .max(8, note("spaceKeyLength"))
  .regex(/^[A-Z][A-Z0-9]*$/, note("spaceKeyChars"));

export const docSpaceSchema = z.object({
  key: spaceKeyField,
  name: z.string().trim().min(1, note("nameSpace")).max(60, note("tooLong", 60)),
  description: z
    .string()
    .trim()
    .max(200, note("tooLong", 200))
    .nullable()
    .default(null)
    .transform((value) => value || null),
  color: hexColour(true),
  teamId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// What a new page on this shelf starts with. Same range as a page's own:
  /// zero is "does not go stale", and five years is where reviewing stops
  /// meaning anything.
  reviewDays: z.coerce
    .number()
    .int()
    .min(0, note("reviewDaysRange"))
    .max(1825, note("reviewDaysRange"))
    .default(180),
  portalCategoryId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

/**
 * One saved edit. The note is what the revision is labelled with in the
 * history, and is allowed to be empty: most edits explain themselves, and
 * making it required only produces a list of rows that all say "update".
 */
export const docSchema = z.object({
  title: z.string().trim().min(1, note("nameDoc")).max(160, note("tooLong", 160)),
  summary: z
    .string()
    .trim()
    .max(240, note("tooLong", 240))
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// Line endings are normalised on the way in. A form submits text with CRLF
  /// endings whatever was typed into it, so without this, opening a page and
  /// pressing Save with nothing changed rewrites every line of it — and writes
  /// a revision saying somebody changed something.
  body: z
    .string()
    .max(100_000)
    .default("")
    .transform((value) => value.replace(/\r\n?/g, "\n")),
  note: z
    .string()
    .trim()
    .max(120, note("tooLong", 120))
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

/// Who answers for a document and how long it may go untouched. Separate from
/// the body because it is a different decision made by a different person at a
/// different time — and because saving it must not write a revision.
export const docCareSchema = z.object({
  ownerId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// Zero means "does not go stale". Capped at five years, past which nobody is
  /// reviewing anything and the honest answer is zero.
  reviewDays: z.coerce
    .number()
    .int()
    .min(0, note("reviewDaysRange"))
    .max(1825, note("reviewDaysRange")),
  parentId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  /// The shelf it stands on. Optional in the shape so a caller that is only
  /// changing the owner does not have to know where the page lives.
  spaceId: z.string().optional(),
});

/// What a document becomes on the portal. The category is picked at publish
/// time rather than stored on the document: a document is filed in a space, and
/// the catalogue is a different filing system with a different audience.
/**
 * How the desk chases a review. Both intervals allow zero, which is how each
 * half is turned off: no warning before the date, and no repeat after it.
 */
export const docDefaultsSchema = z.object({
  remindDays: z.coerce.number().int().min(0).max(90),
  remindEveryDays: z.coerce.number().int().min(0).max(365),
  escalateToTeam: z.boolean(),
  editCountsAsReview: z.boolean(),
});

export const docPublishSchema = z.object({
  categoryId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
  isPublished: z.boolean().default(true),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, note("writeSomething")).max(10_000),
  isInternal: z.boolean().default(false),
});

/* ---------------------------------------------------------------- settings -- */

export const brandSchema = z.object({
  brandColor: hexColour(true),
});

/// The locales the desk can be run in. A closed list rather than free text:
/// every one of these has to have dates, numbers and eventually strings that
/// somebody has actually checked.
export const LOCALES = [
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "nl-NL", label: "Nederlands" },
] as const;

/**
 * How dates are written, independently of what the interface speaks. Named by
 * what they look like rather than by their locale tag: nobody picking a date
 * format is thinking "sv-SE", they are thinking "2026-09-09".
 */
export const DATE_FORMATS = [
  { value: "", label: "Follow the language" },
  { value: "en-GB", label: "9 September 2026 · 09/09/2026" },
  { value: "en-US", label: "September 9, 2026 · 9/9/2026" },
  { value: "sv-SE", label: "2026-09-09" },
  { value: "de-DE", label: "9. September 2026 · 09.09.2026" },
] as const;

export const localeSchema = z.object({
  locale: z.enum(LOCALES.map((locale) => locale.value) as [string, ...string[]]),
  dateLocale: z.enum(DATE_FORMATS.map((row) => row.value) as [string, ...string[]]),
});

export const ticketDefaultsSchema = z.object({
  defaultType: z.enum(["QUESTION", "INCIDENT", "CHANGE"]),
  defaultPriority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  defaultProjectId: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

/// Hours, not minutes: a response target finer than an hour is a promise no
/// desk keeps, and the ceiling is a month.
const targetHours = z.coerce
  .number()
  .int(note("wholeHours"))
  .min(1, note("atLeastAnHour"))
  .max(720, note("longerThanMonth"));

export const priorityTargetsSchema = z.object({
  URGENT: targetHours,
  HIGH: targetHours,
  MEDIUM: targetHours,
  LOW: targetHours,
});

export const tagSchema = z.object({
  name: z.string().trim().min(1, note("nameTag")).max(30, note("tooLong", 30)),
  color: hexColour(),
});

export const businessHoursSchema = z
  .object({
    businessHours: z.boolean().default(false),
    businessDays: z.array(z.coerce.number().int().min(1).max(7)).default([]),
    businessStart: z.coerce.number().int().min(0).max(1440),
    businessEnd: z.coerce.number().int().min(0).max(1440),
    timeZone: z.string().trim().min(1),
  })
  // Only checked when the hours are actually in force: someone turning them off
  // should not have to fix the times first.
  .refine((value) => !value.businessHours || value.businessEnd > value.businessStart, {
    message: note("closingAfterOpening"),
    path: ["businessEnd"],
  })
  .refine((value) => !value.businessHours || value.businessDays.length > 0, {
    message: note("pickOpenDay"),
    path: ["businessDays"],
  });

/* ------------------------------------------------------------------- mail -- */

/// A host as somebody types it off a hosting panel — no scheme, no path. Not
/// pattern-checked beyond that: the only real test of a mail host is connecting
/// to it, which the Test button does.
const mailHost = optionalText(200);

/// Any port a mail server is plausibly on. A closed list would be wrong the
/// first time somebody runs a relay on 2525.
const mailPort = z.coerce
  .number()
  .int(note("badPort"))
  .min(1, note("badPort"))
  .max(65535, note("badPort"));

/// Blank is "not set" rather than an invalid address, so an instance that only
/// collects mail does not have to invent a sender to save the other card.
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, note("tooLong", 200))
  .nullable()
  .default(null)
  .transform((value) => value || null)
  .refine((value) => value === null || z.email().safeParse(value).success, note("notEmail"));

/**
 * A password is only ever written, never read back — so an empty field means
 * "leave the stored one alone" rather than "clear it". Clearing one is done by
 * clearing the user it belongs to, which is also what turns authentication off.
 */
const mailPassword = z.string().max(200, note("tooLong", 200)).default("");

export const mailSendingSchema = z
  .object({
    smtpHost: mailHost,
    smtpPort: mailPort,
    smtpSecure: z.boolean().default(false),
    smtpUser: optionalText(200),
    smtpPass: mailPassword,
    fromName: z.string().trim().min(1, note("nameSender")).max(80, note("tooLong", 80)),
    fromEmail: optionalEmail,
  })
  // Only once there is a server to send through: half-filled settings are how
  // somebody saves progress on a card they are still working out.
  .refine((value) => !value.smtpHost || value.fromEmail, {
    message: note("needFromAddress"),
    path: ["fromEmail"],
  });

export const mailCollectingSchema = z
  .object({
    imapHost: mailHost,
    imapPort: mailPort,
    imapSecure: z.boolean().default(true),
    imapUser: optionalText(200),
    imapPass: mailPassword,
    imapFolder: z.string().trim().min(1, note("nameFolder")).max(100, note("tooLong", 100)),
    archiveFolder: optionalText(100),
  })
  .refine((value) => !value.imapHost || value.imapUser, {
    message: note("needMailbox"),
    path: ["imapUser"],
  });

/**
 * One message's wording. Which variables it may name is not checked here — that
 * depends on the kind, which the action knows and a schema built once at import
 * does not.
 */
export const mailTemplateSchema = z.object({
  subject: z.string().trim().min(1, note("writeSubject")).max(200, note("tooLong", 200)),
  body: z.string().trim().min(1, note("writeBody")).max(10_000, note("tooLong", 10_000)),
  /// The whole document, where the desk has taken the layout over. A layout
  /// with nowhere to put the message is the one mistake worth refusing: it
  /// saves and sends, and what arrives is an empty frame.
  html: z
    .string()
    .max(60_000, note("tooLong", 60_000))
    .refine((value) => !value.trim() || value.includes("{body}"), note("layoutNeedsBody"))
    .transform((value) => value.trim() || null),
});

/** What the desk signs off with. Empty is allowed and is the normal state: a
 *  sign-off is something a desk adds, not something it starts with. */
export const mailSignatureSchema = z.object({
  signature: z.string().trim().max(2_000, note("tooLong", 2_000)),
});

export const statusSchema = z.object({
  name: z.string().trim().min(1, note("nameStatus")).max(40, note("tooLong", 40)),
  color: hexColour(),
  settles: z.boolean().default(false),
  showOnPortal: z.boolean().default(false),
  pausesClock: z.boolean().default(false),
});

export const teamSchema = z.object({
  name: z.string().trim().min(1, note("nameTeam")).max(40, note("tooLong", 40)),
  description: z
    .string()
    .trim()
    .max(120, note("tooLong", 120))
    .nullable()
    .default(null)
    .transform((value) => value || null),
  color: hexColour(),
});

export const changeTemplateSchema = z.object({
  name: z.string().trim().min(1, note("namePlan")).max(60, note("tooLong", 60)),
  description: z
    .string()
    .trim()
    .max(160, note("tooLong", 160))
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

export const roleSchema = z.object({
  name: z.string().trim().min(1, note("nameRole")).max(40, note("tooLong", 40)),
  description: z
    .string()
    .trim()
    .max(120, note("tooLong", 120))
    .nullable()
    .default(null)
    .transform((value) => value || null),
});

export const blockedWordSchema = z.object({
  word: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, note("wordShort"))
    .max(40, note("tooLong", 40))
    .regex(/^[\p{L}\p{N}'’-]+$/u, note("oneWordOnly")),
});

export const projectSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, note("keyLength"))
    .max(5, note("keyLength"))
    .regex(/^[A-Z]+$/, note("keyLetters")),
  name: z.string().trim().min(1, note("nameProject")).max(60),
  description: z.string().trim().max(500).optional(),
  color: hexColour().default("#6366f1"),
});

export const labelSchema = z.object({
  name: z.string().trim().min(1, note("nameTag")).max(30).toLowerCase(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#febe2e"),
});

/** The first thing wrong, for the places that show one line rather than a
 *  message per field. */
export function firstError(error: z.ZodError, t: Messages) {
  const issue = error.issues[0];
  return issue ? translate(issue.message, t) : t.errors.generic;
}

/** Flattens a ZodError into the shape the form components render. */
export function fieldErrors(error: z.ZodError, t: Messages) {
  const flat: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    flat[key] ??= translate(issue.message, t);
  }
  return flat;
}
