"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";
import {
  canEditCis,
  canEditTicket,
  canManageCis,
  canViewCis,
  canViewTicket,
} from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { refreshTicket } from "@/lib/refresh";
import {
  CI_LIFECYCLES,
  keyFromLabel,
  parseAttributes,
  type AttributeProblem,
  type AttributeValue,
  type FieldSpec,
} from "@/lib/cmdb";
import { ALL_TYPES, availableColumns, unionFields, writeColumns } from "@/lib/ci-columns";
import { readViews, withView, withoutView } from "@/lib/ci-views";
import {
  ciImportSchema,
  ciTypeDesignSchema,
  ciBulkSchema,
  ciItemSchema,
  ciRelationSchema,
  ciTypeFieldSchema,
  ciTypeSchema,
  fieldErrors,
} from "@/lib/validation";
import { parseCsv } from "@/lib/csv";
import type { Messages } from "@/lib/i18n";

/**
 * The register: what the desk looks after, and what it is connected to.
 *
 * Two permissions, and the line between them is the one that matters. `ci.edit`
 * is a day's work on the desk — add a laptop, correct its serial, say which
 * assets a ticket is about. `ci.manage` changes what a laptop *is*, which
 * rewrites the shape of every laptop in the register, so it is held by fewer
 * people.
 *
 * Types and attributes are drafts with a Save. Adding, deleting and reordering
 * are list-level commands and take effect at once — the exception `CLAUDE.md`
 * names.
 */

function refreshTypes() {
  revalidatePath("/settings/cmdb");
  revalidatePath("/cmdb");
}

function refreshItem(id?: string) {
  revalidatePath("/cmdb");
  if (id) revalidatePath(`/cmdb/${id}`);
}

/**
 * What an asset looked like before somebody changed it, and what it is called
 * now — enough to write the history without a second read.
 */
const BEFORE = {
  id: true,
  name: true,
  typeId: true,
  lifecycle: true,
  teamId: true,
  attributes: true,
  team: { select: { name: true } },
} as const;

/**
 * The asset's own history.
 *
 * The same append-only `Activity` trail tickets and projects use, hung off
 * `itemId`: a register nobody can ask "when did this become RETIRED, and who
 * said so" of is a register people stop believing. Labels and names are written
 * into the row rather than looked up when it is read — a field renamed next year
 * must not rewrite what last year's entry says happened.
 */
function trail(
  itemId: string,
  actorId: string,
  type: "CI_CREATED" | "CI_UPDATED" | "CI_RELATED" | "CI_UNRELATED" | "CI_IMPORTED",
  entry: { field?: string | null; from?: string | null; to?: string | null; link?: string } = {},
) {
  return {
    itemId,
    actorId,
    type,
    field: entry.field ?? null,
    oldValue: entry.from ?? null,
    newValue: entry.to ?? null,
    link: entry.link ?? null,
  };
}

/// A ceiling on one press. A register is bulk-edited in screenfuls; a request
/// carrying five thousand ids is not somebody ticking boxes.
const BULK_LIMIT = 200;

const FIELD_SELECT = {
  key: true,
  label: true,
  kind: true,
  required: true,
  options: true,
  isExpiry: true,
} as const;

/* ------------------------------------------------------------------ types -- */

export async function createCiType(input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const parsed = ciTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.ciType.findUnique({
    where: { key: parsed.data.key },
    select: { id: true },
  });
  if (taken) return { ok: false as const, errors: { key: t.errors.ciKeyTaken(parsed.data.key) } };

  // Appended rather than inserted: the order is the desk's, and a new type
  // arriving in the middle of a list somebody arranged is a small theft.
  const last = await prisma.ciType.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const type = await prisma.ciType.create({
    data: { ...parsed.data, position: (last?.position ?? -1) + 1 },
    select: { id: true },
  });

  refreshTypes();
  return { ok: true as const, id: type.id };
}

