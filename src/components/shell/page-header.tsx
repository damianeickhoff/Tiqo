/**
 * The page's title row: one line, title on the left, actions on the right, no
 * line underneath — the panel edge and the fill separate it from the body. `eyebrow` and `children` are still accepted so every
 * page compiles, but the blurb is drawn only when a page asks for it with
 * `showBlurb` — most explained themselves to nobody.
 */
export function PageHeader({
  title,
  actions,
  showBlurb = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  showBlurb?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 lg:px-6">
      <h1 className="text-lg leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
      {showBlurb && children ? <div className="text-text-3 min-w-0 text-sm">{children}</div> : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
