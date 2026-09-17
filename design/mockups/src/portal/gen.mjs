// Round 11 — the portal, redrawn from a blank page. Usage: node gen.mjs <outDir>
// Writes one .dc.html per screen and theme (Portal11*.dc.html) and one viewer
// page (PortalRound11.html) that holds every screen with a dark/light toggle.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { THEMES, FONT, I, ring, avatar, AV, AV_NAME, logo } from "../shared.mjs";

const out = process.argv[2] ?? "build";
mkdirSync(out, { recursive: true });

/* ------------------------------------------------------------------ icons */
const X = {
  ...I,
  home: '<path d="M2.5 7.5 8 3l5.5 4.5V13h-4V9.5h-3V13h-4z"/>',
  book: '<path d="M2.5 3.5h4a2 2 0 0 1 1.5.8 2 2 0 0 1 1.5-.8h4v9h-4a1.5 1.5 0 0 0-1.5.8 1.5 1.5 0 0 0-1.5-.8h-4z"/><path d="M8 4.3v8.5"/>',
  stamp: '<path d="M6 8.5V5.5a2 2 0 1 1 4 0v3h2.5v3h-9v-3z"/><path d="M4 13.5h8"/>',
  arrow: '<path d="M3 8h10M9 4l4 4-4 4"/>',
  globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.2v3.5M8 5.2v.1"/>',
  warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2v.1"/>',
  thumb: '<path d="M5 7.5v6H2.5v-6z"/><path d="M5 7.5 7.5 3a1.6 1.6 0 0 1 2.4 1.3V7h2.6a1.3 1.3 0 0 1 1.3 1.5l-.8 4a1.3 1.3 0 0 1-1.3 1H5"/>',
  thumbd: '<path d="M11 8.5v-6h2.5v6z"/><path d="M11 8.5 8.5 13a1.6 1.6 0 0 1-2.4-1.3V9H3.5a1.3 1.3 0 0 1-1.3-1.5l.8-4a1.3 1.3 0 0 1 1.3-1H11"/>',
  clip: '<path d="m11.5 7.5-4.6 4.6a2.5 2.5 0 0 1-3.5-3.5l5.3-5.3a1.7 1.7 0 0 1 2.4 2.4L6 10.8a.8.8 0 0 1-1.2-1.2l4.2-4.2"/>',
  door: '<rect x="3.5" y="2.5" width="9" height="11" rx="1"/><path d="M9.5 8v.1M3.5 13.5h9"/>',
  monitor: '<rect x="2" y="3" width="12" height="8" rx="1.2"/><path d="M6 13.5h4M8 11v2.5"/>',
  drive: '<rect x="2.5" y="4.5" width="11" height="3.5" rx="1"/><rect x="2.5" y="8.5" width="11" height="3.5" rx="1"/><path d="M11 6.2v.1M11 10.2v.1"/>',
  bug: '<path d="M5.5 6.5a2.5 2.5 0 0 1 5 0v4a2.5 2.5 0 0 1-5 0z"/><path d="M2.5 8.5h3M10.5 8.5h3M3.5 4.5l2 2M12.5 4.5l-2 2M3.5 12.5l2-1.5M12.5 12.5l-2-1.5"/>',
  wifi: '<path d="M2 6.5a9 9 0 0 1 12 0M4.2 9a5.8 5.8 0 0 1 7.6 0M6.4 11.3a2.6 2.6 0 0 1 3.2 0"/><path d="M8 13.4v.1"/>',
  ban: '<circle cx="8" cy="8" r="5.5"/><path d="m4.2 4.2 7.6 7.6"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  backl: '<path d="M13 8H3M7 4 3 8l4 4"/>',
};
const ic = (n, cls = "", s = 16) => `<svg class="i ${cls}" viewBox="0 0 16 16" style="width:${s}px;height:${s}px">${X[n]}</svg>`;

