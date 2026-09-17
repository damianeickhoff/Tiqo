"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { updateCisInBulk } from "@/lib/actions/cmdb";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Taking an asset out of service, from the rail.
 *
 * A verb on its own, so it happens when it is pressed — the exception
 * `CLAUDE.md` names. It is the same write the lifecycle field in the form
 * makes; having it here as well is the difference between "I am describing this
 * laptop" and "this laptop has gone".
 */
export function RetireButton({ itemId }: { itemId: string }) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await updateCisInBulk([itemId], { lifecycle: "RETIRED" });
          router.refresh();
        })
      }
      className="text-text-3 hover:text-text flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
    >
      <Archive size={12} />
      {t.cmdb.retire}
    </button>
  );
}
