import Link from "next/link";
import { Printer, TriangleAlert } from "lucide-react";
import { getMessages } from "@/lib/settings";
import { daysUntil, type Lifespan } from "@/lib/cmdb";
import { WarrantyBar } from "@/components/cmdb/ci-details";
import { RetireButton } from "@/components/cmdb/ci-retire";
import { PanelCard } from "@/components/tickets/panel-card";

/**
 * The fault next door.
 *
 * The one-hop query `ticket-assets.ts` runs from a ticket, run from the asset's
 * own side. It is the line that earns the register its keep: the box in front of
 * you is fine, and the thing it depends on is not — which nothing on this page
 * would otherwise say.
 */
export async function CiNearby({
  reference,
  title,
  number,
  asset,
}: {
  reference: string;
  title: string;
  number: number;
  asset: string;
}) {
  const t = await getMessages();

  return (
    <PanelCard
      title={t.cmdb.nearbyTitle}
      action={<span className="text-text-3 text-xs">{t.cmdb.oneHop}</span>}
    >
      <p className="text-text-2 flex items-start gap-2 px-3.5 py-3 text-sm leading-relaxed">
        <span className="text-brand-deep mt-0.5 shrink-0">
          <TriangleAlert size={14} />
        </span>
        <span>
          <Link href={`/tickets/${number}`} className="text-text font-semibold hover:underline">
            {reference}
          </Link>{" "}
          {title} — {t.cmdb.nearbyOn(asset)}
        </span>
      </p>
    </PanelCard>
  );
}

/**
 * How much life this asset has left, and the way out.
 *
 * The bar is the card: a purchase date and a warranty date are two facts a
 * person has to subtract, and the bar is the subtraction already done. Retire
 * sits in the header because it is what somebody does when the bar has run out.
 */
export async function CiLifecycleCard({
  span,
  dateFormat,
  itemId,
  canEdit,
  retired,
}: {
  span: Lifespan;
  dateFormat: Intl.DateTimeFormat;
  itemId: string;
  canEdit: boolean;
  retired: boolean;
}) {
  const t = await getMessages();

  return (
    <PanelCard
      title={t.cmdb.lifecycle}
      action={canEdit && !retired ? <RetireButton itemId={itemId} /> : null}
    >
      <div className="px-3.5 py-3">
        <WarrantyBar
          span={span}
          dateFormat={dateFormat}
          remaining={t.cmdb.until(daysUntil(span.to.value))}
        />
      </div>
    </PanelCard>
  );
}

/** A code that opens this page, and a way to print it. For rack doors and loan
 *  laptops, which is where the register stops being a list and starts being the
 *  thing in front of you. */
export async function CiLabelCard({
  itemId,
  path,
  size,
}: {
  itemId: string;
  path: string | null;
  size: number;
}) {
  const t = await getMessages();

  return (
    <PanelCard
      title={t.cmdb.labelCard}
      action={
        <Link
          href={`/cmdb/${itemId}/label`}
          className="text-text-3 hover:text-text flex items-center gap-1 text-xs font-medium transition-colors"
        >
          <Printer size={12} />
          {t.cmdb.printLabel}
        </Link>
      }
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        {path ? (
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={64}
            height={64}
            aria-hidden
            className="border-line shrink-0 rounded-[6px] border bg-white p-1"
          >
            <path d={path} fill="#000" />
          </svg>
        ) : null}
        <p className="text-text-2 text-sm leading-relaxed">{t.cmdb.labelHint}</p>
      </div>
    </PanelCard>
  );
}
