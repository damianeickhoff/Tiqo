import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getClock, getMessages } from "@/lib/settings";
import { hasResponseTarget } from "@/lib/tickets";
import { localised, pickTranslation, readerLocale } from "@/lib/portal-locale";
import { AnswerRow, Tile } from "@/components/portal/portal-pieces";
import { PortalDeskCard } from "@/components/portal/portal-desk-card";
import { PortalForm } from "@/components/portal/portal-form";

type Params = Promise<{ slug: string }>;

/** Two hundred words a minute, rounded up, never nought. */
function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const form = await prisma.portalForm.findUnique({
    where: { slug: (await params).slug },
    select: { name: true },
  });
  return { title: form?.name ?? "" };
}

export default async function PortalFormPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { slug } = await params;

  const form = await prisma.portalForm.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      color: true,
      isActive: true,
      type: true,
      priority: true,
      team: { select: { name: true } },
      translations: { select: { locale: true, name: true, description: true } },
      category: {
        select: {
          slug: true,
          name: true,
          // The two most-read answers off the same shelf, for the column beside
          // the form. Nested in the form's own query rather than fetched
          // separately: it is the same row of the catalogue either way.
          articles: {
            where: { isPublished: true },
            orderBy: { views: "desc" },
            take: 2,
            select: {
              id: true,
              slug: true,
              title: true,
              body: true,
              translations: { select: { locale: true, title: true } },
            },
          },
        },
      },
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, description: true },
      },
      fields: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          label: true,
          hint: true,
          placeholder: true,
          kind: true,
          target: true,
          required: true,
          halfWidth: true,
          options: true,
          sectionId: true,
          showWhenFieldId: true,
          showWhenValue: true,
          translations: {
            select: { locale: true, label: true, hint: true, placeholder: true, options: true },
          },
        },
      },
    },
  });

  if (!form || !form.isActive) notFound();

  const [t, clock, locale] = await Promise.all([getMessages(), getClock(), readerLocale(user)]);

  // The form in the reader's language where somebody has written it, in the
  // language it was built in where nobody has. Only the words are translated —
  // what a field is, and whether it has to be answered, is the same question
  // whichever language it is asked in.
  const words = localised(
    { name: form.name, description: form.description },
    form.translations,
    locale,
  );
  const fields = form.fields.map((field) => {
    const said = localised(
      { label: field.label, hint: field.hint, placeholder: field.placeholder },
      field.translations,
      locale,
    );
    // Choices are matched by position, so a translation that has drifted out of
    // step with the field is ignored rather than shown against the wrong answer.
    const choices = pickTranslation(field.translations, locale)?.options ?? [];
    return {
      ...field,
      ...said,
      options: choices.length === field.options.length ? choices : field.options,
    };
  });

  const related = (form.category?.articles ?? []).map((article) => ({
    id: article.id,
    slug: article.slug,
    title: localised({ title: article.title }, article.translations, locale).title,
    minutes: readingMinutes(article.body),
  }));

  // What sending this will do, in two lines: which kind of ticket it becomes
  // and who answers it, and where the answer will turn up.
  const timed = hasResponseTarget(form.type);
  const footer = [
    <>
      {t.portal.raisedAs}{" "}
      <b className="text-text font-semibold">
        {t.vocab.priority[form.priority].toLowerCase()} {t.vocab.type[form.type].toLowerCase()}
      </b>
      {" · "}
      {t.portal.answeredBy}{" "}
      <b className="text-text font-semibold">{form.team?.name ?? t.portal.theDesk}</b>
      {timed ? (
        <>
          {" "}
          {t.portal.withinAbout}{" "}
          <b className="text-text font-semibold">
            {t.portal.hoursShort(clock.targets[form.priority])}
          </b>
        </>
      ) : null}
    </>,
    <>
      {t.portal.updatesTo} <b className="text-text font-semibold">{user.email}</b>{" "}
      {t.portal.andMyRequests}
    </>,
  ];

  return (
    <>
      <div className="portal-wrap pt-9 pb-[30px]">
        <nav className="text-text-3 mb-4 flex flex-wrap items-center gap-1.5 text-[13.5px]">
          <Link href="/portal" className="hover:text-text transition-colors">
            {t.portal.home}
          </Link>
          {form.category ? (
            <>
              <ChevronRight size={12} aria-hidden />
              <Link
                href={`/portal/c/${form.category.slug}`}
                className="hover:text-text transition-colors"
              >
                {form.category.name}
              </Link>
            </>
          ) : null}
          <ChevronRight size={12} aria-hidden />
          <span className="text-text-2">{words.name}</span>
        </nav>

        <header className="animate-rise flex items-center gap-[18px]">
          <Tile icon={form.icon} color={form.color} size={56} />
          <div className="min-w-0">
            <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
              {words.name}
            </h1>
            {words.description ? (
              <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px] leading-relaxed">
                {words.description}
              </p>
            ) : null}
          </div>
        </header>
      </div>

      <div className="portal-wrap grid grid-cols-1 items-start gap-x-10 gap-y-9 pb-14 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PortalForm formId={form.id} sections={form.sections} fields={fields} footer={footer} />

        {/* Below lg the column falls in under the form, which is the right way
            round on a phone: the question first, the reading beside it second. */}
        <aside className="flex flex-col gap-[22px]">
          {related.length > 0 ? (
            <section className="pcard">
              <h2 className="px-[22px] pt-[18px] pb-1 text-[16px] font-semibold tracking-[-0.01em]">
                {t.portal.beforeYouAsk}
              </h2>
              <div className="p-1.5 pt-0">
                {related.map((article) => (
                  <AnswerRow
                    key={article.id}
                    href={`/portal/kb/${article.slug}`}
                    title={article.title}
                    meta={t.portal.minRead(article.minutes)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <PortalDeskCard />
        </aside>
      </div>
    </>
  );
}
