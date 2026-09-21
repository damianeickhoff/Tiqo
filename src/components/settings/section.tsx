/**
 * Every settings block reads the same: what the setting is and what it does on
 * the left, the control on the right, the next one below. A section of the
 * page's sheet rather than a card of its own — a page of cards was a page of
 * frames, and the frames said nothing — separated from the one above it by a
 * hairline.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  /// Accepted for the callers that still pass it; the sections no longer
  /// animate in one after another.
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line grid gap-4 border-t px-5 py-6 first:border-t-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-6">
      <div className="lg:pt-0.5">
        <h2 className="text-md font-semibold">{title}</h2>
        <p className="text-text-3 mt-1 text-sm leading-relaxed">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
