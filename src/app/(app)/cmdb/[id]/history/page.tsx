import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canViewCis } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { ActivityFeed } from "@/components/tickets/activity";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.cmdb.history };
}

/// Two hundred is where a history stops being read and starts being audited,
/// and auditing is what the export is for.
const LIMIT = 200;

/** Everything that has been done to one asset. The item page keeps the last
 *  five, which is what anybody reads; this is the rest of it. */
export default async function CiHistoryPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!canViewCis(user)) notFound();

  const { id } = await params;

  const item = await prisma.configurationItem.findUnique({
    where: { id },
    select: { id: true, name: true, type: { select: { name: true, color: true, icon: true } } },
  });
  if (!item) notFound();

  const [settings, t, history] = await Promise.all([
    getSettings(),
    getMessages(),
    prisma.activity.findMany({
      where: { itemId: id },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        type: true,
        field: true,
        oldValue: true,
        newValue: true,
        link: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarVariant: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader title={t.cmdb.history} />

      <div className="border-line flex items-center gap-3 border-b px-5 py-3 lg:px-6">
        <Link
          href={`/cmdb/${item.id}`}
          className="text-text-3 hover:text-text inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={12} strokeWidth={2.5} />
          {item.name}
        </Link>
        <span aria-hidden className="bg-line h-4 w-px" />
        <CiGlyph icon={item.type.icon} color={item.type.color} size={13} />
        <span className="text-text-2 text-sm font-medium">{item.type.name}</span>
      </div>

      <div className="px-5 py-5 lg:px-6">
        <Card className="p-4">
          <ActivityFeed
            events={history}
            canRemove={false}
            locale={settings.locale}
            dateLocale={dateLocaleOf(settings)}
          />
        </Card>
      </div>
    </>
  );
}
