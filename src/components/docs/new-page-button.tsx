"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createDoc } from "@/lib/actions/docs";
import { Modal } from "@/components/modal";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * A page, started from the front of the documentation.
 *
 * On a shelf the rail already knows where a new page goes, so it asks for a
 * title and nothing else. Here it does not, and "which shelf" is the one
 * question that cannot be answered later without moving the page — so it is
 * two fields, asked once, and then the page itself.
 */
export function NewPageButton({ spaces }: { spaces: { id: string; name: string }[] }) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (spaces.length === 0) return null;

  function create() {
    const clean = title.trim();
    if (!clean) return;

    startTransition(async () => {
      const result = await createDoc({ spaceId, parentId: null, title: clean });
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      // The page that was just made is the one somebody wants to be standing
      // on, and it is on an address this page does not share.
      window.location.assign(result.href);
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus size={13} />
        {t.docs.newDoc}
      </Button>

      {open ? (
        <Modal
          title={t.docs.newDoc}
          description={t.docs.newDocBlurb}
          onClose={() => setOpen(false)}
        >
          <div className="space-y-4">
            <FormError>{error ?? undefined}</FormError>

            <Field label={t.docs.space} htmlFor="new-doc-space">
              <Select
                id="new-doc-space"
                value={spaceId}
                onChange={(event) => setSpaceId(event.target.value)}
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t.docs.docTitle} htmlFor="new-doc-title">
              <Input
                id="new-doc-title"
                value={title}
                autoFocus
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && create()}
              />
            </Field>

            <div className="border-line flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="button" disabled={pending || !title.trim()} onClick={create}>
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {pending ? t.common.creating : t.common.create}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
