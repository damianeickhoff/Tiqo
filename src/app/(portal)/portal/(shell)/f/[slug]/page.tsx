import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getClock, getMessages } from "@/lib/settings";
import { hasResponseTarget } from "@/lib/tickets";
import { localised, pickTranslation, readerLocale } from "@/lib/portal-locale";
import { PortalIcon } from "@/components/portal/portal-icon";
import { PortalForm } from "@/components/portal/portal-form";
import { Card } from "@/components/ui";

type Params = Promise<{ slug: string }>;

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
      category: { select: { slug: true, name: true } },
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

  // What sending this will do, in two lines: which kind of ticket it becomes
  // and who answers it, and where the answer will turn up.
  const timed = hasResponseTarget(form.type);
  const footer = [
    t.portal.raisedAsLine(
      t.vocab.priority[form.priority],
      t.vocab.type[form.type],
      form.team?.name ?? t.portal.theDesk,
    ) + (timed ? t.portal.withinAbout(clock.targets[form.priority]) : ""),
    t.portal.updatesGoTo(user.email),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-text-3 flex flex-wrap items-center gap-1 text-base">
        <Link href="/portal" className="hover:text-text transition-colors">
          {t.portal.home}
        </Link>
        {form.category ? (
          <>
            <ChevronRight size={13} aria-hidden />
            <Link
              href={`/portal/c/${form.category.slug}`}
              className="hover:text-text transition-colors"
            >
              {form.category.name}
            </Link>
          </>
        ) : null}
        <ChevronRight size={13} aria-hidden />
        <span className="text-text-2">{words.name}</span>
      </nav>

      <header className="animate-rise flex items-start gap-4">
        <span
          aria-hidden
          className="rounded-card flex size-12 shrink-0 items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${form.color} 15%, transparent)`,
            color: form.color,
          }}
        >
          <PortalIcon name={form.icon} size={23} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">{words.name}</h1>
          {words.description ? (
            <p className="text-text-2 text-md mt-1.5 max-w-[62ch] leading-relaxed">
              {words.description}
            </p>
          ) : null}
        </div>
      </header>

      <Card className="animate-rise p-6 lg:p-8">
        <PortalForm formId={form.id} sections={form.sections} fields={fields} footer={footer} />
      </Card>
    </div>
  );
}
