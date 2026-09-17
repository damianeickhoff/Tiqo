"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { uniqueSlug } from "@/lib/portal";
import { parseHex } from "@/lib/brand";
import { saveImageAsset } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";
import type {
  AnnouncementTone,
  PortalBlockKind,
  PortalFieldKind,
  PortalFieldTarget,
  PortalHeroStyle,
} from "@/generated/prisma/enums";

/**
 * Everything that shapes the portal: its front page, its catalogue, its forms,
 * its knowledge and its notices.
 *
 * All of it answers to `settings.tickets` — a form is a way of raising a ticket,
 * and the two drift apart if they answer to different people.
 */
function refresh(path?: string) {
  revalidatePath("/portal", "layout");
  revalidatePath("/settings/portal", "layout");
  if (path) revalidatePath(path);
}

async function guard() {
  const [t, user] = await Promise.all([getMessages(), requireUser()]);
  // The person doing it travels with the guard: an answer records who wrote it
  // and who touched it last, and every write here is one of the two.
  return { t, user, ok: can(user, "settings.tickets") };
}

/* ------------------------------------------------------------------- blocks -- */

export async function addBlock(kind: PortalBlockKind) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const last = await prisma.portalBlock.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.portalBlock.create({ data: { kind, position: (last?.position ?? -1) + 1 } });
  refresh();
  return { ok: true as const };
}

export async function updateBlock(
  blockId: string,
  patch: {
    title?: string;
    subtitle?: string;
    limit?: number | null;
    categoryId?: string | null;
    isActive?: boolean;
    span?: number;
    heroStyle?: PortalHeroStyle;
    heroColor?: string;
    heroColor2?: string;
    heroImage?: string;
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  // A colour that cannot be read is not stored. The band falls back to the
  // brand when it meets one, and a value that is silently dropped is worse
  // than being told the six characters were wrong.
  for (const value of [patch.heroColor, patch.heroColor2]) {
    if (value?.trim() && !parseHex(value)) {
      return { ok: false as const, error: t.errors.badColour };
    }
  }

  // Absolute, and http only: a relative address would resolve against the
  // portal, and anything else is a scheme in a style attribute.
  if (patch.heroImage?.trim() && !/^https?:\/\/\S+$/i.test(patch.heroImage.trim())) {
    return { ok: false as const, error: t.errors.badImageUrl };
  }

  await prisma.portalBlock.update({
    where: { id: blockId },
    data: {
      ...(patch.title === undefined ? {} : { title: patch.title.trim().slice(0, 120) || null }),
      ...(patch.subtitle === undefined
        ? {}
        : { subtitle: patch.subtitle.trim().slice(0, 240) || null }),
      ...(patch.limit === undefined ? {} : { limit: patch.limit }),
      ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      ...(patch.heroStyle === undefined ? {} : { heroStyle: patch.heroStyle }),
      ...(patch.heroColor === undefined ? {} : { heroColor: patch.heroColor.trim() || null }),
      ...(patch.heroColor2 === undefined ? {} : { heroColor2: patch.heroColor2.trim() || null }),
      ...(patch.heroImage === undefined
        ? {}
        : { heroImage: patch.heroImage.trim().slice(0, 500) || null }),
      // Two columns of six is a third of the page and the narrowest a band
      // stays readable at; six is the row. Clamped here as well as in the
      // designer, because the designer is not the only thing that can call it.
      ...(patch.span === undefined
        ? {}
        : { span: Math.min(6, Math.max(2, Math.round(patch.span))) }),
    },
  });

  refresh();
  return { ok: true as const };
}

/**
 * A picture for the search band, uploaded rather than linked.
 *
 * Returns the address it is served at, which is what the field already held
 * when the only way to fill it was to paste one. Nothing is written to the
 * band here: the picture is stored, the designer puts the address in the
 * draft, and Save is still what commits it.
 */
export async function uploadHeroImage(file: File) {
  const { t, ok, user } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const stored = await saveImageAsset(file, user.id);
  if ("error" in stored) {
    return {
      ok: false as const,
      error:
        stored.error === "type"
          ? t.errors.imageTypeOnly
          : stored.error === "size"
            ? t.errors.imageTooBig
            : t.errors.generic,
    };
  }

  return { ok: true as const, url: stored.url };
}

/**
 * The whole running order at once, as the designer left it.
 *
 * Dragging produces a new arrangement, not a sequence of swaps, and replaying
 * it as swaps would write a position for every band anyway. Ids the caller does
 * not mention keep their place at the end, so a band added in another tab is
 * not silently dropped out of the page.
 */
export async function reorderBlocks(ids: string[]) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const all = await prisma.portalBlock.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const known = new Set(all.map((row) => row.id));
  const order = [
    ...ids.filter((id) => known.has(id)),
    ...all.map((row) => row.id).filter((id) => !ids.includes(id)),
  ];

  await prisma.$transaction(
    order.map((id, position) => prisma.portalBlock.update({ where: { id }, data: { position } })),
  );

  refresh();
  return { ok: true as const };
}

