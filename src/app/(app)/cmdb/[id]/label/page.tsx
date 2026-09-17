import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewCis } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { labelsFor } from "@/lib/ci-labels";
import { CiLabelSheet } from "@/components/cmdb/ci-label-sheet";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.labels };
}

/** One asset's label. The same sheet as many, with one on it: a label printed
 *  from an item page and a label printed from a selection are the same piece of
 *  paper, and two of them would drift apart. */
export default async function CiLabelPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!canViewCis(user)) notFound();

  const { id } = await params;
  const labels = await labelsFor([id]);
  if (labels.length === 0) notFound();

  return <CiLabelSheet labels={labels} back={`/cmdb/${id}`} />;
}
