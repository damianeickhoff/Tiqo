import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCis } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { attrKeyOf, availableColumns } from "@/lib/ci-columns";
import type { FieldSpec } from "@/lib/cmdb";
import { CiTypeDesigner, type DesignerType } from "@/components/settings/ci-type-designer";
import { buttonClass, EmptyState } from "@/components/ui";
import { SettingsSheet } from "@/components/settings/sheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.typesTitle };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * What the desk looks after, and what each kind records about itself.
 *
 * One type at a time, picked from the top bar. A side list of four was a column
 * of width spent saying what a selector says in a line — and the designer is
 * wide because an attribute is six controls on a row.
 *
 * Behind `ci.manage` rather than `ci.edit`: adding a laptop is a day's work,
 * changing what a laptop *is* rewrites the shape of every laptop in the
 * register.
 */
export default async function CmdbSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!canManageCis(user)) notFound();

  const [t, params, types] = await Promise.all([
    getMessages(),
    searchParams,
    prisma.ciType.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        icon: true,
        color: true,
        namePattern: true,
        defaultColumns: true,
        fields: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            key: true,
            label: true,
            kind: true,
            required: true,
            options: true,
            isExpiry: true,
          },
        },
        _count: { select: { items: true } },
      },
    }),
  ]);

  if (types.length === 0) {
    return (
      <div className="px-5 py-8 lg:px-6">
        <EmptyState title={t.cmdb.noTypes} body={t.cmdb.typesBlurb} />
      </div>
    );
  }

  const wanted = (Array.isArray(params.type) ? params.type[0] : params.type)?.trim();
  const type = types.find((candidate) => candidate.key === wanted) ?? types[0]!;

  const design: DesignerType = {
    id: type.id,
    key: type.key,
    name: type.name,
    icon: type.icon,
    color: type.color,
    namePattern: type.namePattern,
    defaultColumns: type.defaultColumns,
    fields: type.fields,
    items: type._count.items,
  };

  // What this type's register could show, named the way the column picker names
  // it — so the chips here and the chips there say the same words.
  const columns = availableColumns(type.fields as FieldSpec[]).map((id) => {
    const key = attrKeyOf(id);
    if (key) return { id, label: type.fields.find((field) => field.key === key)?.label ?? key };
    if (id === "type") return { id, label: t.cmdb.type };
    if (id === "lifecycle") return { id, label: t.cmdb.lifecycle };
    if (id === "team") return { id, label: t.cmdb.team };
    return { id, label: t.cmdb.openHeading };
  });

  return (
    <SettingsSheet>
      <CiTypeDesigner
        // Remounted when the attributes are added to or taken away: those are
        // list-level commands and the draft is built from the rows that exist,
        // so it has to start again from the ones that exist now.
        key={`${type.id}:${type.fields.map((field) => field.id).join(",")}`}
        type={design}
        types={types.map((option) => ({
          id: option.id,
          key: option.key,
          name: option.name,
          icon: option.icon,
          color: option.color,
          items: option._count.items,
        }))}
        columns={columns}
      />

      {/* The feed, one press from the types it fills: deciding what a laptop
          records and loading five hundred of them are the same afternoon. */}
      <div className="px-5 pb-6 lg:px-6">
        <Link href="/settings/cmdb/import" className={buttonClass("outline", "sm")}>
          <Upload size={13} />
          {t.cmdb.importLink}
        </Link>
      </div>
    </SettingsSheet>
  );
}