export async function deleteBlock(blockId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.portalBlock.delete({ where: { id: blockId } });
  refresh();
  return { ok: true as const };
}

export async function moveBlock(blockId: string, direction: "up" | "down") {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const all = await prisma.portalBlock.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === blockId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.portalBlock.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh();
  return { ok: true as const };
}

/* --------------------------------------------------------------- categories -- */

/**
 * A section made on the spot, from a picker that was about to need one. Returns
 * the id so the caller can select it straight away — the alternative is sending
 * someone to another page mid-sentence.
 */
export async function addCategory(name: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false as const, error: t.errors.nameCategory };

  const last = await prisma.portalCategory.findFirst({
    where: { parentId: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.portalCategory.create({
    data: {
      name: clean,
      slug: await uniqueSlug("portalCategory", clean),
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true, name: true },
  });

  refresh();
  return { ok: true as const, id: created.id, name: created.name };
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t, ok } = await guard();
  if (!ok) return { errors: { form: t.errors.noSettings } };

  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  if (!name) return { errors: { name: t.errors.nameCategory } };

  const parentId = String(formData.get("parentId") ?? "") || null;

  const last = await prisma.portalCategory.findFirst({
    where: { parentId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.portalCategory.create({
    data: {
      name,
      slug: await uniqueSlug("portalCategory", name),
      parentId,
      icon: String(formData.get("icon") ?? "help").trim() || null,
      color: String(formData.get("color") ?? "#febe2e"),
      position: (last?.position ?? -1) + 1,
    },
  });

  refresh();
  return {};
}

export async function updateCategory(
  categoryId: string,
  patch: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    parentId?: string | null;
    isActive?: boolean;
    /// True puts the section on the front page's shelf, after whatever is
    /// there; false takes it off. The shelf holds five.
    leadsPortal?: boolean;
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const name = patch.name?.trim().slice(0, 60);
  if (patch.name !== undefined && !name) {
    return { ok: false as const, error: t.errors.nameCategory };
  }

  let leadsPortal: number | null | undefined;
  if (patch.leadsPortal === false) leadsPortal = null;
  if (patch.leadsPortal === true) {
    const leading = await prisma.portalCategory.findMany({
      where: { leadsPortal: { not: null }, NOT: { id: categoryId } },
      orderBy: { leadsPortal: "desc" },
      select: { leadsPortal: true },
    });
    if (leading.length >= SHELF_PLACES) return { ok: false as const, error: t.errors.shelfFull };
    leadsPortal = (leading[0]?.leadsPortal ?? -1) + 1;
  }

  // A section cannot be filed under itself, and the tree is one level deep, so
  // a parent that already has one is not a parent anyone may pick.
  if (patch.parentId) {
    if (patch.parentId === categoryId) return { ok: false as const, error: t.errors.generic };
    const parent = await prisma.portalCategory.findUnique({
      where: { id: patch.parentId },
      select: { parentId: true },
    });
    if (parent?.parentId) return { ok: false as const, error: t.errors.oneLevelOnly };
  }

  await prisma.portalCategory.update({
    where: { id: categoryId },
    data: {
      ...(name === undefined ? {} : { name }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 200) || null }),
      ...(patch.icon === undefined ? {} : { icon: patch.icon.trim() || null }),
      ...(patch.color === undefined ? {} : { color: patch.color }),
      ...(patch.parentId === undefined ? {} : { parentId: patch.parentId }),
      ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      ...(leadsPortal === undefined ? {} : { leadsPortal }),
    },
  });

  refresh();
  return { ok: true as const };
}

/** The shelf on the portal's front page: five sections and "Browse everything". */
const SHELF_PLACES = 5;

export async function deleteCategory(categoryId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.portalCategory.delete({ where: { id: categoryId } });
  refresh();
  return { ok: true as const };
}

export async function moveCategory(categoryId: string, direction: "up" | "down") {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const category = await prisma.portalCategory.findUnique({
    where: { id: categoryId },
    select: { parentId: true },
  });
  if (!category) return { ok: true as const };

  const siblings = await prisma.portalCategory.findMany({
    where: { parentId: category.parentId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = siblings.findIndex((row) => row.id === categoryId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return { ok: true as const };

  const reordered = [...siblings];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.portalCategory.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh();
  return { ok: true as const };
}

/* -------------------------------------------------------------------- forms -- */

export async function createForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t, ok } = await guard();
  if (!ok) return { errors: { form: t.errors.noSettings } };

  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 80);
  if (!name) return { errors: { name: t.errors.nameForm } };

  const last = await prisma.portalForm.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // A new form is born able to raise something: a subject and a description are
  // what a ticket is, so they are laid down rather than left to be remembered.
  const created = await prisma.portalForm.create({
    data: {
      name,
      slug: await uniqueSlug("portalForm", name),
      categoryId: String(formData.get("categoryId") ?? "") || null,
      type: (String(formData.get("type") ?? "QUESTION") || "QUESTION") as
        "QUESTION" | "INCIDENT" | "CHANGE",
      position: (last?.position ?? -1) + 1,
      fields: {
        create: [
          {
            label: "Subject",
            kind: "TEXT",
            target: "TITLE",
            required: true,
            position: 0,
          },
          {
            label: "Tell us what you need",
            kind: "TEXTAREA",
            target: "DESCRIPTION",
            required: true,
            position: 1,
          },
        ],
      },
    },
    select: { id: true },
  });

  refresh();
  redirect(`/settings/portal/forms/${created.id}`);
}

export async function updateForm(
  formId: string,
  patch: {
    name?: string;
    summary?: string;
    description?: string;
    confirmation?: string;
    keywords?: string;
    icon?: string;
    color?: string;
    categoryId?: string | null;
    type?: "QUESTION" | "INCIDENT" | "CHANGE";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    teamId?: string | null;
    projectId?: string | null;
    planId?: string | null;
    isActive?: boolean;
    isFeatured?: boolean;
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const name = patch.name?.trim().slice(0, 80);
  if (patch.name !== undefined && !name) return { ok: false as const, error: t.errors.nameForm };

  await prisma.portalForm.update({
    where: { id: formId },
    data: {
      ...(name === undefined ? {} : { name }),
      ...(patch.summary === undefined
        ? {}
        : { summary: patch.summary.trim().slice(0, 200) || null }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 600) || null }),
      ...(patch.confirmation === undefined
        ? {}
        : { confirmation: patch.confirmation.trim().slice(0, 400) || null }),
      ...(patch.keywords === undefined
        ? {}
        : {
            keywords: patch.keywords
              .split(",")
              .map((word) => word.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 25),
          }),
      ...(patch.icon === undefined ? {} : { icon: patch.icon.trim() || null }),
      ...(patch.color === undefined ? {} : { color: patch.color }),
      ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      ...(patch.type === undefined ? {} : { type: patch.type }),
      ...(patch.priority === undefined ? {} : { priority: patch.priority }),
      ...(patch.teamId === undefined ? {} : { teamId: patch.teamId }),
      ...(patch.projectId === undefined ? {} : { projectId: patch.projectId }),
      ...(patch.planId === undefined ? {} : { planId: patch.planId }),
      ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      ...(patch.isFeatured === undefined ? {} : { isFeatured: patch.isFeatured }),
    },
  });

  refresh(`/settings/portal/forms/${formId}`);
  return { ok: true as const };
}

export async function duplicateForm(formId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const source = await prisma.portalForm.findUnique({
    where: { id: formId },
    include: {
      sections: { orderBy: { position: "asc" } },
      fields: { orderBy: { position: "asc" } },
    },
  });
  if (!source) return { ok: false as const, error: t.errors.formGone };

  const name = `${source.name} (2)`;

  const made = await prisma.$transaction(async (tx) => {
    const copy = await tx.portalForm.create({
      data: {
        name,
        slug: await uniqueSlug("portalForm", name),
        summary: source.summary,
        description: source.description,
        confirmation: source.confirmation,
        keywords: source.keywords,
        icon: source.icon,
        color: source.color,
        categoryId: source.categoryId,
        type: source.type,
        priority: source.priority,
        teamId: source.teamId,
        projectId: source.projectId,
        planId: source.planId,
        // A copy starts hidden: it is almost always about to be edited.
        isActive: false,
        position: source.position + 1,
      },
      select: { id: true },
    });

    const sectionIds = new Map<string, string>();
    for (const section of source.sections) {
      const made = await tx.portalFormSection.create({
        data: {
          formId: copy.id,
          title: section.title,
          description: section.description,
          position: section.position,
        },
        select: { id: true },
      });
      sectionIds.set(section.id, made.id);
    }

    const fieldIds = new Map<string, string>();
    for (const field of source.fields) {
      const made = await tx.portalFormField.create({
        data: {
          formId: copy.id,
          sectionId: field.sectionId ? (sectionIds.get(field.sectionId) ?? null) : null,
          label: field.label,
          hint: field.hint,
          placeholder: field.placeholder,
          kind: field.kind,
          target: field.target,
          required: field.required,
          halfWidth: field.halfWidth,
          options: field.options,
          position: field.position,
        },
        select: { id: true },
      });
      fieldIds.set(field.id, made.id);
    }

    // Conditions point at the copies, not at the original's fields.
    for (const field of source.fields) {
      if (!field.showWhenFieldId) continue;
      await tx.portalFormField.update({
        where: { id: fieldIds.get(field.id)! },
        data: {
          showWhenFieldId: fieldIds.get(field.showWhenFieldId) ?? null,
          showWhenValue: field.showWhenValue,
        },
      });
    }

    return copy.id;
  });

  refresh();
  // The id travels back so the designer can open the copy: duplicating and
  // then having to find the copy in the list is two steps for one intention.
  return { ok: true as const, id: made };
}

export async function deleteForm(formId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.portalForm.delete({ where: { id: formId } });
  refresh();
  return { ok: true as const };
}

/* ----------------------------------------------------------------- sections -- */

export async function addSection(formId: string, title: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const text = title.trim().slice(0, 80) || "Section";

  const last = await prisma.portalFormSection.findFirst({
    where: { formId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.portalFormSection.create({
    data: { formId, title: text, position: (last?.position ?? -1) + 1 },
  });

  refresh(`/settings/portal/forms/${formId}`);
  return { ok: true as const };
}

export async function updateSection(
  sectionId: string,
  patch: { title?: string; description?: string },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const section = await prisma.portalFormSection.update({
    where: { id: sectionId },
    data: {
      ...(patch.title === undefined ? {} : { title: patch.title.trim().slice(0, 80) || "Section" }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 300) || null }),
    },
    select: { formId: true },
  });

  refresh(`/settings/portal/forms/${section.formId}`);
  return { ok: true as const };
}

/** Deleting a section keeps its questions: they fall out of the group rather
 *  than out of the form, which is almost always what was meant. */
export async function deleteSection(sectionId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const section = await prisma.portalFormSection.delete({
    where: { id: sectionId },
    select: { formId: true },
  });

  refresh(`/settings/portal/forms/${section.formId}`);
  return { ok: true as const };
}

/* ------------------------------------------------------------------- fields -- */

export async function addField(formId: string, kind: PortalFieldKind, sectionId?: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const last = await prisma.portalFormField.findFirst({
    where: { formId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.portalFormField.create({
    data: {
      formId,
      sectionId: sectionId || null,
      kind,
      label: t.forms.newQuestionName,
      options: kind === "SELECT" || kind === "RADIO" ? ["Option one", "Option two"] : [],
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  refresh(`/settings/portal/forms/${formId}`);
  return { ok: true as const, id: created.id };
}

export async function updateField(
  fieldId: string,
  patch: {
    label?: string;
    hint?: string;
    placeholder?: string;
    kind?: PortalFieldKind;
    target?: PortalFieldTarget;
    required?: boolean;
    halfWidth?: boolean;
    options?: string;
    sectionId?: string | null;
    showWhenFieldId?: string | null;
    showWhenValue?: string | null;
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const field = await prisma.portalFormField.findUnique({
    where: { id: fieldId },
    select: { formId: true, position: true },
  });
  if (!field) return { ok: false as const, error: t.errors.generic };

  // Every question has to say what it is asking. Without this a form can be
  // published with a blank line where a question should be, and the person
  // filling it in has no way to guess what belongs there.
  if (patch.label !== undefined && !patch.label.trim()) {
    return { ok: false as const, error: t.errors.labelField };
  }

  // A field may only depend on one that comes before it: that is what makes a
  // form impossible to make un-answerable.
  if (patch.showWhenFieldId) {
    const target = await prisma.portalFormField.findUnique({
      where: { id: patch.showWhenFieldId },
      select: { formId: true, position: true },
    });
    if (!target || target.formId !== field.formId || target.position >= field.position) {
      return { ok: false as const, error: t.errors.fieldOrderOnly };
    }
  }

  await prisma.portalFormField.update({
    where: { id: fieldId },
    data: {
      ...(patch.label === undefined ? {} : { label: patch.label.trim().slice(0, 120) }),
      ...(patch.hint === undefined ? {} : { hint: patch.hint.trim().slice(0, 240) || null }),
      ...(patch.placeholder === undefined
        ? {}
        : { placeholder: patch.placeholder.trim().slice(0, 120) || null }),
      ...(patch.kind === undefined ? {} : { kind: patch.kind }),
      ...(patch.target === undefined ? {} : { target: patch.target }),
      ...(patch.required === undefined ? {} : { required: patch.required }),
      ...(patch.halfWidth === undefined ? {} : { halfWidth: patch.halfWidth }),
      ...(patch.sectionId === undefined ? {} : { sectionId: patch.sectionId }),
      ...(patch.showWhenFieldId === undefined ? {} : { showWhenFieldId: patch.showWhenFieldId }),
      ...(patch.showWhenValue === undefined ? {} : { showWhenValue: patch.showWhenValue }),
      ...(patch.options === undefined
        ? {}
        : {
            options: patch.options
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 40),
          }),
    },
  });

  refresh(`/settings/portal/forms/${field.formId}`);
  return { ok: true as const };
}

export async function deleteField(fieldId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const field = await prisma.portalFormField.delete({
    where: { id: fieldId },
    select: { formId: true },
  });

  refresh(`/settings/portal/forms/${field.formId}`);
  return { ok: true as const };
}

export async function moveField(fieldId: string, direction: "up" | "down") {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const field = await prisma.portalFormField.findUnique({
    where: { id: fieldId },
    select: { formId: true },
  });
  if (!field) return { ok: true as const };

  const all = await prisma.portalFormField.findMany({
    where: { formId: field.formId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === fieldId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.portalFormField.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh(`/settings/portal/forms/${field.formId}`);
  return { ok: true as const };
}

/* ---------------------------------------------------------------- knowledge -- */

export async function createArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t, user, ok } = await guard();
  if (!ok) return { errors: { form: t.errors.noSettings } };

  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 160);
  if (!title) return { errors: { title: t.errors.nameArticle } };

  const created = await prisma.portalArticle.create({
    data: {
      title,
      slug: await uniqueSlug("portalArticle", title),
      body: "",
      createdById: user.id,
      updatedById: user.id,
      categoryId: String(formData.get("categoryId") ?? "") || null,
    },
    select: { id: true },
  });

  refresh();
  redirect(`/settings/portal/knowledge/${created.id}`);
}

export async function updateArticle(
  articleId: string,
  patch: {
    title?: string;
    summary?: string;
    body?: string;
    keywords?: string;
    categoryId?: string | null;
    isPublished?: boolean;
    isFeatured?: boolean;
  },
) {
  const { t, user, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const title = patch.title?.trim().slice(0, 160);
  if (patch.title !== undefined && !title) {
    return { ok: false as const, error: t.errors.nameArticle };
  }

  await prisma.portalArticle.update({
    where: { id: articleId },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(patch.summary === undefined
        ? {}
        : { summary: patch.summary.trim().slice(0, 240) || null }),
      ...(patch.body === undefined ? {} : { body: patch.body.slice(0, 20_000) }),
      ...(patch.keywords === undefined
        ? {}
        : {
            keywords: patch.keywords
              .split(",")
              .map((word) => word.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 25),
          }),
      ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      ...(patch.isPublished === undefined ? {} : { isPublished: patch.isPublished }),
      ...(patch.isFeatured === undefined ? {} : { isFeatured: patch.isFeatured }),
      // Who touched it last, so a stale answer can be traced to somebody.
      updatedById: user.id,
    },
  });

  refresh(`/settings/portal/knowledge/${articleId}`);
  return { ok: true as const };
}

export async function deleteArticle(articleId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.portalArticle.delete({ where: { id: articleId } });
  refresh();
  return { ok: true as const };
}

/* ------------------------------------------------------------ announcements -- */

export async function createAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t, ok } = await guard();
  if (!ok) return { errors: { form: t.errors.noSettings } };

  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 160);
  if (!title) return { errors: { title: t.errors.nameAnnouncement } };

  const last = await prisma.portalAnnouncement.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.portalAnnouncement.create({
    data: {
      title,
      body:
        String(formData.get("body") ?? "")
          .trim()
          .slice(0, 600) || null,
      tone: (String(formData.get("tone") ?? "INFO") || "INFO") as AnnouncementTone,
      position: (last?.position ?? -1) + 1,
    },
  });

  refresh();
  return {};
}

export async function updateAnnouncement(
  announcementId: string,
  patch: {
    title?: string;
    body?: string;
    tone?: AnnouncementTone;
    isActive?: boolean;
    /// A local datetime as the input gives it, or "" to run until switched off.
    endsAt?: string;
    isBanner?: boolean;
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const ends =
    patch.endsAt === undefined ? undefined : patch.endsAt ? new Date(patch.endsAt) : null;
  if (ends !== undefined && ends !== null && Number.isNaN(ends.getTime())) {
    return { ok: false as const, error: t.errors.generic };
  }

  // One banner at a time: a page with two of them has none. Promoting this
  // notice demotes whichever one was up.
  if (patch.isBanner) {
    await prisma.portalAnnouncement.updateMany({
      where: { isBanner: true, id: { not: announcementId } },
      data: { isBanner: false },
    });
  }

  await prisma.portalAnnouncement.update({
    where: { id: announcementId },
    data: {
      ...(patch.title === undefined ? {} : { title: patch.title.trim().slice(0, 160) }),
      ...(patch.body === undefined ? {} : { body: patch.body.trim().slice(0, 600) || null }),
      ...(patch.tone === undefined ? {} : { tone: patch.tone }),
      ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      ...(ends === undefined ? {} : { endsAt: ends }),
      ...(patch.isBanner === undefined ? {} : { isBanner: patch.isBanner }),
    },
  });

  refresh();
  return { ok: true as const };
}

export async function deleteAnnouncement(announcementId: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.portalAnnouncement.delete({ where: { id: announcementId } });
  refresh();
  return { ok: true as const };
}

/**
 * An answer in another language.
 *
 * The article keeps the words it was written in; this is the version somebody
 * reading in another language gets instead. Saving an empty one removes it, so
 * a half-written translation can be taken back rather than left to show up as
 * a blank page.
 */
export async function saveArticleTranslation(
  articleId: string,
  locale: string,
  patch: { title: string; summary: string; body: string },
) {
  const { t, user, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const title = patch.title.trim().slice(0, 160);
  const body = patch.body.slice(0, 20_000);
  const summary = patch.summary.trim().slice(0, 240);

  if (!title && !body && !summary) {
    await prisma.portalArticleTranslation.deleteMany({ where: { articleId, locale } });
  } else {
    if (!title) return { ok: false as const, error: t.errors.nameArticle };
    await prisma.portalArticleTranslation.upsert({
      where: { articleId_locale: { articleId, locale } },
      update: { title, summary: summary || null, body },
      create: { articleId, locale, title, summary: summary || null, body },
    });
  }

  // The article itself has changed as far as a reader is concerned.
  await prisma.portalArticle.update({
    where: { id: articleId },
    data: { updatedById: user.id },
  });

  refresh(`/settings/portal/knowledge/${articleId}`);
  return { ok: true as const };
}

/**
 * A form in another language.
 *
 * One save for the whole form rather than one per question: a half-translated
 * form is a worse thing to ship than an untranslated one, so the words are
 * committed together. A row whose fields are all empty is deleted, which is how
 * a translation is taken back.
 */
export async function saveFormTranslation(
  formId: string,
  locale: string,
  patch: {
    name: string;
    summary: string;
    description: string;
    fields: { id: string; label: string; hint: string; placeholder: string; options: string }[];
  },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const name = patch.name.trim().slice(0, 80);
  const summary = patch.summary.trim().slice(0, 200);
  const description = patch.description.trim().slice(0, 600);

  if (!name && !summary && !description) {
    await prisma.portalFormTranslation.deleteMany({ where: { formId, locale } });
  } else {
    if (!name) return { ok: false as const, error: t.errors.nameForm };
    await prisma.portalFormTranslation.upsert({
      where: { formId_locale: { formId, locale } },
      update: { name, summary: summary || null, description: description || null },
      create: { formId, locale, name, summary: summary || null, description: description || null },
    });
  }

  // Only this form's own questions, whatever the client sent: a field id from
  // another form would otherwise be translatable from here.
  const mine = new Set(
    (await prisma.portalFormField.findMany({ where: { formId }, select: { id: true } })).map(
      (field) => field.id,
    ),
  );

  for (const field of patch.fields) {
    if (!mine.has(field.id)) continue;

    const label = field.label.trim().slice(0, 120);
    const hint = field.hint.trim().slice(0, 240);
    const placeholder = field.placeholder.trim().slice(0, 120);
    const options = field.options
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);

    if (!label && !hint && !placeholder && options.length === 0) {
      await prisma.portalFormFieldTranslation.deleteMany({ where: { fieldId: field.id, locale } });
      continue;
    }
    if (!label) return { ok: false as const, error: t.errors.labelField };

    await prisma.portalFormFieldTranslation.upsert({
      where: { fieldId_locale: { fieldId: field.id, locale } },
      update: { label, hint: hint || null, placeholder: placeholder || null, options },
      create: {
        fieldId: field.id,
        locale,
        label,
        hint: hint || null,
        placeholder: placeholder || null,
        options,
      },
    });
  }

  refresh(`/settings/portal/forms/${formId}`);
  return { ok: true as const };
}
