import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PortalIcon } from "@/components/portal/portal-icon";
import { getMessages } from "@/lib/settings";

export type ShelfItem = {
  slug: string;
  name: string;
  icon: string | null;
  color: string;
  /// Forms and answers in the section, its sub-sections included.
  count: number;
};

/**
 * The category shelf: six places, overlapping the hero's lower edge.
 *
 * Five sections and then "Browse everything", always. Five, six or seven
 * sections would otherwise leave a ragged last row, and the sixth place is a
 * way to the whole catalogue rather than a sixth subject. With fewer than five
 * the grid keeps its six columns so the tiles stay the same size, the empty
 * places simply stay empty, and the way to everything still comes last.
 */
export async function PortalShelf({
  items,
  totalItems,
  totalSections,
}: {
  items: ShelfItem[];
  totalItems: number;
  totalSections: number;
}) {
  const t = await getMessages();

  const slot =
    "flex flex-col items-center gap-3 rounded-[14px] px-3 pt-[26px] pb-[22px] text-center transition-colors hover:bg-surface-2";

  return (
    <div className="portal-wrap">
      <div className="bg-surface relative z-[3] -mt-8 grid grid-cols-2 rounded-[20px] p-2 shadow-[var(--shadow-md)] sm:grid-cols-3 lg:mx-10 lg:-mt-[60px] lg:grid-cols-6">
        {items.map((item) => (
          <Link key={item.slug} href={`/portal/c/${item.slug}`} className={slot}>
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-full text-white"
              style={{ background: item.color }}
            >
              <PortalIcon name={item.icon} size={24} />
            </span>
            <span className="text-[14.5px] leading-tight font-semibold tracking-[-0.01em]">
              {item.name}
            </span>
            <span className="text-text-3 -mt-2 text-[12.5px]">
              {t.portal.itemCount(item.count)}
            </span>
          </Link>
        ))}

        <Link href="/portal/search" className={slot}>
          <span
            aria-hidden
            className="bg-surface-2 text-text flex size-14 items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
          >
            <ArrowRight size={22} />
          </span>
          <span className="text-text-2 text-[14.5px] leading-tight font-semibold tracking-[-0.01em]">
            {t.portal.browseEverything}
          </span>
          <span className="text-text-3 -mt-2 text-[12.5px]">
            {t.portal.shelfCount(totalItems, totalSections)}
          </span>
        </Link>
      </div>
    </div>
  );
}
