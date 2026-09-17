import { ImageResponse } from "next/og";

/**
 * The app icon is the mark: an amber tile with three bars rising toward the
 * response target — the same drawing as the logo and the heat spine. Drawn
 * with plain boxes so the icon needs no font data at runtime.
 */
const BRAND = "#febe2e";
const INK = "#1c1300";
const BARS = [
  { fill: 0.28, opacity: 0.55 },
  { fill: 0.5, opacity: 0.75 },
  { fill: 0.72, opacity: 1 },
];

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "512" ? 512 : 192;
  const pad = Math.round(size * 0.28);
  const gap = Math.round(size * 0.07);
  const inner = size - pad * 2;
  const barWidth = Math.round((inner - gap * 2) / 3);

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "flex-end",
        gap,
        padding: pad,
        background: BRAND,
      }}
    >
      {BARS.map((bar) => (
        <div
          key={bar.fill}
          style={{
            display: "flex",
            width: barWidth,
            height: Math.round(inner * bar.fill),
            background: INK,
            opacity: bar.opacity,
            borderRadius: Math.round(barWidth * 0.3),
          }}
        />
      ))}
    </div>,
    { width: size, height: size },
  );
}
