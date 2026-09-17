// Generates the Tiqo "Signal" mockup artboards (.dc.html) + canvas.json.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "boards");
mkdirSync(out, { recursive: true });

/* ------------------------------------------------------------------ tokens */

const THEMES = {
  dark: `
    --bg:#09090b; --chrome:#0c0c0e; --surface:#121214; --surface-2:#18181b; --surface-3:#232326;
    --line:rgba(255,255,255,.08); --line-strong:rgba(255,255,255,.14);
    --hl:inset 0 1px 0 rgba(255,255,255,.05);
    --text:#fafafa; --text-2:#a1a1aa; --text-3:#6b6b74;
    --brand:#febe2e; --brand-hover:#ffcb54; --brand-ink:#1c1300; --brand-deep:#fcc94a;
    --brand-tint:rgba(254,190,46,.14); --brand-glow:rgba(254,190,46,.35); --brand-wash:#1a170e;
    --p-low:#34d399; --p-medium:#818cf8; --p-high:#fb923c; --p-urgent:#fb7185;
    --positive:#34d399; --negative:#f87171;
    --created:#febe2e; --resolved:#34d399;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 16px 40px -12px rgba(0,0,0,.8);
    --paper:#121214; --seg-on:#2a2a2f;
  `,
  light: `
    --bg:#ffffff; --chrome:#fafafa; --surface:#ffffff; --surface-2:#f4f4f5; --surface-3:#e9e9ec;
    --line:rgba(9,9,11,.08); --line-strong:rgba(9,9,11,.16);
    --hl:0 1px 2px rgba(9,9,11,.05), 0 0 0 1px rgba(9,9,11,.02);
    --text:#09090b; --text-2:#52525b; --text-3:#9d9da6;
    --brand:#febe2e; --brand-hover:#f5b21c; --brand-ink:#1c1300; --brand-deep:#b7790a;
    --brand-tint:rgba(254,190,46,.18); --brand-glow:rgba(254,190,46,.4); --brand-wash:#fffbeb;
    --p-low:#10b981; --p-medium:#6366f1; --p-high:#f97316; --p-urgent:#e11d48;
    --positive:#10b981; --negative:#e11d48;
    --created:#e0a422; --resolved:#10b981;
    --shadow:0 1px 2px rgba(9,9,11,.06), 0 16px 40px -16px rgba(9,9,11,.18);
    --paper:#ffffff; --seg-on:#ffffff;
  `,
};

const FONT =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">';

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: Geist, "Segoe UI", system-ui, sans-serif; font-size: 13px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  a { color: var(--brand-deep); text-decoration: none; } a:hover { color: var(--text); }
  .mono { font-family: "Geist Mono", ui-monospace, "Cascadia Mono", monospace; font-variant-numeric: tabular-nums; }
  .tnum { font-variant-numeric: tabular-nums; }
  .t3 { color: var(--text-3); } .t2 { color: var(--text-2); }
  .label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); line-height: 1; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--hl); }
  .hair { border-top: 1px solid var(--line); }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 500; border: 1px solid transparent; white-space: nowrap; }
  .btn.primary { background: var(--brand); color: var(--brand-ink); font-weight: 600; box-shadow: 0 1px 2px rgba(9,9,11,.1); }
  .pv { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border-radius: 6px; font-size: 12.5px; font-weight: 500; color: var(--text); max-width: 100%; white-space: nowrap; }
  .pv:hover, .pv.open { background: var(--surface-2); }
  .pv.dirty { background: var(--brand-tint); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--brand) 45%, transparent); }
  .prow { display: grid; grid-template-columns: 84px minmax(0,1fr); align-items: center; min-height: 30px; gap: 8px; }
  .prow .pl { font-size: 12px; color: var(--text-3); padding-left: 8px; }
  .ev { display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: center; padding: 5px 0; font-size: 12.5px; color: var(--text-2); }
  .ev .dot { width: 20px; height: 20px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--text-3); margin-left: 4px; }
  .ev .dot svg { width: 12px; height: 12px; }
  .ev b { color: var(--text); font-weight: 600; }
  .btn.outline { border-color: var(--line); background: var(--surface); color: var(--text); box-shadow: var(--hl); }
  .btn.ghost { color: var(--text-2); }
  .btn.sm { height: 24px; padding: 0 8px; font-size: 12px; border-radius: 7px; }
  kbd { font-family: "Geist Mono", ui-monospace, monospace; font-size: 10.5px; color: var(--text-3); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; line-height: 1; background: var(--surface-2); }
  .input { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--paper); color: var(--text); font-size: 13px; box-shadow: var(--hl); }
  .input .ph { color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .input { white-space: nowrap; }
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-size: 12px; color: var(--text-2); white-space: nowrap; }
  .chip.on { background: var(--surface-3); color: var(--text); border-color: transparent; }
  .seg { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--surface-2); border: 0; }
  .seg .chip { border: 0; background: transparent; height: 26px; }
  .seg .chip.on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 2px rgba(9,9,11,.1), 0 0 0 1px rgba(9,9,11,.04); }
  .tag { display: inline-flex; align-items: center; gap: 5px; height: 18px; padding: 0 7px; border-radius: 999px; background: color-mix(in oklab, var(--text) 6%, transparent); font-size: 11px; font-weight: 500; color: var(--text-2); }
  .ref { font-family: "Geist Mono", ui-monospace, monospace; font-size: 12px; color: var(--text-3); white-space: nowrap; }
  .ref b { font-weight: 600; }
  .ref.inc b { color: var(--p-urgent); } .ref.chg b { color: var(--brand-deep); } .ref.qst b { color: var(--p-medium); }
  .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
  .bars i { display: block; width: 3px; border-radius: 1px; background: var(--c); opacity: .22; }
  .bars i.on { opacity: 1; }
  .bars i:nth-child(1){height:5px} .bars i:nth-child(2){height:8px} .bars i:nth-child(3){height:11px} .bars i:nth-child(4){height:14px}
  .ring { display: inline-block; width: 14px; height: 14px; }
  .spine { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: color-mix(in oklab, var(--c) 16%, transparent); overflow: visible; }
  .spine i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--c); }
  .spine.hot i::after { content: ""; position: absolute; left: -2px; right: -2px; top: -3px; height: 6px; border-radius: 3px; background: var(--c); box-shadow: 0 0 8px 2px var(--c); }
  .avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-size: 10px; font-weight: 600; color: #fff; width: 22px; height: 22px; letter-spacing: .02em; }
  .empty-avatar { width: 22px; height: 22px; border-radius: 999px; border: 1px dashed var(--line-strong); }
  /* shell */
  .shell { width: 1440px; height: 900px; display: grid; grid-template-columns: 220px 1fr; grid-template-rows: 48px 1fr; overflow: hidden; background: var(--bg); }
  .rail { grid-row: 1 / span 2; border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 12px; gap: 4px; background: var(--chrome); }
  .bar { height: 48px; border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 16px; gap: 12px; background: var(--chrome); }
  .nav a.on { background: var(--surface-3); }
  .rail .nav a.on { background: color-mix(in oklab, var(--text) 7%, transparent); }
  .main { overflow: hidden; position: relative; }
  .nav a { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border-radius: 6px; color: var(--text-2); font-weight: 500; position: relative; }
  .nav a.on { background: var(--surface-3); color: var(--text); }
  .nav a.on::before { content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 2px; background: var(--brand); border-radius: 0 2px 2px 0; }
  .nav a .n { margin-left: auto; font-size: 11px; color: var(--text-3); font-family: "Geist Mono", monospace; }
  .nav a kbd { margin-left: auto; opacity: 0; }
  .nav a:hover kbd { opacity: 1; }
  .nav .sec { font-size: 11px; color: var(--text-3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 14px 10px 6px; }
  .pagehead { height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 24px; border-bottom: 1px solid var(--line); }
  .pagehead h1 { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: -.01em; }
  svg.i { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; }
`;

/* ------------------------------------------------------------------- icons */

const I = {
  inbox: '<path d="M2.5 8.5 4 3.5h8l1.5 5v4h-11z"/><path d="M2.5 8.5h3.2l1 2h2.6l1-2h3.2"/>',
  ticket: '<path d="M2.5 5.5a1.5 1.5 0 0 0 0 5v2h11v-2a1.5 1.5 0 0 1 0-5v-2h-11z"/><path d="M8 3.5v9" stroke-dasharray="1.5 2"/>',
  folder: '<path d="M2.5 4.5h4l1.5 1.5h5.5v7h-11z"/>',
  users: '<circle cx="6" cy="5.5" r="2.2"/><path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13"/><path d="M10.5 3.6a2.2 2.2 0 0 1 0 3.9M11 9.6c1.5.4 2.5 1.8 2.5 3.4"/>',
  cog: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3"/>',
  search: '<circle cx="7" cy="7" r="4"/><path d="m10 10 3.5 3.5"/>',
  bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z"/><path d="M6.5 14.5h3"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  chev: '<path d="m6 4 4 4-4 4"/>',
  chevd: '<path d="m4 6 4 4 4-4"/>',
  check: '<path d="m3 8.5 3 3 7-7"/>',
  clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>',
  msg: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>',
  tagi: '<path d="M2.5 2.5h5l6 6-5 5-6-6z"/><circle cx="5.5" cy="5.5" r=".8"/>',
  user: '<circle cx="8" cy="5.5" r="2.5"/><path d="M3 14c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2"/>',
  flag: '<path d="M3.5 14V2.5h8l-2 3 2 3h-8"/>',
  layers: '<path d="m8 2.5 6 3-6 3-6-3z"/><path d="m2 8.5 6 3 6-3M2 11.5l6 3 6-3"/>',
  star: '<path d="m8 2.5 1.7 3.6 3.9.5-2.8 2.7.7 3.9L8 11.3l-3.5 1.9.7-3.9-2.8-2.7 3.9-.5z"/>',
  reply: '<path d="M6.5 3.5 2.5 7l4 3.5"/><path d="M2.5 7h6a5 5 0 0 1 5 5v.5"/>',
  note: '<path d="M3 2.5h7l3 3v8H3z"/><path d="M10 2.5v3h3M5.5 8.5h5M5.5 11h3"/>',
  fwd: '<path d="M9.5 3.5 13.5 7l-4 3.5"/><path d="M13.5 7h-6a5 5 0 0 0-5 5v.5"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  merge: '<path d="M4 3v4a4 4 0 0 0 4 4h4"/><path d="m10 8.5 2.5 2.5L10 13.5M4 3v10"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.7 9h5.6l.7-9"/>',
  eye: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  arrowl: '<path d="M13 8H3M7 4 3 8l4 4"/>',
  pin: '<path d="M6 2.5h4l-.6 4 2.6 2.5v1h-9v-1L5.6 6.5z"/><path d="M8 10v4"/>',
  cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>',
  spark: '<path d="M8 2.5 9.3 6l3.7.5-2.7 2.5.7 3.7L8 11l-3 1.7.7-3.7L3 6.5 6.7 6z"/>',
  help: '<circle cx="8" cy="8" r="5.5"/><path d="M6.3 6.4a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3M8 11.6v.1"/>',
  wrench: '<path d="M9.5 2.6a3.2 3.2 0 0 0 3.6 4.3L7 13a1.5 1.5 0 0 1-2.1-2.1l6.1-6.1A3.2 3.2 0 0 0 9.5 2.6z"/>',
  laptop: '<rect x="3" y="3.5" width="10" height="7" rx="1"/><path d="M1.5 13h13"/>',
  key: '<circle cx="5.5" cy="10.5" r="2.5"/><path d="m7.3 8.7 6-6M11 4.5l1.5 1.5M9.5 6l1.5 1.5"/>',
  send: '<path d="m2.5 8 11-5-3 11-2.5-4.5z"/><path d="m8 9.5 5.5-6.5"/>',
  panel: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M6 3v10"/>',
  dots: '<circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/>',
  ext: '<path d="M9 3h4v4M13 3 7.5 8.5M11 9v4H3V5h4"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
  moon: '<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/>',
  logout: '<path d="M6 3H3v10h3M10 11l3-3-3-3M13 8H6.5"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  phone: '<path d="M3.5 2.5h2.5l1 3-1.5 1a8 8 0 0 0 4 4l1-1.5 3 1v2.5a1 1 0 0 1-1 1A11 11 0 0 1 2.5 3.5a1 1 0 0 1 1-1z"/>',
  mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m2.5 4.5 5.5 4 5.5-4"/>',
  building: '<rect x="3" y="2.5" width="10" height="11" rx="1"/><path d="M6 5.5h1M9 5.5h1M6 8h1M9 8h1M6 10.5h1M9 10.5h1"/>',
  briefcase: '<rect x="2" y="5" width="12" height="8" rx="1.5"/><path d="M6 5V3.5h4V5M2 8.5h12"/>',
  chevl: '<path d="m10 4-4 4 4 4"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>',
  grip: '<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 16 16">${I[n]}</svg>`;

/* -------------------------------------------------------------- primitives */

const PRI = { low: 1, medium: 2, high: 3, urgent: 4 };
const bars = (p) =>
  `<span class="bars" style="--c: var(--p-${p})" title="${p}">` +
  [1, 2, 3, 4].map((n) => `<i class="${n <= PRI[p] ? "on" : ""}"></i>`).join("") +
  `</span>`;

const STATUS = {
  new: { c: "var(--brand)", d: 0 },
  progress: { c: "var(--p-medium)", d: 0.55 },
  waiting: { c: "var(--text-3)", d: 0.3 },
  resolved: { c: "var(--positive)", d: 1 },
};
const STATUS_NAME = { new: "New", progress: "In progress", waiting: "Waiting on requester", resolved: "Resolved" };
function ring(s) {
  const { c, d } = STATUS[s];
  const r = 5, C = 2 * Math.PI * r;
  const inner = d >= 1
    ? `<path d="M4.6 7.3 6.6 9.3 9.6 5.2" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : d > 0
      ? `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${(C * d).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 7 7)"/>`
      : "";
  return `<svg class="ring" viewBox="0 0 14 14"><circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.4" opacity="${d >= 1 ? 1 : 0.35}"/>${inner}</svg>`;
}
const status = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2)">${ring(s)}${STATUS_NAME[s]}</span>`;

const AV = { AA: "#6366f1", MK: "#10b981", JB: "#f97316", SL: "#0ea5e9", RD: "#f43f5e", TP: "#84cc16" };
const AV_NAME = { AA: "Ada Admin", MK: "Mila Kuipers", JB: "Jonas Berg", SL: "Sanne Lin", RD: "Rami Daoud", TP: "Tomás Pereira" };
const avatar = (k, size = 22) =>
  k
    ? `<span class="avatar" style="background:${AV[k]};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px" title="${AV_NAME[k]}">${k}</span>`
    : `<span class="empty-avatar" title="Unassigned"></span>`;

