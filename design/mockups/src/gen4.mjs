// Round 10: assets, documentation, mail settings and change templates, after
// the September hardening. Same vocabulary as rounds 1–9 (shared.mjs); the
// boards land on a second canvas page. Usage: node gen4.mjs <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { I, bars, ring, status, avatar, AV_NAME, ref, page, logo } from "./shared.mjs";

const out = process.argv[2];
if (!out) throw new Error("usage: node gen4.mjs <outDir>");
mkdirSync(out, { recursive: true });

/* ------------------------------------------------------------------- icons */

const I4 = {
  box: '<path d="m8 2.5 5.5 3v5L8 13.5l-5.5-3v-5z"/><path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5"/>',
  book: '<path d="M2.5 3.5a2 2 0 0 1 2-2h9v11h-9a2 2 0 0 0-2 2z"/><path d="M4.5 12.5h9"/>',
  stamp: '<path d="M5 9V6a3 3 0 0 1 6 0v3"/><rect x="2.5" y="9" width="11" height="3" rx="1"/><path d="M4 12v2h8v-2"/>',
  shield: '<path d="M8 1.8 13 3.8v4c0 3-2.2 5.2-5 6.4-2.8-1.2-5-3.4-5-6.4v-4z"/>',
  wifi: '<path d="M2 6.5a9 9 0 0 1 12 0M4.5 9a5.5 5.5 0 0 1 7 0M6.8 11.3a2 2 0 0 1 2.4 0"/><circle cx="8" cy="13" r=".6" fill="currentColor"/>',
  server: '<rect x="2.5" y="2.5" width="11" height="4.5" rx="1"/><rect x="2.5" y="9" width="11" height="4.5" rx="1"/><path d="M5 4.75h.1M5 11.25h.1"/>',
  print: '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-4a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v4h-2"/><rect x="4.5" y="9.5" width="7" height="4"/>',
  edit: '<path d="m10.5 2.5 3 3-7.5 7.5H3v-3z"/>',
  link: '<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  chevu: '<path d="m4 10 4-4 4 4"/>',
  archive: '<rect x="2" y="3" width="12" height="3" rx="1"/><path d="M3 6v7h10V6M6.5 9h3"/>',
  warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2v.1"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.5v3.5M8 5.2v.1"/>',
  download: '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>',
  upload: '<path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10"/>',
  columns: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M6.2 3v10M9.8 3v10"/>',
  sort: '<path d="M5 3v10M5 13l-2-2M5 13l2-2M11 13V3M11 3 9 5M11 3l2 2"/>',
  filter: '<path d="M2.5 3.5h11l-4.5 5v4l-2 1v-5z"/>',
  qr: '<rect x="2.5" y="2.5" width="4.5" height="4.5"/><rect x="9" y="2.5" width="4.5" height="4.5"/><rect x="2.5" y="9" width="4.5" height="4.5"/><path d="M9 9h2v2H9zM12 9h1.5M9 13.5h1.5M12 12h1.5v1.5"/>',
  paper: '<path d="M3 2.5h7l3 3v8H3z"/><path d="M10 2.5v3h3M5.5 8.5h5M5.5 11h3"/>',
  diff: '<path d="M4 2.5v11M4 13.5l-1.5-1.5M4 13.5l1.5-1.5M12 2.5v11M12 2.5l-1.5 1.5M12 2.5l1.5 1.5"/>',
  check2: '<path d="m2.5 8.5 3 3 4-6M8.5 11.5l5-6.5"/>',
  text: '<path d="M3 3.5h10M8 3.5v9"/>',
  bold: '<path d="M5 3h4a2.3 2.3 0 0 1 0 4.6H5zM5 7.6h4.8a2.5 2.5 0 0 1 0 5H5z"/>',
  italic: '<path d="M9 3h3M4 13h3M9.5 3l-3 10"/>',
  code: '<path d="m5 5-3 3 3 3M11 5l3 3-3 3M9.5 3l-3 10"/>',
  image: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="m3 12 3.5-3.5 2.5 2.5 2-2 2.5 2.5"/>',
  paperclip: '<path d="m11.5 6.5-5 5a2.1 2.1 0 0 1-3-3l5.5-5.5a1.4 1.4 0 0 1 2 2L5.5 10.5"/>',
  list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".8"/><circle cx="2.8" cy="8" r=".8"/><circle cx="2.8" cy="12" r=".8"/>',
  h: '<path d="M3 3v10M13 3v10M3 8h10"/>',
  grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
  rows: '<rect x="2.5" y="3" width="11" height="3.5" rx="1"/><rect x="2.5" y="9.5" width="11" height="3.5" rx="1"/>',
  play: '<path d="M5 3.5v9l7-4.5z"/>',
  refresh: '<path d="M13 8a5 5 0 0 1-8.7 3.4M3 8a5 5 0 0 1 8.7-3.4"/><path d="M11.5 2v3h-3M4.5 14v-3h3"/>',
  move: '<path d="M8 2v12M2 8h12M8 2 6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2"/>',
  drag: '<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>',
  people: '<circle cx="6" cy="5.5" r="2.2"/><path d="M2.5 13c0-2 1.6-3.5 3.5-3.5S9.5 11 9.5 13"/><path d="M10.5 3.6a2.2 2.2 0 0 1 0 3.9M11 9.6c1.5.4 2.5 1.8 2.5 3.4"/>',
  history: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.5 2.5v3h3M8 5v3.2l2 1.3"/>',
  key: '<circle cx="5.5" cy="10.5" r="2.5"/><path d="m7.3 8.7 6-6M11 4.5l1.5 1.5M9.5 6l1.5 1.5"/>',
  laptop: '<rect x="3" y="3.5" width="10" height="7" rx="1"/><path d="M1.5 13h13"/>',
  layers: '<path d="m8 2.5 6 3-6 3-6-3z"/><path d="m2 8.5 6 3 6-3M2 11.5l6 3 6-3"/>',
  mailx: '<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m2.5 4.5 5.5 4 5.5-4"/>',
  inbox: '<path d="M2.5 8.5 4 3.5h8l1.5 5v4h-11z"/><path d="M2.5 8.5h3.2l1 2h2.6l1-2h3.2"/>',
  send: '<path d="m2.5 8 11-5-3 11-2.5-4.5z"/><path d="m8 9.5 5.5-6.5"/>',
  chevr: '<path d="m6 4 4 4-4 4"/>',
  maximize: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
  eyeoff: '<path d="M2 2l12 12M6.3 6.4A2 2 0 0 0 9.6 9.6M4.5 4.7C2.6 5.9 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.1 0 2.1-.3 3-.8M7 3.6c.3 0 .7-.1 1-.1 4 0 6.5 4.5 6.5 4.5s-.7 1.3-2 2.5"/>',
};
const ic = (n, cls = "", size) => `<svg class="i ${cls}" viewBox="0 0 16 16"${size ? ` style="width:${size}px;height:${size}px"` : ""}>${I4[n] ?? I[n]}</svg>`;

/* ------------------------------------------------------------------- bits */

const h1 = (t, size = 20) => `<h1 style="font-size:${size}px;font-weight:600;letter-spacing:-.02em;margin:0;line-height:1.2">${t}</h1>`;
const cardHead = (label, right = "") =>
  `<div style="display:flex;align-items:center;justify-content:space-between;height:34px;padding:0 14px;border-bottom:1px solid var(--line);flex:none"><span class="label">${label}</span>${right}</div>`;
const card = (head, body, style = "") => `<div class="card" style="overflow:hidden;flex:none;display:flex;flex-direction:column;${style}">${head}${body}</div>`;
const iconBtn = (i, title = "", extra = "") => `<span class="btn ghost sm" style="width:26px;padding:0;justify-content:center;${extra}" title="${title}">${ic(i)}</span>`;
const linkA = (t, i) => `<a style="font-size:11.5px;display:inline-flex;align-items:center;gap:4px">${i ? ic(i) : ""}${t}</a>`;
const field = (label, control, opts = {}) =>
  `<div style="display:flex;flex-direction:column;gap:5px;${opts.style ?? ""}"><span class="label" style="font-size:10.5px;display:flex;gap:4px">${label}${opts.req ? '<span style="color:var(--negative)">*</span>' : ""}</span>${control}${opts.hint ? `<span class="t3" style="font-size:11.5px;line-height:1.4">${opts.hint}</span>` : ""}</div>`;
const input = (v, opts = {}) =>
  `<div class="input" style="height:${opts.h ?? 30}px;${opts.dirty ? "border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint);" : ""}${opts.style ?? ""}">${opts.icon ? `<span class="t3" style="display:flex">${ic(opts.icon)}</span>` : ""}<span class="${opts.ph ? "ph" : ""}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;${opts.mono ? "font-family:'Geist Mono',monospace;font-size:12px" : ""}">${v}</span>${opts.right ?? ""}</div>`;
const select = (v, opts = {}) => input(v, { ...opts, right: `<span class="t3" style="display:flex">${ic("chevd")}</span>` });
const textarea = (v, rows = 4, opts = {}) =>
  `<div class="input" style="height:${rows * 20 + 16}px;align-items:flex-start;padding:8px 10px;white-space:normal;line-height:1.5;${opts.dirty ? "border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint);" : ""}${opts.style ?? ""}"><span class="${opts.ph ? "ph" : ""}" style="white-space:pre-wrap">${v}</span></div>`;
const checkbox = (label, on, opts = {}) =>
  `<label style="display:flex;align-items:center;gap:8px;font-size:${opts.size ?? 12.5}px;${opts.style ?? ""}"><span style="width:15px;height:15px;border-radius:4px;border:1px solid ${on ? "var(--brand)" : "var(--line-strong)"};background:${on ? "var(--brand)" : "var(--paper)"};display:flex;align-items:center;justify-content:center;color:var(--brand-ink);flex:none">${on ? '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3 3 7-7"/></svg>' : ""}</span>${label}</label>`;
const check = (on, mixed = false) =>
  `<span style="width:15px;height:15px;border-radius:4px;border:1px solid ${on || mixed ? "var(--brand)" : "var(--line-strong)"};background:${on || mixed ? "var(--brand)" : "var(--paper)"};display:inline-flex;align-items:center;justify-content:center;color:var(--brand-ink);flex:none">${on ? '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3 3 7-7"/></svg>' : mixed ? '<i style="width:7px;height:2px;background:currentColor;border-radius:1px"></i>' : ""}</span>`;
const dotpill = (color, label, extra = "", h = 26) =>
  `<span class="chip" style="height:${h}px;gap:7px;padding:0 9px"><i style="width:7px;height:7px;border-radius:99px;background:${color};flex:none"></i><span style="color:var(--text);font-weight:500">${label}</span>${extra}</span>`;
const tag = (t, tone) => `<span class="tag" style="${tone === "brand" ? "background:var(--brand-tint);color:var(--brand-deep)" : tone === "neg" ? "background:color-mix(in oklab,var(--negative) 12%,transparent);color:var(--negative)" : tone === "pos" ? "background:color-mix(in oklab,var(--positive) 12%,transparent);color:var(--positive)" : ""}">${t}</span>`;
const saveFoot = (summary, opts = {}) =>
  `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--line);background:var(--surface-2)"><span class="btn primary sm">${ic("check")}Save</span><span class="btn ghost sm">Cancel</span><span class="t3" style="font-size:11.5px;margin-left:auto;display:flex;align-items:center;gap:6px"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>${summary}</span></div>`;
const savedFoot = () =>
  `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--line)"><span class="btn outline sm" style="opacity:.5">${ic("check")}Save</span><span class="t3" style="font-size:11.5px;display:flex;align-items:center;gap:5px;color:var(--positive)">${ic("check")}Saved just now</span></div>`;
const tabRow = (items, on) =>
  `<div style="display:flex;border-bottom:1px solid var(--line);padding:0 24px">${items.map(([n, c]) => `<span style="display:flex;align-items:center;gap:7px;height:38px;margin-right:22px;font-size:12.5px;font-weight:500;color:${n === on ? "var(--text)" : "var(--text-2)"};border-bottom:2px solid ${n === on ? "var(--brand)" : "transparent"}">${n}${c ? `<span class="mono t3" style="font-size:11px">${c}</span>` : ""}</span>`).join("")}</div>`;
const kv = (rows, cols = "110px 1fr", pad = "12px 14px") =>
  `<div style="display:grid;grid-template-columns:${cols};gap:7px 12px;padding:${pad};font-size:12.5px;align-items:center">${rows.map(([k, v]) => `<span class="t3" style="font-size:11.5px">${k}</span><span style="min-width:0;display:flex;align-items:center;gap:6px">${v}</span>`).join("")}</div>`;
const segToggle = (items, on) => `<span class="seg">${items.map((i) => `<span class="chip ${i === on ? "on" : ""}" style="height:24px;font-size:11.5px">${i}</span>`).join("")}</span>`;
const searchBox = (ph, w = 240, h = 30) => `<div class="input" style="width:${w}px;height:${h}px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">${ph}</span></div>`;

/* ----------------------------------------------------------------- shell */

