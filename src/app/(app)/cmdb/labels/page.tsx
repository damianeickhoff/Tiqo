import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewCis } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { labelsFor } from "@/lib/ci-labels";
import { CiLabelSheet } from "@/components/cmdb/ci-label-sheet";
import { EmptyState } from "@/components/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.labels };
}

/** A sheet of labels for whatever was ticked in the register. */
export default async function CiLabelsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!canViewCis(user)) notFound();

  const params = await searchParams;
  const raw = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const labels = await labelsFor((raw ?? "").split(",").filter(Boolean));

  const t = await getMessages();
  if (labels.length === 0) {
    return (
      <div className="px-5 py-8">
        <EmptyState title={t.cmdb.noLabelsTitle} body={t.cmdb.noLabelsBody} />
      </div>
    );
  }

  return <CiLabelSheet labels={labels} back="/cmdb" />;
}