const ref = (r) => {
  const t = r.slice(0, 3).toLowerCase();
  return `<span class="ref ${t}"><b>${r.slice(0, 3)}</b>${r.slice(3)}</span>`;
};
const spine = (p, heat, hot = false) =>
  `<span class="spine ${hot ? "hot" : ""}" style="--c: var(--p-${p})"><i style="height:${Math.round(heat * 100)}%"></i></span>`;

/* ---------------------------------------------------------------- data */

const T = [
  { r: "INC-2609 0117", t: "VPN drops every 20 minutes on the Utrecht office Wi-Fi", p: "urgent", s: "progress", a: "MK", age: "3h", rep: 6, heat: 0.92, hot: true, tags: ["network"] },
  { r: "INC-2609 0121", t: "Shared finance mailbox stuck in a forwarding loop", p: "urgent", s: "new", a: null, age: "41m", rep: 0, heat: 0.35, tags: ["email", "finance"] },
  { r: "INC-2609 0109", t: "Badge readers on floor 3 reject everyone since the firmware update", p: "high", s: "progress", a: "JB", age: "1d", rep: 11, heat: 1, hot: true, tags: ["facilities"] },
  { r: "CHG-2609 0003", t: "Fix mailbox flow for the service desk shared inbox", p: "high", s: "progress", a: "AA", age: "4h", rep: 2, heat: 0.4, plan: [2, 6], tags: [] },
  { r: "INC-2609 0119", t: "Laptop will not wake from sleep after Monday's patch", p: "high", s: "waiting", a: "SL", age: "6h", rep: 3, heat: 0.55, tags: ["endpoint"] },
  { r: "QST-2609 0122", t: "How do I get a second monitor for the Rotterdam desk?", p: "medium", s: "new", a: null, age: "12m", rep: 0, heat: 0.05, tags: [] },
  { r: "CHG-2609 0004", t: "Roll out MFA to the remaining 38 contractors", p: "medium", s: "progress", a: "RD", age: "2d", rep: 9, heat: 0.3, plan: [5, 9], tags: ["security"] },
  { r: "INC-2609 0114", t: "Printer on floor 1 prints every page twice", p: "medium", s: "progress", a: "TP", age: "9h", rep: 4, heat: 0.62, tags: ["print"] },
  { r: "QST-2609 0116", t: "Can we archive the 2019 project drives?", p: "medium", s: "waiting", a: "MK", age: "1d", rep: 5, heat: 0.7, tags: ["storage"] },
  { r: "INC-2609 0111", t: "Teams call quality poor in the small meeting rooms", p: "medium", s: "new", a: null, age: "5h", rep: 1, heat: 0.28, tags: ["network", "av"] },
  { r: "QST-2609 0120", t: "Where do I request a licence for Figma?", p: "low", s: "new", a: null, age: "2h", rep: 0, heat: 0.06, tags: ["licences"] },
  { r: "INC-2609 0105", t: "Calendar invites arrive an hour late for people in Lisbon", p: "low", s: "progress", a: "SL", age: "3d", rep: 7, heat: 0.45, tags: ["email"] },
  { r: "CHG-2609 0002", t: "Move the intranet to the new hosting account", p: "low", s: "waiting", a: "JB", age: "5d", rep: 14, heat: 0.6, plan: [7, 8], tags: ["web"] },
  { r: "QST-2609 0112", t: "Onboarding checklist for the two September starters", p: "low", s: "resolved", a: "TP", age: "2d", rep: 3, heat: 1, tags: ["onboarding"] },
  { r: "INC-2609 0104", t: "Wrong cost centre on the print budget report", p: "low", s: "resolved", a: "RD", age: "4d", rep: 2, heat: 1, tags: ["print", "finance"] },
  { r: "QST-2609 0108", t: "Request access to the HR SharePoint site", p: "low", s: "resolved", a: "MK", age: "6d", rep: 1, heat: 1, tags: ["access"] },
];

/* ---------------------------------------------------------------- shell */

function rail(active) {
  const item = (key, icon, label, extra = "") =>
    `<a class="${active === key ? "on" : ""}">${ic(icon)}<span>${label}</span>${extra}</a>`;
  return `
  <aside class="rail">
    <div style="display:flex;align-items:center;gap:8px;height:32px;padding:0 6px;margin-bottom:8px">
      ${logo(22)}<span style="font-weight:700;font-size:14px;letter-spacing:-.02em">Tiqo</span>
      <span class="t3" style="margin-left:auto;display:flex">${ic("panel")}</span>
    </div>
    <nav class="nav" style="display:flex;flex-direction:column;gap:2px">
      <div class="sec" style="padding-top:2px">Work</div>
      ${item("dash", "inbox", "Dashboard", "<kbd>G D</kbd>")}
      ${item("tickets", "ticket", "Tickets", '<span class="n">23</span>')}
      ${item("projects", "folder", "Projects", "<kbd>G P</kbd>")}
      <div class="sec">Organisation</div>
      ${item("people", "users", "People", "<kbd>G U</kbd>")}
    </nav>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:2px" class="nav">
      ${item("settings", "cog", "Settings", "<kbd>G S</kbd>")}
      <div style="display:flex;align-items:center;gap:8px;height:40px;padding:0 6px;border-top:1px solid var(--line);margin-top:8px">
        ${avatar("AA", 24)}
        <div style="min-width:0;line-height:1.2"><div style="font-weight:600;font-size:12.5px">Ada Admin</div><div class="t3" style="font-size:11px">Admin · desk open</div></div>
      </div>
    </div>
  </aside>`;
}

function logo(size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" style="flex:none"><defs><mask id="n${size}"><rect width="32" height="32" rx="8" fill="#fff"/><circle cx="32" cy="16" r="4.5"/><circle cx="0" cy="16" r="4.5"/></mask></defs><rect width="32" height="32" rx="8" fill="var(--brand)" mask="url(#n${size})"/><g fill="var(--brand-ink)"><rect x="9" y="17" width="3.2" height="6" rx="1.2" opacity=".5"/><rect x="14.4" y="13" width="3.2" height="10" rx="1.2" opacity=".72"/><rect x="19.8" y="9" width="3.2" height="14" rx="1.2"/></g></svg>`;
}

function bar(crumbs, extra = "") {
  const crumb = crumbs
    .map((c, i) => (i === crumbs.length - 1 ? `<span style="color:var(--text);font-weight:500">${c}</span>` : `<span class="t3">${c}</span><span class="t3" style="display:flex">${ic("chev")}</span>`))
    .join("");
  return `
  <header class="bar">
    <div style="display:flex;align-items:center;gap:6px;font-size:13px">${crumb}</div>
    ${extra}
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      <div class="input" style="width:260px;height:30px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search tickets, people, projects</span><kbd style="margin-left:auto">⌘K</kbd></div>
      <span class="btn primary" style="height:30px">${ic("plus")}New<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">⌘N</kbd></span>
      <span style="width:1px;height:20px;background:var(--line)"></span>
      <span class="btn ghost" style="width:30px;padding:0;justify-content:center;position:relative">${ic("bell")}<i style="position:absolute;top:6px;right:7px;width:6px;height:6px;border-radius:99px;background:var(--brand);box-shadow:0 0 0 2px var(--bg)"></i></span>
      ${avatar("AA", 26)}
    </div>
  </header>`;
}

const shell = (active, crumbs, body, barExtra = "") =>
  `<div class="shell">${rail(active)}${bar(crumbs, barExtra)}<div class="main">${body}</div></div>`;

/* ---------------------------------------------------------------- rows */

function row(t, opts = {}) {
  const hover = opts.hover;
  const plan = t.plan
    ? `<span style="display:inline-flex;align-items:center;gap:6px" class="t3"><span style="width:32px;height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;display:inline-block"><i style="display:block;height:100%;width:${(t.plan[0] / t.plan[1]) * 100}%;background:var(--brand)"></i></span><span class="mono" style="font-size:11.5px">${t.plan[0]}/${t.plan[1]}</span></span>`
    : "";
  const rep = t.rep ? `<span class="t3" style="display:inline-flex;align-items:center;gap:4px" >${ic("msg")}<span class="mono" style="font-size:11.5px">${t.rep}</span></span>` : "";
  const tags = t.tags.map((x) => `<span class="tag">${x}</span>`).join("");
  const settled = t.s === "resolved";
  return `
  <div style="position:relative;display:grid;grid-template-columns:${opts.cols ?? "120px minmax(0,1fr) 72px 48px 176px 40px 32px 44px"};align-items:center;gap:12px;height:40px;padding:0 20px 0 20px;border-bottom:1px solid var(--line);background:${hover ? "var(--surface-2)" : "transparent"};opacity:${settled ? 0.6 : 1}">
    ${spine(t.p, t.heat, t.hot)}
    ${ref(t.r)}
    <div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.t}</span>${tags}</div>
    ${opts.short ? "" : `<div>${plan}</div><div>${rep}</div><div>${status(t.s)}</div>`}
    <div>${bars(t.p)}</div>
    <div>${avatar(t.a)}</div>
    <div class="mono tnum" style="font-size:12px;text-align:right;color:${t.hot ? `var(--p-${t.p})` : "var(--text-3)"}">${t.age}</div>
    ${hover ? `<div style="position:absolute;right:16px;top:0;bottom:0;display:flex;align-items:center;gap:4px;padding-left:24px;background:linear-gradient(90deg,transparent,var(--surface-2) 30%)">
        <span class="btn outline sm">${ic("user")}Take</span><span class="btn outline sm">${ic("star")}</span><span class="btn outline sm">${ic("eye")}Peek</span><span class="btn outline sm">${ic("dots")}</span></div>` : ""}
  </div>`;
}

const columns = (cols) => `
  <div class="label" style="display:grid;grid-template-columns:${cols};gap:12px;height:32px;align-items:center;padding:0 20px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0">
    <span>Ticket</span><span>Subject</span><span>Plan</span><span>Replies</span><span>Status</span><span>Pri</span><span></span><span style="text-align:right">Age</span>
  </div>`;

/* ---------------------------------------------------------------- charts */