function rail(active) {
  const item = (key, icon, label, extra = "") => `<a class="${active === key ? "on" : ""}">${ic(icon)}<span>${label}</span>${extra}</a>`;
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
      ${item("approvals", "stamp", "Approvals", '<span class="n">2</span>')}
      ${item("assets", "box", "Assets", "<kbd>G A</kbd>")}
      ${item("docs", "book", "Documentation", "<kbd>G W</kbd>")}
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
function bar(crumbs, extra = "") {
  const crumb = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span style="color:var(--text);font-weight:500">${c}</span>` : `<span class="t3">${c}</span><span class="t3" style="display:flex">${ic("chev")}</span>`)).join("");
  return `
  <header class="bar">
    <div style="display:flex;align-items:center;gap:6px;font-size:13px">${crumb}</div>
    ${extra}
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      <div class="input" style="width:260px;height:30px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search tickets, assets, pages…</span><kbd style="margin-left:auto">⌘K</kbd></div>
      <span class="btn primary" style="height:30px">${ic("plus")}New<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">⌘N</kbd></span>
      <span style="width:1px;height:20px;background:var(--line)"></span>
      <span class="btn ghost" style="width:30px;padding:0;justify-content:center;position:relative">${ic("bell")}<i style="position:absolute;top:6px;right:7px;width:6px;height:6px;border-radius:99px;background:var(--brand);box-shadow:0 0 0 2px var(--bg)"></i></span>
      ${avatar("AA", 26)}
    </div>
  </header>`;
}
const shell = (active, crumbs, body, h = 900) => `<div class="shell" style="height:${h}px">${rail(active)}${bar(crumbs)}<div class="main">${body}</div></div>`;

function settingsShell(active, body, h = 900) {
  const items = ["General", "Tickets", "Portal", "Change templates", "Operator groups", "Asset types", "Documentation", "Tags", "Blocked words", "Mail", "Roles"];
  const nav = items.map((n) => `<a class="${n === active ? "on" : ""}" style="height:30px">${n}</a>`).join("");
  return shell("settings", ["Settings", active], `
    <div class="pagehead"><h1>Settings</h1><span class="t3" style="font-size:12.5px">How this desk behaves, for everyone who uses it</span></div>
    <div style="display:grid;grid-template-columns:200px 1fr;height:${h - 96}px">
      <nav class="nav" style="display:flex;flex-direction:column;gap:2px;padding:16px 12px;border-right:1px solid var(--line)">${nav}</nav>
      <div style="position:relative;overflow:hidden">${body}</div>
    </div>`, h);
}
const section = (title, blurb, content, opts = {}) => `
  <section style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px;padding:24px 32px;${opts.first ? "" : "border-top:1px solid var(--line)"}">
    <div><h2 style="font-size:13.5px;font-weight:600;margin:0">${title}</h2><p class="t3" style="margin:5px 0 0;font-size:12px;line-height:1.5">${blurb}</p></div>
    <div style="min-width:0">${content}</div>
  </section>`;

/* ------------------------------------------------------------------- data */

const TYPES = {
  hw: { n: "Hardware", i: "laptop", c: "#febe2e", count: 7 },
  net: { n: "Network", i: "wifi", c: "#6366f1", count: 1 },
  cert: { n: "Certificate", i: "shield", c: "#0ea5e9", count: 2 },
  lic: { n: "Licence", i: "key", c: "#10b981", count: 3 },
};
const LIFE = { service: ["var(--positive)", "In service"], maint: ["var(--brand)", "Maintenance"], planned: ["var(--p-medium)", "Planned"], retired: ["var(--text-3)", "Retired"] };
const ASSETS = [
  { n: "SRV-APP-01", sub: "HPE ProLiant DL360 · 5CG2140XYZ", t: "hw", l: "service", g: "Infrastructure", exp: ["11 Mar 2027", "Warranty · 18 mo", ""], open: 2, upd: "Today" },
  { n: "SRV-DB-01", sub: "Dell PowerEdge R750 · 7HK3P2", t: "hw", l: "service", g: "Infrastructure", exp: ["02 Nov 2026", "Warranty · 7 wk", "warn"], open: 0, upd: "Yesterday" },
  { n: "*.tiqo.it", sub: "Wildcard · Sectigo", t: "cert", l: "service", g: "Infrastructure", exp: ["07 Oct 2026", "Expires · 23 d", "warn"], open: 0, upd: "12 Sep" },
  { n: "LT-LOAN-02", sub: "ThinkPad T14 · PF3K9X", t: "hw", l: "maint", g: "Service desk", exp: ["19 Jun 2027", "Warranty", ""], open: 1, upd: "Today" },
  { n: "Microsoft 365 E3", sub: "120 seats · annual", t: "lic", l: "service", g: "Service desk", exp: ["25 Oct 2026", "Renews · 41 d", ""], open: 0, upd: "3 Sep" },
  { n: "SW-RACK-B", sub: "Aruba 6300M · rack B", t: "net", l: "service", g: "Infrastructure", exp: ["—", "", ""], open: 1, upd: "Today" },
  { n: "LT-ADA", sub: "MacBook Pro 14 · C02XY", t: "hw", l: "service", g: "Service desk", exp: ["30 Jan 2028", "Warranty", ""], open: 0, upd: "8 Sep" },
  { n: "PRN-2F", sub: "Canon iR-ADV C3530", t: "hw", l: "service", g: "Facilities", exp: ["—", "", ""], open: 0, upd: "8 Sep" },
  { n: "vpn.tiqo.it", sub: "RSA 2048 · Sectigo", t: "cert", l: "service", g: "Infrastructure", exp: ["08 Feb 2027", "Expires", ""], open: 0, upd: "12 Sep" },
  { n: "Adobe Creative Cloud", sub: "15 seats · monthly", t: "lic", l: "service", g: "Service desk", exp: ["01 Oct 2026", "Renews · 17 d", "warn"], open: 0, upd: "1 Sep" },
  { n: "SRV-MAIL-01", sub: "HP DL380 G9 · decommissioned", t: "hw", l: "retired", g: "Infrastructure", exp: ["14 Jan 2024", "Warranty · lapsed", "neg"], open: 0, upd: "Jul" },
  { n: "Atlassian JSM", sub: "Replaced by Tiqo", t: "lic", l: "retired", g: "Service desk", exp: ["31 Aug 2026", "Lapsed", "neg"], open: 0, upd: "Aug" },
];
const glyph = (t, size = 22, r = 6) => {
  const { i, c } = TYPES[t];
  return `<span style="width:${size}px;height:${size}px;border-radius:${r}px;background:color-mix(in oklab,${c} 16%,transparent);color:${c};display:inline-flex;align-items:center;justify-content:center;flex:none">${ic(i, "", Math.round(size * 0.6))}</span>`;
};
const life = (l, h = 24) => dotpill(LIFE[l][0], LIFE[l][1], "", h);
const openPill = (n) => (n ? `<span class="tag" style="background:color-mix(in oklab,var(--p-urgent) 14%,transparent);color:var(--p-urgent)">${ring("progress").replace("var(--p-medium)", "currentColor")} ${n} open</span>` : '<span class="t3">—</span>');
const expCell = (e) =>
  e[0] === "—"
    ? '<span class="t3">—</span>'
    : `<span style="display:flex;flex-direction:column;line-height:1.3"><span class="mono tnum" style="font-size:12px;color:${e[2] === "warn" ? "var(--brand-deep)" : e[2] === "neg" ? "var(--negative)" : "var(--text)"}">${e[0]}</span><span class="t3" style="font-size:11px">${e[1]}</span></span>`;

/* ====================================================================== */
/*                          ASSETS — the register                          */
/* ====================================================================== */

function typeSidebar(active = "all", withViews = true) {
  const item = (k, label, n, icon, color) =>
    `<a class="${active === k ? "on" : ""}" style="height:30px;font-size:12.5px">${color ? `<span style="width:16px;height:16px;border-radius:5px;background:color-mix(in oklab,${color} 16%,transparent);color:${color};display:inline-flex;align-items:center;justify-content:center">${ic(icon, "", 10)}</span>` : ic(icon)}<span>${label}</span><span class="n">${n}</span></a>`;
  return `
  <div class="nav" style="display:flex;flex-direction:column;gap:2px;padding:14px 10px;border-right:1px solid var(--line);background:var(--chrome)">
    ${item("all", "All types", 13, "layers")}
    ${Object.entries(TYPES).map(([k, t]) => item(k, t.n, t.count, t.i, t.c)).join("")}
    ${withViews ? `
    <div class="sec" style="margin-top:8px">Saved views</div>
    ${item("exp", "Expiring in 30 days", 3, "clock")}
    ${item("open", "With open tickets", 3, "ticket")}
    ${item("ret", "Retired", 2, "archive")}
    <a style="height:28px;font-size:12px;color:var(--text-3)">${ic("plus")}Save current view</a>` : ""}
    <div style="margin-top:auto;padding:10px 10px 4px" class="t3">
      <div class="label" style="font-size:10px;margin-bottom:6px">Lifecycle</div>
      <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px"><i style="flex:9;background:var(--positive)"></i><i style="flex:1;background:var(--brand)"></i><i style="flex:2;background:var(--text-3)"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-top:5px"><span>9 in service</span><span>1 maint</span><span>2 retired</span></div>
    </div>
  </div>`;
}

function assetRow(a, o = {}) {
  const cols = o.cols ?? "22px 30px minmax(0,1fr) 110px 128px 120px 150px 90px 70px";
  return `
  <div style="display:grid;grid-template-columns:${cols};align-items:center;gap:12px;height:48px;padding:0 20px;border-bottom:1px solid var(--line);background:${o.selected ? "var(--brand-tint)" : o.active ? "var(--surface-2)" : "transparent"};opacity:${a.l === "retired" ? 0.6 : 1};position:relative">
    ${o.active ? '<i style="position:absolute;left:0;top:8px;bottom:8px;width:2px;background:var(--brand);border-radius:0 2px 2px 0"></i>' : ""}
    ${check(!!o.selected)}
    ${glyph(a.t, 26, 7)}
    <div style="min-width:0;line-height:1.25"><div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.n}</div><div class="t3 mono" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.sub}</div></div>
    <span class="t2" style="font-size:12.5px">${TYPES[a.t].n}</span>
    ${life(a.l)}
    ${o.compact ? "" : `<span class="t2" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.g}</span>${expCell(a.exp)}<span>${openPill(a.open)}</span><span class="mono t3" style="font-size:11.5px;text-align:right">${a.upd}</span>`}
  </div>`;
}
const assetColumns = (cols, compact = false) => `
  <div class="label" style="display:grid;grid-template-columns:${cols};gap:12px;height:34px;align-items:center;padding:0 20px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;font-size:10.5px">
    ${check(false, true)}<span></span><span style="display:flex;align-items:center;gap:4px;color:var(--text)">Name ${ic("chevu", "", 11)}</span><span>Type</span><span>Lifecycle</span>${compact ? "" : "<span>Operator group</span><span>Expires / warranty</span><span>Tickets</span><span style=\"text-align:right\">Updated</span>"}
  </div>`;

function registerB() {
  const cols = "22px 30px minmax(0,1fr) 100px 120px";
  const a = ASSETS[0];
  const peek = `
  <aside style="border-left:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:12px;overflow:hidden">
    <div class="card" style="overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 14px 12px">
        ${glyph(a.t, 40, 10)}
        <div style="min-width:0;line-height:1.25;flex:1"><div style="font-weight:600;font-size:15px">${a.n}</div><div class="t2" style="font-size:12px;margin-top:2px">Hardware · Infrastructure</div></div>
        ${life(a.l)}
      </div>
      <div style="display:flex;gap:6px;padding:0 14px 12px">
        <span class="btn primary sm" style="flex:1;justify-content:center">${ic("maximize")}Open</span>
        <span class="btn outline sm" style="flex:1;justify-content:center">${ic("edit")}Edit</span>
        <span class="btn outline sm" style="width:26px;padding:0;justify-content:center">${ic("dots")}</span>
      </div>
      <div style="border-top:1px solid var(--line)">${kv([
        ["Serial", '<span class="mono" style="font-size:12px">5CG2140XYZ</span>'],
        ["Model", "HPE ProLiant DL360"],
        ["Form factor", "Server"],
        ["Purchased", '<span class="mono" style="font-size:12px">11 Mar 2024</span>'],
        ["Warranty", `<span style="display:flex;flex-direction:column;gap:5px;flex:1"><span class="mono" style="font-size:12px">11 Mar 2027 <span class="t3">· 18 months left</span></span><span style="height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden"><i style="display:block;height:100%;width:50%;background:var(--positive)"></i></span></span>`],
        ["Primary user", `${avatar("MK", 16)} Mila Kuipers`],
        ["Mounted in", `<a style="display:inline-flex;align-items:center;gap:5px">${glyph("net", 16, 4)}SW-RACK-B</a>`],
        ["Source", '<span class="mono t3" style="font-size:11px">seed · srv-app-01</span>'],
      ])}</div>
    </div>
    ${card(cardHead("Connected to", linkA("Add", "plus")), `<div style="padding:6px 0">${[["Depends on", "SRV-DB-01", "hw"], ["Runs", "*.tiqo.it", "cert"], ["Mounted in", "SW-RACK-B", "net"]].map(([v, n, t]) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12.5px">${glyph(t, 18, 5)}<span style="display:flex;flex-direction:column;line-height:1.2"><span class="t3" style="font-size:10.5px">${v}</span><span style="font-weight:500">${n}</span></span></div>`).join("")}</div>`)}
    ${card(cardHead("Open tickets", '<span class="mono t3" style="font-size:11px">2 of 5</span>'), `<div style="padding:4px 0">${[["INC-2609 0017", "Rack B switch running hot", "urgent", "progress"], ["QST-2609 0002", "Laptop will not charge", "medium", "new"]].map(([r, t, p, s]) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 14px;font-size:12px">${ring(s)}<span style="min-width:0;display:flex;flex-direction:column;line-height:1.2">${ref(r)}<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span></span><span style="margin-left:auto">${bars(p)}</span></div>`).join("")}
      <div style="display:flex;align-items:center;gap:8px;margin:6px 14px 10px;padding:8px 10px;border-radius:8px;background:var(--brand-tint);font-size:11.5px;color:var(--brand-deep)">${ic("warn", "", 13)}<span>Also open nearby: <b>INC-2609 0014</b> on SW-RACK-B, which this depends on.</span></div></div>`)}
  </aside>`;
  const body = `
  <div class="pagehead">
    <h1>Assets</h1><span class="mono t3" style="font-size:11.5px">13 items</span>
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      ${searchBox("Search name, serial or attribute", 250)}
      <span class="seg"><span class="chip" style="height:26px">${ic("rows", "", 12)}List</span><span class="chip on" style="height:26px">${ic("panel", "", 12)}Split</span></span>
      <span class="btn outline sm" style="height:30px">${ic("download")}Export</span>
      <span class="btn primary sm" style="height:30px">${ic("plus")}New asset</span>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:200px minmax(0,1fr) 400px;height:852px">
    ${typeSidebar("hw", true)}
    <div style="overflow:hidden;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 20px;border-bottom:1px solid var(--line);flex:none">
        <span class="chip on" style="height:26px">Hardware ${ic("x", "", 11)}</span><span class="chip" style="height:26px">Any lifecycle ${ic("chevd", "t3", 12)}</span><span class="chip" style="height:26px">Any group ${ic("chevd", "t3", 12)}</span>
        <span class="mono t3" style="font-size:11.5px;margin-left:auto">1–7 of 7</span>
      </div>
      ${assetColumns(cols, true)}
      ${ASSETS.filter((x) => x.t === "hw").map((x) => assetRow(x, { cols, compact: true, active: x.n === a.n })).join("")}
    </div>
    ${peek}
  </div>`;
  return shell("assets", ["Assets"], body);
}

/* ====================================================================== */
/*                            ASSETS — one item                            */
/* ====================================================================== */

const HIST = [
  ["link", "<b>Ada</b> connected this to <b>SW-RACK-B</b> (mounted in)", "Today 10:14"],
  ["ticket", "<b>Sam</b> raised <b>INC-2609 0017</b> against this", "Today 09:02"],
  ["edit", "<b>Ada</b> set Warranty until to <b>11 Mar 2027</b>", "Yesterday"],
  ["upload", "Imported from <b>seed</b> · 3 fields updated", "8 Sep"],
  ["play", "Lifecycle <b>Planned → In service</b>", "11 Mar 2024"],
];
const histRows = (items) => `<div style="padding:4px 14px 8px">${items.map(([i, x, w]) => `<div style="display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:start;padding:6px 0"><span style="width:18px;height:18px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--text-3);margin-top:1px">${ic(i, "", 10)}</span><span class="t2" style="font-size:12px;line-height:1.4;min-width:0">${x.replace(/<b>/g, '<b style="font-weight:600;color:var(--text)">')}</span><span class="mono t3" style="font-size:10.5px;padding-top:2px;white-space:nowrap">${w}</span></div>`).join("")}</div>`;

function assetHeader(edit = false) {
  return `
  <div style="padding:18px 24px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px">
    ${glyph("hw", 44, 11)}
    <div style="min-width:0">${h1("SRV-APP-01", 20)}<div class="t2" style="font-size:12.5px;margin-top:3px;display:flex;align-items:center;gap:8px">Hardware · HPE ProLiant DL360 <span class="t3">·</span> <span class="mono">5CG2140XYZ</span> <span class="t3">·</span> Infrastructure</div></div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      ${edit ? '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--brand-deep);font-weight:500;margin-right:4px"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>2 unsaved</span>' : ""}
      ${dotpill(LIFE.service[0], "In service", ic("chevd", "t3", 12), 28)}
      <span class="btn outline sm" style="height:28px">${ic("qr")}Print label</span>
      ${edit ? `<span class="btn outline sm" style="height:28px;opacity:.5">${ic("edit")}Editing…</span>` : `<span class="btn primary sm" style="height:28px">${ic("edit")}Edit</span>`}
      <span class="btn ghost sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("dots")}</span>
    </div>
  </div>`;
}
function assetRail() {
  const rel = (v, n, t, inv = false) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12.5px">${glyph(t, 20, 5)}<span style="display:flex;flex-direction:column;line-height:1.2;min-width:0"><span class="t3" style="font-size:10.5px">${v}</span><a style="font-weight:500;color:var(--text)">${n}</a></span><span class="t3" style="margin-left:auto;display:flex;gap:2px">${inv ? "" : ""}${iconBtn("x", "Disconnect")}</span></div>`;
  return `
  <aside style="border-left:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:12px;overflow:hidden">
    ${card(cardHead("Connected to", linkA("Connect", "plus")), `<div style="padding:4px 0">${rel("Depends on", "SRV-DB-01", "hw")}${rel("Runs", "*.tiqo.it", "cert")}${rel("Mounted in", "SW-RACK-B", "net")}<div class="hair" style="margin:4px 14px 0"></div>${rel("Depended on by", "vpn.tiqo.it", "cert", true)}</div>`)}
    ${card(cardHead("Also open nearby", '<span class="t3" style="font-size:11px">one hop</span>'), `<div style="padding:8px 14px 12px;font-size:12px;line-height:1.45"><div style="display:flex;gap:8px;align-items:flex-start"><span style="color:var(--brand-deep);display:flex;margin-top:1px">${ic("warn", "", 14)}</span><span class="t2"><b style="color:var(--text)">INC-2609 0014</b> Nightly backup failed — on <b style="color:var(--text)">SRV-DB-01</b>, which this depends on. Worth reading before touching this box.</span></div></div>`)}
    ${card(cardHead("Lifecycle", linkA("Retire", "archive")), `
      <div style="padding:12px 14px 14px">
        <div style="display:flex;justify-content:space-between;font-size:11px" class="t3"><span>Purchased</span><span>Warranty ends</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:2px" class="mono"><span>11 Mar 2024</span><span>11 Mar 2027</span></div>
        <div style="height:6px;border-radius:3px;background:var(--surface-3);margin-top:8px;overflow:hidden;position:relative"><i style="display:block;height:100%;width:50%;background:var(--positive)"></i><i style="position:absolute;top:-2px;bottom:-2px;left:50%;width:2px;background:var(--text)"></i></div>
        <div class="t3" style="font-size:11px;margin-top:7px;display:flex;justify-content:space-between"><span>18 months of cover left</span><span>No retirement planned</span></div>
      </div>`)}
    ${card(cardHead("Label", linkA("Print", "print")), `<div style="display:flex;gap:12px;padding:12px 14px;align-items:center"><span style="width:56px;height:56px;border-radius:6px;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--text)">${ic("qr", "", 36)}</span><span class="t2" style="font-size:11.5px;line-height:1.45">Scanning opens this page. Handy on the rack door and the loan laptops.</span></div>`)}
  </aside>`;
}
function assetTickets() {
  const rows = [["INC-2609 0017", "Rack B switch running hot", "urgent", "progress", "Ada Admin", "2h"], ["QST-2609 0002", "Laptop will not charge", "medium", "new", null, "1d"], ["INC-2609 0014", "Nightly backup job failed twice this week", "high", "resolved", "Sam Support", "5d"], ["INC-2608 0008", "Broken monitor", "low", "resolved", "Sam Support", "Aug"]];
  return card(cardHead("Tickets raised against this", `<span style="display:flex;gap:6px;align-items:center">${segToggle(["Open 2", "All 5"], "Open 2")}<span class="btn outline sm" style="height:24px">${ic("plus")}Raise</span></span>`), `
    <div>${rows.map(([r, t, p, s, a, age]) => `<div style="display:grid;grid-template-columns:14px 112px minmax(0,1fr) 40px 22px 40px;gap:12px;align-items:center;padding:0 14px;height:38px;border-bottom:1px solid var(--line);opacity:${s === "resolved" ? 0.55 : 1}">${ring(s)}${ref(r)}<span style="font-weight:500;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span>${bars(p)}${avatar(a ? (a === "Ada Admin" ? "AA" : "SL") : null, 20)}<span class="mono t3" style="font-size:11.5px;text-align:right">${age}</span></div>`).join("")}</div>`);
}
function assetPage({ edit = false } = {}) {
  const val = (v, mono = false) => `<span style="${mono ? "font-family:'Geist Mono',monospace;font-size:12px" : "font-size:12.5px"}">${v}</span>`;
  const details = edit
    ? `<div style="padding:14px 14px 4px;display:grid;grid-template-columns:1fr 1fr;gap:14px 16px">
        ${field("Name", input("SRV-APP-01"))}${field("Operator group", select("Infrastructure"))}
        <div style="grid-column:1/-1" class="label">Attributes</div>
        ${field("Serial number", input("5CG2140XYZ", { mono: true }), { req: true })}${field("Model", input("HPE ProLiant DL360"))}
        ${field("Form factor", select("Server"))}${field("Purchased", input("11-03-2024", { right: ic("cal", "t3") }))}
        ${field("Warranty until", input("11-03-2028", { right: ic("cal", "t3"), dirty: true }))}${field("Primary user", select(`${avatar("MK", 16)} Mila Kuipers`))}
        ${field("Mounted in", input(`${glyph("net", 16, 4)} SW-RACK-B`, { right: ic("x", "t3") }), { hint: "Any Network item" })}${field("Notes", input("Second PSU is on order", { dirty: true }))}
      </div>${saveFoot("Warranty until 2027 → 2028 · Notes")}`
    : `<div style="display:grid;grid-template-columns:1fr 1fr;padding:6px 0">
        ${kv([["Serial number", val("5CG2140XYZ", true)], ["Model", val("HPE ProLiant DL360")], ["Form factor", val("Server")], ["Purchased", val("11 Mar 2024", true)]], "110px 1fr", "8px 14px")}
        ${kv([["Warranty until", `${val("11 Mar 2027", true)}${tag("18 mo", "pos")}`], ["Primary user", `${avatar("MK", 16)}${val("Mila Kuipers")}`], ["Mounted in", `<a style="display:inline-flex;align-items:center;gap:5px">${glyph("net", 16, 4)}SW-RACK-B</a>`], ["Source", `<span class="mono t3" style="font-size:11px">seed · srv-app-01 · synced 8 Sep</span>`]], "110px 1fr", "8px 14px")}
      </div>`;
  const body = `
  ${assetHeader(edit)}
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;height:${1000 - 48 - 77}px">
    <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
      ${card(cardHead("Details", edit ? "" : linkA("Edit", "edit")), details)}
      ${assetTickets()}
      ${card(cardHead("History", '<a style="font-size:11.5px">All 12</a>'), histRows(HIST))}
    </div>
    ${assetRail()}
  </div>`;
  return shell("assets", ["Assets", "Hardware", "SRV-APP-01"], body, 1000);
}

/* ====================================================================== */
/*                              DOCUMENTATION                              */
/* ====================================================================== */

const SPACES = [
  { key: "OPS", n: "Operations", c: "#febe2e", team: "Infrastructure", pages: 12, stale: 2, desc: "Runbooks for the things that break, and what to do at two in the morning.", upd: "Today" },
  { key: "DESK", n: "How the desk works", c: "#6366f1", team: null, pages: 9, stale: 1, desc: "Procedures, standing arrangements and the things nobody writes down.", upd: "Yesterday" },
  { key: "SEC", n: "Security", c: "#f43f5e", team: "Security", pages: 6, stale: 0, desc: "Access reviews, incident response and the yearly audit.", upd: "3 Sep" },
  { key: "NET", n: "Network", c: "#0ea5e9", team: "Infrastructure", pages: 7, stale: 1, desc: "Every site, every line, every supplier contact.", upd: "1 Sep" },
];
const keyTile = (key, color, size = 32) => `<span class="mono" style="width:${size}px;height:${size}px;flex:none;border-radius:${size > 36 ? 10 : 8}px;background:color-mix(in oklab,${color} 16%,transparent);color:${color};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${size > 36 ? 12 : 10.5}px">${key}</span>`;
const DOCS = [
  { t: "The VPN concentrator", s: "What it is, where it is, and what to do when it stops answering.", o: "SL", rev: "due in 78 d", upd: "Today", space: "OPS" },
  { t: "Restarting the concentrator", s: "The last resort, and the two things to do before it and after it.", o: "SL", rev: "overdue 20 d", stale: true, upd: "Today", space: "OPS" },
  { t: "Nightly backups", s: "What runs, where it writes, and what a failure actually means.", o: "AA", rev: "due in 12 d", upd: "12 Sep", space: "OPS" },
  { t: "Standing arrangement: Northwind", s: "What they do for us, who to ask, and the response times we actually have.", o: "AA", rev: "due in 140 d", upd: "10 Sep", space: "DESK" },
  { t: "Out of hours and on call", s: "Who is reachable after six, and what is worth reaching them for.", o: "MK", rev: "overdue 3 d", stale: true, upd: "8 Sep", space: "DESK" },
  { t: "Certificate renewals", s: "Where each certificate lives and how it is renewed without downtime.", o: "JB", rev: "due in 40 d", upd: "5 Sep", space: "SEC" },
];
const revChip = (d) => (d.stale ? `<span class="tag" style="background:color-mix(in oklab,var(--negative) 12%,transparent);color:var(--negative)">${ic("warn", "", 10)} Review ${d.rev}</span>` : `<span class="tag">${ic("check", "", 10)} Review ${d.rev}</span>`);

function docsHome() {
  const spaceCard = (s) => `
    <div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-height:128px">
      <div style="display:flex;align-items:center;gap:10px">${keyTile(s.key, s.c, 30)}<div style="min-width:0;line-height:1.2"><div style="font-weight:600;font-size:13.5px">${s.n}</div><div class="t3" style="font-size:11px;margin-top:2px">${s.team ?? "Whole desk"} · ${s.pages} pages</div></div>${s.stale ? `<span class="tag" style="margin-left:auto;background:color-mix(in oklab,var(--negative) 12%,transparent);color:var(--negative)">${s.stale} stale</span>` : `<span class="tag" style="margin-left:auto;color:var(--positive)">All current</span>`}</div>
      <p class="t2" style="margin:0;font-size:12px;line-height:1.45;flex:1">${s.desc}</p>
      <div class="t3" style="font-size:11px">Updated ${s.upd}</div>
    </div>`;
  const docRow = (d, i, list) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;${i < list.length - 1 ? "border-bottom:1px solid var(--line)" : ""}">
      <span style="width:8px;height:8px;border-radius:99px;background:${SPACES.find((s) => s.key === d.space).c};flex:none"></span>
      <div style="min-width:0;flex:1;line-height:1.3"><div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:12.5px"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.t}</span>${d.stale ? revChip(d) : ""}</div><div class="t3" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.s}</div></div>
      ${avatar(d.o, 20)}<span class="mono t3" style="font-size:11px;width:52px;text-align:right">${d.upd}</span>
    </div>`;
  const pinned = DOCS.slice(0, 3).map((d) => `<div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 12px;min-width:0"><span style="color:var(--brand);display:flex">${ic("pin", "", 14)}</span><span style="font-weight:500;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.t}</span><span class="t3" style="font-size:11px;margin-left:auto;white-space:nowrap">${SPACES.find((s) => s.key === d.space).key}</span></div>`).join("");
  const body = `
  <div class="pagehead">
    <h1>Documentation</h1><span class="mono t3" style="font-size:11.5px">4 spaces · 34 pages · 4 stale</span>
    <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
      <span class="btn outline sm" style="height:30px">${ic("plus")}New space</span>
      <span class="btn primary sm" style="height:30px">${ic("plus")}New page</span>
    </div>
  </div>
  <div style="padding:20px 24px;display:flex;flex-direction:column;gap:20px;height:852px;overflow:hidden">
    <div class="input" style="height:40px;font-size:13.5px;box-shadow:var(--shadow)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search runbooks, procedures and arrangements — titles and text</span><kbd style="margin-left:auto">/</kbd></div>
    <div><div class="label" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">Pinned by you<span class="t3" style="font-weight:400;letter-spacing:0;text-transform:none">· the three you keep coming back to</span></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${pinned}</div></div>
    <div><div class="label" style="margin-bottom:8px">Spaces</div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${SPACES.map(spaceCard).join("")}</div></div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:16px;min-height:0">
      ${card(cardHead("Recently updated", '<a style="font-size:11.5px">Everything</a>'), `<div>${DOCS.map((d, i) => docRow(d, i, DOCS)).join("")}</div>`)}
      ${card(cardHead("Needs review", '<span class="mono t3" style="font-size:11px">yours · 2</span>'), `
        <div>${DOCS.filter((d) => d.stale).map((d, i, l) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;${i < l.length - 1 ? "border-bottom:1px solid var(--line)" : ""}"><div style="min-width:0;flex:1;line-height:1.3"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.t}</div><div style="font-size:11.5px;color:var(--negative)">Review ${d.rev}</div></div><span class="btn outline sm" style="height:24px">${ic("check")}Still correct</span><span class="btn ghost sm" style="height:24px;width:24px;padding:0;justify-content:center">${ic("edit")}</span></div>`).join("")}</div>
        <div style="margin-top:auto;border-top:1px solid var(--line);padding:10px 14px;display:flex;align-items:center;gap:8px;font-size:12px" class="t2">${ic("people", "t3", 14)}Across the desk: <b style="color:var(--text)">4 stale pages</b> owned by 3 people<a style="margin-left:auto;font-size:11.5px">Review queue ${ic("chevr", "", 11)}</a></div>`)}
    </div>
  </div>`;
  return shell("docs", ["Documentation"], body);
}

function docTree(active = "The VPN concentrator", opts = {}) {
  const items = [
    ["The VPN concentrator", 0, true, false],
    ["Restarting the concentrator", 1, false, true],
    ["Tunnel counts and what they mean", 1, false, false],
    ["Nightly backups", 0, true, false],
    ["Restoring a single mailbox", 1, false, false],
    ["The NAS target", 1, false, false],
    ["Certificate renewals", 0, false, false],
    ["Rack B", 0, false, false],
    ["Supplier contacts", 0, false, false],
  ];
  const row = ([t, depth, open, stale]) => `
    <div style="display:flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 ${8 + depth * 16}px;border-radius:6px;font-size:12.5px;${t === active ? "background:color-mix(in oklab,var(--text) 7%,transparent);font-weight:500" : "color:var(--text-2)"}">
      <span class="t3" style="display:flex;width:14px;justify-content:center">${depth === 0 && (t === "The VPN concentrator" || t === "Nightly backups") ? ic(open ? "chevd" : "chevr", "", 12) : ""}</span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${t}</span>
      ${stale ? '<i style="width:6px;height:6px;border-radius:99px;background:var(--negative);flex:none" title="Review overdue"></i>' : ""}
    </div>`;
  return `
  <div style="border-right:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;padding:12px 10px;gap:8px;overflow:hidden">
    <a class="t3" style="font-size:11.5px;display:flex;align-items:center;gap:4px;padding:0 6px">${ic("arrowl", "", 12)}All spaces</a>
    <div style="display:flex;align-items:center;gap:8px;padding:2px 6px">${keyTile("OPS", "#febe2e", 26)}<div style="line-height:1.2;min-width:0"><div style="font-weight:600;font-size:13px">Operations</div><div class="t3" style="font-size:10.5px">Infrastructure · 12 pages · 2 stale</div></div></div>
    <div class="input" style="height:28px;font-size:12px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Find in this space</span></div>
    <div style="display:flex;flex-direction:column;gap:1px;flex:1;overflow:hidden">${items.map(row).join("")}</div>
    <span class="btn outline sm" style="justify-content:center;border-style:dashed">${ic("plus")}New page</span>
  </div>`;
}

function spacePage() {
  const pageCard = (d) => `
    <div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:120px">
      <div style="display:flex;align-items:flex-start;gap:8px"><span style="font-weight:600;font-size:13.5px;line-height:1.3;flex:1">${d.t}</span><span class="t3" style="display:flex;flex:none">${ic("pin", "", 13)}</span></div>
      <p class="t2" style="margin:0;font-size:12px;line-height:1.45;flex:1">${d.s}</p>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px" class="t3">${avatar(d.o, 18)}<span>${AV_NAME[d.o].split(" ")[0]}</span><span>·</span><span>${d.upd}</span><span style="margin-left:auto">${revChip(d)}</span></div>
    </div>`;
  const ops = DOCS.filter((d) => d.space === "OPS").concat([{ t: "Certificate renewals", s: "Where each certificate lives and how it is renewed without downtime.", o: "JB", rev: "due in 40 d", upd: "5 Sep" }, { t: "Rack B", s: "What is in it, top to bottom, and which breaker it is on.", o: "AA", rev: "due in 90 d", upd: "2 Sep" }, { t: "Supplier contacts", s: "Who to ring for the line, the UPS and the air conditioning.", o: "MK", rev: "due in 5 d", upd: "28 Aug" }]);
  const body = `
  <div style="display:grid;grid-template-columns:240px minmax(0,1fr);height:852px">
    ${docTree(null)}
    <div style="overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:18px 24px 0;display:flex;align-items:center;gap:14px">
        ${keyTile("OPS", "#febe2e", 44)}
        <div>${h1("Operations", 20)}<div class="t2" style="font-size:12.5px;margin-top:3px">Runbooks for the things that break, and what to do at two in the morning. <span class="t3">· Infrastructure · 12 pages</span></div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn outline sm" style="height:28px">${ic("cog")}Space settings</span><span class="btn primary sm" style="height:28px">${ic("plus")}New page</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:14px 24px;border-bottom:1px solid var(--line)">
        <span class="seg"><span class="chip on">All 12</span><span class="chip">Stale <span class="mono" style="font-size:11px;margin-left:4px;color:var(--negative)">2</span></span><span class="chip">Mine 4</span><span class="chip">Archived 3</span></span>
        <span class="chip" style="height:26px;margin-left:8px">Owner ${ic("chevd", "t3", 12)}</span>
        <span class="t3" style="font-size:12px;margin-left:auto;display:flex;align-items:center;gap:6px">${ic("sort", "", 13)}Recently updated</span>
        <span class="seg"><span class="chip on" style="height:24px;padding:0 8px">${ic("grid", "", 12)}</span><span class="chip" style="height:24px;padding:0 8px">${ic("rows", "", 12)}</span></span>
      </div>
      <div style="padding:16px 24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-content:start;overflow:hidden">${ops.map(pageCard).join("")}</div>
    </div>
  </div>`;
  return shell("docs", ["Documentation", "Operations"], body);
}

const ARTICLE = `
  <p style="margin:0 0 12px;font-size:13.5px;line-height:1.65">The concentrator terminates every remote session for staff and for the two suppliers with standing access. It is the single point of failure nobody has got round to removing, so it is the first thing to check when several people report the same thing at once.</p>
  <h2 id="where" style="font-size:15px;font-weight:600;margin:20px 0 8px;letter-spacing:-.01em">Where it is</h2>
  <p style="margin:0 0 12px;font-size:13.5px;line-height:1.65">Rack 4, top unit. Management is on the out-of-band network only — the management address is <b>not</b> reachable from the office LAN, which is deliberate and catches somebody about once a year. The rack itself is <a style="display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:5px;background:var(--brand-tint);color:var(--brand-deep);font-size:12px;font-weight:500;vertical-align:middle">${ic("box", "", 11)}SW-RACK-B</a>.</p>
  <h2 id="when" style="font-size:15px;font-weight:600;margin:20px 0 8px;letter-spacing:-.01em">When it stops answering</h2>
  <ol style="margin:0 0 12px;padding-left:22px;font-size:13.5px;line-height:1.65;display:flex;flex-direction:column;gap:6px">
    <li>Check whether the office itself is affected — if only remote sessions are down, it is almost always the concentrator.</li>
    <li>Open a session on the out-of-band jump host.</li>
    <li>Read the tunnel count. Under twenty on a weekday morning means sessions are being dropped rather than refused.</li>
    <li>If the count is climbing again on its own, wait five minutes before doing anything else — restarting during recovery costs another twenty minutes.</li>
  </ol>
  <p style="margin:0;font-size:13.5px;line-height:1.65">Restarting is in <a style="display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:5px;background:var(--brand-tint);color:var(--brand-deep);font-size:12px;font-weight:500;vertical-align:middle">${ic("book", "", 11)}Restarting the concentrator</a>. The last two outages were <a style="display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:5px;background:var(--brand-tint);color:var(--brand-deep);font-size:12px;font-weight:500;vertical-align:middle">${ic("ticket", "", 11)}INC-2609 0008</a> and <a style="display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border-radius:5px;background:var(--brand-tint);color:var(--brand-deep);font-size:12px;font-weight:500;vertical-align:middle">${ic("ticket", "", 11)}INC-2607 0141</a>.</p>`;

function docRail({ edit = false } = {}) {
  const refRow = (r, t) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px">${ring("progress")}<span style="display:flex;flex-direction:column;line-height:1.2;min-width:0">${ref(r)}<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span></span></div>`;
  return `
  <aside style="border-left:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:12px;overflow:hidden">
    ${card(cardHead("Ownership & review", edit ? "" : linkA("Change", "edit")), `
      ${kv([["Owner", `${avatar("SL", 18)} Sanne Lin`], ["Review every", "90 days"], ["Last confirmed", '<span class="mono" style="font-size:12px">28 Jun 2026</span>'], ["Next review", `<span class="mono" style="font-size:12px">26 Sep 2026</span>${tag("in 12 d")}`], ["Sits under", '<span class="t3">Top of the shelf</span>']])}
      <div style="display:flex;gap:6px;padding:0 14px 12px"><span class="btn outline sm" style="flex:1;justify-content:center">${ic("check")}Still correct</span><span class="btn ghost sm" style="flex:1;justify-content:center">${ic("bell")}Remind me</span></div>`)}
    ${card(cardHead("On the portal", linkA("Publish again", "refresh")), `<div style="padding:10px 14px 12px;font-size:12px;line-height:1.45"><div style="display:flex;align-items:center;gap:8px"><span style="color:var(--positive);display:flex">${ic("globe", "", 14)}</span><a style="font-weight:500;color:var(--text)">VPN keeps dropping — what to try first</a></div><div class="t3" style="margin-top:4px;font-size:11.5px">Under <b>Working from home</b> · published 2 Sep</div><div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding:6px 8px;border-radius:6px;background:var(--brand-tint);color:var(--brand-deep);font-size:11.5px">${ic("warn", "", 12)}This page changed since — the answer is 1 revision behind.</div></div>`)}
    ${card(cardHead("Referenced from", '<span class="mono t3" style="font-size:11px">3</span>'), `<div style="padding:4px 0">${refRow("INC-2609 0008", "Broken monitor — mentioned in a note")}${refRow("INC-2609 0017", "Rack B switch running hot")}<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px">${ic("book", "t3", 14)}<span style="font-weight:500">Out of hours and on call</span></div></div>`)}
    ${card(cardHead("Files", linkA("Attach", "paperclip")), `<div style="padding:4px 0">${[["rack4-front.jpg", "1.2 MB", "image"], ["concentrator-config.txt", "8 KB", "paper"]].map(([n, s, i]) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px">${ic(i, "t3", 14)}<span class="mono" style="font-size:11.5px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span><span class="t3" style="font-size:11px">${s}</span></div>`).join("")}</div>`)}
    ${card(cardHead("History", linkA("Compare", "diff")), `<div style="padding:4px 0">${[["Current", "Ada Admin", "Today 17:37", true], ["Restored an earlier version", "Ada Admin", "Today 17:35"], ["Recorded the last full outage", "Sanne Lin", "12 Sep"]].map(([t, a, w, cur]) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px">${cur ? '<i style="width:8px;height:8px;border-radius:99px;background:var(--brand);flex:none;margin:0 4px"></i>' : avatar(a === "Ada Admin" ? "AA" : "SL", 16)}<span style="display:flex;flex-direction:column;line-height:1.2;min-width:0"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span><span class="t3" style="font-size:10.5px">${a} · ${w}</span></span></div>`).join("")}</div>`)}
  </aside>`;
}
function docPage() {
  const toc = `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;margin:0 0 18px;padding:8px 12px;border-radius:8px;background:var(--surface-2)" class="t3"><span class="label" style="font-size:10px;margin-right:4px">On this page</span><a style="color:var(--text-2)">Where it is</a><span>·</span><a style="color:var(--text);font-weight:500">When it stops answering</a><span>·</span><a style="color:var(--text-2)">Sub-pages</a></div>`;
  const body = `
  <div style="display:grid;grid-template-columns:240px minmax(0,1fr) 320px;height:${1000 - 48}px">
    ${docTree("The VPN concentrator")}
    <div style="overflow:hidden;position:relative">
      <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 24px;border-bottom:1px solid var(--line)">
        <span class="t3" style="font-size:12px;display:flex;align-items:center;gap:6px">Operations ${ic("chev", "", 11)} <span style="color:var(--text)">The VPN concentrator</span></span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
          <span class="chip" style="height:26px">${ic("pin", "", 12)}Pinned</span>
          <span class="btn outline sm">${ic("maximize")}Reading mode</span>
          <span class="btn primary sm">${ic("edit")}Edit</span>
          ${iconBtn("dots", "Move · Publish · Archive · Print")}
        </div>
      </div>
      <div style="padding:22px 40px 24px;max-width:820px">
        ${h1("The VPN concentrator", 24)}
        <p class="t2" style="margin:8px 0 0;font-size:14px;line-height:1.5">What it is, where it is, and what to do when it stops answering.</p>
        <div style="display:flex;align-items:center;gap:10px;margin:14px 0 16px;font-size:12px" class="t3">${tag(`${ic("check", "", 10)} Review due in 12 days`)}<span style="display:flex;align-items:center;gap:6px">${avatar("SL", 18)}Sanne Lin</span><span>·</span><span>Updated today by Ada</span><span>·</span><span>4 min read</span></div>
        ${toc}
        ${ARTICLE}
        <div class="label" style="margin:26px 0 10px">2 sub-pages</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[["Restarting the concentrator", "The last resort, and the two things to do before it and after it.", true], ["Tunnel counts and what they mean", "Reading the one number that tells you whether to wait.", false]].map(([t, s, st]) => `<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:4px"><div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:12.5px">${t}${st ? '<i style="width:6px;height:6px;border-radius:99px;background:var(--negative)"></i>' : ""}</div><div class="t3" style="font-size:11.5px;line-height:1.4">${s}</div></div>`).join("")}</div>
      </div>
    </div>
    ${docRail()}
  </div>`;
  return shell("docs", ["Documentation", "Operations", "The VPN concentrator"], body, 1000);
}
function docEdit() {
  const tool = (i, on = false) => `<span class="btn ghost sm" style="width:26px;padding:0;justify-content:center;${on ? "background:var(--surface-3);color:var(--text)" : ""}">${ic(i)}</span>`;
  const body = `
  <div style="display:grid;grid-template-columns:240px minmax(0,1fr) 320px;height:${1000 - 48}px">
    ${docTree("The VPN concentrator")}
    <div style="overflow:hidden;position:relative;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 24px;border-bottom:1px solid var(--line);flex:none">
        <span class="t3" style="font-size:12px;display:flex;align-items:center;gap:6px">Operations ${ic("chev", "", 11)} <span style="color:var(--text)">The VPN concentrator</span></span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--brand-deep);font-weight:500;margin-left:12px"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>Editing · unsaved</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px"><span class="t3" style="font-size:11.5px;display:flex;align-items:center;gap:5px">${ic("people", "", 13)}Sanne opened this 4 min ago</span></div>
      </div>
      <div style="padding:20px 40px 0;display:flex;flex-direction:column;gap:12px;flex:1;overflow:hidden">
        ${input("The VPN concentrator", { h: 40, style: "font-size:20px;font-weight:600;letter-spacing:-.02em" })}
        ${input("What it is, where it is, and what to do when it stops answering.", { h: 34, style: "font-size:13.5px" })}
        <div class="input" style="flex:1;flex-direction:column;align-items:stretch;padding:0;overflow:hidden;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)">
          <div style="display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid var(--line);background:var(--surface-2)">${tool("h")}${tool("bold", true)}${tool("italic")}${tool("code")}<span style="width:1px;height:16px;background:var(--line);margin:0 4px"></span>${tool("list")}${tool("link")}${tool("image")}${tool("paperclip")}<span style="width:1px;height:16px;background:var(--line);margin:0 4px"></span><span class="t3" style="font-size:11px;display:flex;align-items:center;gap:4px">${ic("hash", "", 11)}Type # to reference a ticket, asset or page</span><span class="t3" style="font-size:11px;margin-left:auto;display:flex;align-items:center;gap:6px"><kbd>⌘S</kbd> save <kbd>Esc</kbd> cancel</span></div>
          <div style="padding:16px 18px;white-space:normal;line-height:1.65;font-size:13.5px;overflow:hidden">${ARTICLE.replace("The concentrator terminates", "The concentrator terminates")}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:12px 40px;border-top:1px solid var(--line);background:var(--bg);flex:none">
        <span class="btn primary" style="height:30px">${ic("check")}Save</span><span class="btn ghost" style="height:30px">Cancel</span>
        <div class="input" style="height:30px;width:320px;margin-left:8px"><span class="ph">What changed? (optional, shown in History)</span></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-left:auto" class="t2">${check(true)} Counts as a review — resets the 90-day clock</label>
      </div>
    </div>
    ${docRail({ edit: true })}
  </div>`;
  return shell("docs", ["Documentation", "Operations", "The VPN concentrator"], body, 1000);
}
function docCompare() {
  const line = (t, kind) => `<div style="display:flex;gap:10px;padding:2px 12px;font-size:12.5px;line-height:1.6;${kind === "add" ? "background:color-mix(in oklab,var(--positive) 12%,transparent)" : kind === "del" ? "background:color-mix(in oklab,var(--negative) 12%,transparent);text-decoration:line-through;color:var(--text-3)" : ""}"><span class="mono t3" style="font-size:11px;width:14px;flex:none">${kind === "add" ? "+" : kind === "del" ? "−" : ""}</span><span>${t}</span></div>`;
  const left = [["The concentrator terminates every remote session for staff and for the two suppliers with standing access."], ["It is the single point of failure nobody has got round to removing.", "del"], ["## Where it is"], ["Rack 4, top unit. Management is on the out-of-band network only."], ["## When it stops answering"], ["1. Check whether the office itself is affected."], ["2. Open a session on the out-of-band jump host."], ["3. Read the tunnel count."], ["4. Restart it.", "del"]];
  const right = [["The concentrator terminates every remote session for staff and for the two suppliers with standing access."], ["It is the single point of failure nobody has got round to removing, so it is the first thing to check when several people report the same thing at once.", "add"], ["## Where it is"], ["Rack 4, top unit. Management is on the out-of-band network only."], ["## When it stops answering"], ["1. Check whether the office itself is affected."], ["2. Open a session on the out-of-band jump host."], ["3. Read the tunnel count. Under twenty on a weekday morning means sessions are being dropped rather than refused.", "add"], ["4. If the count is climbing again on its own, wait five minutes before doing anything else.", "add"]];
  const col = (title, meta, lines, cur) => `
    <div class="card" style="overflow:hidden;display:flex;flex-direction:column;min-width:0">
      <div style="display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border-bottom:1px solid var(--line)">${select(title, { h: 28, style: "width:230px" })}<span class="t3" style="font-size:11.5px">${meta}</span>${cur ? tag("Current", "brand") : `<span class="btn outline sm" style="margin-left:auto">${ic("history")}Restore this version</span>`}</div>
      <div style="padding:10px 0;overflow:hidden">${lines.map(([t, k]) => line(t, k)).join("")}</div>
    </div>`;
  const body = `
  <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 24px;border-bottom:1px solid var(--line)">
    <a class="t3" style="font-size:12px;display:flex;align-items:center;gap:4px">${ic("arrowl", "", 12)}The VPN concentrator</a><span class="t3">·</span><span style="font-size:12.5px;font-weight:500">Compare versions</span>
    <span class="t3" style="font-size:11.5px;margin-left:12px">3 lines changed · 1 removed · 3 added</span>
    <div style="margin-left:auto;display:flex;gap:6px">${segToggle(["Side by side", "Inline"], "Side by side")}<span class="btn outline sm">${ic("x")}Close</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:20px 24px;height:${900 - 92}px">
    ${col("Version 4 · Sanne Lin", "12 Sep, 14:02 · 'Recorded the last full outage'", left, false)}
    ${col("Version 6 · Ada Admin", "Today, 17:37", right, true)}
  </div>`;
  return shell("docs", ["Documentation", "Operations", "The VPN concentrator", "Compare"], body);
}

/* ====================================================================== */
/*                         SETTINGS — asset types                          */
/* ====================================================================== */

const KINDS = ["Text", "Number", "Date", "Yes / no", "One of a list", "Person", "Another asset"];
const attrRow = ({ label, key, kind, req, opts, dirty }, last = false) => `
  <div style="display:grid;grid-template-columns:18px minmax(0,1.2fr) minmax(0,1fr) 150px 88px 26px;gap:10px;align-items:center;padding:8px 12px;${last ? "" : "border-bottom:1px solid var(--line)"};${dirty ? "background:var(--brand-tint)" : ""}">
    <span class="t3" style="display:flex;cursor:grab">${ic("drag")}</span>
    <div style="min-width:0">${input(label, { h: 28 })}</div>
    <div style="min-width:0">${input(key, { h: 28, mono: true })}</div>
    ${select(kind, { h: 28 })}
    ${checkbox("Required", req, { size: 12 })}
    ${iconBtn("trash", "Remove")}
  </div>${opts ? `<div style="display:flex;align-items:center;gap:8px;padding:0 12px 10px 40px;font-size:12px;${last ? "" : "border-bottom:1px solid var(--line)"}"><span class="t3" style="font-size:11px">${opts[0]}</span>${opts[1]}</div>` : ""}`;
const HW_ATTRS = [
  { label: "Serial number", key: "serial", kind: "Text", req: true },
  { label: "Model", key: "model", kind: "Text", req: false },
  { label: "Form factor", key: "form_factor", kind: "One of a list", req: false, opts: ["Options", `<span style="display:flex;gap:4px">${["Laptop", "Desktop", "Server", "Printer"].map((o) => `<span class="chip" style="height:22px;font-size:11.5px">${o}${ic("x", "", 10)}</span>`).join("")}<span class="chip" style="height:22px;font-size:11.5px;border-style:dashed">${ic("plus", "", 10)}Add</span></span>`] },
  { label: "Purchased", key: "purchased", kind: "Date", req: false },
  { label: "Warranty until", key: "warranty_until", kind: "Date", req: false, dirty: true, opts: ["Expiry", `${checkbox("Counts as an expiry date — shows on the dashboard and in the register", true, { size: 11.5 })}`] },
  { label: "Primary user", key: "primary_user", kind: "Person", req: false },
  { label: "Mounted in", key: "mounted_in", kind: "Another asset", req: false, opts: ["Points at", `${select("Network", { h: 24, style: "width:140px" })}<span class="t3" style="font-size:11px">Only items of this type are offered.</span>`] },
];
function typeTopBar() {
  return `
  <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 32px;border-bottom:1px solid var(--line)">
    <a class="t3" style="font-size:12px;display:flex;align-items:center;gap:4px">${ic("arrowl", "", 12)}Settings</a><span class="t3">·</span><span style="font-size:12.5px;font-weight:500">Asset types</span>
    <span style="width:1px;height:18px;background:var(--line);margin:0 6px"></span>
    ${select(`${glyph("hw", 18, 5)} Hardware <span class="t3" style="font-weight:400">· 7 items</span>`, { h: 30, style: "width:230px;font-weight:500" })}
    <span class="btn outline sm" style="height:30px">${ic("plus")}New type</span>
    <div style="margin-left:auto;display:flex;gap:6px">
      <span class="btn outline sm" style="height:30px">${ic("eye")}Preview</span>
      <span class="btn outline sm" style="height:30px">${ic("copy")}Duplicate</span>
      <span class="btn ghost sm" style="height:30px;color:var(--negative)">${ic("trash")}Delete type</span>
    </div>
  </div>`;
}
function iconPopover() {
  const icons = ["laptop", "server", "print", "wifi", "shield", "key", "box", "phone", "mail", "building", "layers", "cal", "globe", "lock", "briefcase", "monitor"];
  return `
  <div class="card" style="position:absolute;left:0;top:40px;width:236px;padding:10px;box-shadow:var(--shadow);z-index:2">
    <div class="input" style="height:28px;margin-bottom:8px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Find an icon</span></div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${icons.map((i, n) => `<span class="btn outline sm" style="width:32px;height:32px;padding:0;justify-content:center;${n === 0 ? "border-color:var(--brand);color:var(--brand-deep);background:var(--brand-tint)" : ""}">${ic(I4[i] || I[i] ? i : "box", "", 15)}</span>`).join("")}</div>
    <div class="t3" style="font-size:11px;margin-top:8px">Picked: <b style="color:var(--text)">Laptop</b> · Esc closes</div>
  </div>`;
}
function typeDesigner({ popup = false } = {}) {
  const cols = "18px minmax(0,1.4fr) minmax(0,1fr) 180px 100px 26px";
  const row = ({ label, key, kind, req, opts, dirty }, last) => `
    <div style="display:grid;grid-template-columns:${cols};gap:12px;align-items:center;padding:8px 14px;${last ? "" : "border-bottom:1px solid var(--line)"};${dirty ? "background:var(--brand-tint)" : ""}">
      <span class="t3" style="display:flex;cursor:grab">${ic("drag")}</span>
      ${input(label, { h: 30 })}${input(key, { h: 30, mono: true })}${select(kind, { h: 30 })}${checkbox("Required", req, { size: 12 })}${iconBtn("trash", "Remove")}
    </div>${opts ? `<div style="display:flex;align-items:center;gap:8px;padding:0 14px 10px 44px;font-size:12px;${last ? "" : "border-bottom:1px solid var(--line)"}"><span class="t3" style="font-size:11px">${opts[0]}</span>${opts[1]}</div>` : ""}`;
  const colours = ["#febe2e", "#6366f1", "#0ea5e9", "#10b981", "#f43f5e", "#f97316", "#9d9da6"];
  const preview = popup ? `
  <div style="position:absolute;inset:0;background:rgba(9,9,11,.55);display:flex;align-items:center;justify-content:center;z-index:5">
    <div class="card" style="width:720px;box-shadow:var(--shadow)">
      <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)"><div>${h1("How a Hardware item reads", 15)}<div class="t3" style="font-size:12px;margin-top:3px">SRV-APP-01 as the example · follows the draft, saved or not</div></div><div style="margin-left:auto;display:flex;gap:6px">${segToggle(["Item page", "Register row", "Card"], "Item page")}${iconBtn("x", "Close")}</div></div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px;background:var(--bg)">
        <div class="card" style="overflow:hidden">
          <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)">${glyph("hw", 32, 8)}<div style="line-height:1.25"><div style="font-weight:600;font-size:13.5px">SRV-APP-01</div><div class="t3" style="font-size:11px">Hardware · Infrastructure</div></div>${life("service", 22)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr">${kv([["Serial number", '<span class="mono" style="font-size:12px">5CG2140XYZ</span>'], ["Model", "HPE ProLiant DL360"], ["Form factor", "Server"], ["Purchased", '<span class="mono" style="font-size:12px">11 Mar 2024</span>']], "110px 1fr", "8px 14px")}${kv([["Warranty until", `<span class="mono" style="font-size:12px">11 Mar 2027</span>${tag("18 mo", "pos")}`], ["Primary user", `${avatar("MK", 16)} Mila Kuipers`], ["Mounted in", `<a style="display:inline-flex;align-items:center;gap:5px">${glyph("net", 16, 4)}SW-RACK-B</a>`], ["Notes", '<span class="t3">—</span>']], "110px 1fr", "8px 14px")}</div>
        </div>
        <div class="card" style="overflow:hidden;font-size:12px">${assetColumns("22px 30px minmax(0,1fr) 110px 128px", true).replace("position:sticky;top:0", "")}${assetRow(ASSETS[0], { cols: "22px 30px minmax(0,1fr) 110px 128px", compact: true })}</div>
      </div>
    </div>
  </div>` : "";
  const body = `
  ${typeTopBar()}
  <div style="padding:20px 32px;max-width:1040px;position:relative">
    <div class="card" style="overflow:hidden">
      <div style="display:flex;align-items:flex-end;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)">
        <div style="flex:1">${field("Name", input("Hardware", { h: 30 }))}</div>
        <div style="width:180px">${field("Key", input("hardware", { h: 30, mono: true }))}</div>
        <div style="position:relative">${field("Icon", `<span class="btn outline sm" style="height:30px;border-color:var(--brand)">${glyph("hw", 18, 5)}Laptop ${ic("chevd", "t3", 12)}</span>`)}${popup ? "" : iconPopover()}</div>
        ${field("Colour", `<span class="btn outline sm" style="height:30px"><span style="width:14px;height:14px;border-radius:99px;background:#febe2e"></span>Amber ${ic("chevd", "t3", 12)}</span>`)}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 6px"><span class="label">Attributes</span><span class="t3" style="font-size:11px">Drag to reorder · this is the order on the item page</span></div>
      <div style="margin:0 14px 12px;border:1px solid var(--line);border-radius:10px;overflow:hidden">${HW_ATTRS.map((a, i) => row(a, i === HW_ATTRS.length - 1)).join("")}</div>
      <div style="padding:0 14px 14px"><span class="btn outline sm">${ic("plus")}Add an attribute</span></div>
      <div class="hair"></div>
      <div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
        ${field("Shown in the register by default", `<div style="display:flex;flex-wrap:wrap;gap:4px">${["Name", "Lifecycle", "Group", "Warranty until", "Primary user", "Tickets"].map((c, n) => `<span class="chip ${n < 4 || n === 5 ? "on" : ""}" style="height:24px;font-size:11.5px">${c}</span>`).join("")}</div>`, { hint: "Anyone can change their own columns; this is where new people start." })}
        ${field("Name pattern", input("Free text", { h: 30 }), { hint: "Optional. A prefix or a regex — LT-, SRV- — so a wrongly named laptop is caught on save." })}
      </div>
      ${saveFoot("Warranty until → counts as an expiry")}
    </div>
  </div>
  ${preview}`;
  return settingsShell("Asset types", body, 1000);
}

/* ====================================================================== */
/*                     SETTINGS — documentation spaces                     */
/* ====================================================================== */

function docSpacesSettings({ dialog = false } = {}) {
  const row = (s, i) => `
    <div style="display:grid;grid-template-columns:18px 32px minmax(0,1fr) 130px 70px 70px 110px 150px 60px;gap:12px;align-items:center;height:52px;padding:0 12px;${i ? "border-top:1px solid var(--line)" : ""}">
      <span class="t3" style="display:flex">${ic("drag")}</span>
      ${keyTile(s.key, s.c, 30)}
      <div style="min-width:0;line-height:1.25"><div style="font-weight:600;font-size:12.5px">${s.n}</div><div class="t3" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.desc}</div></div>
      <span class="t2" style="font-size:12px;display:flex;align-items:center;gap:6px">${s.team ? `${ic("people", "t3", 13)}${s.team}` : '<span class="t3">Whole desk</span>'}</span>
      <span class="mono t2" style="font-size:12px">${s.pages}</span>
      <span class="mono" style="font-size:12px;color:${s.stale ? "var(--negative)" : "var(--text-3)"}">${s.stale || "—"}</span>
      <span class="t2" style="font-size:12px">${s.key === "SEC" ? "90 days" : "180 days"}</span>
      <span class="t2" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.key === "OPS" ? "Working from home" : s.key === "DESK" ? "Getting help" : '<span class="t3">Not published</span>'}</span>
      <span style="display:flex;gap:2px;justify-content:flex-end">${iconBtn("edit", "Edit")}${iconBtn("dots", "More")}</span>
    </div>`;
  const head = `<div class="label" style="display:grid;grid-template-columns:18px 32px minmax(0,1fr) 130px 70px 70px 110px 150px 60px;gap:12px;height:32px;align-items:center;padding:0 12px;border-bottom:1px solid var(--line);font-size:10.5px"><span></span><span></span><span>Space</span><span>Answers for it</span><span>Pages</span><span>Stale</span><span>Review every</span><span>Portal category</span><span></span></div>`;
  const dlg = dialog ? `
  <div style="position:absolute;inset:0;background:rgba(9,9,11,.55);display:flex;align-items:center;justify-content:center">
    <div class="card" style="width:520px;box-shadow:var(--shadow)">
      <div style="padding:16px 18px 6px">${h1("Edit space", 15)}<p class="t3" style="margin:4px 0 0;font-size:12px">The key is in every address under it — change it and links change.</p></div>
      <div style="padding:10px 18px 16px;display:grid;grid-template-columns:1fr 120px;gap:14px 12px">
        ${field("Name", input("Operations", { h: 30 }))}${field("Key", input("OPS", { h: 30, mono: true }))}
        <div style="grid-column:1/-1">${field("Description", textarea("Runbooks for the things that break, and what to do at two in the morning.", 2))}</div>
        ${field("Answers for it", select(`${ic("people", "t3", 13)} Infrastructure`, { h: 30 }), { hint: "Who owns pages here by default." })}
        ${field("Colour", `<div style="display:flex;gap:5px;height:30px;align-items:center">${["#febe2e", "#6366f1", "#0ea5e9", "#10b981", "#f43f5e"].map((c, n) => `<span style="width:18px;height:18px;border-radius:99px;background:${c};box-shadow:${n === 0 ? "0 0 0 2px var(--surface),0 0 0 3.5px var(--text)" : "none"}"></span>`).join("")}</div>`)}
        ${field("Review every", select("180 days", { h: 30, dirty: true }), { hint: "New pages start with this. Each page can differ." })}
        ${field("Portal category", select("Working from home", { h: 30 }), { hint: "Where “Publish” puts an answer." })}
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--line);background:var(--surface-2);border-radius:0 0 12px 12px"><span class="btn ghost sm" style="color:var(--negative);margin-right:auto">${ic("trash")}Delete space…</span><span class="btn ghost sm">Cancel</span><span class="btn primary sm">${ic("check")}Save</span></div>
    </div>
  </div>` : "";
  const body = `
  ${section("Documentation spaces", "A shelf for each body of writing, and the team that answers for what is written there. A page's review clock, portal category and default owner all start from its space.", `
    <div class="card" style="overflow:hidden">${head}${SPACES.map(row).join("")}</div>
    <div style="display:flex;align-items:center;gap:10px;padding:12px 0"><span class="btn outline sm">${ic("plus")}Add a space</span><span class="t3" style="font-size:11.5px">Drag to reorder · the order is the order on the Documentation page.</span></div>`, { first: true })}
  ${section("Review defaults", "How long a page may go unconfirmed before it is marked, and who is told.", `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px">
      ${field("Remind the owner", select("7 days before it is due", { h: 30 }), { hint: "By notification, and by mail when the desk sends mail." })}
      ${field("Then", select("Every 14 days until confirmed", { h: 30 }))}
      ${field("Escalate to", select(`${ic("people", "t3", 13)} The space's team`, { h: 30 }), { hint: "After the second reminder goes unanswered." })}
      ${field("Editing a page", select("Counts as a review", { h: 30 }), { hint: "Or ask each time, as the editor does now." })}
    </div>
    <div style="margin-top:14px">${savedFoot()}</div>`)}
  ${dlg}`;
  return settingsShell("Documentation", body);
}

/* ====================================================================== */
/*                            SETTINGS — mail                              */
/* ====================================================================== */

const MAILLOG = [
  ["out", "[CHG-2609 0004] Your approval is needed", "sam@example.com", "CHG-2609 0004", "Sent", "14 Sep, 21:18", 1],
  ["in", "Re: [QST-2609 0007] Laptop will not charge", "sam.rezip@example.com", "QST-2609 0007", "Filed", "14 Sep, 21:04", 1],
  ["in", "[QST-2609 0007] Laptop will not charge", "sam.rezip@example.com", "QST-2609 0007", "Raised", "14 Sep, 21:02", 1],
  ["out", "[QST-2609 0007] We have your message", "sam.rezip@example.com", "QST-2609 0007", "Sent", "14 Sep, 21:02", 1],
  ["out", "[INC-2609 0017] Sam replied", "ada@tiqo.local", "INC-2609 0017", "Failed", "14 Sep, 19:40", 5, "550 5.1.1 Mailbox does not exist"],
  ["in", "Out of office: automatic reply", "j.berg@example.com", "—", "Skipped", "14 Sep, 18:12", 0],
  ["out", "[INC-2609 0014] Status changed to Resolved", "ada@tiqo.local", "INC-2609 0014", "Sent", "14 Sep, 17:31", 1],
];
const mailStatus = (s) => ({ Sent: tag("Sent", "pos"), Filed: tag("Filed as reply", "pos"), Raised: tag("Raised a ticket", "brand"), Failed: tag("Failed", "neg"), Skipped: tag("Skipped · auto-reply") }[s]);
function mailLogTable(expanded = false) {
  return `
  <div class="card" style="overflow:hidden">
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line)">
      ${segToggle(["All", "Sent", "Received", "Failed 1"], "All")}
      ${searchBox("Search address, subject or ticket", 240, 26)}
      <span class="t3" style="font-size:11.5px;margin-left:auto">Last 50 · older mail is on the ticket</span>
    </div>
    ${MAILLOG.map(([dir, subj, addr, tk, st, when, att, err], i) => `
      <div style="display:grid;grid-template-columns:16px minmax(0,1fr) 190px 118px 130px 100px 80px;gap:12px;align-items:center;height:40px;padding:0 12px;${i ? "border-top:1px solid var(--line)" : ""};${st === "Failed" ? "background:color-mix(in oklab,var(--negative) 5%,transparent)" : ""}">
        <span class="t3" style="display:flex">${ic(dir === "out" ? "send" : "inbox", "", 13)}</span>
        <span style="font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subj}</span>
        <span class="mono t2" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${addr}</span>
        <span>${tk === "—" ? '<span class="t3">—</span>' : ref(tk)}</span>
        <span>${mailStatus(st)}</span>
        <span class="mono t3" style="font-size:11px">${when}</span>
        <span style="display:flex;justify-content:flex-end;gap:2px">${st === "Failed" ? `<span class="btn outline sm" style="height:24px">${ic("refresh")}Send again</span>` : `<span class="mono t3" style="font-size:11px">${att > 1 ? att + " tries" : ""}</span>`}</span>
      </div>${st === "Failed" && expanded ? `<div style="padding:8px 12px 12px 40px;font-size:12px;display:flex;gap:10px;align-items:flex-start;background:color-mix(in oklab,var(--negative) 5%,transparent)"><span style="color:var(--negative);display:flex">${ic("warn", "", 14)}</span><div><div class="mono" style="font-size:11.5px;color:var(--negative)">${err}</div><div class="t3" style="margin-top:3px;font-size:11.5px">5 attempts over 40 minutes, given up at 20:20. The address is Ada's — check the account, then Send again.</div></div></div>` : ""}`).join("")}
  </div>`;
}
function healthStrip() {
  const tile = (icon, title, big, sub, tone, extra = "") => `
    <div class="card" style="display:flex;align-items:center;gap:10px;padding:12px 14px;flex:1;min-width:0;overflow:hidden">
      <span style="width:32px;height:32px;border-radius:8px;background:color-mix(in oklab,${tone} 14%,transparent);color:${tone};display:flex;align-items:center;justify-content:center;flex:none">${ic(icon, "", 16)}</span>
      <div style="line-height:1.25;min-width:0;flex:1"><div class="t3" style="font-size:11px">${title}</div><div style="font-weight:600;font-size:13.5px;margin-top:1px;white-space:nowrap">${big}</div><div class="t3" style="font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div></div>${extra}
    </div>`;
  return `<div style="display:flex;gap:12px">
    ${tile("send", "Sending", "Connected", "41 sent today · last 2 min ago", "var(--positive)")}
    ${tile("inbox", "Collecting", "Connected", "Polled 21:19 · 3 filed, 1 raised", "var(--positive)")}
    ${tile("refresh", "Queue", "1 failed", "0 waiting · 5 tries", "var(--negative)", `<span class="btn outline sm" style="height:24px;flex:none">${ic("refresh")}Retry</span>`)}
    ${tile("clock", "Poll", "Every minute", `<span class="mono">…/api/mail/poll</span> · token set`, "var(--brand)", `<span class="btn ghost sm" style="height:24px;flex:none">${ic("play")}Now</span>`)}
  </div>`;
}
const mailField = (label, v, opts = {}) => field(label, input(v, { h: 30, ...opts }), opts);
function sendingCard(dirty = false) {
  return `
  <div class="card" style="overflow:hidden">
    <div style="padding:14px 16px 4px;display:grid;grid-template-columns:1fr 100px;gap:12px">
      ${mailField("Host", "smtp.example.com", { mono: true })}${mailField("Port", "587", { mono: true })}
      <div style="grid-column:1/-1">${checkbox("Connect over TLS from the start", false, { size: 12.5 })}<div class="t3" style="font-size:11.5px;margin:3px 0 0 23px">Port 465 wants this on; 587 starts plain and upgrades with STARTTLS.</div></div>
      ${mailField("Username", "desk@example.com", { mono: true })}${field("Password", input("••••••••", { h: 30, right: '<span class="t3" style="font-size:11px">set</span>' }))}
      ${mailField("Sender name", "Tiqo service desk", dirty ? { dirty: true } : {})}${mailField("Sender address", "support@example.com", { mono: true })}
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px 14px"><span class="btn outline sm">${ic("play")}Test</span><span style="font-size:12px;color:var(--positive);display:flex;align-items:center;gap:5px">${ic("check", "", 13)}Connected · smtp.example.com said hello as mail-3.example.com</span></div>
    ${dirty ? saveFoot("Sender name") : savedFoot()}
  </div>`;
}
function collectingCard() {
  return `
  <div class="card" style="overflow:hidden">
    <div style="padding:14px 16px 4px;display:grid;grid-template-columns:1fr 100px;gap:12px">
      ${mailField("Host", "imap.example.com", { mono: true })}${mailField("Port", "993", { mono: true })}
      <div style="grid-column:1/-1">${checkbox("Connect over TLS", true, { size: 12.5 })}<div class="t3" style="font-size:11.5px;margin:3px 0 0 23px">Port 993 wants this on; 143 starts plain and upgrades with STARTTLS.</div></div>
      ${mailField("Username", "desk@example.com", { mono: true })}${field("Password", input("••••••••", { h: 30, right: '<span class="t3" style="font-size:11px">set</span>' }))}
      ${mailField("Collect from", "INBOX", { mono: true })}${mailField("Move to when filed", "Processed", { mono: true })}
      <div style="grid-column:1/-1">${field("Unknown senders", select("Create a requester account and file the mail", { h: 30 }), { hint: "Follows self-registration. With it off, strangers get a bounce — once a day per address." })}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px 14px"><span class="btn outline sm">${ic("play")}Test</span><span class="t3" style="font-size:12px">Tests with what is on screen, saved or not.</span></div>
    ${savedFoot()}
  </div>`;
}
function mailB() {
  const body = `
  <div style="padding:20px 32px 0">${healthStrip()}</div>
  <div style="margin-top:16px">${tabRow([["Connection"], ["Wording", "7"], ["Signature"], ["Log", "50"]], "Log")}</div>
  <div style="padding:20px 32px;display:flex;flex-direction:column;gap:16px">
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
      ${[["Sent today", "41", "var(--positive)"], ["Received today", "9", "var(--p-medium)"], ["New tickets by mail", "1", "var(--brand)"], ["Bounced", "2", "var(--text-3)"]].map(([l, n, c]) => `<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:4px"><span class="t3" style="font-size:11px">${l}</span><span class="mono tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;color:${c}">${n}</span></div>`).join("")}
    </div>
    ${mailLogTable(true)}
  </div>`;
  return settingsShell("Mail", body, 1000);
}

/* ====================================================================== */
/*                        SETTINGS — change template                       */
/* ====================================================================== */

const PHASES = [
  { n: "Precautions", by: "AA", steps: [["Inventarise the request", "Ada Admin", "", "30 min", ""], ["Check against the access policy", "", "Inventarise the request", "1 h", "Security"], ["Make any necessary precautions", "", "Check against the access policy", "2 h", "Security"]] },
  { n: "Develop", by: null, steps: [["Create the script and commit", "", "", "1 d", ""], ["Write the runbook page", "", "Create the script and commit", "2 h", ""], ["Review the script", "", "Create the script and commit", "1 h", "Infrastructure"], ["Update script", "", "Review the script", "2 h", ""]] },
  { n: "Test", by: null, steps: [["Run it against the test data", "", "", "1 h", ""], ["Compare the output with last month's sheet", "", "Run it against the test data", "30 min", "Finance"]] },
  { n: "Deploy", by: "MK", steps: [["Run it once by hand", "", "", "1 h", "Infrastructure"], ["Schedule it", "", "Run it once by hand", "15 min", ""], ["Tell the requester and close", "", "Schedule it", "15 min", ""]] },
];
function templateDesigner() {
  const SELECTED = "Make any necessary precautions";
  const stepRow = ([n, who, dep, est, role], idx) => {
    const on = n === SELECTED;
    return `
    <div style="display:grid;grid-template-columns:18px 24px minmax(0,1fr) 150px 190px 56px 26px;gap:10px;align-items:center;height:32px;padding:0 10px 0 12px;border-top:1px solid var(--line);position:relative;${on ? "background:var(--brand-tint)" : ""}">
      ${on ? '<i style="position:absolute;left:0;top:6px;bottom:6px;width:2px;background:var(--brand);border-radius:0 2px 2px 0"></i>' : ""}
      <span class="t3" style="display:flex;cursor:grab;opacity:.6">${ic("drag")}</span>
      <span class="mono t3" style="font-size:11px">${idx}</span>
      <span style="font-size:12.5px;font-weight:500;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:11.5px;min-width:0">${who ? `${avatar("AA", 16)}<span class="t2" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who}</span>` : role ? `<span class="tag">${role}</span>` : '<span class="t3">Default</span>'}</span>
      <span class="t3" style="font-size:11px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px">${dep ? `${ic("chevu", "", 10)}after ${dep}` : ""}</span>
      <span class="mono t3" style="font-size:11px;text-align:right">${est}</span>
      ${iconBtn("dots", "Move · Remove")}
    </div>`;
  };
  let idx = 0;
  const phaseGroup = (p, i) => `
    <div style="display:flex;align-items:center;gap:10px;height:30px;padding:0 12px;background:var(--surface-2);${i ? "border-top:1px solid var(--line)" : ""}">
      <span class="mono" style="width:18px;height:18px;border-radius:5px;background:var(--surface-3);display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600">${i + 1}</span>
      <span style="font-size:12.5px;font-weight:600">${p.n}</span>
      <span class="t3" style="font-size:11px">${p.steps.length} steps</span>
      ${p.by ? `<span class="tag" style="margin-left:auto;background:var(--brand-tint);color:var(--brand-deep)">${ic("stamp", "", 10)} Sign-off · ${AV_NAME[p.by].split(" ")[0]}</span>` : `<span class="t3" style="margin-left:auto;font-size:11px">No sign-off</span>`}
      <span class="t3" style="display:flex;gap:2px">${iconBtn("plus", "Add a step here")}${iconBtn("dots", "Rename · Move · Remove")}</span>
    </div>
    ${p.steps.map((s) => stepRow(s, ++idx)).join("")}`;
  const strip = `
    <div style="display:flex;align-items:center;gap:6px;padding:0 0 12px">
      <span class="chip on" style="height:28px">All steps <span class="mono t3" style="font-size:11px;margin-left:2px">12</span></span>
      ${PHASES.map((p, i) => `<span class="chip" style="height:28px;gap:7px"><span class="mono t3" style="font-size:10.5px">${i + 1}</span>${p.n}<span class="mono t3" style="font-size:11px">${p.steps.length}</span>${p.by ? `<span style="color:var(--brand-deep);display:flex" title="Sign-off · ${AV_NAME[p.by]}">${ic("stamp", "", 11)}</span>` : ""}</span>`).join("")}
      <span class="chip" style="height:28px;border-style:dashed;color:var(--text-3)">${ic("plus", "", 12)}Phase</span>
    </div>`;
  const outline = `
  <div style="padding:18px 24px 20px 32px;display:flex;flex-direction:column;min-width:0">
    <div style="display:flex;align-items:flex-start;gap:12px;padding-bottom:14px">
      <div style="flex:1;min-width:0">${h1("Automate a process", 20)}<div class="t2" style="font-size:12.5px;margin-top:4px">This plan is used to automate a process. <span class="t3">· Approval by Ada Admin before anything starts · steps go to whoever applies it</span></div></div>
      <span class="btn ghost sm" style="height:28px">${ic("edit")}Edit details</span>
    </div>
    ${strip}
    <div class="card" style="overflow:hidden">
      <div class="label" style="display:grid;grid-template-columns:18px 24px minmax(0,1fr) 150px 190px 56px 26px;gap:10px;height:30px;align-items:center;padding:0 10px 0 12px;font-size:10.5px"><span></span><span>#</span><span>Step</span><span>Who</span><span>After</span><span style="text-align:right">Est.</span><span></span></div>
      ${PHASES.map(phaseGroup).join("")}
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--line)"><div class="input" style="height:28px;flex:1"><span class="ph">Add a step to Deploy…</span></div><span class="btn outline sm" style="height:28px">${ic("plus")}Add</span></div>
    </div>
    <div class="t3" style="font-size:11.5px;line-height:1.5;margin-top:12px;display:flex;gap:8px">${ic("info", "", 14)}<span>Drag a step to another phase to move it. A phase starts when the one before it is finished and its sign-off has said yes; steps run in any order unless one says “after”.</span></div>
  </div>`;
  const inspector = `
  <aside style="border-left:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:12px;overflow:hidden">
    ${card(cardHead("Step 3 · Precautions", iconBtn("x", "Deselect")), `
      <div style="padding:14px 14px 4px;display:flex;flex-direction:column;gap:12px">
        ${field("Name", input("Make any necessary precautions", { h: 30 }))}
        ${field("Instructions", textarea("Check the request against the access policy. If it touches production data, ask Security before the next phase.", 3, { dirty: true }), { hint: "Shown on the step when the plan is applied." })}
        ${field("Who does it", select(`${ic("people", "t3", 13)} Security group`, { h: 30 }), { hint: "A person, a group, or the change's default assignee." })}
        ${field("After", select("Check against the access policy", { h: 30 }), { hint: "Cannot start until that step is done." })}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field("Estimate", input("2 h", { h: 30, mono: true }))}${field("If skipped", select("Needs a reason", { h: 30 }))}</div>
      </div>
      <div style="padding:10px 14px 14px">${checkbox("Blocks the phase from finishing", true, { size: 12.5 })}</div>
      ${saveFoot("Instructions")}`)}
    ${card(cardHead("Where it is used", '<span class="mono t3" style="font-size:11px">4</span>'), `<div style="padding:4px 0">${[["CHG-2609 0004", "Automate the weekly export", "new"], ["CHG-2609 0005", "Retire the legacy export job", "resolved"], ["CHG-2608 0011", "Move the intranet to the new hosting account", "progress"]].map(([r, t, s]) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px">${ring(s)}<span style="min-width:0;display:flex;flex-direction:column;line-height:1.2">${ref(r)}<span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span></span></div>`).join("")}<div class="t3" style="font-size:11px;padding:6px 14px 10px">Changes keep the plan they were given; editing here changes the next one.</div></div>`)}
  </aside>`;
  const body = `
  <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 32px;border-bottom:1px solid var(--line)">
    <a class="t3" style="font-size:12px;display:flex;align-items:center;gap:4px">${ic("arrowl", "", 12)}Settings · Change templates</a><span class="t3">·</span><span style="font-size:12.5px;font-weight:500">Automate a process</span><span class="t3" style="font-size:11.5px;margin-left:8px">4 phases · 12 steps · about 3 days</span>
    <div style="margin-left:auto;display:flex;gap:6px"><span class="btn outline sm">${ic("eye")}Preview on a change</span><span class="btn outline sm">${ic("copy")}Duplicate</span><span class="btn ghost sm" style="color:var(--negative)">${ic("trash")}Delete</span></div>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 360px;height:${1000 - 48 - 44}px">
    ${outline}
    ${inspector}
  </div>`;
  return shell("settings", ["Settings", "Change templates", "Automate a process"], body, 1000);
}

const TEMPLATES = [
  ["received", "We have your message", "Whoever writes in", "[{reference}] We have your message", true, "AA", "12 Sep", 9],
  ["answered", "Someone replied to you", "The requester, on a public reply", "[{reference}] {actor} replied", true, "AA", "12 Sep", 41],
  ["status", "Where a request has got to", "The requester, on a status change", "[{reference}] Now {status}", false, null, null, 27],
  ["approval", "A decision is waiting on you", "The person asked to approve", "[{reference}] Your approval is needed", false, null, null, 3],
  ["decided", "A decision has been made", "Whoever asked", "[{reference}] {actor} {decision} your request", false, null, null, 2],
  ["bounce", "Mail the desk cannot file", "A sender with no account", "We could not file your message", false, null, null, 2],
  ["internal", "Assigned, forwarded, mentioned", "Operators", "[{reference}] {title}", false, null, null, 58],
];
function mailTemplates() {
  const cols = "minmax(0,1.2fr) 190px minmax(0,1fr) 110px 130px 70px 70px";
  const head = `<div class="label" style="display:grid;grid-template-columns:${cols};gap:12px;height:32px;align-items:center;padding:0 14px;border-bottom:1px solid var(--line);font-size:10.5px"><span>Kind</span><span>Goes to</span><span>Subject</span><span>Wording</span><span>Last edited</span><span style="text-align:right">Sent · 30 d</span><span></span></div>`;
  const rows = TEMPLATES.map(([k, t, who, subj, ed, by, when, sent], i) => `
    <div style="display:grid;grid-template-columns:${cols};gap:12px;align-items:center;height:44px;padding:0 14px;${i ? "border-top:1px solid var(--line)" : ""}">
      <span style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span>
      <span class="t2" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who}</span>
      <span class="mono t2" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subj}</span>
      <span>${ed ? tag("Edited") : '<span class="t3" style="font-size:11.5px">Shipped</span>'}</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:11.5px" class="t3">${by ? `${avatar(by, 16)}<span>${when}</span>` : "—"}</span>
      <span class="mono t3" style="font-size:11.5px;text-align:right">${sent}</span>
      <span style="display:flex;justify-content:flex-end"><span class="btn outline sm" style="height:26px">${ic("edit")}Edit</span></span>
    </div>`).join("");
  const body = `
  <div style="padding:20px 32px 0">${healthStrip()}</div>
  <div style="margin-top:16px">${tabRow([["Connection"], ["Wording", "7"], ["Signature"], ["Log", "50"]], "Wording")}</div>
  <div style="padding:20px 32px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:10px"><span class="t2" style="font-size:12.5px">Seven kinds of mail. A template left alone follows the shipped wording, so an upgrade improves it; edit one and it is yours until you go back.</span><span class="btn outline sm" style="margin-left:auto;height:28px">${ic("send")}Send me every kind</span></div>
    <div class="card" style="overflow:hidden">${head}${rows}</div>
  </div>`;
  return settingsShell("Mail", body, 900);
}
function mailTemplateDesigner() {
  const varChip = (v) => `<span class="chip" style="height:24px;font-size:11.5px;font-family:'Geist Mono',monospace">{${v}}</span>`;
  const body = `
  <div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 32px;border-bottom:1px solid var(--line)">
    <a class="t3" style="font-size:12px;display:flex;align-items:center;gap:4px">${ic("arrowl", "", 12)}Mail · Wording</a><span class="t3">·</span><span style="font-size:12.5px;font-weight:500">Someone replied to you</span>${tag("Edited")}
    <div style="margin-left:auto;display:flex;gap:6px"><span class="btn outline sm">${ic("send")}Send me a test</span><span class="btn outline sm">${ic("refresh")}Back to the shipped wording</span></div>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 560px;height:${1000 - 48 - 44 - 52}px">
    <div style="padding:22px 32px;display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden">
      ${field("Subject", input("[{reference}] {actor} replied", { h: 34, mono: true, style: "font-size:13px" }))}
      <div style="display:flex;flex-direction:column;gap:5px;flex:1;min-height:0">
        <span class="label" style="font-size:10.5px">Body</span>
        <div class="input" style="flex:1;align-items:flex-start;padding:12px 14px;white-space:pre-wrap;line-height:1.6;font-size:13px;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)">{actor} replied to your request:

{body}

Reply to this mail to answer, or open it on the portal.</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center"><span class="t3" style="font-size:11.5px;margin-right:4px">Insert</span>${["reference", "title", "actor", "body", "status", "link", "requester", "desk", "assignee"].map(varChip).join("")}</div>
      <div class="t3" style="font-size:12px;line-height:1.5;display:flex;gap:8px">${ic("info", "", 14)}<span>The reference, the link, the reply marker and the signature are added under every mail — you do not need to write them. Markdown works: <b>**bold**</b>, lists, links.</span></div>
    </div>
    <aside style="border-left:1px solid var(--line);background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:16px;overflow:hidden">
      ${card(cardHead("Preview", `<span style="display:flex;gap:6px;align-items:center">${segToggle(["HTML", "Plain"], "HTML")}${segToggle(["Light", "Dark client"], "Light")}</span>`), `
        <div style="padding:14px;background:var(--surface-2)">
          <div style="background:#f4f4f5;border-radius:8px;padding:16px;color:#18181b;font-size:12.5px;line-height:1.55;border:1px solid var(--line)">
            <div style="color:#71717a;font-size:11.5px;margin-bottom:10px;line-height:1.5"><b style="color:#18181b">[INC-2609 0119] Sam replied</b><br>Tiqo service desk &lt;support@example.com&gt; · to sanne.lin@example.com</div>
            <div style="background:#fff;border-radius:6px;padding:18px 20px;border:1px solid #e4e4e7"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="width:20px;height:20px;border-radius:5px;background:#febe2e"></span><b>Tiqo service desk</b></div><div>Sam replied to your request:</div><div style="color:#52525b;margin-top:10px;padding-left:12px;border-left:2px solid #e4e4e7">Batch of WD19TB docks — firmware update rolling out tomorrow morning.</div><div style="margin-top:10px">Reply to this mail to answer, or open it on the portal.</div><div style="margin:16px 0;border-top:1px dashed #d4d4d8;color:#a1a1aa;font-size:11px;text-align:center">— reply above this line —</div><div style="color:#71717a;font-size:11.5px;line-height:1.55">Tiqo service desk · Mon–Fri 08:30–17:30 · +31 30 123 4567<br>support@example.com</div><div style="display:flex;justify-content:space-between;color:#a1a1aa;font-size:11.5px;margin-top:10px"><span>INC-2609 0119</span><span style="color:#b7790a">Open on the portal</span></div></div>
          </div>
        </div>`)}
      ${card(cardHead("When it goes out"), kv([["Trigger", "A public reply on a ticket"], ["To", "The requester"], ["Never", "For internal notes, or to the person who wrote the reply"], ["Sent · 30 d", '<span class="mono">41</span>']], "80px 1fr"))}
    </aside>
  </div>
  <div style="display:flex;align-items:center;gap:10px;height:52px;padding:0 32px;border-top:1px solid var(--line);background:var(--bg)">
    <span class="btn primary" style="height:30px">${ic("check")}Save</span><span class="btn ghost" style="height:30px">Cancel</span>
    <span class="t3" style="font-size:12px;display:flex;align-items:center;gap:6px;margin-left:auto"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>Body changed</span>
  </div>`;
  return shell("settings", ["Settings", "Mail", "Wording", "Someone replied to you"], body, 1000);
}

/* ====================================================================== */
/*                                 boards                                  */
/* ====================================================================== */

const BOARDS = [
  ["AssetsRegisterSplit", registerB(), 900, "Assets · register · split with peek and saved views"],
  ["Asset", assetPage(), 1000, "Asset · read view with rail"],
  ["AssetEdit", assetPage({ edit: true }), 1000, "Asset · editing (draft)"],
  ["DocsHome", docsHome(), 900, "Documentation · home"],
  ["DocsSpace", spacePage(), 900, "Documentation · a space"],
  ["Doc", docPage(), 1000, "Document · reading"],
  ["DocEdit", docEdit(), 1000, "Document · editing (draft)"],
  ["DocCompare", docCompare(), 900, "Document · compare versions"],
  ["AssetTypes", typeDesigner(), 1000, "Settings · asset types · designer"],
  ["AssetTypesPreview", typeDesigner({ popup: true }), 1000, "Settings · asset types · preview popup"],
  ["DocSpaces", docSpacesSettings({ dialog: true }), 900, "Settings · documentation spaces"],
  ["MailLog", mailB(), 1000, "Settings · mail · Log tab"],
  ["MailTemplates", mailTemplates(), 900, "Settings · mail · Wording tab, the templates as a table"],
  ["MailTemplateDesigner", mailTemplateDesigner(), 1000, "Settings · mail · one template, its own page"],
  ["ChangeTemplate", templateDesigner(), 1000, "Settings · change template · designer"],
];

const NOTES = {
  AssetsRegisterSplit: "Round 10 — Assets, chosen 16 Sep: the split register. The table keeps name (with serial or model underneath), type and lifecycle; the right pane shows whoever is selected — details with the warranty bar, connections, open tickets and the one-hop warning — so browsing forty laptops does not mean forty page loads. Open and Edit jump to the full page; List / Split toggles the pane. The sidebar carries the types, Saved views (Expiring in 30 days, With open tickets, Retired, plus Save current view) and a lifecycle strip. Rows still have a checkbox for the bulk verbs; Columns, Export CSV, Import and New asset stay in the page head.",
  Asset: "One asset. The page reads first and edits second: a header band with the glyph, model, serial and group, the lifecycle as a pill, Print label, Edit and a menu. Details is a label/value grid in two columns (the form is gone until Edit). Tickets raised against this has Open / All and a Raise button that pre-fills the asset. The rail: Connected to, grouped by verb with the inverse readings under a rule; Also open nearby, the one-hop inference surfaced on the asset itself rather than only on tickets; Lifecycle with the purchased → warranty bar and a retirement slot; a Label card with a QR that opens this page — for rack doors and loan laptops.",
  AssetEdit: "The same asset while editing. Edit turns Details into the form (same fields, same order), the header shows the unsaved count, and Save / Cancel sit in the card's own footer with a summary of what changed. Dirty fields get the amber ring. 'Mounted in' is the new Another-asset kind with a picker limited to Network items. The rail is untouched — relations and tickets are list-level and never wait for Save.",
  DocsHome: "Round 10 — Documentation. The home page becomes search-first: one wide box over titles and text, with / as the shortcut. Pinned by you is new — three pages you keep coming back to, per person. Space cards carry the team, page count and a stale count so the state of the writing is visible at a glance. Recently updated stays; Needs review is now actionable — Still correct and Edit on each row — and the footer gives the desk-wide count with a link to a review queue for whoever runs the reviews.",
  DocsSpace: "A space. The tree rail gets the space header (colour, team, counts), a find-in-space box, stale dots on pages and a real New page button. The shelf gains filter chips — All / Stale / Mine / Archived — an owner filter, sort, and a cards / list toggle. Cards show title, summary, owner, last update and the review chip. Space settings is one click away for the people who manage it.",
  Doc: "A document, reading. Three columns: tree, article, rail. The article gets an 'On this page' outline, a meta line (review chip, owner, updated, read time), reference chips for tickets, assets and pages, and sub-pages as cards underneath. The toolbar keeps Edit and the menu (Move · Publish · Archive · Print) and adds Pinned and Reading mode, which hides both rails. The rail is all contained cards: Ownership & review with Still correct and a Remind me; On the portal, which now says when the answer has fallen behind the page and offers Publish again; Referenced from; Files; History with Compare.",
  DocEdit: "Editing. The draft is unmistakable — amber ring on the body, 'Editing · unsaved' in the toolbar, ⌘S / Esc hints in the editor bar. Title and summary are inputs above the body, not separate dialogs. The toolbar carries a paperclip and an image button and a hint that # references anything. The footer holds Save, Cancel, an optional change note (it becomes the History line) and a tick for 'counts as a review'. Top right: who else has the page open — the collision warning before it is a collision.",
  DocCompare: "Compare. Two versions side by side, each picked from a dropdown, removed lines struck in red and added lines in green, a count in the header, an Inline toggle, and Restore this version on the older side. The current version is marked and cannot be restored over itself.",
  AssetTypes: "Round 10 — Settings, revised 16 Sep. Asset types: one designer, full width. The type is picked from a selector in the top bar (with New type beside it); Preview, Duplicate and Delete sit on the right. Name and key on one row with an Icon button and a Colour button — each opens its own picker (the icon one is shown open) instead of a strip of swatches. Attributes as a table with room to breathe: drag handle, label, key, kind, required, remove, and the kind-specific line underneath (options for a list, 'counts as an expiry' for a date, 'points at' for another asset). Below: default register columns and an optional name pattern. One Save for the whole draft.",
  AssetTypesPreview: "The Preview button opens a popup: how an item of this type reads, following the draft even before it is saved — the item page card, or the register row, or a compact card, from a toggle. It replaces the always-on preview pane so the designer keeps the width.",
  DocSpaces: "Documentation spaces. One row per space with the team that answers for it, page and stale counts, the default review interval and the portal category Publish uses. Edit opens a dialog (draft: Save enabled only when something changed; Delete tucked left). Below, review defaults for the whole desk: when the owner is reminded, how often, who it escalates to, and whether editing counts as a review.",
  MailLog: "Round 10 — Mail, chosen 16 Sep: tabs. A health strip stays above every tab: Sending, Collecting, Queue (failed count with Send again), Poll (the address the cron calls, token state, Poll now). Tabs: Connection (sending, collecting and polling, each a draft with Test and Save) · Wording · Signature · Log. Shown on Log: four counters for the day, then the last fifty messages in and out — direction icon, subject, address, the ticket as a chip, the status as a tag — with Send again on a failure and the server's error and attempt history expanded underneath.",
  MailTemplates: "The Wording tab, revised 16 Sep: the seven kinds as a table — kind, who it goes to, the subject, Shipped or Edited, who last edited it and when, how many went out in 30 days — with an Edit button per row and 'Send me every kind' for a quick check of the whole set. Nothing is edited in place here.",
  MailTemplateDesigner: "Edit opens the template on its own page, without the settings side-nav, so the body and the preview both get room. Left: subject and a tall body with the amber ring while dirty, insertable variables as chips, and the note that the reference, link, reply marker and signature are always added. Right: the preview (HTML or plain, light or a dark mail client) at readable size, and a small 'When it goes out' card — trigger, recipient, the never rule, the 30-day count. Send me a test and Back to the shipped wording in the top bar; Save and Cancel in a footer that names what changed.",
  ChangeTemplate: "Round 10 — Change template, redrawn again 16 Sep for plans of a dozen steps. The designer is its own page without the settings side-nav, like the form and mail-template designers, so the table gets the width. A phase strip on top — All steps, then one chip per phase with its step count and a stamp when it has a sign-off, and a dashed chip to add one — filters the table below; All is shown here with twelve steps in four phases, and it fits without scrolling. The table is dense: a slim phase header row (name, count, sign-off, add and menu) and 32px step rows with number, name, who, after and estimate; drag a step to another phase to move it. Clicking a row fills the inspector on the right — name, instructions, who, after, estimate, if skipped, blocks the phase — as one draft with Save, plus where the template is already in use. The template's own details open from Edit details in the header. Preview on a change, Duplicate and Delete in the top bar.",
};

/* write boards and a layout fragment for page 2 */
const files = [];
let y = 0;
const layout = [];
const annotations = [];
for (const [name, body, h, title] of BOARDS) {
  writeFileSync(join(out, `${name}.dc.html`), page("dark", body, `.shell{height:${h}px}`));
  writeFileSync(join(out, `${name}Light.dc.html`), page("light", body, `.shell{height:${h}px}`));
  files.push(`${name}.dc.html`, `${name}Light.dc.html`);
  layout.push({ file: `${name}.dc.html`, x: 0, y, w: 1440, h, title: `${title} · dark`, page: "page-2" });
  layout.push({ file: `${name}Light.dc.html`, x: 1560, y, w: 1440, h, title: `${title} · light`, page: "page-2" });
  annotations.push({ id: `r10-${name.toLowerCase()}`, x: 3120, y, w: 460, text: NOTES[name], page: "page-2" });
  y += h + 180;
}
writeFileSync(join(out, "layout4.json"), JSON.stringify({ artboards: layout, annotations }, null, 2));
console.log(`wrote ${files.length} boards to ${out}; page height ${y}`);
