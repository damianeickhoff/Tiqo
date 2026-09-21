import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { docHref } from "@/lib/docs";
import { diffLines } from "@/lib/diff";
import { DocCompare, type Version } from "@/components/docs/doc-compare";

type Params = Promise<{ space: string; slug: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.docs.compareTitle };
}

/// What the live page is, on either picker.
const CURRENT = "current";

/**
 * Two versions of one page, lined up.
 *
 * A screen rather than a dialog over the page it came from: reading every
 * changed line and deciding whether to put an older version back both want the
 * width, and a diff squeezed into a rail's modal was being scrolled in two
 * directions at once.
 *
 * Which two is in the address, so a comparison can be sent to the person who
 * wrote the line in question.
 */
export default async function DocComparePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space: spaceKey, slug } = await params;
  const query = await searchParams;
  const [user, t, settings] = await Promise.all([requireUser(), getMessages(), getSettings()]);

  const doc = await prisma.doc.findFirst({
    where: { slug, space: { is: { key: spaceKey.toUpperCase() } } },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      updatedAt: true,
      archivedAt: true,
      updatedBy: { select: { name: true } },
      space: { select: { key: true } },
      revisions: {
        // Oldest first, so the numbering counts the way somebody would: the
        // first thing that was written is version one.
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          note: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  if (!doc) notFound();

  // Nothing has replaced anything yet, so there are no two versions to line
  // up. Opening on "Version 1" against itself, with two empty panes and a
  // line saying they agree, is a screen that answers a question nobody asked
  // — so the address simply goes back to the page.
  if (doc.revisions.length === 0) redirect(docHref(doc.space.key, doc.slug));

  const when = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // A revision holds what the page said *before* the save that wrote it, so
  // the oldest revision is version one and the live page is the last number.
  const versions: Version[] = [
    ...doc.revisions.map((revision, at) => ({
      id: revision.id,
      label: t.docs.versionN(at + 1, revision.author?.name ?? t.activity.someone),
      meta: [when.format(revision.createdAt), revision.note].filter(Boolean).join(" · "),
    })),
    {
      id: CURRENT,
      label: t.docs.versionN(doc.revisions.length + 1, doc.updatedBy?.name ?? t.activity.someone),
      meta: when.format(doc.updatedAt),
    },
  ];

  const bodyOf = (id: string) =>
    id === CURRENT ? doc.body : (doc.revisions.find((one) => one.id === id)?.body ?? null);

  // The change somebody arrived to look at, when they said nothing: the last
  // save, which is the version before the current one against the current one.
  const fallbackA = doc.revisions.at(-1)?.id ?? CURRENT;
  const asked = {
    a: asOne(query.a) ?? fallbackA,
    b: asOne(query.b) ?? CURRENT,
  };

  const known = (id: string) => (versions.some((one) => one.id === id) ? id : CURRENT);
  const order = (id: string) => versions.findIndex((one) => one.id === id);

  // Older on the left whatever order the two were picked in: a diff that reads
  // backwards says things were added when they were removed.
  const picked = [known(asked.a), known(asked.b)].sort((left, right) => order(left) - order(right));
  const [olderId, newerId] = picked as [string, string];

  const rows = diffLines(bodyOf(olderId) ?? "", bodyOf(newerId) ?? "");

  return (
    <DocCompare
      backHref={docHref(doc.space.key, doc.slug)}
      backTitle={doc.title}
      versions={versions}
      olderId={olderId}
      newerId={newerId}
      olderMeta={versions.find((one) => one.id === olderId)!}
      newerMeta={versions.find((one) => one.id === newerId)!}
      rows={rows}
      canEdit={canEditDocs(user) && !doc.archivedAt}
    />
  );
}

/** One value out of a search parameter that could have arrived twice. */
function asOne(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