function sparkline(points, color, w = 120, h = 28) {
  const max = Math.max(...points), min = Math.min(...points);
  const p = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${p.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${w}" cy="${p[p.length - 1].split(",")[1]}" r="2.2" fill="${color}"/></svg>`;
}

function volumeChart() {
  const w = 620, h = 170, pad = { l: 24, r: 8, t: 12, b: 22 };
  const created = [6, 9, 7, 11, 8, 4, 3, 10, 12, 9, 13, 8, 6, 11];
  const resolved = [5, 7, 8, 9, 9, 5, 2, 8, 10, 11, 12, 10, 7, 8];
  const max = 14;
  const x = (i) => pad.l + (i / 13) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = (d, c) => `<polyline points="${d.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="1.75" stroke-linejoin="round"/>`;
  const grid = [0, 7, 14].map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${y(v) + 3.5}" font-size="10" fill="var(--text-3)" text-anchor="end" font-family="Geist Mono, monospace">${v}</text>`).join("");
  const days = ["25 Aug", "", "", "", "29", "", "", "1 Sep", "", "", "", "5", "", "8 Sep"].map((d, i) => d ? `<text x="${x(i)}" y="${h - 6}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="Geist Mono, monospace">${d}</text>` : "").join("");
  const area = `<polygon points="${x(0)},${y(0)} ${created.map((v, i) => `${x(i)},${y(v)}`).join(" ")} ${x(13)},${y(0)}" fill="var(--created)" opacity=".07"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:auto">${grid}${area}${line(created, "var(--created)")}${line(resolved, "var(--resolved)")}${days}<line x1="${x(10)}" x2="${x(10)}" y1="${pad.t}" y2="${h - pad.b}" stroke="var(--line-strong)" stroke-dasharray="2 3"/><circle cx="${x(10)}" cy="${y(13)}" r="3" fill="var(--created)" stroke="var(--surface)" stroke-width="1.5"/><circle cx="${x(10)}" cy="${y(12)}" r="3" fill="var(--resolved)" stroke="var(--surface)" stroke-width="1.5"/></svg>`;
}

function gauge(pct) {
  const r = 44, C = 2 * Math.PI * r;
  return `<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="8"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--brand)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle" font-size="26" font-weight="600" fill="var(--text)" font-family="Geist, sans-serif" letter-spacing="-0.02em">${Math.round(pct * 100)}%</text><text x="60" y="76" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="Geist, sans-serif" letter-spacing=".06em">ON TARGET</text></svg>`;
}

function priorityBars() {
  const d = [["urgent", 2, 2], ["high", 6, 1], ["medium", 9, 1], ["low", 6, 0]];
  const max = 10;
  return `<div style="display:flex;flex-direction:column;gap:10px">${d.map(([p, n, over]) => `
    <div style="display:grid;grid-template-columns:70px 1fr 28px;align-items:center;gap:10px;font-size:12px">
      <span style="display:flex;align-items:center;gap:8px;color:var(--text-2)">${bars(p)}<span style="text-transform:capitalize">${p}</span></span>
      <span style="height:8px;border-radius:2px;background:var(--surface-3);position:relative;overflow:hidden"><i style="position:absolute;inset:0;width:${(n / max) * 100}%;background:var(--p-${p});opacity:.9"></i>${over ? `<i style="position:absolute;top:0;bottom:0;left:${((n - over) / max) * 100}%;width:${(over / max) * 100}%;background:repeating-linear-gradient(45deg,rgba(0,0,0,.35) 0 2px,transparent 2px 5px)"></i>` : ""}</span>
      <span class="mono tnum" style="text-align:right;color:var(--text-2)">${n}</span>
    </div>`).join("")}</div>`;
}

/* ---------------------------------------------------------------- screens */

function cardHead(title, right = "") {
  return `<div style="display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 16px;border-bottom:1px solid var(--line)"><span style="font-weight:600;font-size:13px">${title}</span>${right}</div>`;
}

function dashboard() {
  const strip = [
    ["Open", 23, [18, 20, 19, 22, 21, 24, 23, 25, 22, 21, 23, 24, 22, 23], "var(--brand)", true],
    ["Past target", 4, [1, 2, 2, 3, 2, 4, 5, 3, 4, 4, 3, 5, 4, 4], "var(--p-high)", false],
    ["Waiting on me", 7, [5, 6, 6, 7, 8, 6, 5, 7, 6, 8, 7, 6, 7, 7], "var(--text-3)", false],
    ["Unassigned", 5, [2, 3, 4, 3, 5, 6, 4, 3, 5, 4, 6, 5, 4, 5], "var(--text-3)", false],
  ];
  const cell = ([label, n, pts, c, live], i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;${i ? "border-left:1px solid var(--line)" : ""}">
      <div>
        <div style="display:flex;align-items:center;gap:8px" class="label">${label}${live ? `<i style="width:6px;height:6px;border-radius:99px;background:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)"></i>` : ""}</div>
        <div class="tnum" style="font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1;margin-top:10px;color:${i === 1 ? "var(--p-high)" : "var(--text)"}">${n}</div>
      </div>
      ${sparkline(pts, c)}
    </div>`;

  const overview = `
    <div class="card" style="overflow:hidden">
      ${cardHead("Queue overview", `<span class="t3" style="font-size:12px">Open work by kind</span>`)}
      <div style="display:grid;grid-template-columns:1fr 56px 56px 56px 72px;padding:8px 16px 0;gap:0" class="label"><span></span><span style="text-align:right">Mine</span><span style="text-align:right">Team</span><span style="text-align:right">All</span><span style="text-align:right">Unowned</span></div>
      ${[["ticket", "Incidents", 3, 6, 11, 3], ["help", "Questions", 2, 3, 7, 2], ["wrench", "Changes", 2, 2, 3, 0], ["folder", "Projects", 1, 2, 2, 0]].map(([i, n, a, b, c, d]) => `
        <div style="display:grid;grid-template-columns:1fr 56px 56px 56px 72px;padding:0 16px;height:36px;align-items:center;border-top:1px solid var(--line);font-size:13px" class="tnum">
          <span style="display:flex;align-items:center;gap:8px;color:var(--text-2)">${ic(i)}<span style="color:var(--text)">${n}</span></span>
          <span class="mono" style="text-align:right;color:var(--brand-deep);font-weight:600">${a}</span><span class="mono" style="text-align:right">${b}</span><span class="mono" style="text-align:right">${c}</span><span class="mono" style="text-align:right;color:${d ? "var(--p-high)" : "var(--text-3)"}">${d}</span>
        </div>`).join("")}
      <div style="display:grid;grid-template-columns:1fr 56px 56px 56px 72px;padding:0 16px;height:36px;align-items:center;border-top:1px solid var(--line-strong);font-weight:600" class="tnum"><span>Everything</span><span class="mono" style="text-align:right;color:var(--brand-deep)">8</span><span class="mono" style="text-align:right">13</span><span class="mono" style="text-align:right">23</span><span class="mono" style="text-align:right;color:var(--p-high)">5</span></div>
    </div>`;

  const attention = `
    <div class="card" style="overflow:hidden">
      ${cardHead("Needs attention", `<a style="font-size:12px">All open ${ic("chev")}</a>`)}
      ${T.slice(0, 6).map((t) => row(t, { short: true, cols: "120px minmax(0,1fr) 40px 32px 44px" })).join("")}
    </div>`;

  const widgets = `
    <div style="display:grid;grid-template-columns:7fr 5fr;gap:16px">
      <div class="card" style="overflow:hidden">${cardHead("Raised and resolved", `<span style="display:flex;gap:14px;font-size:12px" class="t2"><span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:2px;background:var(--created)"></i>Raised</span><span style="display:flex;align-items:center;gap:6px"><i style="width:10px;height:2px;background:var(--resolved)"></i>Resolved</span></span>`)}<div style="padding:12px 16px 8px">${volumeChart()}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card" style="overflow:hidden">${cardHead("Response targets")}<div style="display:flex;flex-direction:column;align-items:center;padding:14px 16px 12px;gap:8px">${gauge(0.87)}<div class="t3" style="font-size:12px">39 of 45 answered in time</div></div></div>
        <div class="card" style="overflow:hidden">${cardHead("Open by priority")}<div style="padding:16px">${priorityBars()}<div class="t3" style="font-size:11.5px;margin-top:12px;display:flex;align-items:center;gap:6px"><i style="width:14px;height:8px;border-radius:2px;background:repeating-linear-gradient(45deg,var(--text-3) 0 2px,transparent 2px 5px)"></i>past target</div></div></div>
      </div>
    </div>`;

  const body = `
    <div class="pagehead"><h1>Good morning, Ada</h1><span class="t3" style="font-size:12.5px">Monday 8 September · desk open until 17:30</span><span style="margin-left:auto" class="btn outline sm">${ic("layers")}Customise</span></div>
    <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">
      <div class="card" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden">${strip.map(cell).join("")}</div>
      <div style="display:grid;grid-template-columns:5fr 7fr;gap:16px">${overview}${attention}</div>
      ${widgets}
    </div>`;
  return shell("dash", ["Dashboard"], body);
}

function queue(opts = {}) {
  const cols = "120px minmax(0,1fr) 72px 48px 176px 40px 32px 44px";
  const views = ["All open", "Mine", "My groups", "Unassigned", "Everything"].map((v, i) => `<span class="chip ${i === 0 ? "on" : ""}">${v}${i === 0 ? '<span class="mono t3" style="font-size:11px">23</span>' : ""}</span>`).join("");
  const filters = [["Any status", "chevd"], ["Any priority", "chevd"], ["Any type", "chevd"], ["All projects", "chevd"], ["Anyone", "chevd"]].map(([l]) => `<span class="chip">${l}${ic("chevd")}</span>`).join("");
  const body = `
    <div class="pagehead"><h1>Tickets</h1><span class="t3" style="font-size:12.5px">23 open · 3 past target</span>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="btn outline sm">${ic("layers")}Columns</span><span class="btn outline sm">Urgent first${ic("chevd")}</span></div></div>
    <div style="display:flex;align-items:center;gap:8px;padding:10px 24px;border-bottom:1px solid var(--line)">
      <div class="seg">${views}</div>
      <span style="width:1px;height:18px;background:var(--line);margin:0 4px"></span>
      ${filters}
      <div class="input" style="margin-left:auto;width:220px;height:28px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Filter by title or reference</span></div>
    </div>
    <div style="padding:0 4px">
      ${columns(cols)}
      ${T.map((t, i) => row(t, { cols, hover: opts.hover === i })).join("")}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px" class="t3"><span style="font-size:12px">1–16 of 23</span><span style="display:flex;gap:6px"><span class="btn outline sm" style="opacity:.5">Previous</span><span class="btn outline sm">Next</span></span></div>
    </div>
    ${opts.palette ? palette() : ""}`;
  return shell("tickets", ["Tickets"], body);
}

function palette() {
  const rows = [
    ["ticket", "INC-2609 0117", "VPN drops every 20 minutes on the Utrecht office Wi-Fi", "Ticket"],
    ["ticket", "INC-2609 0111", "Teams call quality poor in the small meeting rooms", "Ticket"],
    ["folder", "NET", "Network refresh 2026", "Project"],
    ["users", "", "Mila Kuipers · Network engineer", "Person"],
  ];
  return `
  <div style="position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);display:flex;justify-content:center;padding-top:120px">
    <div class="card" style="width:640px;height:fit-content;box-shadow:var(--shadow);border-radius:12px;overflow:hidden;background:var(--surface)">
      <div style="display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-bottom:1px solid var(--line)"><span class="t3" style="display:flex">${ic("search")}</span><span style="font-size:15px">net<span style="border-left:1.5px solid var(--brand);margin-left:1px"></span></span><span style="margin-left:auto;display:flex;gap:6px"><kbd>↑↓</kbd><kbd>↵</kbd><kbd>esc</kbd></span></div>
      <div class="label" style="padding:10px 16px 4px">Results</div>
      ${rows.map(([i, r, t, k], n) => `<div style="display:flex;align-items:center;gap:10px;height:36px;padding:0 16px;background:${n === 0 ? "var(--surface-3)" : "transparent"}"><span class="t3" style="display:flex">${ic(i)}</span>${r ? `<span class="ref">${r}</span>` : ""}<span style="font-weight:500">${t}</span><span class="t3" style="margin-left:auto;font-size:12px">${k}</span></div>`).join("")}
      <div class="label" style="padding:12px 16px 4px;border-top:1px solid var(--line)">Actions</div>
      ${[["plus", "New ticket", "⌘N"], ["user", "Assign to me", "A"], ["moon", "Switch to dark theme", ""]].map(([i, t, k]) => `<div style="display:flex;align-items:center;gap:10px;height:36px;padding:0 16px"><span class="t3" style="display:flex">${ic(i)}</span><span>${t}</span>${k ? `<kbd style="margin-left:auto">${k}</kbd>` : ""}</div>`).join("")}
      <div style="height:8px"></div>
    </div>
  </div>`;
}

function ticket() {
  const t = T[0];
  const prop = (icon, label, value, extra = "") => `
    <div style="display:grid;grid-template-columns:96px 1fr;align-items:center;height:32px;padding:0 12px;border-radius:6px">
      <span style="display:flex;align-items:center;gap:8px;color:var(--text-3);font-size:12px">${ic(icon)}${label}</span>
      <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500">${value}${extra}</span>
    </div>`;
  const entry = (who, when, body, kind = "reply") => `
    <div style="display:grid;grid-template-columns:28px 1fr;gap:12px;padding:16px 0;border-top:1px solid var(--line)">
      ${avatar(who, 28)}
      <div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><b style="font-weight:600">${AV_NAME[who]}</b>${kind === "note" ? `<span class="tag" style="background:var(--brand-tint);color:var(--brand-deep)">${ic("note")}Internal note</span>` : ""}<span class="t3 mono" style="margin-left:auto;font-size:11.5px">${when}</span></div>
        <div style="margin-top:6px;font-size:13.5px;line-height:1.55;color:var(--text-2)">${body}</div>
      </div>
    </div>`;
  const event = (txt, when) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0 6px 40px;font-size:12px;color:var(--text-3)"><i style="width:5px;height:5px;border-radius:99px;background:var(--line-strong);margin-left:-27px"></i>${txt}<span class="mono" style="margin-left:auto;font-size:11px">${when}</span></div>`;

  const toolbar = `
    <div style="display:flex;align-items:center;gap:4px;height:44px;padding:0 24px;border-bottom:1px solid var(--line);background:var(--bg)">
      <span class="btn primary sm" style="height:28px">${ic("reply")}Reply<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">R</kbd></span>
      <span class="btn ghost sm" style="height:28px">${ic("note")}Add note</span>
      <span class="btn ghost sm" style="height:28px">${ic("fwd")}Forward</span>
      <span style="width:1px;height:18px;background:var(--line);margin:0 6px"></span>
      <span class="btn ghost sm" style="height:28px">${ic("check")}Resolve</span>
      <span class="btn ghost sm" style="height:28px">${ic("merge")}Merge</span>
      <span class="btn ghost sm" style="height:28px;color:var(--text-3)">${ic("trash")}</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:12px;font-size:12px" class="t2">
        <span style="display:flex;align-items:center;gap:6px">${ic("clock")}Target in <b class="mono" style="color:var(--p-urgent)">0h 19m</b></span>
        <span class="btn outline sm">${ic("eye")}Activity<kbd>12</kbd></span>
      </span>
    </div>`;

  const centre = `
    <div style="padding:24px 40px 0;max-width:800px">
      <div style="display:flex;align-items:center;gap:10px">${ref(t.r)}${bars(t.p)}<span style="font-size:12px;color:var(--p-urgent);font-weight:500">Urgent</span><span class="t3">·</span>${status(t.s)}<span class="t3">·</span><span class="t3" style="font-size:12px">Incident</span></div>
      <h1 style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin:10px 0 6px;line-height:1.25">${t.t}</h1>
      <div class="t3" style="font-size:12.5px;display:flex;gap:8px;align-items:center">Raised by <b style="color:var(--text-2);font-weight:500">Sanne Lin</b> 3h ago · updated 12 min ago · <span class="tag">network</span><span class="tag">utrecht</span></div>

      <div style="margin-top:20px;border-radius:10px;background:var(--brand-wash);padding:18px 20px;position:relative">
        ${spine("urgent", 0.92, true).replace('class="spine hot"', 'class="spine hot" style="--c:var(--p-urgent);left:0;top:0;bottom:0;border-radius:10px 0 0 10px;overflow:hidden"')}
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px">${avatar("SL", 22)}<b style="font-weight:600">Sanne Lin</b><span class="t3">· Utrecht office · 09:12</span></div>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6">Since this morning the VPN client disconnects roughly every twenty minutes for everyone on the second floor. Reconnecting works, but Teams calls drop each time and the finance team is trying to close the month. Wired desks seem fine. Laptops on the guest network are also fine, which makes me think it is the corporate Wi-Fi rather than the VPN itself.</p>
      </div>

      ${event("Mila Kuipers took the ticket", "09:31")}
      ${entry("MK", "09:34", "Thanks Sanne. I can see the 2F access points renegotiating every ~20 min in the controller log, which matches. I'm rolling the AP firmware back on that floor now, should take about 15 minutes. Wired desks are unaffected so finance can plug in meanwhile.")}
      ${entry("MK", "09:36", "Controller shows the AP firmware went from 8.10.3 to 8.11.0 last night with the change window. Rolling back AP-2F-01…08. If this fixes it we need a change ticket to re-plan the upgrade.", "note")}
      ${event("Priority raised from High to Urgent by Ada Admin", "10:02")}
      ${entry("SL", "10:40", "Rollback seems to have helped for most people, but two colleagues near the kitchen still lose the connection. Could that be a different AP?")}
      <div style="height:120px"></div>
    </div>
    <div style="position:absolute;left:0;right:320px;bottom:0;padding:12px 40px 16px;background:linear-gradient(180deg,transparent,var(--bg) 30%)">
      <div class="card" style="max-width:720px;border-radius:12px;box-shadow:var(--shadow)">
        <div style="display:flex;gap:2px;padding:6px 6px 0"><span class="chip on" style="border:0">${ic("reply")}Reply</span><span class="chip" style="border:0;background:transparent">${ic("note")}Internal note</span></div>
        <div style="padding:8px 14px 12px;font-size:13.5px;color:var(--text-3)">Write a reply to Sanne… <span class="t3">@</span> to mention, <span class="t3">#</span> to reference</div>
        <div style="display:flex;align-items:center;gap:6px;padding:8px 8px;border-top:1px solid var(--line)"><span class="btn ghost sm">B</span><span class="btn ghost sm" style="font-style:italic">I</span><span class="btn ghost sm">${ic("tagi")}</span><span class="btn ghost sm">${ic("layers")}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="t3" style="font-size:12px">Reply sets status to</span><span class="chip" style="height:22px">${ring("waiting")}Waiting${ic("chevd")}</span><span class="btn primary sm" style="height:28px">${ic("send")}Send<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">⌘↵</kbd></span></span></div>
      </div>
    </div>`;

  const railR = `
    <aside style="position:absolute;top:0;right:0;bottom:0;width:320px;border-left:1px solid var(--line);overflow:hidden;background:var(--bg);display:flex;flex-direction:column">
      <div style="padding:12px 12px 8px;display:flex;flex-direction:column;gap:2px">
        <div class="label" style="padding:6px 12px 8px">Properties</div>
        ${prop("layers", "Status", status("progress"), ic("chevd", "t3"))}
        ${prop("flag", "Priority", `${bars("urgent")}<span>Urgent</span>`, ic("chevd", "t3"))}
        ${prop("ticket", "Type", "Incident", ic("chevd", "t3"))}
        ${prop("user", "Assignee", `${avatar("MK", 18)}Mila Kuipers`, ic("chevd", "t3"))}
        ${prop("users", "Team", "Network", ic("chevd", "t3"))}
        ${prop("folder", "Project", '<span class="ref">NET</span> Network refresh', ic("chevd", "t3"))}
        ${prop("cal", "Due", '<span class="t3" style="font-weight:400">No deadline</span>')}
        ${prop("tagi", "Tags", '<span class="tag">network</span><span class="tag">utrecht</span><span class="t3" style="font-size:16px;line-height:1">+</span>')}
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 4px"><span class="btn primary sm" style="opacity:.45">${ic("check")}Save</span><span class="t3" style="font-size:12px">Nothing to save</span></div>
      </div>
      <div style="border-top:1px solid var(--line);padding:12px 12px 8px">
        <div class="label" style="padding:6px 12px 10px">People</div>
        <div style="display:flex;flex-direction:column;gap:10px;padding:0 12px">
          <div style="display:flex;gap:10px;align-items:center">${avatar("SL", 30)}<div style="line-height:1.3"><div style="font-weight:600">Sanne Lin <span class="t3" style="font-weight:400;font-size:11.5px">· requester</span></div><div class="t3 mono" style="font-size:11.5px">s.lin@tiqo.local · +31 6 1234 5678</div></div></div>
          <div style="display:flex;gap:10px;align-items:center">${avatar("MK", 30)}<div style="line-height:1.3"><div style="font-weight:600">Mila Kuipers <span class="t3" style="font-weight:400;font-size:11.5px">· working on it</span></div><div class="t3" style="font-size:11.5px">Network engineer · Infrastructure</div></div></div>
        </div>
      </div>
      <div style="border-top:1px solid var(--line);padding:12px 12px 8px;flex:1;overflow:hidden">
        <div class="label" style="padding:6px 12px 10px">Response target</div>
        <div style="padding:0 12px">
          <div style="display:flex;justify-content:space-between;font-size:12px" class="t2"><span>Urgent · 4 h</span><span class="mono" style="color:var(--p-urgent);font-weight:600">0h 19m left</span></div>
          <div style="height:6px;border-radius:3px;background:var(--surface-3);margin-top:8px;overflow:hidden"><i style="display:block;height:100%;width:92%;background:var(--p-urgent);box-shadow:0 0 8px var(--p-urgent)"></i></div>
          <div class="t3" style="font-size:11.5px;margin-top:8px">Clock paused while waiting on requester.</div>
        </div>
      </div>
    </aside>`;

  const body = `${toolbar}<div style="position:absolute;top:44px;left:0;right:320px;bottom:0;overflow:hidden">${centre}</div>${railR}`;
  return shell("tickets", ["Tickets", `<span class="ref inc" style="color:var(--text)"><b>INC</b>-2609 0117</span>`], body,
    `<span class="btn ghost sm" style="margin-left:-6px">${ic("arrowl")}Queue</span>`);
}

/* ------------------------------------------------- ticket page, round 5 */

const PLAN = {
  template: "Automate a process",
  phases: [
    { name: "Prepare", steps: [["Confirm scope with HR", "done", "RD", "20 Aug"], ["Inventory contractor accounts", "done", "RD", "22 Aug"]] },
    { name: "Build", steps: [["Create conditional-access policy", "done", "RD", "27 Aug"], ["Pilot with 5 contractors", "done", "MK", "2 Sep"], ["Write the enrolment guide", "done", "TP", "4 Sep"]] },
    { name: "Verify", steps: [["Review pilot sign-in logs", "doing", "RD", "9 Sep"], ["Security sign-off", "blocked", "RD", "10 Sep"]] },
    { name: "Roll out", steps: [["Enrol remaining 33 contractors", "todo", "MK", "16 Sep"], ["Close out and hand over to ops", "todo", "RD", "19 Sep"]] },
  ],
};
const STEP = {
  done: ["Done", "var(--positive)", 1],
  doing: ["Doing", "var(--brand)", 0.5],
  blocked: ["Blocked", "var(--p-urgent)", 0.5],
  todo: ["To do", "var(--text-3)", 0],
};
function stepRing(s) {
  const [, c, d] = STEP[s];
  const r = 5, C = 2 * Math.PI * r;
  const inner = d >= 1
    ? `<path d="M4.6 7.3 6.6 9.3 9.6 5.2" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : d > 0 ? `<circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="${(C * d).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 7 7)"/>` : "";
  return `<svg class="ring" viewBox="0 0 14 14"><circle cx="7" cy="7" r="${r}" fill="none" stroke="${c}" stroke-width="1.4" opacity="${d >= 1 ? 1 : 0.35}"/>${inner}</svg>`;
}
function stepChip(s) {
  const [name] = STEP[s];
  const svg = stepRing(s);
  return `<span class="chip" style="height:24px;gap:6px;color:${s === "todo" ? "var(--text-2)" : "var(--text)"};${s === "blocked" ? "border-color:color-mix(in oklab,var(--p-urgent) 40%,transparent);background:color-mix(in oklab,var(--p-urgent) 8%,transparent)" : ""}">${svg}${name}${ic("chevd", "t3")}</span>`;
}

function ticket2(kind = "incident") {
  const change = kind === "change";
  const t = change ? T[6] : T[0];
  const requester = change ? "TP" : "SL";
  const reqName = AV_NAME[requester];
  const first = reqName.split(" ")[0];
  const stepsDone = PLAN.phases.flatMap((p) => p.steps).filter((s) => s[1] === "done").length;
  const stepsAll = PLAN.phases.flatMap((p) => p.steps).length;

  /* toolbar: actions left, ticket-level views + prev/next right, over the rail */
  const toolbar = `
    <div style="display:flex;align-items:center;gap:4px;height:44px;padding:0 16px 0 24px;border-bottom:1px solid var(--line);background:var(--bg)">
      <span class="btn primary sm" style="height:28px">${ic("reply")}Reply<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">R</kbd></span>
      <span class="btn ghost sm" style="height:28px">${ic("note")}Add note</span>
      <span class="btn ghost sm" style="height:28px">${ic("fwd")}Forward</span>
      <span style="width:1px;height:18px;background:var(--line);margin:0 6px"></span>
      <span class="btn ghost sm" style="height:28px">${ic("check")}${change ? "Complete" : "Resolve"}</span>
      <span class="btn ghost sm" style="height:28px">${ic("merge")}Merge</span>
      <span class="btn ghost sm" style="height:28px;color:var(--text-3)">${ic("trash")}</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:6px">
        ${change ? `<span class="btn outline sm" style="height:28px">${ic("layers")}Plan<span class="mono t3" style="font-size:11px">${stepsDone}/${stepsAll}</span></span>` : ""}
        <span class="btn outline sm" style="height:28px">${ic("clock")}Activity<span class="mono t3" style="font-size:11px">12</span></span>
        <span style="width:1px;height:18px;background:var(--line);margin:0 4px"></span>
        <span class="btn outline sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("chevl")}</span>
        <span class="mono t3" style="font-size:11.5px;padding:0 4px">${change ? "7" : "1"} of 23</span>
        <span class="btn outline sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("chev")}</span>
      </span>
    </div>`;

  /* conversation pieces */
  const entry = (who, when, body) => `
    <div style="display:grid;grid-template-columns:28px 1fr;gap:12px;padding:16px 0 14px">
      ${avatar(who, 28)}
      <div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><b style="font-weight:600">${AV_NAME[who]}</b><span class="t3">replied</span><span class="t3 mono" style="margin-left:auto;font-size:11.5px">${when}</span></div>
        <div style="margin-top:6px;font-size:13.5px;line-height:1.55;color:var(--text-2)">${body}</div>
      </div>
    </div>`;
  const note = (who, when, body) => `
    <div style="display:grid;grid-template-columns:28px 1fr;gap:12px;padding:8px 0 10px">
      ${avatar(who, 28)}
      <div style="border-radius:10px;background:var(--brand-wash);border:1px solid color-mix(in oklab,var(--brand) 32%,transparent);padding:10px 14px 12px;position:relative">
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px"><b style="font-weight:600">${AV_NAME[who]}</b><span style="display:inline-flex;align-items:center;gap:5px;color:var(--brand-deep);font-weight:600;font-size:11.5px">${ic("lock")}Internal note · ${first} can't see this</span><span class="t3 mono" style="margin-left:auto;font-size:11.5px">${when}</span></div>
        <div style="margin-top:6px;font-size:13.5px;line-height:1.55;color:var(--text-2)">${body}</div>
      </div>
    </div>`;
  const events = (items) => `
    <div style="margin:4px 0;padding:4px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      ${items.map(([i, txt, when]) => `<div class="ev"><span class="dot">${ic(i)}</span><span>${txt}</span><span class="mono t3" style="font-size:11px">${when}</span></div>`).join("")}
    </div>`;

  /* change: the plan card sits between request and conversation */
  const planCard = change ? `
    <div class="card" style="margin-top:16px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-bottom:1px solid var(--line)">
        <span style="font-weight:600">Plan</span><span class="t3" style="font-size:12px">from template <b style="color:var(--text-2);font-weight:500">${PLAN.template}</b></span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:10px"><span class="mono t3" style="font-size:11.5px">${stepsDone} of ${stepsAll} steps</span><span style="width:120px;height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;display:inline-block"><i style="display:block;height:100%;width:${(stepsDone / stepsAll) * 100}%;background:var(--brand)"></i></span><a style="font-size:12px;font-weight:500">Open plan ${ic("chev")}</a></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
        ${PLAN.phases.map((p, i) => {
          const d = p.steps.filter((s) => s[1] === "done").length, n = p.steps.length;
          const state = d === n ? "done" : d > 0 || p.steps.some((s) => s[1] !== "todo") ? "now" : "todo";
          const cur = p.steps.find((s) => s[1] === "doing" || s[1] === "blocked");
          return `<div style="padding:12px 16px;${i ? "border-left:1px solid var(--line)" : ""}${state === "now" ? ";background:var(--surface-2)" : ""}">
            <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600">${stepRing(state === "done" ? "done" : state === "now" ? "doing" : "todo")}${p.name}<span class="mono t3" style="margin-left:auto;font-weight:400;font-size:11px">${d}/${n}</span></div>
            <div class="t3" style="font-size:12px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cur ? `<span style="color:${cur[1] === "blocked" ? "var(--p-urgent)" : "var(--brand-deep)"};font-weight:500">${STEP[cur[1]][0]}</span> · ${cur[0]}` : state === "done" ? "All steps done" : "Not started"}</div>
          </div>`;
        }).join("")}
      </div>
    </div>` : "";

  const requestBody = change
    ? "We still have 38 contractors signing in with password only. Security wants everyone on MFA before the October audit. Contractors don't have company phones, so the enrolment guide must cover personal devices and a hardware-key alternative for the three people who refuse to install anything."
    : "Since this morning the VPN client disconnects roughly every twenty minutes for everyone on the second floor. Reconnecting works, but Teams calls drop each time and the finance team is trying to close the month. Wired desks seem fine. Laptops on the guest network are also fine, which makes me think it is the corporate Wi-Fi rather than the VPN itself.";

  const conversation = change ? `
      ${events([["user", "<b>Rami Daoud</b> took the change", "20 Aug"], ["layers", "<b>Rami Daoud</b> applied the plan <b>Automate a process</b> · 9 steps in 4 phases", "20 Aug"]])}
      ${entry("RD", "2 Sep", "Pilot group is enrolled. Two of the five needed the hardware-key path, so the guide now covers both. Logs look clean so far; I'll review them properly on Monday before asking for sign-off.")}
      ${note("RD", "8 Sep", "Security sign-off is blocked on the exception list: legal wants it in writing that the three refusers get keys and not an exemption. Chasing Sanne in security today.")}
      ${events([["check", "<b>Rami Daoud</b> finished step <b>Write the enrolment guide</b>", "4 Sep"], ["flag", "<b>Rami Daoud</b> marked <b>Security sign-off</b> as blocked", "8 Sep 09:20"]])}`
    : `
      ${events([["user", "<b>Mila Kuipers</b> took the ticket", "09:31"]])}
      ${entry("MK", "09:34", "Thanks Sanne. I can see the 2F access points renegotiating every ~20 min in the controller log, which matches. I'm rolling the AP firmware back on that floor now, should take about 15 minutes. Wired desks are unaffected so finance can plug in meanwhile.")}
      ${note("MK", "09:36", "Controller shows the AP firmware went from 8.10.3 to 8.11.0 last night with the change window. Rolling back AP-2F-01…08. If this fixes it we need a change ticket to re-plan the upgrade.")}
      ${events([["flag", "<b>Ada Admin</b> raised priority from <b>High</b> to <b>Urgent</b>", "10:02"], ["layers", "<b>Ada Admin</b> linked project <b>NET · Network refresh 2026</b>", "10:03"]])}
      ${entry("SL", "10:40", "Rollback seems to have helped for most people, but two colleagues near the kitchen still lose the connection. Could that be a different AP?")}`;

  const centre = `
    <div style="padding:22px 32px 0 40px;max-width:820px">
      <div style="display:flex;align-items:center;gap:10px">${ref(t.r)}${bars(t.p)}<span style="font-size:12px;color:var(--p-${t.p});font-weight:500;text-transform:capitalize">${t.p}</span><span class="t3">·</span>${status(t.s)}<span class="t3">·</span><span class="t3" style="font-size:12px">${change ? "Change" : "Incident"}</span></div>
      <h1 style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin:10px 0 6px;line-height:1.25">${t.t}</h1>
      <div class="t3" style="font-size:12.5px;display:flex;gap:8px;align-items:center">Raised by <b style="color:var(--text-2);font-weight:500">${reqName}</b> ${change ? "20 Aug" : "3h ago"} · updated ${change ? "today 09:20" : "12 min ago"} · ${t.tags.map((x) => `<span class="tag">${x}</span>`).join("")}</div>

      <div style="margin-top:18px;border-radius:12px;background:var(--brand-wash);padding:16px 20px;position:relative;overflow:hidden">
        <span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--p-${t.p})"></span>
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px">${avatar(requester, 22)}<b style="font-weight:600">${reqName}</b><span class="t3">· ${change ? "IT · 20 Aug 14:05" : "Utrecht office · 09:12"}</span></div>
        <p style="margin:8px 0 0;font-size:14px;line-height:1.6">${requestBody}</p>
      </div>
      ${planCard}
      <div style="margin-top:8px">${conversation}</div>
      <div style="height:90px"></div>
    </div>
    <!-- composer: one collapsed line, narrower than the conversation; expands on focus -->
    <div style="position:absolute;left:40px;width:560px;bottom:16px">
      <div class="card" style="display:flex;align-items:center;gap:10px;height:44px;padding:0 8px 0 12px;border-radius:12px;box-shadow:var(--shadow)">
        ${avatar("AA", 24)}
        <span class="t3" style="font-size:13px;flex:1">Reply to ${first}…</span>
        <span class="seg" style="padding:2px"><span class="chip on" style="height:24px;font-size:11.5px">${ic("reply")}Reply</span><span class="chip" style="height:24px;font-size:11.5px">${ic("lock")}Note</span></span>
        <span class="btn primary sm" style="height:28px">${ic("send")}Send</span>
      </div>
    </div>`;

  /* right rail */
  const prow = (label, value, dirty = false) => `<div class="prow"><span class="pl">${label}</span><span class="pv ${dirty ? "dirty" : ""}">${value}${ic("chevd", "t3")}</span></div>`;
  const rail = `
    <aside style="position:absolute;top:0;right:0;bottom:0;width:320px;border-left:1px solid var(--line);overflow:hidden;background:var(--bg);display:flex;flex-direction:column">
      <div style="padding:10px 12px 8px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 6px"><span class="label">Properties</span><span class="t3 mono" style="font-size:10.5px">edited · unsaved</span></div>
        ${prow("Status", status("progress"))}
        ${prow("Priority", `${bars(t.p)}<span style="text-transform:capitalize">${t.p}</span>`, !change)}
        ${prow("Type", change ? "Change" : "Incident")}
        ${prow("Assignee", `${avatar(t.a, 18)}${AV_NAME[t.a]}`)}
        ${prow("Team", change ? "Security" : "Network")}
        ${prow("Project", change ? '<span class="ref">SEC</span> Zero trust' : '<span class="ref">NET</span> Network refresh')}
        ${change ? prow("Plan", `${ic("layers", "t3")}${PLAN.template} <span class="mono t3" style="font-size:11px">${stepsDone}/${stepsAll}</span>`) : ""}
        ${prow("Due", change ? '<span class="mono">19 Sep</span>' : '<span class="t3" style="font-weight:400">None</span>')}
        ${prow("Tags", t.tags.map((x) => `<span class="tag">${x}</span>`).join("") + '<span class="t3" style="font-size:15px;line-height:1">+</span>')}
        <div style="display:flex;align-items:center;gap:8px;padding:8px 8px 2px">${!change ? `<span class="btn primary sm">${ic("check")}Save</span><span class="btn ghost sm">Discard</span><span class="t3" style="font-size:11.5px">Priority High → Urgent</span>` : `<span class="btn primary sm" style="opacity:.4">${ic("check")}Save</span><span class="t3" style="font-size:11.5px">No changes</span>`}</div>
      </div>`.replace('<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 6px"><span class="label">Properties</span><span class="t3 mono" style="font-size:10.5px">edited · unsaved</span></div>', `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px 6px"><span class="label">Properties</span>${!change ? '<span class="t3 mono" style="font-size:10.5px">1 unsaved change</span>' : ""}</div>`) + `

      <div style="border-top:1px solid var(--line);padding:12px 12px 12px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 8px 8px"><span class="label">Requester</span><a style="font-size:11.5px">3 other requests</a></div>
        <div class="card" style="overflow:hidden">
          <div style="display:flex;gap:10px;align-items:center;padding:12px 14px">
            ${avatar(requester, 38)}
            <div style="line-height:1.25;min-width:0;flex:1"><div style="font-weight:600;font-size:13.5px">${reqName}</div><div class="t2" style="font-size:12px;margin-top:2px">${change ? "Facilities liaison · Facilities" : "Finance controller · Finance"}</div></div>
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:var(--positive);background:color-mix(in oklab,var(--positive) 10%,transparent);padding:3px 8px;border-radius:999px;white-space:nowrap"><i style="width:6px;height:6px;border-radius:99px;background:currentColor"></i>In office</span>
          </div>
          <div style="display:grid;grid-template-columns:76px 1fr;gap:6px 10px;padding:10px 14px;border-top:1px solid var(--line);font-size:12.5px;align-items:center">
            <span class="t3" style="font-size:11.5px">Company</span><span>Tiqo · Utrecht</span>
            <span class="t3" style="font-size:11.5px">Email</span><span class="mono" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${change ? "t.pereira" : "s.lin"}@tiqo.local</span>
            <span class="t3" style="font-size:11.5px">Phone</span><span class="mono" style="font-size:12px">+31 6 1234 5678</span>
            <span class="t3" style="font-size:11.5px">Hours</span><span>Mon–Fri 08:30–17:30 <span class="t3">· CET</span></span>
          </div>
          <div style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--line);background:var(--surface-2)">
            <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("mail")}Email</span>
            <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("phone")}Call</span>
            <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("user")}Profile</span>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--line);padding:10px 20px 12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;align-items:center"><span class="label">Response target</span><span class="mono" style="color:var(--p-${t.p});font-weight:600">${change ? "6d 4h left" : "0h 19m left"}</span></div>
        <div style="height:6px;border-radius:3px;background:var(--surface-3);margin-top:8px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(t.heat * 100)}%;background:var(--p-${t.p});${t.hot ? `box-shadow:0 0 8px var(--p-${t.p})` : ""}"></i></div>
      </div>

      <div style="border-top:1px solid var(--line);padding:10px 20px 0;flex:1;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 4px"><span class="label">Activity</span><a style="font-size:11.5px">All 12</a></div>
        ${(change
          ? [["RD", "marked <b>Security sign-off</b> as blocked", "Today 09:20"], ["RD", "finished <b>Write the enrolment guide</b>", "4 Sep"], ["RD", "assigned <b>Pilot with 5 contractors</b> to Mila", "1 Sep"], ["RD", "applied the plan <b>Automate a process</b>", "20 Aug"], ["TP", "raised this change", "20 Aug"]]
          : [["AA", "linked project <b>NET · Network refresh</b>", "10:03"], ["AA", "raised priority from High to <b>Urgent</b>", "10:02"], ["MK", "added an internal note", "09:36"], ["MK", "took the ticket", "09:31"], ["SL", "raised this ticket", "09:12"]]
        ).map(([k, x, w]) => `<div style="display:grid;grid-template-columns:20px 1fr;gap:10px;align-items:start;padding:7px 0;border-top:1px solid var(--line)">${avatar(k, 20)}<div style="min-width:0;font-size:12px;line-height:1.4"><span><b style="font-weight:600;color:var(--text)">${AV_NAME[k].split(" ")[0]}</b> <span class="t2">${x}</span></span><div class="mono t3" style="font-size:10.5px;margin-top:1px">${w}</div></div></div>`).join("")}
      </div>
    </aside>`;

  const body = `${toolbar}<div style="position:absolute;top:44px;left:0;right:320px;bottom:0;overflow:hidden">${centre}</div>${rail.replace('position:absolute;top:0;right:0;bottom:0;width:320px', 'position:absolute;top:44px;right:0;bottom:0;width:320px')}`;
  return shell("tickets", ["Tickets", `<span class="ref ${change ? "chg" : "inc"}" style="color:var(--text)"><b>${change ? "CHG" : "INC"}</b>${t.r.slice(3)}</span>`], body,
    `<span class="btn ghost sm" style="margin-left:-6px">${ic("arrowl")}Queue</span>`);
}

/* --------------------------------------------------------- the plan page */

function plan() {
  const t = T[6];
  const all = PLAN.phases.flatMap((p) => p.steps);
  const done = all.filter((s) => s[1] === "done").length;
  const stepRow = ([name, s, who, due], i, last) => `
    <div style="display:grid;grid-template-columns:110px minmax(0,1fr) 28px 64px 40px 16px;gap:12px;align-items:center;height:44px;padding:0 16px;${last ? "" : "border-bottom:1px solid var(--line)"};${s === "doing" ? "background:var(--surface-2)" : ""}">
      ${stepChip(s)}
      <span style="font-weight:500;${s === "done" ? "color:var(--text-3)" : ""}">${name}${s === "blocked" ? ` <span class="tag" style="background:color-mix(in oklab,var(--p-urgent) 10%,transparent);color:var(--p-urgent);margin-left:6px">waiting on legal</span>` : ""}</span>
      ${avatar(who, 22)}
      <span class="mono tnum" style="font-size:12px;color:${s === "blocked" ? "var(--p-urgent)" : "var(--text-3)"}">${due}</span>
      <span class="t3" style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px">${s === "done" || s === "doing" || s === "blocked" ? `${ic("msg")}<span class="mono">${[3, 1, 4, 2, 2, 5, 3][i % 7]}</span>` : ""}</span>
      <span class="t3" style="display:flex">${ic("chev")}</span>
    </div>`;
  let idx = 0;
  const phases = PLAN.phases.map((p, pi) => {
    const d = p.steps.filter((s) => s[1] === "done").length;
    const rows = p.steps.map((s, i) => stepRow(s, idx++, i === p.steps.length - 1)).join("");
    const state = d === p.steps.length ? "done" : p.steps.some((s) => s[1] !== "todo") ? "now" : "todo";
    return `
      <section style="margin-top:${pi ? 20 : 0}px">
        <div style="display:flex;align-items:center;gap:10px;padding:0 4px 8px">
          <span class="mono t3" style="font-size:11px">0${pi + 1}</span>
          <span style="font-weight:600;font-size:14px;${state === "todo" ? "color:var(--text-2)" : ""}">${p.name}</span>
          ${state === "now" ? '<span class="tag" style="background:var(--brand-tint);color:var(--brand-deep)">current phase</span>' : ""}
          <span class="mono t3" style="font-size:11.5px;margin-left:auto">${d}/${p.steps.length}</span>
          <span class="btn ghost sm">${ic("plus")}Step</span>
        </div>
        <div class="card" style="overflow:hidden">${rows}</div>
      </section>`;
  }).join("");

  const body = `
    <div style="padding:18px 24px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:10px">${ref(t.r)}${bars(t.p)}${status("progress")}<span class="t3">·</span><span class="t3" style="font-size:12px">Change</span></div>
      <div style="display:flex;align-items:flex-end;gap:16px;margin-top:8px;padding-bottom:16px">
        <div><h1 style="font-size:20px;font-weight:600;letter-spacing:-.02em;margin:0;line-height:1.25">${t.t}</h1><div class="t3" style="font-size:12.5px;margin-top:4px">Plan from template <b style="color:var(--text-2);font-weight:500">${PLAN.template}</b> · applied 20 Aug by Rami Daoud</div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn outline sm" style="height:28px">${ic("layers")}Change template</span><span class="btn outline sm" style="height:28px">${ic("arrowl")}Back to the change</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;padding:20px 24px">
      <div>${phases}</div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:16px 18px">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="label">Progress</span><span class="mono t3" style="font-size:11.5px">${done} of ${all.length} steps</span></div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-top:8px"><span class="tnum" style="font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1">${Math.round((done / all.length) * 100)}%</span><span class="t3" style="font-size:12px">· 1 blocked · due 19 Sep</span></div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
            ${PLAN.phases.map((p) => { const d = p.steps.filter((s) => s[1] === "done").length; const b = p.steps.some((s) => s[1] === "blocked"); return `<div style="display:grid;grid-template-columns:64px 1fr 28px;gap:10px;align-items:center;font-size:12px"><span class="t2">${p.name}</span><span style="height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden;position:relative"><i style="position:absolute;inset:0;width:${(d / p.steps.length) * 100}%;background:var(--brand)"></i>${b ? `<i style="position:absolute;top:0;bottom:0;left:${(d / p.steps.length) * 100}%;width:${(1 / p.steps.length) * 100}%;background:var(--p-urgent)"></i>` : ""}</span><span class="mono t3" style="text-align:right">${d}/${p.steps.length}</span></div>`; }).join("")}
          </div>
        </div>
        <div class="card" style="padding:16px 18px">
          <div class="label" style="margin-bottom:8px">Needs a decision</div>
          <div style="display:flex;gap:10px;align-items:flex-start"><span style="color:var(--p-urgent);display:flex;margin-top:2px">${ic("flag")}</span><div style="font-size:12.5px;line-height:1.45"><b style="font-weight:600">Security sign-off</b> is blocked: legal wants the hardware-key exception in writing.<div style="margin-top:6px"><a style="font-weight:500">Open step ${ic("chev")}</a></div></div></div>
        </div>
        <div class="card" style="padding:16px 18px 6px">
          <div class="label" style="margin-bottom:4px">Step owners</div>
          ${[["RD", 6], ["MK", 2], ["TP", 1]].map(([k, n]) => `<div style="display:flex;align-items:center;gap:10px;height:38px;border-top:1px solid var(--line)">${avatar(k, 22)}<span style="font-weight:500">${AV_NAME[k]}</span><span class="mono t3" style="margin-left:auto;font-size:11.5px">${n} steps</span></div>`).join("")}
        </div>
      </div>
    </div>`;
  return shell("tickets", ["Tickets", '<span class="ref chg" style="color:var(--text)"><b>CHG</b>-2609 0004</span>', "Plan"], body,
    `<span class="btn ghost sm" style="margin-left:-6px">${ic("arrowl")}Change</span>`);
}

function settings() {
  const navItems = [["General", 0], ["Tickets", 1], ["Portal", 0], ["Change templates", 0], ["Teams", 0], ["Tags", 0], ["Blocked words", 0], ["Roles", 0]];
  const nav = navItems.map(([n, on]) => `<a class="${on ? "on" : ""}" style="height:30px">${n}</a>`).join("");
  const field = (label, ctrl, hint = "") => `
    <div style="display:grid;grid-template-columns:220px 1fr;gap:24px;padding:14px 0;border-top:1px solid var(--line)">
      <div><div style="font-weight:500">${label}</div>${hint ? `<div class="t3" style="font-size:12px;margin-top:2px">${hint}</div>` : ""}</div>
      <div>${ctrl}</div>
    </div>`;
  const select = (v, w = 220) => `<div class="input" style="width:${w}px;justify-content:space-between"><span>${v}</span>${ic("chevd", "t3")}</div>`;
  const num = (v, unit, dirty = false) => `<div class="input" style="width:110px;justify-content:space-between;border-color:${dirty ? "var(--brand)" : "var(--line-strong)"};box-shadow:${dirty ? "0 0 0 3px var(--brand-tint)" : "none"}"><span class="mono">${v}</span><span class="t3" style="font-size:12px">${unit}</span></div>`;
  const group = (title, blurb, content) => `
    <section style="padding:24px 0 8px">
      <h2 style="font-size:14px;font-weight:600;margin:0">${title}</h2>
      <p class="t3" style="margin:4px 0 12px;font-size:12.5px;max-width:560px">${blurb}</p>
      ${content}
    </section>`;
  const statuses = [["new", "New", "Where every ticket starts", "1"], ["progress", "In progress", "Someone is working on it", ""], ["waiting", "Waiting on requester", "Pauses the clock · shown on portal", ""], ["resolved", "Resolved", "Settles the ticket", ""]];
  const body = `
    <div class="pagehead"><h1>Settings</h1><span class="t3" style="font-size:12.5px">How this desk behaves, for everyone who uses it</span></div>
    <div style="display:grid;grid-template-columns:200px 1fr;height:852px">
      <nav class="nav" style="display:flex;flex-direction:column;gap:2px;padding:16px 12px;border-right:1px solid var(--line)">${nav}</nav>
      <div style="position:relative;overflow:hidden">
        <div style="padding:0 32px;max-width:920px">
          ${group("New ticket defaults", "What the form starts on. Whoever raises the ticket can still change any of it.",
            field("Type", select("Question")) + field("Priority", select("Medium")) + field("Project", select("No project")))}
          ${group("Response targets", "How long a ticket of each priority may sit before it counts as overdue. This drives the countdown on the ticket and the heat mark on every row.",
            field(`<span style="display:flex;align-items:center;gap:8px">${bars("urgent")}Urgent</span>`, num(4, "hrs", true), "4 hours") +
            field(`<span style="display:flex;align-items:center;gap:8px">${bars("high")}High</span>`, num(24, "hrs"), "1 day") +
            field(`<span style="display:flex;align-items:center;gap:8px">${bars("medium")}Medium</span>`, num(72, "hrs"), "3 days") +
            field(`<span style="display:flex;align-items:center;gap:8px">${bars("low")}Low</span>`, num(168, "hrs"), "7 days"))}
          ${group("Business hours", "Targets count only inside these hours. Europe/Amsterdam.",
            field("Working days", `<div style="display:flex;gap:4px">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => `<span class="chip ${i < 5 ? "on" : ""}" style="width:44px;justify-content:center">${d}</span>`).join("")}</div>`) +
            field("Hours", `<div style="display:flex;gap:8px;align-items:center">${num("08:30", "")}<span class="t3">to</span>${num("17:30", "")}</div>`))}
          ${group("Statuses", "The stages a ticket moves through, in order. Drag to reorder.",
            `<div class="card" style="overflow:hidden">${statuses.map(([k, n, h, c], i) => `<div style="display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;${i ? "border-top:1px solid var(--line)" : ""}"><span class="t3" style="display:flex">${ic("grip")}</span>${ring(k)}<span style="font-weight:500;width:180px">${n}</span><span class="t3" style="font-size:12px">${h}</span>${c ? `<span class="tag" style="margin-left:auto;background:var(--brand-tint);color:var(--brand-deep)">New tickets</span>` : ""}<span class="btn ghost sm" style="margin-left:${c ? "0" : "auto"}">${ic("dots")}</span></div>`).join("")}</div>
             <div style="padding:10px 0"><span class="btn outline sm">${ic("plus")}Add status</span></div>`)}
          <div style="height:80px"></div>
        </div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 32px;border-top:1px solid var(--line);background:var(--bg)">
          <span class="btn primary" style="height:30px">${ic("check")}Save changes</span>
          <span class="btn ghost" style="height:30px">Discard</span>
          <span style="font-size:12.5px;display:flex;align-items:center;gap:6px" class="t2"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>1 unsaved change · Urgent target 8 → 4 hrs</span>
        </div>
      </div>
    </div>`;
  return shell("settings", ["Settings", "Tickets"], body);
}

/* A field of rising bars: the logo's motif at landscape scale. Heights are
   deterministic so the two themes and re-seeds agree. */
function signalField({ bars = 44, w = 760, h = 420, target = 0.7, bright = false }) {
  const cols = ["urgent", "high", "medium", "low"];
  const out = [];
  const gap = w / bars;
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const wave = 0.32 + 0.28 * Math.sin(t * 6.1 + 0.8) + 0.18 * Math.sin(t * 13.7 + 2.1) + 0.12 * Math.sin(t * 27 + 0.3);
    const height = Math.max(0.06, Math.min(0.98, wave));
    const amber = (i * 7) % 11 !== 0;
    const c = amber ? "var(--brand)" : `var(--p-${cols[(i * 5) % 4]})`;
    const hot = height > target;
    const alpha = hot ? 1 : 0.28 + height * 0.5;
    out.push(`<span style="position:absolute;left:${(i * gap).toFixed(1)}px;bottom:0;width:${Math.max(3, gap - 6).toFixed(1)}px;height:${(height * h).toFixed(0)}px;border-radius:3px 3px 0 0;background:${c};opacity:${alpha.toFixed(2)};${hot ? `box-shadow:0 0 14px 1px ${c};` : ""}--i:${i}"></span>`);
  }
  return `<div class="field" style="position:relative;width:${w}px;height:${h}px">${out.join("")}
    <span style="position:absolute;left:0;right:0;bottom:${(target * h).toFixed(0)}px;border-top:1px dashed ${bright ? "rgba(0,0,0,.25)" : "rgba(255,255,255,.28)"}"></span>
    <span class="mono" style="position:absolute;right:0;bottom:${(target * h + 8).toFixed(0)}px;font-size:11px;letter-spacing:.06em;color:${bright ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.5)"}">RESPONSE TARGET</span>
  </div>`;
}

function portal() {
  const catRow = (icon, title, sub, n, last = false) => `
    <div style="display:grid;grid-template-columns:40px 1fr auto 16px;gap:14px;align-items:center;padding:14px 4px;${last ? "" : "border-bottom:1px solid var(--line)"}">
      <span style="width:40px;height:40px;border-radius:10px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center">${ic(icon)}</span>
      <div><div style="font-weight:600;font-size:15px">${title}</div><div class="t2" style="font-size:13px;margin-top:2px">${sub}</div></div>
      <span class="t3 mono" style="font-size:11.5px;white-space:nowrap">${n}</span>
      <span class="t3" style="display:flex">${ic("chev")}</span>
    </div>`;
  const req = (t) => `<div style="display:grid;grid-template-columns:4px minmax(0,1fr);gap:14px;align-items:stretch;padding:12px 0;border-top:1px solid var(--line)"><span style="position:relative;width:4px;border-radius:2px;overflow:visible">${spine(t.p, t.heat, t.hot)}</span><div style="min-width:0"><div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.t}</div><div style="display:flex;align-items:center;gap:10px;margin-top:4px;font-size:12px">${ref(t.r)}${status(t.s)}<span class="t3 mono" style="margin-left:auto">${t.age}</span></div></div></div>`;
  const quick = (icon, label) => `<span class="btn outline" style="height:36px;padding:0 14px;font-size:13.5px;border-radius:999px;gap:8px">${ic(icon)}${label}</span>`;
  return `
  <div style="width:1440px;height:900px;background:var(--bg);overflow:hidden;position:relative">
    <header style="height:60px;display:flex;align-items:center;padding:0 48px;gap:14px;position:relative;z-index:2">
      ${logo(28)}<span style="font-weight:700;font-size:16px;letter-spacing:-.02em">Tiqo</span><span class="t3" style="font-size:13px;padding-left:12px;border-left:1px solid var(--line-strong)">Service portal</span>
      <nav style="margin-left:auto;display:flex;gap:2px;align-items:center;font-size:13.5px;font-weight:500">
        <span class="chip on" style="height:32px;padding:0 14px;border:0;border-radius:999px">Home</span><span class="chip" style="height:32px;padding:0 14px;border:0;background:transparent;border-radius:999px">Answers</span><span class="chip" style="height:32px;padding:0 14px;border:0;background:transparent;border-radius:999px">My requests <span class="mono" style="font-size:11px;background:var(--surface-3);padding:1px 6px;border-radius:99px">2</span></span>
        <span style="width:1px;height:18px;background:var(--line-strong);margin:0 10px"></span>
        <span class="btn ghost" style="width:32px;padding:0;justify-content:center">${ic("sun")}</span>
        ${avatar("SL", 30)}
      </nav>
    </header>

    <section style="position:relative;margin:12px 48px 0;border-radius:16px;background:var(--brand-wash);overflow:hidden;height:300px;border:1px solid color-mix(in oklab,var(--brand) 22%,transparent)">
      <div style="position:absolute;right:0;bottom:0;opacity:.85;-webkit-mask-image:linear-gradient(90deg,transparent,#000 35%);mask-image:linear-gradient(90deg,transparent,#000 35%)">${signalField({ bars: 48, w: 720, h: 300, target: 0.68 })}</div>
      <div style="position:relative;padding:44px 48px;max-width:640px">
        <h1 style="font-size:36px;font-weight:600;letter-spacing:-.03em;margin:0;line-height:1.1">Hi Sanne.<br>What do you need?</h1>
        <div class="input" style="margin-top:22px;height:52px;border-radius:12px;padding:0 18px;font-size:15px;box-shadow:var(--shadow);border-color:var(--line-strong);background:var(--surface);width:560px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search answers, or describe the problem</span><kbd style="margin-left:auto">/</kbd></div>
        <div style="display:flex;gap:8px;margin-top:14px">${quick("flag", "Something is broken")}${quick("key", "I need access")}${quick("laptop", "New device")}${quick("help", "Ask a question")}</div>
      </div>
    </section>

    <div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:48px;padding:28px 48px 0">
      <div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:4px"><h2 style="font-size:18px;font-weight:600;margin:0;letter-spacing:-.01em">Browse the catalogue</h2><span class="t3" style="font-size:13px">Everything you can ask for, by subject</span></div>
        ${catRow("laptop", "Devices", "Laptops, phones, screens and everything that plugs in", "6 requests · 4 answers")}
        ${catRow("key", "Accounts and access", "Passwords, shared drives, SharePoint, licences", "5 requests · 9 answers")}
        ${catRow("flag", "Something is broken", "Tell us what stopped working and we will take it from there", "2 requests")}
        ${catRow("wrench", "I need something built", "Changes, integrations, automations, new tooling", "3 requests", true)}
      </div>
      <div>
        <div class="card" style="padding:16px 18px;display:flex;align-items:center;gap:14px;border-radius:12px">
          <span style="width:10px;height:10px;border-radius:99px;background:var(--brand);box-shadow:0 0 0 4px var(--brand-tint)"></span>
          <div><div style="font-weight:600;font-size:14px">The desk is open</div><div class="t2" style="font-size:12.5px">Answering in about 2 hours · until 17:30</div></div>
          <span class="mono t3" style="margin-left:auto;font-size:11.5px">09:41</span>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--line);position:relative;overflow:hidden">
          <i style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--p-high)"></i>
          <div style="font-size:13px;margin-left:6px"><b style="font-weight:600">Wi-Fi on the second floor is unstable this morning.</b> <span class="t2">Use a wired desk for calls until 11:00.</span></div>
        </div>
        <div style="display:flex;align-items:baseline;gap:12px;margin:24px 0 2px"><h2 style="font-size:16px;font-weight:600;margin:0">Your requests</h2><a style="margin-left:auto;font-size:13px;font-weight:500">All requests ${ic("chev")}</a></div>
        ${req(T[0])}${req(T[4])}
      </div>
    </div>
  </div>`;
}

function portalOld() {
  const tile = (icon, title, sub, n) => `
    <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px;min-height:132px">
      <span style="width:32px;height:32px;border-radius:8px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center">${ic(icon)}</span>
      <div><div style="font-weight:600;font-size:15px">${title}</div><div class="t3" style="font-size:13px;margin-top:2px">${sub}</div></div>
      <div class="t3" style="font-size:12px;margin-top:auto">${n}</div>
    </div>`;
  const answer = (t, r) => `<div style="display:flex;align-items:center;gap:12px;height:44px;border-top:1px solid var(--line);font-size:14px"><span class="t3" style="display:flex">${ic("note")}</span><span style="font-weight:500">${t}</span><span class="t3" style="margin-left:auto;font-size:12px">${r} reads</span>${ic("chev", "t3")}</div>`;
  const req = (t) => `<div style="display:grid;grid-template-columns:104px minmax(0,1fr) 150px;gap:12px;align-items:center;height:44px;border-top:1px solid var(--line);font-size:14px;position:relative;padding-left:14px">${spine(t.p, t.heat, t.hot)}${ref(t.r)}<span style="font-weight:500;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.t}</span>${status(t.s)}</div>`;
  return `
  <div style="width:1440px;height:900px;background:var(--bg);overflow:hidden">
    <header style="height:56px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 40px;gap:14px;background:var(--surface)">
      ${logo(26)}<span style="font-weight:700;font-size:15px;letter-spacing:-.02em">Tiqo</span><span class="t3" style="font-size:13px">Service portal</span>
      <nav style="margin-left:auto;display:flex;gap:4px;align-items:center;font-size:13.5px">
        <span class="chip on" style="height:30px;padding:0 12px;border:0">Home</span><span class="chip" style="height:30px;padding:0 12px;border:0;background:transparent">My requests <span class="mono" style="font-size:11px">2</span></span>
        <span style="width:1px;height:18px;background:var(--line);margin:0 8px"></span>
        <span class="btn outline sm" style="height:30px">${ic("panel")}Open the desk</span>
        <span class="btn ghost" style="width:30px;padding:0;justify-content:center">${ic("sun")}</span>
        ${avatar("SL", 28)}
      </nav>
    </header>
    <div style="max-width:960px;margin:0 auto;padding:56px 0 0">
      <h1 style="font-size:28px;font-weight:600;letter-spacing:-.025em;margin:0;text-align:center">Hello Sanne, what do you need?</h1>
      <p class="t2" style="text-align:center;margin:8px 0 24px;font-size:14.5px">Search for an answer, or tell us and we will pick it up.</p>
      <div class="input" style="height:52px;border-radius:12px;padding:0 18px;font-size:15px;box-shadow:var(--shadow);border-color:var(--line-strong);background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Try “VPN”, “new laptop” or “parking pass”</span><kbd style="margin-left:auto">/</kbd></div>
      <div style="display:flex;gap:12px;align-items:flex-start;margin-top:20px;padding:14px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);position:relative;overflow:hidden">
        <i style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--p-high)"></i>
        <span style="color:var(--p-high);display:flex;margin-left:6px">${ic("flag")}</span>
        <div style="font-size:13.5px"><b style="font-weight:600">Wi-Fi on the second floor is unstable this morning.</b> <span class="t2">We are rolling back an access-point update. Use a wired desk for calls until 11:00.</span></div>
        <span class="t3" style="margin-left:auto;font-size:12px;white-space:nowrap">09:40</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:12px;margin:36px 0 12px"><h2 style="font-size:16px;font-weight:600;margin:0">Browse the catalogue</h2><span class="t3" style="font-size:13px">Everything you can ask for, by subject</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px">
        ${tile("laptop", "Devices", "Laptops, phones, screens", "6 requests · 4 answers")}
        ${tile("key", "Access", "Accounts, passwords, shared drives", "5 requests · 9 answers")}
        ${tile("help", "Something is broken", "Tell us what stopped working", "2 requests")}
        ${tile("wrench", "I need something built", "Changes, integrations, automations", "3 requests")}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px">
        <div><div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px"><h2 style="font-size:16px;font-weight:600;margin:0">Popular answers</h2></div>
          ${answer("Set up the VPN on a personal phone", 412)}${answer("Book a meeting room from Outlook", 288)}${answer("Reset your password without calling us", 251)}${answer("Get a parking pass for a visitor", 97)}</div>
        <div><div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px"><h2 style="font-size:16px;font-weight:600;margin:0">Your open requests</h2><a style="margin-left:auto;font-size:13px">All requests</a></div>
          ${req(T[0])}${req(T[4])}</div>
      </div>
    </div>
  </div>`;
}