export async function updateCiType(id: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const parsed = ciTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  // A tab left open while somebody else removed the type. Answered as an error
  // the form can render, rather than as the Prisma exception a 500 page is
  // made of.
  const type = await prisma.ciType.findUnique({ where: { id }, select: { id: true } });
  if (!type) return { ok: false as const, errors: { form: t.errors.ciTypeGone } };

  const clash = await prisma.ciType.findUnique({
    where: { key: parsed.data.key },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return { ok: false as const, errors: { key: t.errors.ciKeyTaken(parsed.data.key) } };
  }

  await prisma.ciType.update({ where: { id }, data: parsed.data });
  refreshTypes();
  return { ok: true as const };
}

/**
 * The whole designer, saved at once.
 *
 * One Save for a type and everything it records, because that is one decision —
 * "this is what a laptop is". The alternative, which this replaced, was a Save
 * per attribute: seven of them on a type with seven fields, and no moment at
 * which the thing being described was either finished or abandoned.
 *
 * Adding, removing and reordering an attribute stay list-level and immediate:
 * they are verbs on their own, which is the exception `CLAUDE.md` names.
 */
export async function saveCiTypeDesign(id: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const parsed = ciTypeDesignSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const { fields, namePattern, defaultColumns, ...type } = parsed.data;

  const existing = await prisma.ciType.findUnique({
    where: { id },
    select: { id: true, fields: { select: { id: true } } },
  });
  if (!existing) return { ok: false as const, errors: { form: t.errors.ciTypeGone } };

  const clash = await prisma.ciType.findUnique({
    where: { key: type.key },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return { ok: false as const, errors: { key: t.errors.ciKeyTaken(type.key) } };
  }

  // A pattern that will not compile is a pattern that refuses every name — so
  // it is refused here, once, rather than on every save of every laptop.
  if (namePattern !== null) {
    try {
      new RegExp(namePattern);
    } catch {
      return { ok: false as const, errors: { namePattern: t.errors.ciPatternBroken } };
    }
  }

  // Only this type's own fields, and each key only once: an attribute belongs
  // to the type that declares it, and two columns matching on the same key is
  // an import that quietly drops half a file.
  const mine = new Set(existing.fields.map((field) => field.id));
  const seen = new Set<string>();
  for (const field of fields) {
    if (!mine.has(field.id)) return { ok: false as const, errors: { form: t.errors.ciFieldGone } };
    if (seen.has(field.key)) {
      return {
        ok: false as const,
        errors: { [`fields.${field.id}`]: t.errors.ciKeyTaken(field.key) },
      };
    }
    seen.add(field.key);
  }

  await prisma.$transaction([
    prisma.ciType.update({ where: { id }, data: { ...type, namePattern, defaultColumns } }),
    ...fields.map((field) =>
      prisma.ciTypeField.update({
        where: { id: field.id },
        data: {
          key: field.key,
          label: field.label,
          kind: field.kind,
          required: field.required,
          options: field.options,
          // Only a date runs out. Cleared rather than refused when the kind has
          // moved on, because the flag is not on screen for those kinds and a
          // refusal for something invisible is not an answer.
          isExpiry: field.kind === "DATE" && field.isExpiry,
        },
      }),
    ),
  ]);

  refreshTypes();
  return { ok: true as const };
}

/**
 * A type copied, attributes and all.
 *
 * The way a second kind of thing usually starts: a licence is a certificate with
 * two fields changed. The key gets `-copy` because a key is unique and somebody
 * has to be able to see which one they are looking at.
 */
export async function duplicateCiType(id: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, error: t.errors.noCiManage };

  const type = await prisma.ciType.findUnique({
    where: { id },
    select: {
      name: true,
      key: true,
      icon: true,
      color: true,
      defaultColumns: true,
      namePattern: true,
      fields: {
        orderBy: { position: "asc" },
        select: {
          key: true,
          label: true,
          kind: true,
          required: true,
          options: true,
          isExpiry: true,
        },
      },
    },
  });
  if (!type) return { ok: false as const, error: t.errors.ciTypeGone };

  // `-copy`, then `-copy-2` and so on: duplicating twice is something people do
  // and a refusal at the second press would be a puzzle.
  let key = `${type.key}-copy`.slice(0, 30);
  for (let attempt = 2; await prisma.ciType.findUnique({ where: { key }, select: { id: true } });) {
    key = `${type.key}-copy-${attempt}`.slice(0, 30);
    attempt += 1;
  }

  const last = await prisma.ciType.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const copy = await prisma.ciType.create({
    data: {
      name: t.cmdb.copyOf(type.name),
      key,
      icon: type.icon,
      color: type.color,
      defaultColumns: type.defaultColumns,
      namePattern: type.namePattern,
      position: (last?.position ?? -1) + 1,
      fields: {
        create: type.fields.map((field, position) => ({ ...field, position })),
      },
    },
    select: { key: true },
  });

  refreshTypes();
  return { ok: true as const, key: copy.key };
}

export async function deleteCiType(id: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, error: t.errors.noCiManage };

  // Refused rather than cascaded. `onDelete: Restrict` would refuse this too,
  // but as a database error nobody can read — and the number is the whole of
  // what somebody needs to decide what to do instead.
  const items = await prisma.configurationItem.count({ where: { typeId: id } });
  if (items > 0) return { ok: false as const, error: t.errors.ciTypeInUse(items) };

  await prisma.ciType.delete({ where: { id } });
  refreshTypes();
  return { ok: true as const };
}

/* ------------------------------------------------------------ attributes -- */

