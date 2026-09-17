// Shared Signal vocabulary, lifted verbatim from the round-7 generator.
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
export { THEMES, FONT, BASE_CSS, I, ic, PRI, bars, STATUS, STATUS_NAME, ring, status, AV, AV_NAME, avatar, ref, spine, T, rail, logo, bar, shell, row, columns, sparkline, cardHead, signalField, page, GROW };
