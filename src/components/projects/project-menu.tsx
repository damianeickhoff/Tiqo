"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { setProjectArchived } from "@/lib/actions/admin";
import { deleteProject, toggleProjectStar } from "@/lib/actions/projects";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Watching a project.
 *
 * Its own control rather than a line in a menu: it is the one thing on this
 * header anybody does more than once, and it is the one that is not
 * destructive.
 */
export function ProjectStarButton({
  projectId,
  starred: initial,
}: {
  projectId: string;
  starred: boolean;
}) {
  const t = useMessages();
  const [starred, setStarred] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={starred}
      aria-label={starred ? t.projects.unstar : t.projects.star}
      title={starred ? t.projects.unstar : t.projects.star}
      onClick={() =>
        startTransition(async () => {
          // Shown at once and put back if the server refuses: a star that waits
          // for a round trip feels broken.
          setStarred((was) => !was);
          const result = await toggleProjectStar(projectId);
          if (!result.ok) setStarred(initial);
        })
      }
      className={cn(
        "bg-surface rounded-control flex size-8 shrink-0 items-center justify-center border border-transparent shadow-[var(--highlight)] transition-colors disabled:opacity-60",
        starred ? "text-brand-deep" : "text-text-3 hover:text-text",
      )}
    >
      <Star size={14} className={starred ? "fill-current" : undefined} />
    </button>
  );
}

/**
 * The rest of what can be done to a project, behind one button.
 *
 * Archiving and deleting are the same question asked with different force, so
 * they sit together — and away from the things people press every day.
 */
export function ProjectMenu({
  projectId,
  name,
  isArchived,
}: {
  projectId: string;
  name: string;
  isArchived: boolean;
}) {
  const t = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.common.more}
        className="bg-surface text-text-2 hover:text-text rounded-control flex size-8 items-center justify-center border border-transparent shadow-[var(--highlight)] transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="animate-rise bg-surface rounded-card absolute right-0 z-50 mt-2 w-52 overflow-hidden p-1 shadow-[var(--shadow-float)]"
          >
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                startTransition(() => void setProjectArchived(projectId, !isArchived));
              }}
              className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              {isArchived ? (
                <ArchiveRestore size={14} className="text-text-3" />
              ) : (
                <Archive size={14} className="text-text-3" />
              )}
              {isArchived ? t.projects.restore : t.projects.archive}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setAsking(true);
              }}
              className="text-negative hover:bg-negative/10 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              <Trash2 size={14} />
              {t.projects.deleteProject}
            </button>
          </div>
        </>
      ) : null}

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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="bg-negative rounded-control text-md inline-flex h-9 items-center gap-1.5 px-4 font-semibold text-white disabled:opacity-50"
            >
              <Trash2 size={14} />
              {pending ? t.common.saving : t.projects.confirmDelete}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