export async function addCiField(typeId: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const raw = (input ?? {}) as Record<string, unknown>;
  // A key offered from the label, so the common case is one field to fill in
  // rather than two — but still a real value somebody can overrule, because the
  // key is what an import matches on and the label is not.
  const withKey = {
    ...raw,
    key: raw.key || keyFromLabel(String(raw.label ?? "")),
  };

  const parsed = ciTypeFieldSchema.safeParse(withKey);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const type = await prisma.ciType.findUnique({ where: { id: typeId }, select: { id: true } });
  if (!type) return { ok: false as const, errors: { form: t.errors.ciTypeGone } };

  const taken = await prisma.ciTypeField.findUnique({
    where: { typeId_key: { typeId, key: parsed.data.key } },
    select: { id: true },
  });
  if (taken) return { ok: false as const, errors: { key: t.errors.ciKeyTaken(parsed.data.key) } };

  const last = await prisma.ciTypeField.findFirst({
    where: { typeId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.ciTypeField.create({
    data: { ...parsed.data, typeId, position: (last?.position ?? -1) + 1 },
  });

  refreshTypes();
  return { ok: true as const };
}

export async function updateCiField(id: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const parsed = ciTypeFieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const field = await prisma.ciTypeField.findUnique({
    where: { id },
    select: { typeId: true },
  });
  if (!field) return { ok: false as const, errors: { form: t.errors.ciFieldGone } };

  const clash = await prisma.ciTypeField.findUnique({
    where: { typeId_key: { typeId: field.typeId, key: parsed.data.key } },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return { ok: false as const, errors: { key: t.errors.ciKeyTaken(parsed.data.key) } };
  }

  // Values already written under the old key are left where they are rather
  // than migrated. Renaming a key is rare, rewriting every item in the register
  // to follow it is not free, and `readAttribute` shows an orphaned value as
  // unset — which is honest about what happened.
  await prisma.ciTypeField.update({ where: { id }, data: parsed.data });
  refreshTypes();
  return { ok: true as const };
}

export async function deleteCiField(id: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, error: t.errors.noCiManage };

  const field = await prisma.ciTypeField.findUnique({ where: { id }, select: { id: true } });
  if (!field) return { ok: false as const, error: t.errors.ciFieldGone };

  await prisma.ciTypeField.delete({ where: { id } });
  refreshTypes();
  return { ok: true as const };
}

/** Up or down one place. Swapped with its neighbour, so two fields can never
 *  end up holding the same position. */
export async function moveCiField(id: string, direction: "up" | "down") {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, error: t.errors.noCiManage };

  const field = await prisma.ciTypeField.findUnique({
    where: { id },
    select: { id: true, typeId: true, position: true },
  });
  if (!field) return { ok: false as const, error: t.errors.ciFieldGone };

  const neighbour = await prisma.ciTypeField.findFirst({
    where: {
      typeId: field.typeId,
      position: direction === "up" ? { lt: field.position } : { gt: field.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  // Already at the end. Not an error: the button is simply the edge of the list.
  if (!neighbour) return { ok: true as const };

  await prisma.$transaction([
    prisma.ciTypeField.update({ where: { id: field.id }, data: { position: neighbour.position } }),
    prisma.ciTypeField.update({ where: { id: neighbour.id }, data: { position: field.position } }),
  ]);

  refreshTypes();
  return { ok: true as const };
}

/* ------------------------------------------------------------------ items -- */

/** The type's fields, and the answers checked against them. */
async function withAttributes(typeId: string, raw: unknown, t: Messages) {
  const fields = await prisma.ciTypeField.findMany({
    where: { typeId },
    orderBy: { position: "asc" },
    select: FIELD_SELECT,
  });

  const { values, errors, references } = parseAttributes(fields as FieldSpec[], raw);

  // An id is only worth storing if it points at something. A dangling one
  // renders as "unset" for ever afterwards, which reads as a field nobody
  // filled in rather than as the pointer to a deleted thing that it is.
  for (const key of await missingReferences(references)) errors[key] = "missing";

  const said: Record<string, string> = {};
  for (const [key, reason] of Object.entries(errors)) {
    said[`attributes.${key}`] = sayProblem(reason, t);
  }
  return { values, errors: said };
}

/**
 * Whether a name keeps the convention its type holds names to.
 *
 * A refusal rather than a correction, and the pattern is in the message: "that
 * is not a valid name" tells somebody they are wrong without telling them what
 * would be right, and they will simply try again with another guess.
 */
async function namedWrong(typeId: string, name: string, t: Messages) {
  const type = await prisma.ciType.findUnique({
    where: { id: typeId },
    select: { namePattern: true },
  });
  const pattern = type?.namePattern;
  if (!pattern) return null;

  try {
    if (new RegExp(pattern).test(name)) return null;
  } catch {
    // A pattern that will not compile was refused when it was saved; if one is
    // in the database anyway it must not stop the desk adding a laptop.
    return null;
  }
  return t.errors.ciNamePattern(pattern);
}

/** Which of the pointed-at ids are not there. Two queries whatever the type
 *  carries, rather than one per field. */
async function missingReferences(references: { kind: "USER" | "ITEM"; key: string; id: string }[]) {
  if (references.length === 0) return [];

  const wanted = (kind: "USER" | "ITEM") =>
    references.filter((reference) => reference.kind === kind).map((reference) => reference.id);

  const [people, items] = await Promise.all([
    wanted("USER").length
      ? prisma.user.findMany({ where: { id: { in: wanted("USER") } }, select: { id: true } })
      : [],
    wanted("ITEM").length
      ? prisma.configurationItem.findMany({
          where: { id: { in: wanted("ITEM") } },
          select: { id: true },
        })
      : [],
  ]);

  const found = new Set([...people, ...items].map((row) => row.id));
  return references
    .filter((reference) => !found.has(reference.id))
    .map((reference) => reference.key);
}

/** The same, for one line of a file rather than one field of a form: the row
 *  number is already on the report, so the sentence names the column. */
function sayRowProblem(reason: AttributeProblem, key: string, t: Messages) {
  switch (reason) {
    case "number":
      return t.errors.rowNotANumber(key);
    case "choice":
      return t.errors.rowNotAnOption(key);
    case "date":
      return t.errors.rowNotADate(key);
    case "missing":
      return t.errors.rowNotThere(key);
    default:
      return t.errors.rowMissing(key);
  }
}

/** What a rejected attribute is told to say, in the desk's language. */
function sayProblem(reason: AttributeProblem, t: Messages) {
  switch (reason) {
    case "required":
      return t.errors.fieldRequired;
    case "number":
      return t.errors.notANumber;
    case "date":
      return t.errors.notADate;
    case "missing":
      return t.errors.notThere;
    default:
      return t.errors.notAnOption;
  }
}

export async function createCiItem(input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, errors: { form: t.errors.noCiEdit } };

  const parsed = ciItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const type = await prisma.ciType.findUnique({
    where: { id: parsed.data.typeId },
    select: { id: true },
  });
  if (!type) return { ok: false as const, errors: { typeId: t.errors.ciTypeGone } };

  const wrong = await namedWrong(parsed.data.typeId, parsed.data.name, t);
  if (wrong) return { ok: false as const, errors: { name: wrong } };

  const checked = await withAttributes(parsed.data.typeId, parsed.data.attributes, t);
  if (Object.keys(checked.errors).length > 0) {
    return { ok: false as const, errors: checked.errors };
  }

  // Named rather than spread: the attributes have already been checked and
  // rebuilt, and spreading the parsed input would put the raw ones back.
  const { name, typeId, lifecycle, teamId } = parsed.data;
  const item = await prisma.configurationItem.create({
    data: { name, typeId, lifecycle, teamId, attributes: checked.values },
    select: { id: true },
  });

  await prisma.activity.create({ data: trail(item.id, user.id, "CI_CREATED", { to: name }) });

  refreshItem(item.id);
  return { ok: true as const, id: item.id };
}

export async function updateCiItem(id: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, errors: { form: t.errors.noCiEdit } };

  const parsed = ciItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const existing = await prisma.configurationItem.findUnique({
    where: { id },
    select: BEFORE,
  });
  if (!existing) return { ok: false as const, errors: { form: t.errors.ciGone } };

  // The item's own type, never the one that was submitted. Changing what
  // something *is* rewrites every attribute it has under keys the new type has
  // never heard of, so it is not an edit to a form — it is a decision, and one
  // this desk makes by deleting and adding rather than by a dropdown.
  const typeId = existing.typeId;

  const wrong = await namedWrong(typeId, parsed.data.name, t);
  if (wrong) return { ok: false as const, errors: { name: wrong } };

  const checked = await withAttributes(typeId, parsed.data.attributes, t);
  if (Object.keys(checked.errors).length > 0) {
    return { ok: false as const, errors: checked.errors };
  }

  const { name, lifecycle, teamId } = parsed.data;

  const fields = await prisma.ciTypeField.findMany({
    where: { typeId },
    orderBy: { position: "asc" },
    select: FIELD_SELECT,
  });

  // One row per thing that actually changed, worked out before the write.
  // A save that touched nothing leaves no trace: a history of "Ada saved this"
  // forty times is one nobody reads to find the change that mattered.
  const changes: { field: string; from: string | null; to: string | null }[] = [];
  const say = (field: string, from: string | null, to: string | null) => {
    if ((from ?? "") !== (to ?? "")) changes.push({ field, from, to });
  };

  say(t.cmdb.name, existing.name, name);
  say(
    t.cmdb.lifecycle,
    t.cmdb.life[existing.lifecycle],
    t.cmdb.life[lifecycle as keyof typeof t.cmdb.life],
  );

  if (existing.teamId !== teamId) {
    const team = teamId
      ? await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } })
      : null;
    say(t.cmdb.team, existing.team?.name ?? null, team?.name ?? null);
  }

  const was = (existing.attributes ?? {}) as Record<string, AttributeValue>;
  for (const field of fields) {
    const before = was[field.key];
    const after = checked.values[field.key];
    say(
      field.label,
      before === undefined || before === null ? null : String(before),
      after === undefined || after === null ? null : String(after),
    );
  }

  await prisma.$transaction([
    prisma.configurationItem.update({
      where: { id },
      data: { name, typeId, lifecycle, teamId, attributes: checked.values },
    }),
    prisma.activity.createMany({
      data: changes.map((change) =>
        trail(id, user.id, "CI_UPDATED", {
          field: change.field,
          from: change.from,
          to: change.to,
        }),
      ),
    }),
  ]);

  refreshItem(id);
  return { ok: true as const };
}

/**
 * What goes with an asset when it goes.
 *
 * Asked before the confirm dialog rather than after the delete, because these
 * are the three numbers that change the answer: a laptop nobody has raised a
 * ticket about is a row, and a switch four things depend on is an outage.
 */
export async function ciDependants(id: string) {
  const user = await requireUser();
  if (!canViewCis(user)) return null;

  const [tickets, dependants, relations] = await Promise.all([
    prisma.ticketCi.count({ where: { itemId: id } }),
    prisma.ciRelation.count({ where: { kind: "DEPENDS_ON", targetId: id } }),
    prisma.ciRelation.count({ where: { OR: [{ sourceId: id }, { targetId: id }] } }),
  ]);

  return { tickets, dependants, relations };
}

export async function deleteCiItem(id: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, error: t.errors.noCiEdit };

  const item = await prisma.configurationItem.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!item) return { ok: false as const, error: t.errors.ciGone };

  // The trail goes first. `Activity.itemId` cascades with the item, so a row
  // written after the delete would have nothing to hang from — but the history
  // of the *tickets* it was on keeps the name, which is what somebody reading
  // "why is this asset no longer listed" is actually looking for.
  await prisma.$transaction([
    prisma.activity.createMany({
      data: (
        await prisma.ticketCi.findMany({ where: { itemId: id }, select: { ticketId: true } })
      ).map((row) => ({
        ticketId: row.ticketId,
        actorId: user.id,
        type: "CI_REMOVED" as const,
        field: "ci",
        // Named in `newValue` like every other CI_REMOVED row, because that is
        // where the trail reads the asset's name from.
        newValue: item.name,
      })),
    }),
    prisma.configurationItem.delete({ where: { id } }),
  ]);

  refreshItem();
  return { ok: true as const };
}