function signin(theme) {
  const light = theme === "light";
  return `
  <div style="width:1440px;height:900px;display:grid;grid-template-columns:800px 1fr;overflow:hidden;background:var(--bg)">
    <div style="background:#09090b;color:#ecebe6;padding:44px 56px;display:flex;flex-direction:column;position:relative;overflow:hidden;--brand:#febe2e;--p-low:#34d399;--p-medium:#818cf8;--p-high:#fb923c;--p-urgent:#fb7185">
      <div style="position:absolute;inset:0;background:radial-gradient(60% 50% at 50% 100%,rgba(254,190,46,.16),transparent 70%)"></div>
      <div style="display:flex;align-items:center;gap:10px;position:relative">${logo(30)}<span style="font-weight:700;font-size:17px;letter-spacing:-.02em">Tiqo</span></div>
      <div style="position:relative;margin-top:56px">
        <h2 style="font-size:56px;font-weight:600;letter-spacing:-.035em;line-height:1.02;margin:0;max-width:560px">Work the queue.<br><span style="color:var(--brand)">See what's burning.</span></h2>
        <p style="color:#a09a90;margin:20px 0 0;font-size:15px;max-width:440px;line-height:1.55">Every ticket rises toward its response target. Colour is priority, height is time burned, and anything over the line is on fire.</p>
      </div>
      <div style="position:absolute;left:56px;right:0;bottom:0">${signalField({ bars: 52, w: 744, h: 360, target: 0.66 })}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:90px;background:linear-gradient(180deg,transparent,#09090b)"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;background:var(--bg);position:relative">
      <div style="position:absolute;top:32px;right:40px;display:flex;gap:4px"><span class="chip ${light ? "on" : ""}" style="height:26px;border:0;${light ? "" : "background:transparent"}">${ic("sun")}</span><span class="chip ${light ? "" : "on"}" style="height:26px;border:0;${light ? "background:transparent" : ""}">${ic("moon")}</span></div>
      <div style="width:360px">
        <h1 style="font-size:26px;font-weight:600;letter-spacing:-.025em;margin:0">Welcome back</h1>
        <p class="t2" style="margin:6px 0 28px;font-size:14px">Sign in to pick up where you left off.</p>
        <div style="display:flex;flex-direction:column;gap:16px">
          <label style="display:flex;flex-direction:column;gap:6px"><span class="label">Email</span><div class="input" style="height:40px;font-size:14px"><span>ada@tiqo.local</span></div></label>
          <label style="display:flex;flex-direction:column;gap:6px"><span class="label" style="display:flex;justify-content:space-between">Password<a style="text-transform:none;letter-spacing:0;font-weight:500">Forgot it?</a></span><div class="input" style="height:40px;font-size:14px;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)"><span>••••••••••••</span><span class="t3" style="margin-left:auto;display:flex">${ic("eye")}</span></div></label>
          <span class="btn primary" style="height:42px;justify-content:center;font-size:14px;margin-top:4px;border-radius:8px">Sign in<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">↵</kbd></span>
          <div class="t3" style="font-size:12.5px;text-align:center">New here? <a style="font-weight:500">Create an account</a> · <a style="font-weight:500">Requester portal</a></div>
        </div>
      </div>
      <div class="t3 mono" style="position:absolute;bottom:28px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.06em">TIQO · SELF-HOSTED · v0.4</div>
    </div>
  </div>`;
}

