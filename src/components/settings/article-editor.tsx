"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BookText, ExternalLink, Eye, Star } from "lucide-react";
import { deleteArticle, saveArticleTranslation, updateArticle } from "@/lib/actions/portal-admin";
import { CONTENT_LOCALES } from "@/lib/i18n";
import { Card, Input, Select } from "@/components/ui";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { DeleteThing } from "@/components/settings/delete-thing";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  keywords: string[];
  categoryId: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  views: number;
};

/**
 * Writing an answer. Body on the left, everything that decides who finds it on
 * the right — because "will anyone ever see this" is the question a knowledge
 * base usually fails to answer.
 *
 * Publishing is the one control that acts at once: it is a decision on its own,
 * not a description of the article, and it is the thing an author reaches for
 * when the words are already right.
 */
export function ArticleEditor({
  article,
  categories,
  baseLocale,
  translations,
  fromDoc,
}: {
  article: Article;
  categories: { id: string; name: string }[];
  /// The language the article itself is written in — the instance"s.
  baseLocale: string;
  translations: { locale: string; title: string; summary: string | null; body: string }[];
  /// The documentation page this answer was published from, if it was. Said on
  /// the page rather than left to be discovered: the two are free to diverge,
  /// and publishing the document again overwrites whatever was edited here.
  fromDoc?: string | null;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(article.isPublished);
  const [writing, setWriting] = useState(baseLocale.split("-")[0]!);

  const draft = useDraft({
    title: article.title,
    summary: article.summary ?? "",
    body: article.body,
    keywords: article.keywords.join(", "),
    categoryId: article.categoryId ?? "",
    isFeatured: article.isFeatured,
  });
  const { draft: form, set } = draft;

  function togglePublished() {
    const next = !published;
    startTransition(async () => {
      const result = await updateArticle(article.id, { isPublished: next });
      if (result.ok) setPublished(next);
      else setError(result.error ?? t.errors.generic);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/settings/portal/knowledge"
          className="text-text-2 hover:text-text inline-flex items-center gap-1.5 text-base font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          {t.forms.tabKnowledge}
        </Link>

        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={togglePublished}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-semibold transition-colors",
              published
                ? "bg-positive/12 text-positive"
                : "bg-surface-3 text-text-2 hover:text-text",
            )}
          >
            <Eye size={13} />
            {published ? t.forms.published : t.forms.draft}
          </button>

          {published ? (
            <Link
              href={`/portal/kb/${article.slug}`}
              className="text-text-2 hover:bg-surface-3 hover:text-text flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-medium transition-colors"
            >
              {t.forms.preview}
              <ExternalLink size={12} />
            </Link>
          ) : null}

          <DeleteThing
            name={article.title}
            blurb={t.forms.deleteArticleBlurb}
            remove={() => deleteArticle(article.id)}
            back="/settings/portal/knowledge"
          />
        </span>
      </div>

      {error ? (
        <p className="bg-negative/[0.06] text-negative rounded-control px-4 py-2 text-base font-medium">
          {error}
        </p>
      ) : null}

      {fromDoc ? (
        <p className="bg-surface-2 text-text-2 rounded-control flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5 text-base">
          <BookText size={14} className="text-text-3 shrink-0" />
          <span className="font-medium">{t.docs.publishedFromDoc}</span>
          <span className="text-text-3">{t.docs.publishedFromDocHint}</span>
          <Link href={fromDoc} className="text-brand-deep ml-auto font-medium hover:underline">
            {t.docs.openDoc}
          </Link>
        </p>
      ) : null}

      {/* Which language you are writing. The original is the article itself;
          the others are translations that stand in for it when somebody reads
          the portal in that language. */}
      <div className="bg-surface-2 flex w-fit items-center gap-0.5 rounded-full p-0.5">
        {CONTENT_LOCALES.map((option) => {
          const base = option.code === baseLocale.split("-")[0];
          const written =
            base || translations.some((row) => row.locale.split("-")[0] === option.code);
          return (
            <button
              key={option.code}
              type="button"
              aria-current={writing === option.code}
              onClick={() => setWriting(option.code)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-medium transition-colors",
                writing === option.code
                  ? "bg-surface text-text shadow-[var(--shadow-sm)]"
                  : "text-text-2 hover:text-text",
              )}
            >
              {option.label}
              {base ? (
                <span className="text-text-3 text-xs">{t.forms.originalLanguage}</span>
              ) : (
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", written ? "bg-positive" : "bg-surface-3")}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {writing === baseLocale.split("-")[0] ? (
          <Card className="animate-rise space-y-4 p-5">
            <label className="block">
              <span className="label mb-1.5 block">{t.forms.articleTitle}</span>
              <Input
                value={form.title}
                maxLength={160}
                onChange={(event) => set({ title: event.target.value })}
                className="h-12 text-lg font-semibold"
              />
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.cardLine}</span>
              <Input
                value={form.summary}
                maxLength={240}
                placeholder={t.forms.summaryHint}
                onChange={(event) => set({ summary: event.target.value })}
              />
            </label>

            <div className="block">
              <span className="label mb-1.5 block">{t.forms.articleBody}</span>
              {/* The same editor the conversation uses: what someone writes is
                  what a reader sees, and an answer that needs a list or a bold
                  step should not have to be written as plain prose. */}
              <MarkdownEditor
                rows={18}
                value={form.body}
                placeholder={t.forms.bodyHint}
                onChange={(body) => set({ body })}
              />
            </div>
          </Card>
        ) : (
          <TranslationPane
            key={writing}
            articleId={article.id}
            locale={writing}
            existing={translations.find((row) => row.locale.split("-")[0] === writing) ?? null}
          />
        )}

        <div className="animate-rise space-y-4 lg:sticky lg:top-4 lg:h-fit">
          <Card className="space-y-4 p-4">
            <p className="label">{t.forms.findability}</p>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.section}</span>
              <Select
                value={form.categoryId}
                onChange={(event) => set({ categoryId: event.target.value })}
              >
                <option value="">{t.forms.noSection}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="label mb-1.5 block">{t.forms.keywords}</span>
              <Input
                value={form.keywords}
                placeholder={t.forms.keywordsHint}
                onChange={(event) => set({ keywords: event.target.value })}
              />
            </label>

            <button
              type="button"
              onClick={() => set({ isFeatured: !form.isFeatured })}
              aria-pressed={form.isFeatured}
              className={cn(
                "rounded-control flex w-full items-center gap-2 border px-3 py-2 text-base font-medium transition-colors",
                form.isFeatured
                  ? "border-brand/45 text-brand-deep bg-[var(--brand-tint)]"
                  : "bg-surface text-text-2 hover:bg-surface-2 border-transparent shadow-[var(--highlight)]",
              )}
            >
              <Star size={14} className={form.isFeatured ? "fill-current" : undefined} />
              {form.isFeatured ? t.forms.featured : t.forms.featureIt}
            </button>
          </Card>

          <Card className="p-4">
            <p className="label">{t.forms.reads}</p>
            <p className="tnum mt-1 text-2xl leading-none font-bold">{article.views}</p>
            <p className="text-text-3 mt-1.5 text-sm">{t.forms.readsHint}</p>
          </Card>
        </div>
      </div>

      {/* Above the fold on a long body: the bar follows the page rather than
          sitting at the bottom of twenty rows of text. */}
      <div className="bg-surface rounded-card sticky bottom-4 z-30 flex items-center gap-3 px-4 py-3 shadow-[var(--shadow-md)]">
        <SaveBar
          draft={draft}
          save={(values) =>
            updateArticle(article.id, {
              title: values.title,
              summary: values.summary,
              body: values.body,
              keywords: values.keywords,
              categoryId: values.categoryId || null,
              isFeatured: values.isFeatured,
            })
          }
        />
      </div>
    </div>
  );
}

/**
 * The same answer, in another language.
 *
 * Its own draft and its own Save, because a translation is a separate thing to
 * commit: half-finishing the Dutch should not put the English at risk. Leaving
 * all three empty and saving removes the translation, which is how you take one
 * back without a delete button that would need its own confirmation.
 */
function TranslationPane({
  articleId,
  locale,
  existing,
}: {
  articleId: string;
  locale: string;
  existing: { title: string; summary: string | null; body: string } | null;
}) {
  const t = useMessages();

  const draft = useDraft({
    title: existing?.title ?? "",
    summary: existing?.summary ?? "",
    body: existing?.body ?? "",
  });
  const { draft: form, set } = draft;

  return (
    <Card className="animate-rise space-y-4 p-5">
      {!existing ? <p className="text-text-3 text-base">{t.forms.noTranslationYet}</p> : null}

      <label className="block">
        <span className="label mb-1.5 block">{t.forms.articleTitle}</span>
        <Input
          value={form.title}
          maxLength={160}
          onChange={(event) => set({ title: event.target.value })}
          className="h-12 text-lg font-semibold"
        />
      </label>

      <label className="block">
        <span className="label mb-1.5 block">{t.forms.cardLine}</span>
        <Input
          value={form.summary}
          maxLength={240}
          placeholder={t.forms.summaryHint}
          onChange={(event) => set({ summary: event.target.value })}
        />
      </label>

      <div className="block">
        <span className="label mb-1.5 block">{t.forms.articleBody}</span>
        <MarkdownEditor
          rows={18}
          value={form.body}
          placeholder={t.forms.bodyHint}
          onChange={(body) => set({ body })}
        />
      </div>

      <SaveBar
        draft={draft}
        hideWhenIdle
        save={(values) => saveArticleTranslation(articleId, locale, values)}
      />
    </Card>
  );
}
