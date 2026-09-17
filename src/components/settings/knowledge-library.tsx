"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { BookOpen, ChevronRight, Plus, Search, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { createArticle } from "@/lib/actions/portal-admin";
import { Avatar } from "@/components/avatar";
import { SectionPicker } from "@/components/settings/section-picker";
import { Modal } from "@/components/modal";
import { Button, Card, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Article = {
  id: string;
  title: string;
  summary: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  views: number;
  categoryId: string | null;
  updatedAt: Date;
  /// How the two questions at the foot of the article were answered.
  helpful: number;
  unhelpful: number;
  /// Who wrote it and who last changed it. Either can be missing: an answer
  /// outlives the account that wrote it.
  createdBy: Person | null;
  updatedBy: Person | null;
};

type Person = { name: string; avatarVariant: number | null };

type Category = { id: string; name: string; parentId: string | null };

/** The filters as chips, the way the form library draws its own. */
const CHIP_SELECT =
  "select-chevron h-8 cursor-pointer appearance-none rounded-full border border-line bg-surface " +
  "pr-7 pl-2.5 text-sm font-medium text-text-2 shadow-[var(--highlight)] " +
  "transition-[border-color,color] hover:border-line-strong hover:text-text " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";
const CHIP_ON = "border-transparent bg-[var(--brand-tint)] text-brand-deep";

/**
 * The knowledge base, built the same way as the form library.
 *
 * The two halves of self-service are managed on two tabs, and a desk that has
 * learnt one of them should not have to learn the other: same toolbar, same
 * sections, same rows. The one thing answers have that forms do not is whether
 * they worked — so that is on the row, and it is something to filter by.
 */
export function KnowledgeLibrary({
  articles,
  categories,
}: {
  articles: Article[];
  categories: Category[];
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [feedback, setFeedback] = useState("");
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (state === "live" && !article.isPublished) return false;
      if (state === "hidden" && article.isPublished) return false;

      const votes = article.helpful + article.unhelpful;
      if (feedback === "none" && votes > 0) return false;
      if (feedback === "helpful" && (votes === 0 || article.helpful <= article.unhelpful))
        return false;
      if (feedback === "unhelpful" && (votes === 0 || article.unhelpful < article.helpful))
        return false;

      if (!needle) return true;
      return (
        article.title.toLowerCase().includes(needle) ||
        (article.summary ?? "").toLowerCase().includes(needle) ||
        (byId.get(article.categoryId ?? "")?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [articles, query, state, feedback, byId]);

  // Grouped by section, in the catalogue's own order, so the library reads the
  // way the portal does rather than as one flat wall.
  const groups = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const article of shown) {
      const key = article.categoryId ?? "none";
      map.set(key, [...(map.get(key) ?? []), article]);
    }
    return [
      ...categories
        .filter((category) => map.has(category.id))
        .map((category) => ({
          id: category.id,
          name: category.parentId
            ? `${byId.get(category.parentId)?.name ?? ""} · ${category.name}`
            : category.name,
          rows: map.get(category.id)!,
        })),
      ...(map.has("none") ? [{ id: "none", name: t.forms.noSection, rows: map.get("none")! }] : []),
    ];
  }, [shown, categories, byId, t]);

  const filtering = Boolean(query.trim() || state || feedback);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search
            size={14}
            aria-hidden
            className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.forms.searchArticles}
            aria-label={t.forms.searchArticles}
            className="border-line bg-surface placeholder:text-text-3 focus:border-brand hover:border-line-strong rounded-control h-8 w-full border pr-3 pl-8 text-base shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
          />
        </div>

        <select
          value={state}
          onChange={(event) => setState(event.target.value)}
          aria-label={t.forms.state}
          className={cn(CHIP_SELECT, state && CHIP_ON)}
        >
          <option value="">{t.forms.anyState}</option>
          <option value="live">{t.forms.published}</option>
          <option value="hidden">{t.forms.draft}</option>
        </select>

        {/* An answer nobody found useful is worth more attention than one
            nobody has read: the reads say it was found, the votes say it
            worked. */}
        <select
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          aria-label={t.forms.anyFeedback}
          className={cn(CHIP_SELECT, feedback && CHIP_ON)}
        >
          <option value="">{t.forms.anyFeedback}</option>
          <option value="helpful">{t.forms.mostlyHelpful}</option>
          <option value="unhelpful">{t.forms.mostlyNot}</option>
          <option value="none">{t.forms.noVotesYet}</option>
        </select>

        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setState("");
              setFeedback("");
            }}
            className="text-text-2 hover:text-text flex h-8 items-center gap-1 rounded-full px-2 text-sm font-medium"
          >
            <X size={12} strokeWidth={2.5} />
            {t.tickets.clear}
          </button>
        ) : null}

        <span className="text-text-3 px-1 text-sm">
          {t.forms.showing(shown.length, articles.length)}
        </span>

        <Button type="button" size="sm" onClick={() => setCreating(true)} className="ml-auto">
          <Plus size={14} strokeWidth={2.5} />
          {t.forms.addArticle}
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">
            {articles.length === 0 ? t.forms.noArticles : t.forms.noMatches}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <p className="label mb-2 flex items-center gap-2">
                {group.name}
                <span className="font-mono tracking-normal">{group.rows.length}</span>
              </p>
              <Card className="overflow-hidden">
                <ul className="divide-line divide-y">
                  {group.rows.map((article) => (
                    <ArticleRow key={article.id} article={article} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      {creating ? (
        <NewArticleDialog categories={categories} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}

/**
 * Who wrote the answer and who last changed it.
 *
 * Two faces, overlapped, author first. When the same person did both there is
 * only one face: a duplicate would read as two people agreeing, which is a
 * different and much stronger claim than the truth.
 */
function Hands({ article }: { article: Article }) {
  const t = useMessages();
  const { createdBy, updatedBy } = article;
  const same = createdBy && updatedBy && createdBy.name === updatedBy.name;
  if (!createdBy && !updatedBy) return null;

  return (
    <span className="hidden shrink-0 items-center sm:flex">
      {createdBy ? (
        <span
          title={t.forms.articleAuthor(createdBy.name)}
          className="border-surface flex rounded-full border-2"
        >
          <Avatar name={createdBy.name} variant={createdBy.avatarVariant} size={22} />
        </span>
      ) : null}

      {updatedBy && !same ? (
        <span
          title={t.forms.articleEditor(updatedBy.name)}
          className={cn("border-surface flex rounded-full border-2", createdBy && "-ml-2")}
        >
          <Avatar name={updatedBy.name} variant={updatedBy.avatarVariant} size={22} />
        </span>
      ) : null}
    </span>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const t = useMessages();

  return (
    <li className="group">
      <div className="hover:bg-surface-2 flex min-h-[52px] items-center gap-3 px-3.5 py-2 transition-[background-color]">
        <span
          aria-hidden
          className={cn(
            "bg-surface-3 text-text-2 rounded-control flex size-8 shrink-0 items-center justify-center",
            !article.isPublished && "opacity-50",
          )}
        >
          <BookOpen size={16} />
        </span>

        <Link href={`/settings/portal/knowledge/${article.id}`} className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-base font-semibold",
              !article.isPublished && "text-text-2",
            )}
          >
            {article.title}
          </span>
          <span className="text-text-3 mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-text-2 font-medium">{t.forms.viewCount(article.views)}</span>
            {article.summary ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{article.summary}</span>
              </>
            ) : null}
          </span>
        </Link>

        <Hands article={article} />

        {/* Both tallies, side by side. A single score would hide the case that
            matters — an answer half the desk disagrees with. */}
        <span
          title={t.forms.usefulVotes(article.helpful, article.unhelpful)}
          className="text-text-3 hidden shrink-0 items-center gap-2.5 font-mono text-xs sm:flex"
        >
          <span className={cn("flex items-center gap-1", article.helpful > 0 && "text-positive")}>
            <ThumbsUp size={12} aria-hidden />
            {article.helpful}
          </span>
          <span className={cn("flex items-center gap-1", article.unhelpful > 0 && "text-negative")}>
            <ThumbsDown size={12} aria-hidden />
            {article.unhelpful}
          </span>
        </span>

        <span
          className="ml-6 flex w-20 shrink-0 items-center gap-1.5 text-sm"
          style={{ color: article.isPublished ? "var(--positive)" : "var(--text-3)" }}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {article.isPublished ? t.forms.published : t.forms.draft}
        </span>

        <Link
          href={`/settings/portal/knowledge/${article.id}`}
          aria-label={t.common.edit}
          className="text-text-3 hover:text-text rounded-control flex size-8 shrink-0 items-center justify-center"
        >
          <ChevronRight size={15} />
        </Link>
      </div>
    </li>
  );
}

function NewArticleDialog({
  categories,
  onClose,
}: {
  categories: Category[];
  onClose: () => void;
}) {
  const t = useMessages();
  const [state, formAction] = useActionState(createArticle, undefined);
  const [categoryId, setCategoryId] = useState("");
  const errors = state?.errors ?? {};

  return (
    <Modal title={t.forms.newArticle} description={t.forms.newArticleBlurb} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <FormError>{errors.form}</FormError>

        <label className="block">
          <span className="label mb-1.5 block">{t.forms.articleTitle}</span>
          <Input name="title" autoFocus maxLength={160} placeholder={t.forms.articlePlaceholder} />
          <FieldError>{errors.title}</FieldError>
        </label>

        <div className="block">
          <span className="label mb-1.5 block">{t.forms.section}</span>
          <SectionPicker
            value={categoryId}
            name="categoryId"
            sections={categories}
            onChange={setCategoryId}
          />
        </div>

        <div className="border-border-soft flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Create />
        </div>
      </form>
    </Modal>
  );
}

function Create() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.creating : t.forms.addArticle}
    </Button>
  );
}