export type CiCandidate = {
  id: string;
  name: string;
  /// The glyph as well as the colour: a picker that draws the same shape in
  /// four colours makes somebody read every line to find the one server among
  /// the licences.
  type: { name: string; color: string; icon: string | null };
};

/** Assets somebody could point at, by name. Six is what fits in a picker. */
export async function searchCiItems(
  query: string,
  excludeId?: string,
  /// Narrowed to one kind of thing, for an ITEM attribute that says which kind
  /// it points at. Without it the picker offers the whole register, which on a
  /// field called "Rack" is every laptop the desk owns.
  typeKey?: string | null,
): Promise<CiCandidate[]> {
  const user = await requireUser();
  if (!canEditCis(user)) return [];

  const needle = query.trim();
  return prisma.configurationItem.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(typeKey ? { type: { is: { key: typeKey } } } : {}),
      ...(needle ? { name: { contains: needle, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 6,
    select: { id: true, name: true, type: { select: { name: true, color: true, icon: true } } },
  });
}

/* -------------------------------------------------------------- relations -- */

export async function relateCis(sourceId: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, errors: { form: t.errors.noCiEdit } };

  const parsed = ciRelationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const { targetId, kind } = parsed.data;
  if (sourceId === targetId) {
    return { ok: false as const, errors: { targetId: t.errors.ciToItself } };
  }

  const items = await prisma.configurationItem.findMany({
    where: { id: { in: [sourceId, targetId] } },
    select: { id: true, name: true },
  });
  const source = items.find((item) => item.id === sourceId);
  const target = items.find((item) => item.id === targetId);
  if (!source || !target) return { ok: false as const, errors: { form: t.errors.ciGone } };

  // The mirror as well as the duplicate: "A runs on B" and "B runs on A" are two
  // rows saying opposite things, and the unique index cannot see the second one
  // coming.
  const existing = await prisma.ciRelation.findFirst({
    where: {
      kind,
      OR: [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ],
    },
    select: { sourceId: true },
  });
  if (existing) {
    const forwards = existing.sourceId === sourceId;
    const verb = t.cmdb.verb[kind];
    return {
      ok: false as const,
      errors: {
        targetId: t.errors.ciRelationExists(
          forwards
            ? `${source.name} ${verb} ${target.name}`
            : `${target.name} ${verb} ${source.name}`,
        ),
      },
    };
  }

  const verb = t.cmdb.verb[kind];
  await prisma.$transaction([
    prisma.ciRelation.create({ data: { kind, sourceId, targetId } }),
    // Both ends, the way a ticket link is recorded at both ends: the far item's
    // history has to say what leaned on it too, or half the graph is invisible
    // from the side that cares.
    prisma.activity.createMany({
      data: [
        trail(sourceId, user.id, "CI_RELATED", {
          field: verb,
          to: target.name,
          link: `/cmdb/${target.id}`,
        }),
        trail(targetId, user.id, "CI_RELATED", {
          field: t.cmdb.inverse[kind],
          to: source.name,
          link: `/cmdb/${source.id}`,
        }),
      ],
    }),
  ]);

  refreshItem(sourceId);
  refreshItem(targetId);
  return { ok: true as const };
}