/* ----------------------------------------------------------------- tokens */
// The portal reads one step larger than the desk: 14px copy, generous air.
const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: Geist, "Segoe UI", system-ui, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }
  .mono { font-family: "Geist Mono", ui-monospace, "Cascadia Mono", monospace; font-variant-numeric: tabular-nums; }
  .t2 { color: var(--text-2); } .t3 { color: var(--text-3); }
  .label { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); line-height: 1; }
  svg.i { stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  kbd { font-family: "Geist Mono", ui-monospace, monospace; font-size: 10.5px; color: var(--text-3); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; line-height: 1.3; background: var(--surface-2); }
  .ring { display: inline-block; width: 14px; height: 14px; flex: none; }
  .avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-weight: 600; color: #fff; letter-spacing: .02em; flex: none; }
  .empty-avatar { width: 22px; height: 22px; border-radius: 999px; border: 1px dashed var(--line-strong); flex: none; }

  .portal { width: 1440px; min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; overflow: hidden; }
  .wrap { width: 1200px; margin: 0 auto; }

  /* strips above the bar: announcements and the approval nudge */
  .strip { height: 40px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-2); border-bottom: 1px solid var(--line); background: var(--chrome); }
  .strip .wrap { display: flex; align-items: center; gap: 10px; }
  .strip b { color: var(--text); font-weight: 600; }
  .strip .until { margin-left: auto; font-size: 12px; color: var(--text-3); }
  .strip a.act { margin-left: auto; font-weight: 600; color: var(--brand-deep); display: inline-flex; align-items: center; gap: 4px; }
  .strip.warn { color: var(--brand-deep); } .strip.warn b { color: inherit; }
  .strip.outage { color: var(--negative); } .strip.outage b { color: inherit; }
  .strip.approve { background: var(--brand-wash); border-bottom-color: color-mix(in oklab, var(--brand) 30%, transparent); color: var(--brand-deep); }

  /* the bar */
  .top { height: 64px; border-bottom: 1px solid var(--line); background: var(--bg); position: relative; z-index: 2; }
  .top .wrap { height: 100%; display: flex; align-items: center; gap: 28px; }
  .lockup { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; letter-spacing: -.01em; }
  .nav { display: flex; align-items: center; gap: 4px; height: 100%; margin-left: 12px; }
  .nav a { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 100%; padding: 0 12px; font-size: 14px; font-weight: 500; color: var(--text-2); }
  .nav a.on { color: var(--text); }
  .nav a.on::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; background: var(--brand); border-radius: 2px 2px 0 0; }
  .nav .n { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--brand); color: var(--brand-ink); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-family: "Geist Mono", monospace; }
  .top .right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .ibtn { width: 36px; height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--text-2); }
  .ibtn:hover { background: var(--surface-2); color: var(--text); }
  .switch { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); font-size: 13px; font-weight: 500; color: var(--text-2); box-shadow: var(--hl); }
  .vsep { width: 1px; height: 22px; background: var(--line); margin: 0 6px; }

  /* the hero band: ink in both themes, so the page has one dark moment */
  .hero { position: relative; background: #0c0c0e; color: #fafafa; border-bottom: 1px solid rgba(255,255,255,.08); }
  .hero .wrap { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 64px 0 96px; }
  .hero h1 { font-size: 36px; font-weight: 600; letter-spacing: -.03em; line-height: 1.1; margin: 0; }
  .hero .welcome { margin: 10px 0 0; font-size: 16px; color: #a1a1aa; max-width: 60ch; }
  .hero .search { margin-top: 28px; width: 720px; height: 56px; border-radius: 999px; background: #18181b; border: 1px solid rgba(255,255,255,.12); display: flex; align-items: center; gap: 12px; padding: 0 12px 0 20px; box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 20px 50px -20px rgba(0,0,0,.8); }
  .hero .search .ph { flex: 1; text-align: left; font-size: 15px; color: #6b6b74; }
  .hero .search kbd { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); color: #a1a1aa; }
  .hero .search .go { width: 40px; height: 40px; border-radius: 999px; background: var(--brand); color: var(--brand-ink); display: inline-flex; align-items: center; justify-content: center; }
  .hero .starts { margin-top: 16px; display: flex; gap: 8px; }
  .hero .starts span { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); font-size: 13px; font-weight: 500; color: #d4d4d8; }
  .hero .desk { margin-top: 26px; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #a1a1aa; }
  .hero .desk .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.22); }
  .hero .desk b { color: #fafafa; font-weight: 500; }
  .hero .deco { position: absolute; inset: 0; overflow: hidden; }
  .hero .aura { position: absolute; left: 50%; bottom: -320px; width: 1200px; height: 600px; margin-left: -600px; border-radius: 50%; background: radial-gradient(closest-side, var(--brand), transparent 70%); filter: blur(80px); opacity: .28; }
  .hero .grid { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.14) 1px, transparent 1.2px); background-size: 24px 24px; -webkit-mask-image: radial-gradient(55% 60% at 50% 40%, #000 10%, transparent 100%); mask-image: radial-gradient(55% 60% at 50% 40%, #000 10%, transparent 100%); }
  .hero .field { position: absolute; right: 0; bottom: 0; width: 620px; height: 260px; opacity: .55; -webkit-mask-image: linear-gradient(90deg, transparent, #000 45%); mask-image: linear-gradient(90deg, transparent, #000 45%); }
  .hero .field i { position: absolute; bottom: 0; border-radius: 3px 3px 0 0; }

  /* the category strip that overlaps the band */
  .shelf { position: relative; z-index: 1; margin-top: -48px; display: grid; grid-template-columns: repeat(6, 1fr); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .shelf a { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 26px 16px 22px; border-right: 1px solid var(--line); text-align: center; position: relative; }
  .shelf a:last-child { border-right: 0; }
  .shelf a:hover { background: var(--surface-2); }
  .shelf a.hover::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--brand); }
  .shelf .tile { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
  .shelf .name { font-weight: 600; font-size: 14px; letter-spacing: -.01em; }
  .shelf .cnt { font-size: 12px; color: var(--text-3); margin-top: -8px; }

  /* content */
  .content { padding: 40px 0 56px; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; }
  .sec { margin-bottom: 40px; }
  .sec:last-child { margin-bottom: 0; }
  .sechead { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
  .sechead h2 { font-size: 20px; font-weight: 600; letter-spacing: -.02em; margin: 0; }
  .sechead .sub { color: var(--text-3); font-size: 13.5px; }
  .sechead a.more { margin-left: auto; font-size: 13px; font-weight: 500; color: var(--brand-deep); display: inline-flex; align-items: center; gap: 4px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--hl); }
  .cardhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--line); font-weight: 600; font-size: 14px; }
  .cardhead a { font-size: 12.5px; font-weight: 500; color: var(--brand-deep); }
  .cardfoot { padding: 12px 18px; border-top: 1px solid var(--line); font-size: 13px; display: flex; align-items: center; gap: 6px; color: var(--brand-deep); font-weight: 500; }

  .services { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .svc { display: flex; flex-direction: column; gap: 12px; padding: 18px 18px 16px; min-height: 148px; position: relative; transition: transform .15s; }
  .svc .tile { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; }
  .svc .n { font-weight: 600; font-size: 14.5px; letter-spacing: -.01em; line-height: 1.25; }
  .svc .s { font-size: 13px; color: var(--text-2); line-height: 1.45; margin-top: -6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .svc .m { margin-top: auto; font-size: 12px; color: var(--text-3); display: flex; align-items: center; }
  .svc .m .arr { margin-left: auto; color: var(--text-3); opacity: 0; }
  .svc.hover { border-color: var(--line-strong); box-shadow: var(--shadow); transform: translateY(-2px); }
  .svc.hover .m .arr { opacity: 1; color: var(--brand-deep); }

  .answers { display: grid; grid-template-columns: 1fr 1fr; }
  .answers a { display: flex; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .answers a:nth-child(odd) { border-right: 1px solid var(--line); }
  .answers a:nth-last-child(-n+2) { border-bottom: 0; }
  .answers .bk { width: 30px; height: 30px; border-radius: 8px; background: var(--surface-2); color: var(--text-2); display: flex; align-items: center; justify-content: center; flex: none; }
  .answers .n { font-weight: 600; font-size: 14px; line-height: 1.3; }
  .answers .s { font-size: 12.5px; color: var(--text-2); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .answers .c { font-size: 11.5px; color: var(--text-3); margin-top: 5px; }

  .req { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--line); }
  .req:last-child { border-bottom: 0; }
  .req .ref { font-family: "Geist Mono", monospace; font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
  .req .ref b { font-weight: 600; }
  .req .ref.inc b { color: var(--p-urgent); } .req .ref.chg b { color: var(--brand-deep); } .req .ref.qst b { color: var(--p-medium); }
  .req .t { font-weight: 500; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .req .sub { font-size: 12px; color: var(--text-3); margin-top: 1px; }
  .req .st { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-2); white-space: nowrap; }
  .tag { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .tag.you { background: var(--brand-tint); color: var(--brand-deep); }
  .pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }

  .deskcard .row { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
  .deskcard .row:last-child { border-bottom: 0; }
  .deskcard .ico { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--text-2); flex: none; }
  .deskcard .row .l { font-size: 11.5px; color: var(--text-3); }

  .waiting { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 14px; background: var(--brand-wash); border: 1px solid color-mix(in oklab, var(--brand) 32%, transparent); grid-column: 1 / -1; font-size: 14px; }
  .waiting .ico { width: 36px; height: 36px; border-radius: 10px; background: var(--brand); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; flex: none; }
  .waiting .ref { font-family: "Geist Mono", monospace; font-size: 12.5px; text-decoration: underline; text-underline-offset: 3px; }
  .waiting .since { margin-left: auto; font-family: "Geist Mono", monospace; font-size: 12px; color: var(--brand-deep); }
  .waiting .go { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--brand-deep); }

  .footer { margin-top: auto; border-top: 1px solid var(--line); }
  .footer .wrap { height: 64px; display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--text-3); }
  .footer a { color: var(--text-2); }

  /* inner pages */
  .pagehead { padding: 40px 0 28px; }
  .crumbs { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); margin-bottom: 14px; }
  .crumbs .cur { color: var(--text-2); }
  .pagehead h1 { font-size: 30px; font-weight: 600; letter-spacing: -.03em; margin: 0; line-height: 1.15; }
  .pagehead .blurb { color: var(--text-2); font-size: 15px; margin: 8px 0 0; max-width: 60ch; }
  .headrow { display: flex; align-items: flex-end; gap: 24px; }
  .headrow .tools { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .input { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font-size: 13.5px; box-shadow: var(--hl); white-space: nowrap; }
  .input .ph { color: var(--text-3); flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .btn { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; border-radius: 10px; font-size: 14px; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
  .btn.primary { background: var(--brand); color: var(--brand-ink); box-shadow: 0 1px 2px rgba(9,9,11,.12); }
  .btn.outline { border-color: var(--line); background: var(--surface); color: var(--text); box-shadow: var(--hl); font-weight: 500; }
  .btn.ghost { color: var(--text-2); font-weight: 500; }
  .btn.sm { height: 32px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface-2); height: 40px; }
  .seg span { display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; font-size: 13.5px; font-weight: 500; color: var(--text-2); }
  .seg span.on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 2px rgba(9,9,11,.1), 0 0 0 1px rgba(9,9,11,.04); }
  .seg span .k { font-family: "Geist Mono", monospace; font-size: 11.5px; color: var(--text-3); }
  .grouphead { display: flex; align-items: baseline; gap: 10px; margin: 28px 0 12px; font-weight: 600; font-size: 15px; }
  .grouphead .k { font-family: "Geist Mono", monospace; font-size: 12px; color: var(--text-3); font-weight: 500; }
  .rrow { display: grid; grid-template-columns: 4px 128px minmax(0, 1fr) 220px 16px; align-items: center; gap: 16px; padding: 14px 18px 14px 0; border-bottom: 1px solid var(--line); }
  .rrow:last-child { border-bottom: 0; }
  .rrow.done { opacity: .7; }
  .rrow .spine { width: 4px; height: 36px; border-radius: 2px; background: color-mix(in oklab, var(--c) 18%, transparent); position: relative; overflow: visible; }
  .rrow .spine i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--c); border-radius: 2px; }
  .rrow .spine.hot i::after { content: ""; position: absolute; left: -2px; right: -2px; top: -3px; height: 6px; border-radius: 3px; background: var(--c); box-shadow: 0 0 8px 2px var(--c); }
  .rrow .ref { font-family: "Geist Mono", monospace; font-size: 12px; color: var(--text-3); }
  .rrow .ref b { font-weight: 600; }
  .rrow .ref.inc b { color: var(--p-urgent); } .rrow .ref.chg b { color: var(--brand-deep); } .rrow .ref.qst b { color: var(--p-medium); }
  .rrow .t { font-weight: 600; font-size: 14.5px; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .rrow .t span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rrow .meta { font-size: 12.5px; color: var(--text-3); margin-top: 2px; display: flex; gap: 6px; align-items: center; }
  .rrow .meta .mono { font-size: 12px; }
  .rrow .st { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); }
  .rrow .st .who { margin-left: auto; }

  .detail { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 40px; padding-bottom: 56px; }
  .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); margin: 28px 0 18px; }
  .detail h1 { font-size: 26px; font-weight: 600; letter-spacing: -.025em; margin: 10px 0 0; line-height: 1.2; }
  .detail .meta { font-size: 13px; color: var(--text-3); margin-top: 8px; }
  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .facts > div { padding: 14px 18px; border-bottom: 1px solid var(--line); }
  .facts > div:nth-child(odd) { border-right: 1px solid var(--line); }
  .facts > div:nth-last-child(-n+2) { border-bottom: 0; }
  .facts .l { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
  .facts .v { margin-top: 6px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
  .prose { font-size: 14.5px; line-height: 1.6; color: var(--text); }
  .prose p { margin: 0 0 12px; } .prose p:last-child { margin: 0; }
  .prose ul { margin: 0 0 12px; padding-left: 20px; } .prose li { margin: 3px 0; }
  .prose h2 { font-size: 17px; font-weight: 600; letter-spacing: -.015em; margin: 22px 0 8px; }
  .prose code { font-family: "Geist Mono", monospace; font-size: 12.5px; background: var(--surface-2); padding: 1px 5px; border-radius: 4px; }
  .attach { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px 0 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-2); font-size: 12.5px; color: var(--text-2); }
  .attach .mono { font-size: 11px; color: var(--text-3); }
  .msg { padding: 16px 18px; border-bottom: 1px solid var(--line); }
  .msg:last-child { border-bottom: 0; }
  .msg .who { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .msg .who b { font-weight: 600; }
  .msg .who .when { color: var(--text-3); margin-left: auto; font-size: 12px; }
  .msg .body { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--text); }
  .msg.desk { background: var(--brand-wash); }
  .composer { padding: 16px 18px; }
  .composer .area { height: 104px; border-radius: 10px; border: 1px solid var(--line); background: var(--paper); padding: 10px 12px; font-size: 14px; color: var(--text-3); }
  .composer .foot { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .callout { padding: 16px 18px; border-radius: 14px; background: var(--brand-wash); border: 1px solid color-mix(in oklab, var(--brand) 32%, transparent); display: flex; gap: 14px; align-items: flex-start; }
  .callout .ico { width: 36px; height: 36px; border-radius: 10px; background: var(--brand); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; flex: none; }
  .callout .h { font-weight: 600; font-size: 14.5px; }
  .callout .s { font-size: 13px; color: var(--text-2); margin-top: 3px; }
  .ok { padding: 14px 18px; border-radius: 14px; background: color-mix(in oklab, var(--positive) 10%, transparent); border: 1px solid color-mix(in oklab, var(--positive) 35%, transparent); display: flex; gap: 12px; align-items: center; font-size: 14px; }
  .ok .ico { color: var(--positive); display: flex; }
  .side .card { margin-bottom: 20px; }
  .side .lbl { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }

  /* form */
  .form { padding: 8px 0 0; }
  .fs { padding: 22px 24px; border-bottom: 1px solid var(--line); }
  .fs:last-of-type { border-bottom: 0; }
  .fs legend, .fs .lg { font-weight: 600; font-size: 15px; letter-spacing: -.01em; }
  .fs .ld { font-size: 13px; color: var(--text-3); margin: 3px 0 16px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
  .f { display: flex; flex-direction: column; gap: 6px; }
  .f.full { grid-column: 1 / -1; }
  .f .fl { font-size: 13.5px; font-weight: 500; }
  .f .fl i { color: var(--negative); font-style: normal; margin-left: 2px; }
  .f .fi { height: 40px; border-radius: 10px; border: 1px solid var(--line); background: var(--paper); display: flex; align-items: center; padding: 0 12px; font-size: 14px; color: var(--text-3); box-shadow: var(--hl); }
  .f .fi.filled { color: var(--text); }
  .f .fi.ta { height: 96px; align-items: flex-start; padding-top: 10px; }
  .f .fi.sel { justify-content: space-between; }
  .f .hint { font-size: 12.5px; color: var(--text-3); }
  .radio { display: flex; flex-direction: column; gap: 8px; }
  .radio span { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--paper); font-size: 14px; }
  .radio span.on { border-color: var(--brand); background: var(--brand-tint); }
  .radio .dot { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--line-strong); display: inline-flex; align-items: center; justify-content: center; }
  .radio .on .dot { border-color: var(--brand); } .radio .on .dot::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--brand); }
  .suggest { margin: 0 24px 4px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); }
  .suggest .h { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13.5px; }
  .suggest .h a { margin-left: auto; font-size: 12.5px; font-weight: 500; color: var(--text-3); }
  .suggest .it { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; margin-top: 8px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-size: 13.5px; }
  .suggest .it .s { color: var(--text-2); font-size: 12.5px; margin-top: 2px; }
  .formfoot { padding: 18px 24px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 18px; }
  .formfoot .lines { font-size: 13px; color: var(--text-2); line-height: 1.5; }
  .formfoot .lines b { color: var(--text); font-weight: 500; }
  .formfoot .btn { margin-left: auto; height: 44px; padding: 0 22px; font-size: 15px; }

  /* answers hub */
  .often { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  .often span { display: inline-flex; align-items: center; height: 32px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-size: 13px; font-weight: 500; color: var(--text-2); box-shadow: var(--hl); }
  .agrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .acard { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; }
  .acard .n { font-weight: 600; font-size: 14.5px; line-height: 1.3; letter-spacing: -.01em; }
  .acard .s { font-size: 13px; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .acard .m { margin-top: auto; font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 6px; }

  /* article */
  .article { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 48px; padding-bottom: 56px; }
  .byline { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-3); margin-top: 14px; }
  .feedback { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--line); font-size: 14px; }
  .feedback .vote { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-size: 13px; font-weight: 500; }
  .feedback .vote.on { background: var(--brand-tint); border-color: var(--brand); color: var(--brand-deep); }
  .feedback .tally { margin-left: auto; font-size: 12.5px; color: var(--text-3); }
  .rel a { display: flex; gap: 10px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
  .rel a:last-child { border-bottom: 0; }
  .rel a > span:not(.tile) { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .rel .s { display: block; font-size: 12px; color: var(--text-3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* search dropdown & menus */
  .dd { position: absolute; left: 50%; width: 720px; margin-left: -360px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; z-index: 5; color: var(--text); text-align: left; }
  .dd .hit { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
  .dd .hit.on { background: var(--surface-2); }
  .dd .hit .tile { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex: none; }
  .dd .hit .n { font-weight: 600; font-size: 14px; }
  .dd .hit .s { font-size: 12.5px; color: var(--text-3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dd .foot { display: flex; align-items: center; gap: 6px; padding: 10px 16px; font-size: 12.5px; color: var(--brand-deep); font-weight: 500; }
  .menu { position: absolute; right: 0; top: 60px; width: 260px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 8px; z-index: 5; }
  .menu .me { display: flex; align-items: center; gap: 10px; padding: 8px 10px 12px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
  .menu .me b { font-weight: 600; font-size: 14px; display: block; }
  .menu .me span { font-size: 12px; color: var(--text-3); }
  .menu .mi { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 8px; font-size: 13.5px; color: var(--text); }
  .menu .lbl { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); padding: 8px 10px 6px; }
  .menu .theme { display: inline-flex; gap: 2px; padding: 3px; border-radius: 8px; background: var(--surface-2); margin: 0 10px 8px; }
  .menu .theme span { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 6px; font-size: 12.5px; color: var(--text-2); flex: 1; }
  .menu .theme span.on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 2px rgba(9,9,11,.1); }

  .closed { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; padding-bottom: 80px; }
  .closed .tile { width: 64px; height: 64px; border-radius: 18px; background: var(--brand-tint); color: var(--brand-deep); display: flex; align-items: center; justify-content: center; }
  .closed h1 { font-size: 26px; font-weight: 600; letter-spacing: -.025em; margin: 6px 0 0; }
  .closed p { color: var(--text-2); font-size: 15px; margin: 0; max-width: 46ch; }

  .empty { padding: 48px 24px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 14px; color: var(--text-2); font-size: 14px; }
  .empty b { display: block; color: var(--text); font-size: 15px; font-weight: 600; margin-bottom: 4px; }
`;

/* ------------------------------------------------------------------- data */
const ME = { k: "SL", name: "Sanne Lin", first: "Sanne", email: "sanne.lin@example.org" };

const CATS = [
  { n: "Hardware", i: "laptop", c: "#6366f1", d: "Laptops, monitors, phones and the bits between", cnt: 9, slug: "hardware" },
  { n: "Software & licences", i: "key", c: "#0ea5e9", d: "Applications, licences and updates", cnt: 12, slug: "software" },
  { n: "Access & accounts", i: "lock", c: "#10b981", d: "Passwords, MFA, shared drives and groups", cnt: 8, slug: "access" },
  { n: "Network & Wi-Fi", i: "wifi", c: "#f97316", d: "VPN, office Wi-Fi and guest access", cnt: 5, slug: "network" },
  { n: "Email & calendar", i: "mail", c: "#febe2e", d: "Mailboxes, forwarding, rooms and invites", cnt: 7, slug: "email" },
  { n: "Office & facilities", i: "building", c: "#f43f5e", d: "Badges, desks, printers and meeting rooms", cnt: 6, slug: "office" },
];

const FORMS = [
  { n: "New or replacement laptop", s: "A standard model within a week, or a specific one if your role needs it.", i: "laptop", c: "#6366f1", cat: "Hardware" },
  { n: "Software licence", s: "Figma, Adobe, JetBrains and anything else on the approved list.", i: "key", c: "#0ea5e9", cat: "Software & licences" },
  { n: "Access to a shared drive", s: "Read or edit rights on a team drive or SharePoint site.", i: "drive", c: "#10b981", cat: "Access & accounts" },
  { n: "Report something broken", s: "Anything that stopped working — tell us what and where.", i: "bug", c: "#f43f5e", cat: "Office & facilities" },
  { n: "Guest Wi-Fi for a visitor", s: "A day pass for someone visiting the office.", i: "wifi", c: "#f97316", cat: "Network & Wi-Fi" },
  { n: "Second monitor", s: "For your desk in the office or at home.", i: "monitor", c: "#6366f1", cat: "Hardware" },
];

const ARTICLES = [
  { n: "VPN keeps dropping — what to try first", s: "Three things that fix nine out of ten disconnects before you call us.", cat: "Network & Wi-Fi", min: 2, views: 412 },
  { n: "Set up email on your phone", s: "Outlook on iPhone and Android, with the MFA step people miss.", cat: "Email & calendar", min: 3, views: 388 },
  { n: "Reset your password without calling us", s: "The self-service page, and what to do when it will not accept the code.", cat: "Access & accounts", min: 1, views: 301 },
  { n: "Book a meeting room from Teams", s: "Rooms show up as attendees. Here is where to find them.", cat: "Office & facilities", min: 2, views: 260 },
  { n: "Printing from your laptop", s: "Add the floor printer once; it follows you between floors.", cat: "Office & facilities", min: 2, views: 190 },
  { n: "Sharing files with people outside the company", s: "When a link is fine and when it needs a guest account.", cat: "Access & accounts", min: 3, views: 154 },
];

const MINE = [
  { r: "INC-2609 0119", t: "Laptop will not wake from sleep after Monday's patch", s: "waiting", a: "MK", who: "Sanne", age: "6h", form: "Report something broken", replies: 3, last: "Mila asked you something 2h ago", you: true, p: "high", heat: 0.55 },
  { r: "QST-2609 0122", t: "How do I get a second monitor for the Rotterdam desk?", s: "new", a: null, age: "12m", form: "Second monitor", replies: 0, last: "", p: "medium", heat: 0.05 },
  { r: "INC-2609 0111", t: "Teams call quality poor in the small meeting rooms", s: "progress", a: "MK", age: "5h", form: null, replies: 1, last: "Mila replied 3h ago", p: "medium", heat: 0.28 },
  { r: "CHG-2609 0004", t: "Roll out MFA to the remaining 38 contractors", s: "progress", a: "RD", age: "2d", form: null, replies: 9, last: "Rami replied yesterday", p: "medium", heat: 0.3 },
];
const SETTLED = [
  { r: "QST-2609 0108", t: "Request access to the HR SharePoint site", s: "resolved", a: "MK", age: "6d", form: "Access to a shared drive", replies: 1, last: "Mila replied 6d ago", p: "low" },
  { r: "QST-2609 0112", t: "Onboarding checklist for the two September starters", s: "resolved", a: "TP", age: "2d", form: null, replies: 3, last: "Tomás replied 2d ago", p: "low" },
];

/* ------------------------------------------------------------- pieces */
const tile = (i, c, size = 38, r = 11, s = 18) =>
  `<span class="tile" style="width:${size}px;height:${size}px;border-radius:${r}px;background:color-mix(in oklab,${c} 14%,transparent);color:${c}">${ic(i, "", s)}</span>`;
const refx = (r) => `<span class="ref ${r.slice(0, 3).toLowerCase()}"><b>${r.slice(0, 3)}</b>${r.slice(3)}</span>`;
const stname = { new: "New", progress: "In progress", waiting: "Waiting on you", resolved: "Resolved" };
const st = (s) => `<span class="st">${ring(s)}${stname[s]}</span>`;
const stpill = (s) => {
  const c = { new: "var(--brand)", progress: "var(--p-medium)", waiting: "var(--text-3)", resolved: "var(--positive)" }[s];
  return `<span class="pill" style="background:color-mix(in oklab,${c} 14%,transparent);color:${c}">${ring(s)}${stname[s]}</span>`;
};

function strip(kind, html) {
  const icon = { info: "info", warn: "warn", outage: "warn", approve: "stamp" }[kind];
  return `<div class="strip ${kind}"><div class="wrap">${ic(icon, "", 15)}${html}</div></div>`;
}
const ANNOUNCE = strip("info", `<b>Planned maintenance on the file servers</b><span>Saturday 20 September, 08:00–12:00 — shared drives will be read-only.</span><span class="until mono">Until 20 Sep 12:00</span>`);
const APPROVE = strip("approve", `<span><b>Something has been waiting 2 days on your approval</b> · <span class="mono" style="font-size:12.5px">CHG-2609 0004</span> Roll out MFA to the remaining 38 contractors</span><a class="act">Answer it ${ic("arrow", "", 13)}</a>`);

function top(active, { staff = true, menu = false } = {}) {
  const item = (k, label, n = 0) => `<a class="${active === k ? "on" : ""}">${label}${n ? `<span class="n">${n}</span>` : ""}</a>`;
  const userMenu = menu
    ? `<div class="menu">
        <div class="me">${avatar(ME.k, 32)}<div><b>${ME.name}</b><span>${ME.email}</span></div></div>
        <div class="lbl">Theme</div>
        <div class="theme"><span>${ic("sun", "", 13)}Light</span><span class="on">${ic("moon", "", 13)}Dark</span><span>System</span></div>
        <div class="mi">${ic("logout", "t3", 15)}Sign out</div>
      </div>`
    : "";
  return `
  <div class="top"><div class="wrap" style="position:relative">
    <span class="lockup">${logo(26)}Service portal</span>
    <nav class="nav">${item("home", "Home")}${item("answers", "Answers")}${item("requests", "My requests", 4)}${item("approvals", "Approvals", 1)}</nav>
    <div class="right">
      <span class="ibtn" title="Search">${ic("search", "", 18)}</span>
      ${staff ? `<span class="vsep"></span><span class="switch">${ic("panel", "", 14)}Service desk</span>` : ""}
      <span class="vsep"></span>
      ${avatar(ME.k, 32)}
    </div>
    ${userMenu}
  </div></div>`;
}

const FOOT = `<div class="footer"><div class="wrap"><span>Service portal</span><span>·</span><a>Service desk</a><span style="margin-left:auto" class="mono">Tiqo</span></div></div>`;

function field() {
  // The signal field, drawn once as spans so it is decoration and nothing else.
  const N = 40, W = 620, H = 260, target = 0.62;
  const cols = ["urgent", "high", "medium", "low"];
  let s = "";
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const wave = 0.3 + 0.28 * Math.sin(t * 6.1 + 0.8) + 0.18 * Math.sin(t * 13.7 + 2.1) + 0.1 * Math.sin(t * 27 + 0.3);
    const h = Math.max(0.05, Math.min(0.95, wave));
    const amber = (i * 7) % 11 !== 0;
    const c = amber ? "var(--brand)" : `var(--p-${cols[(i * 5) % 4]})`;
    const hot = h > target;
    s += `<i style="left:${(i * (W / N)).toFixed(1)}px;width:${(W / N - 6).toFixed(1)}px;height:${(h * H).toFixed(0)}px;background:${c};opacity:${hot ? 0.95 : (0.18 + h * 0.35).toFixed(2)};${hot ? `box-shadow:0 0 14px 1px ${c}` : ""}"></i>`;
  }
  return `<div class="field">${s}<span style="position:absolute;left:0;right:0;bottom:${(target * H).toFixed(0)}px;border-top:1px dashed rgba(255,255,255,.22)"></span></div>`;
}

function hero({ search = false } = {}) {
  const dd = search
    ? `<div class="dd" style="top:64px">
        ${[["laptop", "#6366f1", "Second monitor", "Request · Hardware · For your desk in the office or at home.", true], ["laptop", "#6366f1", "New or replacement laptop", "Request · Hardware · A standard model within a week, or a specific one if your role needs it."], ["book", "var(--text-2)", "Two screens on a MacBook — which adapter", "Answer · Hardware · The dock and cable combinations that work."], ["book", "var(--text-2)", "Printing from your laptop", "Answer · Office & facilities · Add the floor printer once; it follows you between floors."]]
          .map(([i, c, n, s, on]) => `<div class="hit ${on ? "on" : ""}">${tile(i, c, 32, 9, 16)}<div style="min-width:0"><div class="n">${n}</div><div class="s">${s}</div></div>${on ? `<kbd style="margin-left:auto">↵</kbd>` : ""}</div>`)
          .join("")}
        <div class="foot">See all results for “monitor” ${ic("arrow", "", 13)}</div>
      </div>`
    : "";
  return `
  <div class="hero">
    <div class="deco"><div class="grid"></div><div class="aura"></div>${field()}</div>
    <div class="wrap">
      <h1>Good morning, ${ME.first}.</h1>
      <p class="welcome">What do you need? Search for an answer, or ask us for something.</p>
      <div style="position:relative">
        <div class="search">${ic("search", "", 18)}<span class="ph">${search ? `<span style="color:#fafafa">monitor</span>` : "Search answers and requests"}</span><kbd>⌘K</kbd><span class="go">${ic("arrow", "", 17)}</span></div>
        ${dd}
      </div>
      <div class="starts">${CATS.slice(0, 4).map((c) => `<span>${ic(c.i, "", 14)}${c.n}</span>`).join("")}</div>
      <div class="desk"><span class="dot"></span><b>The desk is open</b> until 17:30 · usually answered in about 4 hours</div>
    </div>
  </div>`;
}

const shelf = () => `
  <div class="shelf">${CATS.map((c, i) => `<a class="${i === 2 ? "hover" : ""}">${tile(c.i, c.c, 48, 14, 22)}<span class="name">${c.n}</span><span class="cnt">${c.cnt} items</span></a>`).join("")}</div>`;

const svc = (f, hover = false) => `
  <a class="card svc ${hover ? "hover" : ""}">${tile(f.i, f.c)}<span class="n">${f.n}</span><span class="s">${f.s}</span><span class="m">${f.cat}<span class="arr">${ic("arrow", "", 14)}</span></span></a>`;

const reqRow = (m) => `
  <a class="req">${ring(m.s)}<div style="min-width:0;flex:1"><div class="t">${m.t}</div><div class="sub" style="display:flex;align-items:center;gap:8px">${refx(m.r)} · ${m.age} ago${m.you ? `<span class="tag you">Waiting for your reply</span>` : ""}</div></div></a>`;

const waiting = () => `
  <a class="waiting"><span class="ico">${ic("msg", "", 17)}</span><span><b style="font-weight:600">Mila is waiting for your answer</b> on <span class="ref">INC-2609 0119</span> · Laptop will not wake from sleep after Monday's patch</span><span class="since">waiting 2h for your reply</span><span class="go">Reply ${ic("arrow", "", 13)}</span></a>`;

const deskcard = () => `
  <div class="card deskcard">
    <div class="cardhead">The service desk</div>
    <div class="row"><span class="ico" style="background:color-mix(in oklab,var(--positive) 14%,transparent);color:var(--positive)">${ic("clock", "", 16)}</span><div><div class="l">Opening hours</div><div style="font-weight:500">Open until 17:30 · Mon–Fri 08:30–17:30</div></div></div>
    <div class="row"><span class="ico">${ic("reply", "", 16)}</span><div><div class="l">Usually answered in</div><div style="font-weight:500">About 4 hours</div></div></div>
    <div class="row"><span class="ico">${ic("phone", "", 16)}</span><div><div class="l">Urgent and the desk is closed</div><div style="font-weight:500">+31 30 123 4567</div></div></div>
  </div>`;

/* ------------------------------------------------------------- screens */
function home({ search = false, menu = false } = {}) {
  return `
  <div class="portal">
    ${ANNOUNCE}
    ${top("home", { menu })}
    ${hero({ search })}
    <div class="wrap">
      ${shelf()}
      <div class="content">
        ${waiting()}
        <div>
          <div class="sec">
            <div class="sechead"><h2>Common requests</h2><span class="sub">The things people ask for most</span><a class="more">Everything ${ic("arrow", "", 13)}</a></div>
            <div class="services">${FORMS.map((f, i) => svc(f, i === 0)).join("")}</div>
          </div>
          <div class="sec">
            <div class="sechead"><h2>Answers</h2><span class="sub">Solve it yourself, in a minute, without waiting for us</span><a class="more">All answers ${ic("arrow", "", 13)}</a></div>
            <div class="card answers">${ARTICLES.slice(0, 4).map((a) => `<a><span class="bk">${ic("book", "", 15)}</span><span style="min-width:0"><span class="n">${a.n}</span><span class="s">${a.s}</span><span class="c">${a.cat} · ${a.min} min read</span></span></a>`).join("")}</div>
          </div>
        </div>
        <div class="side">
          <div class="card">
            <div class="cardhead">Your requests<a>4 open</a></div>
            ${MINE.map(reqRow).join("")}
            <div class="cardfoot">My requests ${ic("arrow", "", 13)}</div>
          </div>
          ${deskcard()}
        </div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function category() {
  const c = CATS[0];
  const forms = FORMS.filter((f) => f.cat === "Hardware").concat([{ n: "Phone or SIM", s: "A work phone, a SIM for your own, or a replacement.", i: "phone", c: "#6366f1", cat: "Hardware" }, { n: "Headset or webcam", s: "For calls from the office or from home.", i: "monitor", c: "#6366f1", cat: "Hardware" }]);
  return `
  <div class="portal">
    ${top("home")}
    <div class="wrap">
      <div class="pagehead">
        <div class="crumbs"><span>Home</span>${ic("chev", "", 12)}<span class="cur">${c.n}</span></div>
        <div class="headrow">
          <div style="display:flex;gap:18px;align-items:center">${tile(c.i, c.c, 56, 16, 26)}<div><h1>${c.n}</h1><p class="blurb">${c.d}.</p></div></div>
          <div class="tools"><div class="input" style="width:320px">${ic("search", "t3", 15)}<span class="ph">Search in ${c.n}</span><kbd>⌘K</kbd></div></div>
        </div>
      </div>
      <div class="sec">
        <div class="sechead"><h2>Requests</h2><span class="sub">${forms.length} in this section</span></div>
        <div class="services" style="grid-template-columns:repeat(4,1fr)">${forms.map((f, i) => svc(f, i === 1)).join("")}</div>
      </div>
      <div class="sec" style="padding-bottom:56px">
        <div class="sechead"><h2>Answers</h2><span class="sub">Read these first — most hardware questions end here</span></div>
        <div class="agrid">${[ARTICLES[0], { n: "Two screens on a MacBook — which adapter", s: "The dock and cable combinations that work, and the one that never does.", cat: "Hardware", min: 2 }, { n: "Battery drains fast after an update", s: "Usually indexing. Here is how to tell, and how long to wait.", cat: "Hardware", min: 1 }].map((a) => `<a class="card acard"><span class="n">${a.n}</span><span class="s">${a.s}</span><span class="m">${ic("book", "", 13)}${a.min} min read</span></a>`).join("")}</div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function form() {
  const f = FORMS[5];
  return `
  <div class="portal">
    ${top("home")}
    <div class="wrap">
      <div class="pagehead">
        <div class="crumbs"><span>Home</span>${ic("chev", "", 12)}<span>Hardware</span>${ic("chev", "", 12)}<span class="cur">${f.n}</span></div>
        <div style="display:flex;gap:18px;align-items:center">${tile(f.i, f.c, 56, 16, 26)}<div><h1>${f.n}</h1><p class="blurb">A 27-inch screen for your desk in the office or at home. Standard monitors ship within a week; anything else we will check with you first.</p></div></div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px;padding-bottom:56px">
        <div class="card form">
          <div class="fs">
            <div class="lg">What do you need</div><div class="ld">Two lines is plenty. We will ask if we need more.</div>
            <div class="fields">
              <div class="f full"><span class="fl">Subject<i>*</i></span><span class="fi filled">Second monitor for the Rotterdam desk</span></div>
              <div class="f full">
                <div class="suggest" style="margin:0">
                  <div class="h">${ic("book", "", 15)}This might already answer it<a>None of these</a></div>
                  <div class="it">${ic("book", "t3", 15)}<div><div>Two screens on a MacBook — which adapter</div><div class="s">The dock and cable combinations that work, and the one that never does.</div></div></div>
                  <div class="it">${ic("book", "t3", 15)}<div><div>Home-office equipment — what you can ask for</div><div class="s">Monitor, chair, desk and the budget for each.</div></div></div>
                </div>
              </div>
              <div class="f"><span class="fl">Where is the desk<i>*</i></span><span class="fi sel filled">Rotterdam office ${ic("chevd", "t3", 14)}</span></div>
              <div class="f"><span class="fl">Needed by</span><span class="fi">Pick a date</span><span class="hint">Leave empty if any time next week is fine.</span></div>
              <div class="f full"><span class="fl">Which kind<i>*</i></span>
                <div class="radio"><span class="on"><span class="dot"></span>Standard 27-inch (Dell, USB-C) — in stock</span><span><span class="dot"></span>Something else — I will describe it below</span></div>
              </div>
              <div class="f full"><span class="fl">Anything else</span><span class="fi ta">Model, mount, or why the standard one will not do…</span></div>
            </div>
          </div>
          <div class="fs">
            <div class="lg">Attachments</div><div class="ld">Drop a photo or paste a screenshot into any answer.</div>
            <div style="display:flex;gap:8px;align-items:center"><span class="btn outline sm">${ic("clip", "", 14)}Attach a file</span><span class="attach">${ic("note", "", 13)}desk-photo.jpg<span class="mono">1.2 MB</span>${ic("x", "t3", 12)}</span></div>
          </div>
          <div class="formfoot">
            <div class="lines">Raised as a <b>medium</b> question · answered by <b>Workplace</b> within about 8h<br>Updates go to <b>${ME.email}</b> and to My requests</div>
            <span class="btn primary">${ic("send", "", 16)}Send</span>
          </div>
        </div>
        <div class="side">
          <div class="card"><div class="cardhead">Before you ask</div><div class="rel">${[["Two screens on a MacBook — which adapter", "2 min read"], ["Home-office equipment — what you can ask for", "3 min read"]].map(([n, m]) => `<a>${ic("book", "t3", 15)}<span style="min-width:0"><span style="font-weight:500">${n}</span><span class="s">${m}</span></span></a>`).join("")}</div></div>
          ${deskcard()}
        </div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function request() {
  const m = MINE[0];
  return `
  <div class="portal">
    ${top("requests")}
    <div class="wrap">
      <a class="back">${ic("backl", "", 14)}My requests</a>
      <div class="detail">
        <div>
          <div class="callout" style="margin-bottom:22px"><span class="ico">${ic("stamp", "", 17)}</span><div style="flex:1"><div class="h">Your approval is needed</div><div class="s">Replace the laptop rather than repair it? · Whole ticket · due 19 Sep</div></div><div style="display:flex;gap:8px"><span class="btn primary sm">${ic("check", "", 14)}Approve</span><span class="btn outline sm">${ic("x", "", 14)}Refuse</span></div></div>
          <div class="ok" style="margin-bottom:22px"><span class="ico">${ic("check", "", 18)}</span><span><b style="font-weight:600">Your request has been raised.</b> We have it. You can follow it here and reply at any time.</span></div>
          <div style="display:flex;align-items:center;gap:10px"><span class="mono t3" style="font-size:13px">${refx(m.r)}</span>${stpill("waiting")}</div>
          <h1>${m.t}</h1>
          <div class="meta">Raised 16 Sep 09:12 · through <b style="color:var(--text-2);font-weight:500">Report something broken</b></div>

          <div class="card facts" style="margin-top:22px">
            <div><div class="l">Looking after it</div><div class="v">${avatar("MK", 22)}Mila Kuipers</div></div>
            <div><div class="l">Due date</div><div class="v">${ic("cal", "t3", 15)}Thu 18 Sep, 17:30</div></div>
          </div>

          <div class="card" style="margin-top:20px">
            <div class="cardhead">What you asked</div>
            <div class="prose" style="padding:18px">
              <p>Since Monday's patch the laptop will not wake from sleep. Closing the lid and opening it again shows a black screen with the fan on; only a long press on the power button brings it back.</p>
              <p>It happened four times today. Nothing else changed.</p>
              <div style="display:flex;gap:8px;margin-top:14px"><span class="attach">${ic("note", "", 13)}IMG_4412.jpg<span class="mono">2.1 MB</span></span><span class="attach">${ic("note", "", 13)}system-report.txt<span class="mono">14 KB</span></span></div>
            </div>
          </div>

          <div class="card" style="margin-top:20px">
            <div class="cardhead">Related requests</div>
            <div class="rel"><a>${ring("resolved")}<span style="min-width:0"><span class="t3" style="font-size:12px">relates to</span> <span style="font-weight:500">Battery drains fast after the same update</span></span><span style="margin-left:auto" class="t3">Resolved</span></a></div>
          </div>

          <div class="card" style="margin-top:20px">
            <div class="msg desk"><div class="who">${avatar("MK", 24)}<b>Mila Kuipers</b><span class="tag" style="background:var(--surface-3);color:var(--text-2)">Service desk</span><span class="when">16 Sep 10:40</span></div><div class="body">Thanks Sanne — that patch has a known wake bug on this model. Two questions so I can pick the right fix: is the laptop on the dock when it happens, and does it also fail on battery?</div></div>
            <div class="msg"><div class="who">${avatar("SL", 24)}<b>You</b><span class="when">16 Sep 11:05</span></div><div class="body">On the dock every time. I have not tried on battery yet, will do this afternoon.</div></div>
            <div class="msg desk"><div class="who">${avatar("MK", 24)}<b>Mila Kuipers</b><span class="tag" style="background:var(--surface-3);color:var(--text-2)">Service desk</span><span class="when">Today 08:52</span></div><div class="body">Perfect. Could you try it on battery once and tell me whether it wakes? If it does, the dock firmware is the culprit and I can push the update remotely.</div></div>
            <div class="composer" style="border-top:1px solid var(--line)">
              <div class="lbl" style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px">Add a reply</div>
              <div class="area">Anything you want to add…</div>
              <div class="foot"><span class="btn ghost sm">${ic("clip", "", 14)}Attach</span><span class="t3" style="font-size:12px">or drop a file here</span><span class="btn primary sm" style="margin-left:auto">${ic("send", "", 14)}Send</span></div>
            </div>
          </div>
        </div>
        <div class="side" style="padding-top:8px">
          <div class="card">
            <div class="cardhead">Where it stands</div>
            <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;font-size:13.5px">
              ${[["resolved", "Raised", "16 Sep 09:12"], ["resolved", "Picked up by Mila", "16 Sep 09:30"], ["waiting", "Waiting for your reply", "since 08:52 today"], ["new", "Resolved", "—"]].map(([s, n, w], i) => `<div style="display:flex;align-items:center;gap:10px;${i === 3 ? "opacity:.45" : ""}">${ring(s)}<span style="font-weight:500">${n}</span><span class="t3 mono" style="margin-left:auto;font-size:12px">${w}</span></div>`).join("")}
            </div>
          </div>
          ${deskcard()}
        </div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function requests() {
  const rrow = (m, done = false) => `
    <div class="rrow ${done ? "done" : ""}">
      <span class="spine ${m.heat > 0.5 && !done ? "hot" : ""}" style="--c:var(--p-${m.p})"><i style="height:${Math.round((m.heat ?? 1) * 100)}%"></i></span>
      ${refx(m.r)}
      <div style="min-width:0"><div class="t"><span>${m.t}</span>${m.you ? `<span class="tag you">Waiting for your reply</span>` : ""}</div><div class="meta">${m.form ? `<span>${m.form}</span><span>·</span>` : ""}<span class="mono">${m.age} ago</span>${m.replies ? `<span>·</span><span style="display:inline-flex;align-items:center;gap:4px">${ic("msg", "", 12)}${m.replies} ${m.replies === 1 ? "reply" : "replies"}</span>` : ""}${m.last ? `<span>·</span><span>${m.last}</span>` : ""}</div></div>
      <div class="st">${ring(m.s)}${stname[m.s]}<span class="who">${avatar(m.a, 22)}</span></div>
      ${ic("chev", "t3", 14)}
    </div>`;
  return `
  <div class="portal">
    ${APPROVE}
    ${top("requests")}
    <div class="wrap">
      <div class="pagehead">
        <div class="headrow">
          <div><h1>My requests</h1><p class="blurb">Everything you have asked us for, and where it stands.</p></div>
          <div class="tools">
            <span class="seg"><span class="on">All <span class="k">6</span></span><span>Open <span class="k">4</span></span><span>Settled <span class="k">2</span></span></span>
            <div class="input" style="width:260px">${ic("search", "t3", 15)}<span class="ph">Search your requests</span></div>
            <span class="btn primary">${ic("plus", "", 15)}Make a request</span>
          </div>
        </div>
      </div>
      ${waiting()}
      <div class="grouphead">Still open<span class="k">4</span></div>
      <div class="card" style="padding-left:18px">${MINE.map((m) => rrow(m)).join("")}</div>
      <div class="grouphead">Settled<span class="k">2</span></div>
      <div class="card" style="padding-left:18px;margin-bottom:56px">${SETTLED.map((m) => rrow({ ...m, heat: 1 }, true)).join("")}</div>
    </div>
    ${FOOT}
  </div>`;
}

function answers() {
  const groups = [["Network & Wi-Fi", [ARTICLES[0], { n: "Guest Wi-Fi — how visitors get on", s: "The password changes weekly. Here is where reception keeps it.", min: 1 }, { n: "Working from a hotel or train", s: "What the VPN needs, and the captive portals that block it.", min: 2 }]], ["Email & calendar", [ARTICLES[1], { n: "Out-of-office that actually reaches externals", s: "Two settings, both needed.", min: 1 }, { n: "Shared mailbox not showing in Outlook", s: "Add it explicitly once; auto-mapping takes a day.", min: 2 }]], ["Access & accounts", [ARTICLES[2], ARTICLES[5], { n: "MFA on a new phone", s: "Move the authenticator before you wipe the old one.", min: 2 }]]];
  return `
  <div class="portal">
    ${top("answers")}
    <div class="wrap">
      <div class="pagehead">
        <div class="headrow">
          <div><h1>Answers</h1><p class="blurb">Solve it yourself, in a minute, without waiting for us.</p></div>
          <div class="tools"><div class="input" style="width:360px">${ic("search", "t3", 15)}<span class="ph">What do you need? Search for an answer or a request</span></div></div>
        </div>
        <div style="margin-top:22px;display:flex;align-items:center;gap:12px"><span class="label">Often read</span><div class="often">${ARTICLES.slice(0, 4).map((a) => `<span>${a.n}</span>`).join("")}</div></div>
      </div>
      ${groups.map(([g, list]) => `<div class="sec"><div class="sechead"><h2 style="font-size:17px">${g}</h2><span class="sub mono">${list.length}</span></div><div class="agrid">${list.map((a) => `<a class="card acard"><span class="n">${a.n}</span><span class="s">${a.s}</span><span class="m">${ic("book", "", 13)}${a.min} min read</span></a>`).join("")}</div></div>`).join("")}
      <div style="height:16px"></div>
    </div>
    ${FOOT}
  </div>`;
}

function article() {
  const a = ARTICLES[0];
  return `
  <div class="portal">
    ${top("answers")}
    <div class="wrap">
      <div class="pagehead" style="padding-bottom:0">
        <div class="crumbs"><span>Home</span>${ic("chev", "", 12)}<span>Answers</span>${ic("chev", "", 12)}<span class="cur">${a.cat}</span></div>
        <h1 style="max-width:26ch">${a.n}</h1>
        <p class="blurb" style="max-width:70ch">${a.s}</p>
        <div class="byline">${avatar("MK", 20)}by Mila Kuipers<span>·</span>${avatar("JB", 20)}Updated 2 Sep by Jonas Berg<span>·</span>${a.min} min read</div>
      </div>
      <div class="article" style="margin-top:28px">
        <div class="card">
          <div class="prose" style="padding:26px 28px 22px">
            <h2 style="margin-top:0">1. Turn Wi-Fi off and on, not the VPN</h2>
            <p>Nine out of ten drops are the laptop hopping between two access points that both look equally good. Toggling Wi-Fi forces it to pick one and stay there. Wait ten seconds before you turn it back on.</p>
            <h2>2. Forget the guest network</h2>
            <p>If you have ever joined <code>Office-Guest</code>, your laptop will keep trying it. Remove it from the known networks list; the corporate network is the only one you need.</p>
            <h2>3. Check the client version</h2>
            <p>Anything below <code>4.12</code> drops every twenty minutes on the new Utrecht access points. Open the client, click the gear, and choose <b>Check for updates</b>.</p>
            <ul><li>If it updates and the drops stop, you are done.</li><li>If it says it is up to date and still drops, raise a request below and mention this page.</li></ul>
          </div>
          <div class="feedback">Did this solve it?<span class="vote on">${ic("thumb", "", 14)}Yes</span><span class="vote">${ic("thumbd", "", 14)}Not really</span><span class="tally">Helped 38 people this month</span></div>
        </div>
        <div class="side">
          <div class="card"><div class="cardhead">Related answers</div><div class="rel">${[["Working from a hotel or train", "What the VPN needs, and the captive portals that block it."], ["Guest Wi-Fi — how visitors get on", "The password changes weekly."]].map(([n, s]) => `<a>${ic("book", "t3", 15)}<span style="min-width:0"><span style="font-weight:500">${n}</span><span class="s">${s}</span></span>${ic("chev", "t3", 13)}</a>`).join("")}</div></div>
          <div class="card"><div class="cardhead">Still stuck?</div><div style="padding:14px 18px;font-size:13.5px" class="t2">Raise a request and we will pick it up.</div><div class="rel" style="border-top:1px solid var(--line)">${[FORMS[4], FORMS[3]].map((f) => `<a>${tile(f.i, f.c, 30, 8, 15)}<span style="min-width:0"><span style="font-weight:500">${f.n}</span><span class="s">${f.s}</span></span>${ic("arrow", "t3", 13)}</a>`).join("")}</div></div>
        </div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function search() {
  const hits = [
    { kind: "form", ...FORMS[5] }, { kind: "form", ...FORMS[0] },
    { kind: "art", n: "Two screens on a MacBook — which adapter", s: "The dock and cable combinations that work, and the one that never does.", cat: "Hardware" },
    { kind: "art", ...ARTICLES[4] }, { kind: "form", n: "Home-office equipment", s: "Monitor, chair, desk and the budget for each.", i: "building", c: "#f43f5e", cat: "Office & facilities" },
  ];
  return `
  <div class="portal">
    ${top("home")}
    <div class="wrap">
      <div class="pagehead">
        <div class="headrow">
          <div><h1>5 results</h1><p class="blurb">for “monitor”</p></div>
          <div class="tools"><div class="input" style="width:420px;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)">${ic("search", "t3", 15)}<span class="ph" style="color:var(--text)">monitor</span><span class="t3" style="display:flex">${ic("x", "", 13)}</span></div></div>
        </div>
      </div>
      <div class="sec">
        <div class="sechead"><h2 style="font-size:17px">Requests</h2><span class="sub mono">3</span></div>
        <div class="services">${hits.filter((h) => h.kind === "form").map((f) => svc(f)).join("")}</div>
      </div>
      <div class="sec" style="padding-bottom:56px">
        <div class="sechead"><h2 style="font-size:17px">Answers</h2><span class="sub mono">2</span></div>
        <div class="agrid">${hits.filter((h) => h.kind === "art").map((a) => `<a class="card acard"><span class="n">${a.n}</span><span class="s">${a.s}</span><span class="m">${ic("book", "", 13)}In ${a.cat}</span></a>`).join("")}</div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function approvals() {
  return `
  <div class="portal">
    ${top("approvals")}
    <div class="wrap">
      <div class="pagehead"><h1>Approvals</h1><p class="blurb">The desk has asked you to say yes or no before this work goes ahead.</p></div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:40px;padding-bottom:56px">
        <div>
          <div class="card" style="border-color:color-mix(in oklab,var(--brand) 40%,transparent)">
            <div style="padding:18px 22px;display:flex;gap:14px;align-items:flex-start">
              <span class="ico" style="width:36px;height:36px;border-radius:10px;background:var(--brand);color:var(--brand-ink);display:flex;align-items:center;justify-content:center;flex:none">${ic("stamp", "", 17)}</span>
              <div style="flex:1;min-width:0">
                <div class="mono t3" style="font-size:12px">About CHG-2609 0004</div>
                <div style="font-weight:600;font-size:17px;letter-spacing:-.015em;margin-top:2px">Roll out MFA to the remaining 38 contractors</div>
                <div class="t3" style="font-size:13px;margin-top:4px">Gates the <b style="color:var(--text-2);font-weight:500">Rollout</b> phase · asked by Rami Daoud · <b style="color:var(--negative);font-weight:600">overdue</b> since 15 Sep</div>
              </div>
            </div>
            <div style="margin:0 22px;padding:14px 16px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line)"><div class="label" style="margin-bottom:8px">What was asked for</div><div class="prose" style="font-size:13.5px"><p>Every contractor account gets MFA enforced on Monday 22 September. They receive the enrolment mail on Thursday; anyone who has not enrolled by Monday is locked out until they do.</p><p>Your team has 11 of the 38.</p></div></div>
            <div style="padding:16px 22px;font-size:14px">Are your 11 contractors ready for the lock-out on Monday?</div>
            <div style="padding:0 22px 20px;display:flex;gap:8px"><span class="btn primary">${ic("check", "", 15)}Approve</span><span class="btn outline">${ic("x", "", 15)}Refuse</span><span class="t3" style="margin-left:auto;font-size:12.5px;align-self:center">Refusing asks for a reason</span></div>
          </div>
          <div class="grouphead" style="margin-top:32px">What you have already answered</div>
          <div class="card">${[["CHG-2609 0002", "Move the intranet to the new hosting account", true, ""], ["CHG-2609 0001", "Replace the badge readers on floor 3", false, "Not before the audit, please."]].map(([r, t, yes, c]) => `<div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line);font-size:13.5px"><span class="mono t3" style="font-size:12px">${r}</span><span style="min-width:0;flex:1"><span style="font-weight:500;display:block">${t}</span>${c ? `<span class="t3" style="font-size:12.5px">“${c}”</span>` : ""}</span><span style="display:inline-flex;align-items:center;gap:5px;color:${yes ? "var(--positive)" : "var(--negative)"};font-weight:600">${ic(yes ? "check" : "x", "", 14)}${yes ? "Yes" : "No"}</span></div>`).join("")}</div>
        </div>
        <div class="side">
          <div class="card"><div class="cardhead">Why you are asked</div><div style="padding:14px 18px;font-size:13.5px;line-height:1.55" class="t2">The desk only asks when the work touches something you own. Your answer is recorded on the request, with your name and the time.</div></div>
          ${deskcard()}
        </div>
      </div>
    </div>
    ${FOOT}
  </div>`;
}

function closed() {
  return `
  <div class="portal" style="height:900px">
    <div class="top"><div class="wrap"><span class="lockup">${logo(26)}Service portal</span></div></div>
    <div class="closed">
      <span class="tile">${ic("door", "", 28)}</span>
      <h1>The portal is closed</h1>
      <p>We are moving the file servers this weekend. The portal is back on Monday 22 September at 08:30 — for anything urgent, call +31 30 123 4567.</p>
      <span class="btn outline" style="margin-top:8px">${ic("panel", "", 15)}Service desk</span>
    </div>
    ${FOOT}
  </div>`;
}

/* -------------------------------------------------------------- output */
const SCREENS = [
  ["Home", "Portal11Home", 1500, () => home(), "The front page. Announcement strip above the bar; ink hero with greeting, one search, four quick starts and the desk light; the six catalogue sections as a shelf over the band's edge; then the page-builder bands in a 2:1 grid — the waiting-for-your-reply nudge, common requests, answers; your requests and the desk card on the right."],
  ["Home · search and menu", "Portal11HomeSearch", 1250, () => home({ search: true, menu: true }), "Two open states on the same page: the live search under the hero (forms and answers mixed, ↵ opens the highlighted one, See all results at the foot) and the user menu (name, e-mail, theme, sign out)."],
  ["Category", "Portal11Category", 900, () => category(), "One shelf of the catalogue. Breadcrumb, coloured tile, name and description, a search scoped to the section; its requests in four columns, its answers in three."],
  ["Request form", "Portal11Form", 1240, () => form(), "Raising a request. Sections as ruled groups, half-width fields side by side, the this-might-already-answer-it panel under the subject, radio rows, attachments, and the footer that says what it is raised as and where updates go. Before-you-ask and the desk card on the right."],
  ["Request", "Portal11Request", 1400, () => request(), "One request. Everything the current page shows: approval prompt, just-raised confirmation, reference and status, the two facts (who, due), what you asked with attachments, related requests, the conversation with desk replies on the brand wash, the composer. New on the right: a where-it-stands ladder."],
  ["My requests", "Portal11Requests", 980, () => requests(), "The approval strip rides above the bar. All / Open / Settled with counts, search, Make a request; the waiting nudge; open and settled groups with the heat spine, reference, form, age, replies, last reply, status and assignee."],
  ["Answers", "Portal11Answers", 1080, () => answers(), "The knowledge base: one search, the often-read chips, then every section as a three-column group."],
  ["Answer", "Portal11Article", 900, () => article(), "One answer: byline with author, editor and reading time; body; did-this-solve-it with this month's tally; related answers and still-stuck requests on the right."],
  ["Search results", "Portal11Search", 900, () => search(), "Results split into requests and answers, the query kept in the box."],
  ["Approvals", "Portal11Approvals", 900, () => approvals(), "Decisions waiting on you: reference, title, phase gate, who asked, overdue; what was asked for; the question; Approve / Refuse; what you already answered underneath."],
  ["Closed", "Portal11Closed", 900, () => closed(), "The portal switched off by the desk, with the reason it gave. Only staff see the way to the desk."],
];

const doc = (theme, body, h) => `<!doctype html>
<html><head><meta charset="utf-8">${FONT}<style>:root{${THEMES[theme]}} html,body{height:${h}px;overflow:hidden} ${CSS}</style></head><body>${body}</body></html>`;

const boards = [];
for (const [title, file, h, fn, note] of SCREENS) {
  const body = fn();
  for (const theme of ["dark", "light"]) {
    const name = `${file}${theme === "light" ? "Light" : ""}.dc.html`;
    writeFileSync(join(out, name), doc(theme, body, h));
    boards.push({ file: name, title: `${title} · ${theme}`, h, theme, screen: title, note });
  }
}

/* the viewer: one page, every screen, dark/light toggle */
const viewer = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tiqo Portal · Round 11</title>${FONT}
<style>
:root{--bg:#fff;--surface:#fff;--surface-2:#f4f4f5;--line:rgba(9,9,11,.08);--text:#09090b;--text-2:#52525b;--text-3:#9d9da6;--brand:#febe2e;--seg-on:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#09090b;--surface:#121214;--surface-2:#18181b;--line:rgba(255,255,255,.08);--text:#fafafa;--text-2:#a1a1aa;--text-3:#6b6b74;--seg-on:#232326}}
:root[data-theme="dark"]{--bg:#09090b;--surface:#121214;--surface-2:#18181b;--line:rgba(255,255,255,.08);--text:#fafafa;--text-2:#a1a1aa;--text-3:#6b6b74;--seg-on:#232326}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Geist,system-ui,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1360px;margin:0 auto;padding:28px 24px 80px}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;position:sticky;top:0;background:var(--bg);padding:16px 0 14px;z-index:9;border-bottom:1px solid var(--line)}
.head h1{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0}.head p{margin:4px 0 0;color:var(--text-2);max-width:80ch}
.seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:2px;gap:2px}
.seg button{border:0;background:transparent;color:var(--text-2);font:inherit;font-size:13px;font-weight:500;height:28px;padding:0 12px;border-radius:6px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--seg-on);color:var(--text);box-shadow:0 1px 2px rgba(9,9,11,.12)}
.brief{margin:24px 0 8px;padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text-2);max-width:none;line-height:1.6}
.brief b{color:var(--text)}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0}.toc a{font-size:12.5px;color:var(--text-2);border:1px solid var(--line);border-radius:999px;padding:4px 10px;text-decoration:none}.toc a:hover{color:var(--text)}
.screen{margin-top:44px;padding-top:22px;border-top:1px solid var(--line)}
.screen h2{font-size:17px;font-weight:600;letter-spacing:-.015em;margin:0}.screen .note{margin:4px 0 14px;color:var(--text-2);max-width:90ch}
.stage{position:relative;width:100%;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.stage iframe{position:absolute;left:0;top:0;width:1440px;border:0;transform-origin:0 0;display:none}
.stage iframe.show{display:block}
</style></head><body><div class="wrap">
<div class="head"><div><h1>Tiqo Portal · Round 11</h1><p>The requester portal, redrawn from a blank page. Every screen in both themes; toggle here.</p></div>
<div class="seg" role="group"><button data-t="dark" aria-pressed="true">Dark</button><button data-t="light" aria-pressed="false">Light</button></div></div>
<div class="brief"><b>The idea.</b> One dark moment, then air. The bar is a plain 64px line with the four sections as text and amber counts; the hero is ink in both themes so the page has a single focal band: a greeting, one search, four quick starts and the desk light. The six catalogue sections sit as a shelf across the band's edge, the way the second reference does it, and everything below is a 2:1 grid of contained cards on the page background — no washes, no tinted panels. Amber stays the only warm hue and only ever means "you": your counts, your nudge, the thing waiting on your reply.<br><br><b>Kept from today.</b> Every band the page builder knows (hero, announcements, categories, featured forms, articles, my requests, rich text) and their spans; the banner and approval strips above the bar; the waiting-for-your-reply nudge; the desk light with typical reply time; Answers / My requests / Approvals (only when ever asked) with counts; the desk switch for staff; theme and sign-out in the avatar menu; the closed state. Inner pages keep every control listed in the inventory — filters, search, suggestions, attachments, the raised-as and updates-go-to lines, did-this-solve-it, related answers, refuse-with-reason.<br><br><b>Two proposals</b> beyond what exists today, both marked in the notes: a "Where it stands" ladder on the request page, and a phone line on the desk card for when the desk is closed.
<div class="toc">${SCREENS.map(([t, f]) => `<a href="#${f}">${t}</a>`).join("")}</div></div>
${SCREENS.map(([title, file, h, , note]) => `<section class="screen" id="${file}"><h2>${title}</h2><p class="note">${note}</p><div class="stage" data-h="${h}"><iframe data-t="dark" class="show" src="./${file}.dc.html" style="height:${h}px" loading="lazy"></iframe><iframe data-t="light" src="./${file}Light.dc.html" style="height:${h}px" loading="lazy"></iframe></div></section>`).join("")}
</div>
<script>
(function(){
  function fit(){document.querySelectorAll('.stage').forEach(function(st){var s=st.clientWidth/1440;st.style.height=Math.round(st.dataset.h*s)+'px';st.querySelectorAll('iframe').forEach(function(f){f.style.transform='scale('+s+')'})})}
  addEventListener('resize',fit);fit();
  var segs=document.querySelectorAll('.seg button[data-t]');
  segs.forEach(function(b){b.addEventListener('click',function(){segs.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});document.documentElement.dataset.theme=b.dataset.t;document.querySelectorAll('.stage iframe').forEach(function(f){f.classList.toggle('show',f.dataset.t===b.dataset.t)})})});
})();
</script></body></html>`;
writeFileSync(join(out, "PortalRound11.html"), viewer);
writeFileSync(join(out, "portal11-boards.json"), JSON.stringify(boards, null, 2));
console.log(`${boards.length} boards + viewer → ${out}`);
