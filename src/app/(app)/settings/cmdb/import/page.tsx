import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageCis } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { CiImport } from "@/components/settings/ci-import";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.importTitle };
}

/**
 * The feed.
 *
 * A CMDB maintained entirely by hand disagrees with reality inside a quarter,
 * and a register nobody trusts is worse than none — people stop checking it and
 * start guessing. This is the cheapest honest answer to what keeps it true.
 */
export default async function CmdbImportPage() {
  const user = await requireUser();
  if (!canManageCis(user)) notFound();

  const t = await getMessages();
  const types = await prisma.ciType.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      fields: {
        orderBy: { position: "asc" },
        select: { key: true, label: true, required: true },
      },
    },
  });

  return (
    <SettingsSection title={t.cmdb.importTitle} description={t.cmdb.importBlurb}>
      <CiImport types={types} />
    </SettingsSection>
  );
}
