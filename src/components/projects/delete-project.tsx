"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Removing a project.
 *
 * Behind a confirmation that says what survives, because the reflex worry is
 * "does this take the tickets with it" and the honest answer — they stay, and
 * stop belonging anywhere — is also the reason archiving is usually the better
 * answer. Saying so here is cheaper than an undo.
 */
export function DeleteProject({ projectId, name }: { projectId: string; name: string }) {
  const t = useMessages();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAsking(false);
      router.push("/projects");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control inline-flex items-center gap-1.5 px-2.5 py-1.5 text-base font-medium transition-colors"
      >
        <Trash2 size={14} />
        {t.projects.deleteProject}
      </button>

      {asking ? (
        <Modal
          title={t.common.deleteThing(name)}
          description={t.projects.deleteProjectBlurb}
          onClose={() => setAsking(false)}
        >
          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-4 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          <div className="border-border-soft flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="bg-negative rounded-control text-md inline-flex h-10 items-center gap-1.5 px-4 font-semibold text-white disabled:opacity-50"
            >
              <Trash2 size={14} />
              {pending ? t.common.saving : t.projects.confirmDelete}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
