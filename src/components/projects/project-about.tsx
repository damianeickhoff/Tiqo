"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateProject } from "@/lib/actions/projects";

import { SaveBar, useDraft } from "@/components/settings/draft";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Markdown } from "@/components/markdown";
import { useMessages } from "@/components/shell/instance-context";

/**
 * What the project is, written where it is read.
 *
 * The description belongs in the column people read, not in the panel of
 * settings beside it: it is the content of the page rather than a property of
 * it. Editing follows the same rule as everywhere else — a draft, then Save.
 */
export function ProjectAbout({
  projectId,
  description,
  canEdit,
}: {
  projectId: string;
  description: string | null;
  canEdit: boolean;
}) {
  const t = useMessages();
  const [editing, setEditing] = useState(false);
  const draft = useDraft({ description: description ?? "" });

  if (!canEdit && !description) return null;

  return (
    <div className="card group/about relative px-5 py-4">
      <p className="label mb-2">{t.projects.brief}</p>
      {editing ? (
        <div className="space-y-3">
          <MarkdownEditor
            autoFocus
            rows={6}
            value={draft.draft.description}
            maxLength={2000}
            placeholder={t.projects.descriptionHint}
            onChange={(description) => draft.set({ description })}
          />
          <SaveBar
            draft={draft}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
            save={(values) => updateProject(projectId, { description: values.description })}
          />
        </div>
      ) : (
        <>
          {description ? (
            <Markdown text={description} className="text-md leading-[1.7]" />
          ) : (
            <p className="text-text-3 text-md">{t.projects.descriptionHint}</p>
          )}

          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t.projects.editDescription}
              title={t.projects.editDescription}
              className="border-line bg-surface text-text-2 hover:bg-surface-3 hover:text-text rounded-control absolute top-3 right-3 flex size-8 items-center justify-center border opacity-0 transition-all group-hover/about:opacity-100 focus-visible:opacity-100"
            >
              <Pencil size={15} />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
