"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCiItem } from "@/lib/actions/cmdb";
import { Button, FieldError, FormError, Input, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";

/**
 * A new asset, in two answers.
 *
 * Name and type only, then straight to its own page. Asking for every attribute
 * in a dialog would be a form of unknown length that varies by type, and the
 * page it lands on is a better place to fill one in than a box floating over the
 * list it came from.
 */
export function NewCiButton({ types }: { types: { id: string; name: string }[] }) {
  const t = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (types.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand text-on-brand hover:bg-brand-deep inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors"
      >
        <Plus size={14} strokeWidth={2.5} />
        {t.cmdb.newItem}
      </button>

      {open ? (
        <NewCiDialog
          types={types}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            router.push(`/cmdb/${id}`);
          }}
        />
      ) : null}
    </>
  );
}

function NewCiDialog({
  types,
  onClose,
  onCreated,
}: {
  types: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useMessages();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(types[0]!.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createCiItem({ name, typeId, attributes: {} });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onCreated(result.id);
    });
  }

  return (
    <Modal title={t.cmdb.addItem} onClose={onClose}>
      <div className="space-y-4">
        <FormError>{errors.form}</FormError>

        <label className="block">
          <span className="label mb-1.5 block">{t.cmdb.name}</span>
          <Input
            value={name}
            autoFocus
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) create();
            }}
          />
          <FieldError>{errors.name}</FieldError>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.cmdb.type}</span>
          <Select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
          <FieldError>{errors.typeId}</FieldError>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={create} disabled={pending || !name.trim()}>
            {pending ? t.common.saving : t.cmdb.addItem}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
