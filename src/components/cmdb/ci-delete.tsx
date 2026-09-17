"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ciDependants, deleteCiItem } from "@/lib/actions/cmdb";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Taking an asset out of the register altogether.
 *
 * In the header band rather than in the card, because it is a thing done to the
 * asset and not a field of it — and what depends on it is asked for at the
 * moment the question is asked, because those numbers are what change the
 * answer.
 */
export function CiDelete({ itemId, name }: { itemId: string; name: string }) {
  const t = useMessages();
  const router = useRouter();
  const [weight, setWeight] = useState<{ tickets: number; dependants: number } | null>(null);

  return (
    <ConfirmDelete
      title={name}
      blurb={
        weight && (weight.tickets > 0 || weight.dependants > 0)
          ? t.cmdb.deleteItemBlurb(weight.tickets, weight.dependants)
          : undefined
      }
      run={async () => {
        const result = await deleteCiItem(itemId);
        // The page being deleted is the one we are standing on, so there is
        // nowhere to stay: back to the register, which is where it went.
        if (result.ok) router.push("/cmdb");
        return result;
      }}
    >
      {(ask) => (
        <button
          type="button"
          onClick={() => {
            void ciDependants(itemId).then(setWeight);
            ask();
          }}
          aria-label={t.common.delete}
          title={t.common.delete}
          className="text-text-3 hover:bg-surface-3 hover:text-negative rounded-control p-1.5 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      )}
    </ConfirmDelete>
  );
}