function portalSettings() {
  const navItems = [["General", 0], ["Tickets", 0], ["Portal", 1], ["Change templates", 0], ["Teams", 0], ["Tags", 0], ["Blocked words", 0], ["Roles", 0]];
  const nav = navItems.map(([n, on]) => `<a class="${on ? "on" : ""}" style="height:30px">${n}</a>`).join("");
  const tabs = [["cog", "General"], ["panel", "Front page"], ["layers", "Catalogue"], ["note", "Forms", true], ["help", "Answers"], ["flag", "Notices"]];
  const tabRow = tabs.map(([i, n, on]) => `<span style="display:flex;align-items:center;gap:7px;height:40px;padding:0 2px;margin-right:22px;font-size:13px;font-weight:500;color:${on ? "var(--text)" : "var(--text-2)"};border-bottom:2px solid ${on ? "var(--brand)" : "transparent"}">${ic(i)}${n}${n === "Forms" ? '<span class="mono t3" style="font-size:11px">7</span>' : ""}</span>`).join("");
  const formRow = (icon, name, qs, raised, featured, live, last) => `
    <div style="display:grid;grid-template-columns:32px minmax(0,1fr) 120px 80px 60px 16px;gap:14px;align-items:center;height:52px;padding:0 14px;${last ? "" : "border-bottom:1px solid var(--line)"}">
      <span style="width:32px;height:32px;border-radius:8px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center">${ic(icon)}</span>
      <div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;font-weight:600">${name}${featured ? `<span style="color:var(--brand-deep);display:flex">${ic("star")}</span>` : ""}</div><div class="t3" style="font-size:12px;margin-top:1px">${qs} questions · ${raised} raised this month</div></div>
      <span class="t2" style="font-size:12px;display:flex;align-items:center;gap:6px"><span class="tag">EN</span><span class="tag">NL</span></span>
      <span style="font-size:12px;display:flex;align-items:center;gap:6px;color:${live ? "var(--positive)" : "var(--text-3)"}"><i style="width:6px;height:6px;border-radius:99px;background:currentColor"></i>${live ? "Live" : "Hidden"}</span>
      <span class="btn ghost sm" style="justify-self:end">${ic("dots")}</span>
      <span class="t3" style="display:flex">${ic("chev")}</span>
    </div>`;
  const group = (title, n, rows) => `<div style="margin-top:20px"><div class="label" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${title}<span class="mono" style="letter-spacing:0">${n}</span></div><div class="card" style="overflow:hidden">${rows}</div></div>`;
  const body = `
    <div class="pagehead"><h1>Settings</h1><span class="t3" style="font-size:12.5px">How this desk behaves, for everyone who uses it</span></div>
    <div style="display:grid;grid-template-columns:200px 1fr;height:852px">
      <nav class="nav" style="display:flex;flex-direction:column;gap:2px;padding:16px 12px;border-right:1px solid var(--line)">${nav}</nav>
      <div style="position:relative;overflow:hidden">
        <div style="display:flex;align-items:center;gap:14px;padding:18px 32px 0">
          <div><div style="font-size:15px;font-weight:600">Portal</div><div class="t3" style="font-size:12.5px">Where people who are not on the desk come to ask for something</div></div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12.5px"><span class="t2 mono">tiqo.local/portal</span><span class="btn outline sm">${ic("ext")}Open</span><span style="display:flex;align-items:center;gap:8px;padding-left:10px;border-left:1px solid var(--line)"><span style="width:30px;height:18px;border-radius:99px;background:var(--brand);position:relative"><i style="position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:99px;background:#fff"></i></span><span style="font-weight:500">Portal is on</span></span></div>
        </div>
        <div style="display:flex;padding:8px 32px 0;border-bottom:1px solid var(--line);margin-top:6px">${tabRow}</div>
        <div style="padding:20px 32px 0;max-width:980px">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="input" style="width:320px;height:30px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search forms by name, summary or section</span></div>
            <span class="chip">Any type${ic("chevd")}</span><span class="chip">Live and hidden${ic("chevd")}</span>
            <span class="t3" style="font-size:12px;margin-left:4px">Showing 7 of 7</span>
            <span class="btn primary sm" style="margin-left:auto;height:30px">${ic("plus")}Add form</span>
          </div>
          ${group("Something is broken", 2, formRow("flag", "Something stopped working", 4, 18, true, true) + formRow("laptop", "My laptop or phone has a problem", 6, 7, false, true, true))}
          ${group("Accounts and access", 3, formRow("key", "Request access to a system", 5, 12, true, true) + formRow("user", "Reset a password for a colleague", 2, 3, false, true) + formRow("users", "Add someone to a shared mailbox", 3, 0, false, false, true))}
          ${group("I need something built", 2, formRow("wrench", "Automate a process", 3, 2, true, true) + formRow("layers", "Integrate two systems", 7, 1, false, true, true))}
        </div>
      </div>
    </div>`;
  return shell("settings", ["Settings", "Portal", "Forms"], body);
}