export async function unrelateCis(relationId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, error: t.errors.noCiEdit };

  const relation = await prisma.ciRelation.findUnique({
    where: { id: relationId },
    select: {
      sourceId: true,
      targetId: true,
      kind: true,
      source: { select: { id: true, name: true } },
      target: { select: { id: true, name: true } },
    },
  });
  if (!relation) return { ok: false as const, error: t.errors.ciRelationGone };

  await prisma.$transaction([
    prisma.ciRelation.delete({ where: { id: relationId } }),
    prisma.activity.createMany({
      data: [
        trail(relation.sourceId, user.id, "CI_UNRELATED", {
          field: t.cmdb.verb[relation.kind],
          to: relation.target.name,
        }),
        trail(relation.targetId, user.id, "CI_UNRELATED", {
          field: t.cmdb.inverse[relation.kind],
          to: relation.source.name,
        }),
      ],
    }),
  ]);

  refreshItem(relation.sourceId);
  refreshItem(relation.targetId);
  return { ok: true as const };
}

/* ------------------------------------------------------- tickets ↔ assets -- */

/**
 * Which assets a ticket is about.
 *
 * Both permissions, because it is a change to two things: `ci.edit` says you may
 * speak for the register, `ticket.edit` and `canViewTicket` say you may change
 * this ticket. Every write leaves a row in the ticket's history — a feature that
 * changes a ticket without leaving a trace is a bug.
 */
