"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";
import { NewProjectForm } from "./new-project-form";

/**
 * Making a project is a rare, deliberate act, so it gets a dialog rather than a
 * form parked beside the list. The sticky panel it replaces took a column of
 * the page permanently to offer something most visits never use.
 */
export function NewProjectButton() {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2.5} />
        {t.projects.newProject}
      </Button>

      {open ? (
        <Modal title={t.projects.newProject} onClose={() => setOpen(false)}>
          <NewProjectForm onCreated={() => setOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}