function project() {
  const tabs = [["Overview", true], ["Board"], ["All work", "11"], ["Milestones", "4"], ["People", "6"]];
  const tabRow = tabs.map(([n, on]) => `<span style="display:flex;align-items:center;gap:7px;height:40px;margin-right:22px;font-size:13px;font-weight:500;color:${on === true ? "var(--text)" : "var(--text-2)"};border-bottom:2px solid ${on === true ? "var(--brand)" : "transparent"}">${n}${typeof on === "string" ? `<span class="mono t3" style="font-size:11px">${on}</span>` : ""}</span>`).join("");
  const ms = [["Site survey", "12 Aug", "done"], ["Core switches", "29 Aug", "done"], ["Floor 2 access points", "8 Sep", "now"], ["Floors 1 & 3", "26 Sep", ""], ["Guest network cut-over", "17 Oct", ""]];
  const milestones = `
    <div style="position:relative;padding:14px 0 0">
      <div style="position:absolute;left:8px;right:8px;top:21px;height:2px;background:var(--line-strong)"></div>
      <div style="position:absolute;left:8px;width:46%;top:21px;height:2px;background:var(--brand)"></div>
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:relative">
        ${ms.map(([n, d, s]) => `<div style="display:flex;flex-direction:column;gap:10px"><span style="width:16px;height:16px;border-radius:99px;background:${s === "done" ? "var(--brand)" : s === "now" ? "var(--bg)" : "var(--surface-3)"};border:${s === "now" ? "3px solid var(--brand)" : s === "done" ? "0" : "2px solid var(--line-strong)"};box-shadow:${s === "now" ? "0 0 0 4px var(--brand-tint)" : "none"};display:flex;align-items:center;justify-content:center;color:var(--brand-ink)">${s === "done" ? '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m3 8.5 3 3 7-7"/></svg>' : ""}</span><div><div style="font-weight:${s === "now" ? 600 : 500};font-size:13px">${n}</div><div class="mono t3" style="font-size:11.5px;margin-top:2px">${d}${s === "now" ? " · today" : ""}</div></div></div>`).join("")}
      </div>
    </div>`;
  const act = (who, txt, when) => `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line);font-size:12.5px">${avatar(who, 20)}<div style="flex:1;min-width:0"><span style="font-weight:600">${AV_NAME[who]}</span> <span class="t2">${txt}</span></div><span class="mono t3" style="font-size:11px;white-space:nowrap">${when}</span></div>`;
  const member = (k, role, n) => `<div style="display:flex;align-items:center;gap:10px;height:40px;border-top:1px solid var(--line)">${avatar(k, 24)}<div style="line-height:1.2"><div style="font-weight:500">${AV_NAME[k]}</div><div class="t3" style="font-size:11.5px">${role}</div></div><span class="mono t3" style="margin-left:auto;font-size:11.5px">${n} open</span></div>`;
  const body = `
    <div style="padding:20px 24px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:16px">
        <span class="mono" style="width:44px;height:44px;border-radius:10px;background:#4f7bd9;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px">NET</span>
        <div><h1 style="font-size:20px;font-weight:600;letter-spacing:-.02em;margin:0;line-height:1.2">Network refresh 2026</h1><div class="t2" style="font-size:12.5px;margin-top:3px;display:flex;align-items:center;gap:8px">Lead ${avatar("MK", 16)} Mila Kuipers · Team Infrastructure · <span class="mono">12 Aug → 17 Oct</span></div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <span class="chip" style="height:28px;gap:8px;padding:0 10px"><i style="width:8px;height:8px;border-radius:99px;background:var(--positive)"></i><span style="color:var(--text);font-weight:500">On track</span>${ic("chevd")}</span>
          <span class="btn outline sm" style="height:28px">${ic("star")}</span>
          <span class="btn primary sm" style="height:28px">${ic("plus")}New ticket</span>
          <span class="btn ghost sm" style="height:28px">${ic("dots")}</span>
        </div>
      </div>
      <div style="display:flex;margin-top:10px">${tabRow}</div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;padding:20px 24px">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:18px 20px">
          <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-weight:600">Brief</span><span class="btn ghost sm">Edit</span></div>
          <p style="margin:8px 0 0;font-size:13.5px;line-height:1.6;color:var(--text-2);max-width:640px">Replace every access point and both core switches across the three Utrecht floors before the guest network cut-over in October. Floors go one at a time so at most one floor is degraded on any working day. Firmware is pinned to 8.10.x until the 2F rollback is understood.</p>
        </div>
        <div class="card" style="padding:18px 20px 22px">
          <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-weight:600">Milestones</span><a style="font-size:12px">Manage ${ic("chev")}</a></div>
          ${milestones}
        </div>
        <div class="card" style="overflow:hidden">
          ${cardHead("Open work", `<a style="font-size:12px">All work ${ic("chev")}</a>`)}
          ${[T[0], T[2], T[9], T[6]].map((t) => row(t, { short: true, cols: "120px minmax(0,1fr) 40px 32px 44px" })).join("")}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:16px 18px">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="label">Progress</span><span class="mono t3" style="font-size:11.5px">24 of 35 settled</span></div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-top:8px"><span class="tnum" style="font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1">69%</span><span class="t3" style="font-size:12px">· 11 open · 2 past target</span></div>
          <div style="display:flex;gap:2px;height:8px;margin-top:12px;border-radius:2px;overflow:hidden"><i style="width:69%;background:var(--brand)"></i><i style="width:8%;background:var(--p-high)"></i><i style="flex:1;background:var(--surface-3)"></i></div>
          <div style="display:flex;gap:14px;margin-top:10px;font-size:11.5px" class="t3"><span style="display:flex;align-items:center;gap:5px"><i style="width:8px;height:8px;border-radius:2px;background:var(--brand)"></i>Settled</span><span style="display:flex;align-items:center;gap:5px"><i style="width:8px;height:8px;border-radius:2px;background:var(--p-high)"></i>Past target</span><span style="display:flex;align-items:center;gap:5px"><i style="width:8px;height:8px;border-radius:2px;background:var(--surface-3)"></i>Open</span></div>
        </div>
        <div class="card" style="padding:16px 18px 6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="label">People</span><a style="font-size:12px">Roster</a></div>
          ${member("MK", "Lead · Network engineer", 4)}${member("JB", "Field engineer", 3)}${member("RD", "Security", 2)}${member("TP", "Facilities liaison", 2)}
        </div>
        <div class="card" style="padding:16px 18px 6px">
          <div class="label" style="margin-bottom:4px">Recent activity</div>
          ${act("MK", "rolled back AP firmware on floor 2", "10:12")}${act("AA", "raised INC-2609 0117 to Urgent", "10:02")}${act("JB", "reached milestone Core switches", "29 Aug")}${act("RD", "added a change plan to CHG-2609 0004", "27 Aug")}
        </div>
      </div>
    </div>`;
  return shell("projects", ["Projects", '<span class="ref" style="color:var(--text)">NET</span>'], body);
}