async function ticketFor(ticketId: string, user: SessionUser, t: Messages) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, number: true, reporterId: true, assigneeId: true },
  });
  if (!ticket) return { ok: false as const, error: t.errors.ticketGone };
  if (!canEditCis(user)) return { ok: false as const, error: t.errors.noCiEdit };
  if (!canEditTicket(user) || !canViewTicket(user, ticket)) {
    return { ok: false as const, error: t.errors.noTicketChange };
  }
  return { ok: true as const, ticket };
}

export async function addTicketCi(ticketId: string, itemId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const found = await ticketFor(ticketId, user, t);
  if (!found.ok) return { ok: false as const, error: found.error };

  const item = await prisma.configurationItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true },
  });
  if (!item) return { ok: false as const, error: t.errors.ciGone };

  // Already named is not a failure: two people reaching the same conclusion
  // about the same ticket is agreement, not a conflict.
  const already = await prisma.ticketCi.findUnique({
    where: { ticketId_itemId: { ticketId, itemId } },
    select: { ticketId: true },
  });
  if (already) return { ok: true as const };

  await prisma.$transaction([
    prisma.ticketCi.create({ data: { ticketId, itemId } }),
    prisma.activity.create({
      data: {
        ticketId,
        actorId: user.id,
        type: "CI_ADDED",
        field: "ci",
        newValue: item.name,
        link: `/cmdb/${item.id}`,
      },
    }),
  ]);

  refreshTicket(found.ticket.number);
  refreshItem(itemId);
  return { ok: true as const };
}

export async function removeTicketCi(ticketId: string, itemId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const found = await ticketFor(ticketId, user, t);
  if (!found.ok) return { ok: false as const, error: found.error };

  const item = await prisma.configurationItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true },
  });

  const removed = await prisma.$transaction(async (tx) => {
    // History only for something that actually happened. Two people taking the
    // same asset off the same ticket would otherwise leave two entries saying
    // it was removed, one of which is not true.
    const gone = await tx.ticketCi.deleteMany({ where: { ticketId, itemId } });
    if (gone.count === 0) return false;

    await tx.activity.create({
      data: {
        ticketId,
        actorId: user.id,
        type: "CI_REMOVED",
        field: "ci",
        // No link: the entry names an asset that is no longer on this ticket,
        // and a chip inviting a click reads as if it still were.
        newValue: item?.name ?? null,
      },
    });

    return true;
  });
  if (!removed) return { ok: true as const };

  refreshTicket(found.ticket.number);
  refreshItem(itemId);
  return { ok: true as const };
}

/* ----------------------------------------------------------------- import -- */

/** What one row could not be, when it could not be anything. */
export type ImportNote = { row: number; reason: string };

export type ImportReport = {
  created: number;
  updated: number;
  /// Rows that produced nothing, and why. Never a silent drop.
  skipped: ImportNote[];
  /// Rows that landed, with something in them that did not. An operator group
  /// nobody has heard of is not worth refusing a laptop over, but it is worth
  /// saying out loud.
  warnings: ImportNote[];
};

/** Ten thousand is more estate than this is built for, and a wall to hit that is
 *  ours rather than the database's. */
const MAX_ROWS = 10_000;

/**
 * A re-runnable import.
 *
 * Matching is on `externalSource` + `externalId`, which is the whole design:
 * an import that can only be run once is a one-off migration, not a feed, and a
 * register nothing feeds rots inside a quarter.
 *
 * Two rules it will not break. **It never deletes** — a row that has left the
 * file has not necessarily left the building, and an import that decides
 * otherwise takes the estate with it the first time somebody exports a filtered
 * view. And **it never clears what it was not told about**: attributes are
 * merged over what is already there, so importing three columns does not wipe
 * the seven somebody filled in by hand.
 */