function signinOld(theme) {
  const rows = [
    ["urgent", 0.92, true], ["high", 0.4, false], ["medium", 0.62, false], ["urgent", 0.35, false], ["low", 0.2, false], ["high", 1, true], ["medium", 0.28, false], ["low", 0.6, false], ["medium", 0.7, false], ["high", 0.55, false], ["low", 0.06, false], ["medium", 0.3, false],
  ];
  const graphic = rows.map(([p, h, hot], i) => `
    <div style="display:grid;grid-template-columns:4px 84px 1fr 34px;gap:14px;align-items:center;height:30px;position:relative;opacity:${1 - i * 0.055}">
      <span style="position:relative;height:100%;width:4px;overflow:visible">${spine(p, h, hot).replace('class="spine', 'class="spine grow').replace("style=\"--c", `style="animation-delay:${i * 90}ms;--c`)}</span>
      <span class="ref" style="color:rgba(255,255,255,.35)"><b style="color:rgba(255,255,255,.55)">${["INC", "CHG", "QST"][i % 3]}</b>-2609 0${100 + i * 3}</span>
      <span style="height:6px;border-radius:3px;background:rgba(255,255,255,.06);width:${40 + ((i * 37) % 50)}%"></span>
      ${bars(p).replace('class="bars"', 'class="bars" style="--c:var(--p-' + p + ');opacity:.9"')}
    </div>`).join("");
  const light = theme === "light";
  return `
  <div style="width:1440px;height:900px;display:grid;grid-template-columns:600px 1fr;overflow:hidden;background:var(--bg)">
    <div style="background:#0d0d0c;color:#ecebe6;padding:40px 48px;display:flex;flex-direction:column;position:relative;overflow:hidden;--p-low:#17a892;--p-medium:#8177e8;--p-high:#b87b18;--p-urgent:#db2777">
      <div style="display:flex;align-items:center;gap:10px">${logo(28)}<span style="font-weight:700;font-size:16px;letter-spacing:-.02em">Tiqo</span></div>
      <div style="margin-top:72px;display:flex;flex-direction:column;gap:2px">${graphic}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(180deg,transparent,#0d0d0c 70%)"></div>
      <div style="margin-top:auto;position:relative">
        <p style="font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.25;margin:0;max-width:380px">A ticket system for people who work the queue.</p>
        <p style="color:#a09a90;margin:12px 0 0;font-size:13.5px;max-width:380px">Every row shows how hot it is: colour is priority, fill is how much of its response window has burned.</p>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;background:var(--bg)">
      <div style="width:360px">
        <h1 style="font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0">Welcome back</h1>
        <p class="t2" style="margin:6px 0 28px;font-size:14px">Sign in to pick up where you left off.</p>
        <div style="display:flex;flex-direction:column;gap:16px">
          <label style="display:flex;flex-direction:column;gap:6px"><span class="label">Email</span><div class="input" style="height:38px;font-size:14px"><span>ada@tiqo.local</span></div></label>
          <label style="display:flex;flex-direction:column;gap:6px"><span class="label" style="display:flex;justify-content:space-between">Password<a style="text-transform:none;letter-spacing:0;font-weight:500">Forgot it?</a></span><div class="input" style="height:38px;font-size:14px;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)"><span>••••••••••••</span><span class="t3" style="margin-left:auto;display:flex">${ic("eye")}</span></div></label>
          <span class="btn primary" style="height:40px;justify-content:center;font-size:14px;margin-top:4px">Sign in</span>
          <div class="t3" style="font-size:12.5px;text-align:center">New here? <a style="font-weight:500">Create an account</a></div>
        </div>
        <div style="display:flex;justify-content:center;gap:4px;margin-top:56px"><span class="chip ${light ? "on" : ""}" style="height:26px">${ic("sun")}Light</span><span class="chip ${light ? "" : "on"}" style="height:26px">${ic("moon")}Dark</span><span class="chip" style="height:26px">System</span></div>
      </div>
    </div>
  </div>`;
}

function tokens() {
  const swatch = (name, v) => `<div style="display:flex;flex-direction:column;gap:6px"><span style="height:44px;border-radius:6px;background:${v};border:1px solid var(--line)"></span><span style="font-size:11.5px;font-weight:500">${name}</span><span class="mono t3" style="font-size:11px">${v}</span></div>`;
  const pal = (title, vars) => `<div><div class="label" style="margin-bottom:10px">${title}</div><div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px">${vars.map(([n, v]) => swatch(n, v)).join("")}</div></div>`;
  const type = [["2xl · 26 / 600", "26px", 600, "Good morning, Ada"], ["xl · 20 / 600", "20px", 600, "VPN drops every 20 minutes on the Utrecht office Wi-Fi"], ["lg · 16 / 600", "16px", 600, "Section title"], ["md · 14 / 400", "14px", 400, "Body copy in forms, portal and the conversation."], ["base · 13 / 500", "13px", 500, "List rows, controls, navigation — the desk's working size."], ["sm · 12 / 400", "12px", 400, "Secondary meta, timestamps, hints."], ["xs · 11 / 600 caps", "11px", 600, "COLUMN HEADERS AND LABELS"]];
  return `
  <div style="width:1440px;padding:40px 48px;display:flex;flex-direction:column;gap:36px;background:var(--bg)">
    <div><div style="font-size:20px;font-weight:600;letter-spacing:-.02em">Signal — tokens and parts</div><div class="t2" style="font-size:13px;margin-top:4px">Amber is a signal light on a near-monochrome ground. Priority is the only other hue in the desk.</div></div>
    ${pal("Ground and ink · light (neutral, no warm cast)", [["bg", "#ffffff"], ["chrome (rail, bar)", "#fafafa"], ["surface-2", "#f4f4f5"], ["surface-3", "#e9e9ec"], ["text", "#09090b"], ["text-2", "#52525b"], ["text-3", "#9d9da6"], ["brand-wash", "#fffbeb"]])}
    ${pal("Ground and ink · dark", [["bg", "#09090b"], ["surface", "#121214"], ["surface-2", "#18181b"], ["surface-3", "#232326"], ["text", "#fafafa"], ["text-2", "#a1a1aa"], ["text-3", "#6b6b74"], ["brand-wash", "#1a170e"]])}
    ${pal("Signal · amber is the only warm neutral-adjacent hue; priority hues share one chroma", [["brand", "#febe2e"], ["brand-deep (light)", "#b7790a"], ["low", "var(--p-low)"], ["medium", "var(--p-medium)"], ["high", "var(--p-high)"], ["urgent", "var(--p-urgent)"], ["positive", "var(--positive)"], ["negative", "var(--negative)"]])}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
      <div><div class="label" style="margin-bottom:12px">Type · Geist + Geist Mono</div><div style="display:flex;flex-direction:column;gap:14px">${type.map(([l, s, w, t]) => `<div style="display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:baseline"><span class="mono t3" style="font-size:11px">${l}</span><span style="font-size:${s};font-weight:${w};letter-spacing:${parseInt(s) >= 20 ? "-.02em" : parseInt(s) <= 11 ? ".06em" : "0"}">${t}</span></div>`).join("")}
        <div style="display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:baseline"><span class="mono t3" style="font-size:11px">mono · 12</span><span>${ref("INC-2609 0117")} &nbsp; ${ref("CHG-2609 0003")} &nbsp; ${ref("QST-2609 0122")} &nbsp; <span class="mono">09:34 · 0h 19m · 39/45</span></span></div></div></div>
      <div style="display:flex;flex-direction:column;gap:22px">
        <div><div class="label" style="margin-bottom:12px">Priority as signal bars</div><div style="display:flex;gap:28px;align-items:center">${["low", "medium", "high", "urgent"].map((p) => `<span style="display:flex;align-items:center;gap:8px;text-transform:capitalize">${bars(p)}${p}</span>`).join("")}</div></div>
        <div><div class="label" style="margin-bottom:12px">Status as a ring</div><div style="display:flex;gap:28px;align-items:center">${Object.keys(STATUS).map((s) => status(s)).join("")}</div></div>
        <div><div class="label" style="margin-bottom:12px">Heat spine · colour is priority, fill is time burned, glow is past target</div><div style="display:flex;gap:20px;height:40px">${[["low", 0.1], ["medium", 0.5], ["high", 0.8], ["urgent", 0.92, true], ["high", 1, true]].map(([p, h, hot]) => `<span style="position:relative;width:4px;height:40px">${spine(p, h, hot)}</span>`).join("")}</div></div>
        <div><div class="label" style="margin-bottom:12px">Controls · 6px radius, 28–32px tall</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="btn primary">${ic("plus")}New ticket<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">⌘N</kbd></span><span class="btn outline">Outline</span><span class="btn ghost">Ghost</span><span class="btn outline" style="color:var(--negative);border-color:color-mix(in oklab,var(--negative) 40%,transparent)">Delete</span><div class="input" style="width:200px"><span class="ph">Placeholder</span></div><div class="input" style="width:160px;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)"><span>Focused</span></div><span class="chip">Any status${ic("chevd")}</span><span class="chip on">Mine<span class="mono t3" style="font-size:11px">8</span></span><span class="tag">network</span>${avatar("MK")}${avatar(null)}</div></div>
        <div><div class="label" style="margin-bottom:12px">Radii · control 8 · card 12 · panel 16 · chips and tags are pills</div><div style="display:flex;gap:12px;align-items:flex-end">${[8, 12, 16, 999].map((r) => `<span style="width:${40 + r * 3}px;height:${40 + r * 3}px;border-radius:${r}px;border:1px solid var(--line-strong);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:11px" class="mono t3">${r}</span>`).join("")}</div></div>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- write */

function page(theme, body, extraCss = "") {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT}
  <style>
    :root { ${THEMES[theme]} }
    ${BASE_CSS}
    ${extraCss}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>`;
}

const GROW = `
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .field span:not(.mono) { transform-origin: bottom; animation: grow 1100ms cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i, 0) * 16ms); }
  @media (prefers-reduced-motion: reduce) { .field span { animation: none; } }
`;

const boards = [
  ["Main", "dark", dashboard(), 1440, 900, "Dashboard · dark"],
  ["DashboardLight", "light", dashboard(), 1440, 900, "Dashboard · light"],
  ["Queue", "dark", queue({ hover: 2 }), 1440, 900, "Queue · dark (row hover)"],
  ["QueueLight", "light", queue({ hover: 2 }), 1440, 900, "Queue · light"],
  ["CommandPalette", "dark", queue({ palette: true }), 1440, 900, "⌘K palette"],
  ["Ticket", "dark", ticket2("incident"), 1440, 900, "Incident ticket · dark"],
  ["TicketLight", "light", ticket2("incident"), 1440, 900, "Incident ticket · light"],
  ["ChangeTicket", "dark", ticket2("change"), 1440, 900, "Change ticket · dark"],
  ["ChangeTicketLight", "light", ticket2("change"), 1440, 900, "Change ticket · light"],
  ["Plan", "dark", plan(), 1440, 900, "Change plan · dark"],
  ["PlanLight", "light", plan(), 1440, 900, "Change plan · light"],
  ["Project", "dark", project(), 1440, 900, "Project overview · dark"],
  ["ProjectLight", "light", project(), 1440, 900, "Project overview · light"],
  ["Settings", "light", settings(), 1440, 900, "Settings · Tickets · light"],
  ["SettingsDark", "dark", settings(), 1440, 900, "Settings · Tickets · dark"],
  ["PortalSettings", "light", portalSettings(), 1440, 900, "Settings · Portal · Forms · light"],
  ["PortalSettingsDark", "dark", portalSettings(), 1440, 900, "Settings · Portal · Forms · dark"],
  ["Portal", "light", portal(), 1440, 900, "Portal · light"],
  ["PortalDark", "dark", portal(), 1440, 900, "Portal · dark"],
  ["SignIn", "light", signin("light"), 1440, 900, "Sign-in · light"],
  ["SignInDark", "dark", signin("dark"), 1440, 900, "Sign-in · dark"],
  ["Tokens", "light", tokens(), 1440, 1120, "Tokens and parts"],
];

const layout = [];
let y = 0;
const rowsOf = [["Main", "DashboardLight"], ["Queue", "QueueLight", "CommandPalette"], ["Ticket", "TicketLight"], ["ChangeTicket", "ChangeTicketLight"], ["Plan", "PlanLight"], ["Project", "ProjectLight"], ["Settings", "SettingsDark"], ["PortalSettings", "PortalSettingsDark"], ["Portal", "PortalDark"], ["SignIn", "SignInDark"], ["Tokens"]];
for (const r of rowsOf) {
  let x = 0;
  let h = 0;
  for (const name of r) {
    const b = boards.find((b) => b[0] === name);
    layout.push({ file: `${name}.dc.html`, x, y, w: b[3], h: b[4], title: b[5] });
    x += b[3] + 120;
    h = Math.max(h, b[4]);
  }
  y += h + 180;
}

for (const [name, theme, body] of boards) {
  writeFileSync(join(out, `${name}.dc.html`), page(theme, body, /^(SignIn|Portal)(Dark)?$/.test(name) ? GROW : ""));
}
writeFileSync(
  join(out, "canvas.json"),
  JSON.stringify(
    {
      artboards: layout,
      annotations: [
        { id: "brief", x: 0, y: -190, w: 560, text: "Tiqo — “Signal” direction, round 4.\nCool neutral greys (no warm cast) with amber as the single warm signal. Priority = signal bars in one-chroma hues (emerald / indigo / orange / rose). Status = ring. Heat spine = 4px, glows past target.\nGeist + Geist Mono · 13px working size · controls 8 / cards 12 / pills · 48px bar · 220px rail." },
        { id: "note-queue", x: 3120, y: 1080 - 70, w: 320, text: "⌘K replaces the search box: same data as today's global search, plus actions." },
        { id: "note-ticket", x: 0, y: 2160 - 70, w: 520, text: "Ticket, round 5: toolbar keeps Plan / Activity / prev-next over the rail. Internal notes are amber-washed blocks with a lock. Events are icon rows grouped between hairlines. Composer is one collapsed line that expands on focus. Rail: properties as value pills (a dirty one is amber-tinted, Save/Discard appear), requester with company / department / phone / hours, response target, activity list." },
        { id: "note-change", x: 0, y: 3240 - 70, w: 520, text: "A change is the same page plus a Plan card between the request and the conversation: four phases, the current one highlighted, the blocked step called out. The toolbar's Plan button and the rail's Plan property open the full plan page (next row)." },
        { id: "note-signin", x: 0, y: 9720 - 60, w: 460, text: "Sign-in: the stock photo is gone. The left panel is the product's own graphic — a field of tickets rising toward the response target line; anything over it glows. Bars rise on load; static under reduced motion." },
        { id: "note-portal", x: 0, y: 8640 - 60, w: 460, text: "Portal: left-aligned hero on the brand wash with the same signal field fading in from the right; four quick starts; catalogue as a list, desk status + your requests on the right." },
      ],
      launch: { view: "canvas" },
    },
    null,
    2,
  ),
);
console.log(`wrote ${boards.length} artboards to ${out}`);