export async function importCiItems(input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageCis(user)) return { ok: false as const, errors: { form: t.errors.noCiManage } };

  const parsed = ciImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const { typeId, source, text, delimiter, hasHeader, mapping } = parsed.data;

  const type = await prisma.ciType.findUnique({
    where: { id: typeId },
    select: { id: true, fields: { select: FIELD_SELECT } },
  });
  if (!type) return { ok: false as const, errors: { typeId: t.errors.ciTypeGone } };

  const rows = parseCsv(text, delimiter);
  const body = hasHeader ? rows.slice(1) : rows;
  if (body.length === 0) return { ok: false as const, errors: { form: t.errors.noCsvRows } };
  if (body.length > MAX_ROWS) {
    return { ok: false as const, errors: { form: t.errors.tooManyCsvRows(MAX_ROWS) } };
  }

  const column = (target: string) => mapping.indexOf(target);
  const nameAt = column("name");
  const keyAt = column("externalId");
  // Both or nothing: without a name there is nothing to call it, and without a
  // key the second run makes a second copy of everything.
  if (nameAt < 0) return { ok: false as const, errors: { form: t.errors.mapNameColumn } };
  if (keyAt < 0) return { ok: false as const, errors: { form: t.errors.mapKeyColumn } };

  const cell = (row: string[], at: number) => (at >= 0 ? (row[at] ?? "").trim() : "");

  const teamAt = column("team");
  const lifecycleAt = column("lifecycle");

  // Looked up once for the whole file rather than per row: five hundred laptops
  // on the same four desks is four lookups, not five hundred.
  const [teams, existing] = await Promise.all([
    teamAt >= 0 ? prisma.team.findMany({ select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.configurationItem.findMany({
      where: {
        externalSource: source,
        externalId: { in: [...new Set(body.map((row) => cell(row, keyAt)))].filter(Boolean) },
      },
      select: { id: true, externalId: true, attributes: true },
    }),
  ]);

  const byTeam = new Map(teams.map((team) => [team.name.toLowerCase(), team.id]));
  const byKey = new Map(existing.map((item) => [item.externalId!, item]));

  const report: ImportReport = { created: 0, updated: 0, skipped: [], warnings: [] };
  /// Every item the run wrote, so each one can say in its own history where it
  /// came from. An asset that changed under somebody without explanation is
  /// exactly what makes a register stop being believed.
  const touched: string[] = [];

  for (const [index, row] of body.entries()) {
    // The number somebody sees in their spreadsheet, so a complaint about row
    // 412 can be looked at in the file rather than counted out by hand.
    const line = index + (hasHeader ? 2 : 1);

    const externalId = cell(row, keyAt);
    if (!externalId) {
      report.skipped.push({ row: line, reason: t.errors.rowNoKey });
      continue;
    }

    const name = cell(row, nameAt);
    if (!name) {
      report.skipped.push({ row: line, reason: t.errors.rowNoName });
      continue;
    }

    let lifecycle: (typeof CI_LIFECYCLES)[number] | undefined;
    if (lifecycleAt >= 0) {
      const given = cell(row, lifecycleAt)
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
      if (given) {
        const match = CI_LIFECYCLES.find((life) => life === given);
        if (!match) {
          report.skipped.push({
            row: line,
            reason: t.errors.rowBadLifecycle(cell(row, lifecycleAt)),
          });
          continue;
        }
        lifecycle = match;
      }
    }

    // Only the columns this file actually maps. Anything unmapped is left to
    // whatever the item already says, which is what stops a three-column import
    // from blanking seven attributes.
    const given: Record<string, string> = {};
    for (const [at, target] of mapping.entries()) {
      if (!target.startsWith("attr:")) continue;
      const value = cell(row, at);
      if (value !== "") given[target.slice(5)] = value;
    }

    const mapped = type.fields.filter((field) => field.key in given);
    const { values, errors, references } = parseAttributes(mapped as FieldSpec[], given);
    for (const key of await missingReferences(references)) errors[key] = "missing";

    const firstError = Object.entries(errors)[0];
    if (firstError) {
      const [key, reason] = firstError;
      report.skipped.push({ row: line, reason: sayRowProblem(reason, key, t) });
      continue;
    }

    let teamId: string | undefined;
    if (teamAt >= 0) {
      const teamName = cell(row, teamAt).toLowerCase();
      if (teamName) {
        teamId = byTeam.get(teamName);
        if (!teamId) {
          report.warnings.push({ row: line, reason: t.errors.rowNoSuchTeam(cell(row, teamAt)) });
        }
      }
    }

    const already = byKey.get(externalId);
    const attributes = already
      ? // Everything this feature writes is a primitive, and anything else in the
        // blob already reads as unset — so the cast narrows to what is really there.
        { ...(already.attributes as Record<string, AttributeValue>), ...values }
      : values;

    // Checked on what the row ends up saying rather than on what it carried: an
    // import that only maps three columns must not blank the other seven, but
    // it must not leave a required attribute empty either. A register whose
    // rules apply by hand and not by file is a register with two standards.
    const blank = type.fields.find(
      (field) =>
        field.required &&
        (attributes[field.key] === undefined ||
          attributes[field.key] === null ||
          attributes[field.key] === ""),
    );
    if (blank) {
      report.skipped.push({ row: line, reason: t.errors.rowMissing(blank.key) });
      continue;
    }

    if (already) {
      await prisma.configurationItem.update({
        where: { id: already.id },
        data: {
          name,
          typeId,
          attributes,
          ...(lifecycle ? { lifecycle } : {}),
          ...(teamId ? { teamId } : {}),
        },
      });
      touched.push(already.id);
      report.updated += 1;
    } else {
      const made = await prisma.configurationItem.create({
        data: {
          name,
          typeId,
          attributes,
          externalSource: source,
          externalId,
          ...(lifecycle ? { lifecycle } : {}),
          ...(teamId ? { teamId } : {}),
        },
        select: { id: true, externalId: true, attributes: true },
      });
      touched.push(made.id);
      // Kept, so a file that names the same key twice updates its own first row
      // rather than failing on the unique index halfway through.
      byKey.set(externalId, made);
      report.created += 1;
    }
  }

  // One row each, in one statement: an import of five hundred is five hundred
  // history entries, not five hundred round trips.
  if (touched.length > 0) {
    await prisma.activity.createMany({
      data: touched.map((itemId) => trail(itemId, user.id, "CI_IMPORTED", { to: source })),
    });
  }

  refreshItem();
  return { ok: true as const, report };
}

/* ---------------------------------------------------------------- columns -- */

/**
 * Which columns this person keeps on the register, for one view.
 *
 * No permission beyond being signed in: it is a preference about their own
 * screen, written to their own row — the same trade `saveDashboard` makes. And
 * a verb on its own rather than a draft: ticking a column is not describing
 * something, it is doing it.
 *
 * Normalised against the type's own fields on the way in, so an id nothing can
 * draw never reaches the column.
 */
export async function saveCiColumns(typeKey: string, columns: string[]) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canViewCis(user)) return { ok: false as const, error: t.errors.noPermission };

  // The view that spans every type offers every type's attributes, deduped —
  // the register draws an empty cell where a row's own type has no such field,
  // which is a smaller cost than a column somebody can only reach by picking a
  // side first.
  const fields = await prisma.ciTypeField.findMany({
    where: typeKey === ALL_TYPES ? {} : { type: { is: { key: typeKey } } },
    orderBy:
      typeKey === ALL_TYPES
        ? [{ type: { position: "asc" } }, { position: "asc" }]
        : { position: "asc" },
    select: FIELD_SELECT,
  });

  const allowed = availableColumns(unionFields(fields as FieldSpec[]));
  const kept = columns.filter((id) => allowed.includes(id));

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ciColumns: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { ciColumns: writeColumns(current?.ciColumns ?? null, typeKey, kept) },
    select: { id: true },
  });

  revalidatePath("/cmdb");
  return { ok: true as const };
}

/**
 * A view of the register, kept under a name.
 *
 * The query string exactly as the register produced it, because that is the
 * whole of what a view is — see `ci-views.ts`. A preference about their own
 * screen, written to their own row, so no permission beyond being able to read
 * the register at all; and a verb on its own rather than a draft, because
 * "Save current view" is the act, not a description of one.
 */
export async function saveCiView(name: string, query: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canViewCis(user)) return { ok: false as const, error: t.errors.noPermission };

  const wanted = name.trim();
  if (!wanted) return { ok: false as const, error: t.errors.nameCiView };

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ciViews: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { ciViews: withView(readViews(current?.ciViews), wanted, query) },
    select: { id: true },
  });

  revalidatePath("/cmdb");
  return { ok: true as const };
}

export async function deleteCiView(name: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canViewCis(user)) return { ok: false as const, error: t.errors.noPermission };

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ciViews: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { ciViews: withoutView(readViews(current?.ciViews), name) },
    select: { id: true },
  });

  revalidatePath("/cmdb");
  return { ok: true as const };
}

/**
 * The same change, to a handful of rows at once.
 *
 * Only the two fields a register is actually bulk-edited on: which stage of
 * life something is in, and who operates it. Not the name — fifty assets do not
 * share one — and not the attributes, which differ per type and would make this
 * a form that has to be rebuilt every time the selection changes.
 *
 * Every row still gets its own trail entry, worked out per item: "moved forty
 * things" is not an answer to "when did this become retired, and who said so".
 */
export async function updateCisInBulk(ids: string[], input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditCis(user)) return { ok: false as const, error: t.errors.noCiEdit };

  const parsed = ciBulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidChange };

  const { lifecycle, teamId } = parsed.data;
  // Nothing asked for is not an error, but it is not a write either.
  if (!lifecycle && teamId === undefined)
    return { ok: false as const, error: t.errors.pickAChange };

  const wanted = [...new Set(ids)].slice(0, BULK_LIMIT);
  const items = await prisma.configurationItem.findMany({
    where: { id: { in: wanted } },
    select: { id: true, lifecycle: true, teamId: true, team: { select: { name: true } } },
  });
  if (items.length === 0) return { ok: false as const, error: t.errors.ciGone };

  const team =
    teamId === undefined || teamId === null
      ? null
      : await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (teamId && !team) return { ok: false as const, error: t.errors.invalidChange };

  const entries = items.flatMap((item) => {
    const rows = [];
    if (lifecycle && item.lifecycle !== lifecycle) {
      rows.push(
        trail(item.id, user.id, "CI_UPDATED", {
          field: t.cmdb.lifecycle,
          from: t.cmdb.life[item.lifecycle],
          to: t.cmdb.life[lifecycle],
        }),
      );
    }
    if (teamId !== undefined && item.teamId !== (teamId || null)) {
      rows.push(
        trail(item.id, user.id, "CI_UPDATED", {
          field: t.cmdb.team,
          from: item.team?.name ?? null,
          to: team?.name ?? null,
        }),
      );
    }
    return rows;
  });

  await prisma.$transaction([
    prisma.configurationItem.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: {
        ...(lifecycle ? { lifecycle } : {}),
        ...(teamId === undefined ? {} : { teamId: teamId || null }),
      },
    }),
    prisma.activity.createMany({ data: entries }),
  ]);

  refreshItem();
  return { ok: true as const, changed: items.length };
}
