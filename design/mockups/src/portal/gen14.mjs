// Round 14 — the overview pages (tickets, projects, assets) inside the chosen frame.
// Three answers to "a white sheet in a grey inset in a white frame reads as a box in a box":
//   A  head and filters on the ground, the table alone is the sheet
//   B  the inset panel itself becomes the sheet on one-object pages (the grey rim goes)
//   C  a views column on the ground beside the sheet, the same on all three pages
// Usage: node src/portal/gen14.mjs boards
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FONT, BASE_CSS, I, ic, bars, ring, status, avatar, ref, spine, T, rail } from "../shared.mjs";
import { TOKENS } from "./css12.mjs";

const out = process.argv[2] ?? "build";
mkdirSync(out, { recursive: true });

const LAYER = `
  :root { --highlight: var(--card); --shadow: var(--lift); --bg: #f7f7f9; --card: 0 0 0 1px rgba(9,9,11,.05), 0 1px 2px rgba(9,9,11,.04), 0 8px 24px -12px rgba(9,9,11,.10); }
  .dark { --bg: #0e0e11; --surface: #17171b; --surface-2: #202025; --card: 0 0 0 1px rgba(255,255,255,.06), 0 12px 30px -16px rgba(0,0,0,.7); }
  .shell { background: var(--surface); height: 100%; }
  .dark.shell, .dark .rail, .dark .bar { background: #111114; }
  .rail, .bar { background: var(--surface); border: 0; }
  .main { margin: 0 12px 12px 0; border-radius: 14px; background: var(--bg); overflow: hidden; display: flex; flex-direction: column; }
  .rail .nav a.on { background: var(--surface-2); }
  .bar .input, .bar .btn.ghost { box-shadow: none; background: var(--surface-2); border-color: transparent; }
  .card, .sheet { background: var(--surface); box-shadow: var(--card); border: 0; border-radius: 12px; }
  .input { border-color: transparent; background: var(--surface); box-shadow: var(--card); }
  .btn.outline { border-color: transparent; box-shadow: var(--card); }
  .chip { border-color: transparent; background: var(--surface); box-shadow: var(--card); }
  .chip.on { background: var(--text); color: var(--bg); box-shadow: none; }
  .seg { background: var(--surface); box-shadow: var(--card); } .seg .chip { box-shadow: none; background: transparent; } .seg .chip.on { background: var(--text); color: var(--bg); }
  .pagehead { border-bottom: 0; }
  .ph2 { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 24px; }
  .ph2 h1 { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: -.01em; }
  .filters { display: flex; align-items: center; gap: 8px; padding: 0 24px 12px; }
  .filters .pv { background: var(--surface); box-shadow: var(--card); height: 28px; padding: 0 10px; }
  .thead { display: grid; gap: 12px; height: 32px; align-items: center; padding: 0 20px; background: var(--surface-2); }
  .trow { position: relative; display: grid; gap: 12px; align-items: center; height: 40px; padding: 0 20px; font-size: 13px; }
  .trow + .trow { border-top: 1px solid var(--line); }
  .trow .t { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tfoot { display: flex; align-items: center; gap: 12px; padding: 10px 20px; font-size: 12.5px; color: var(--text-3); border-top: 1px solid var(--line); }
  .tfoot .btn { margin-left: auto; }
  /* the views column (C) and the asset types column */
  .views { width: 200px; flex: none; padding: 4px 0 0 24px; display: flex; flex-direction: column; gap: 2px; }
  .views a { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border-radius: 8px; color: var(--text-2); font-size: 13px; }
  .views a.on { background: var(--surface); color: var(--text); font-weight: 500; box-shadow: var(--card); }
  .views a .n { margin-left: auto; font-family: "Geist Mono", monospace; font-size: 11px; color: var(--text-3); }
  .views .sec { font-size: 11px; color: var(--text-3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 12px 10px 6px; }
  .views .add { color: var(--text-3); font-size: 12.5px; }
  .peek { width: 300px; flex: none; }
  .kv { display: grid; grid-template-columns: 90px 1fr; gap: 6px 10px; padding: 10px 16px; font-size: 12.5px; }
  .kv .k { color: var(--text-3); }
`;

const barx = (crumbs) => `<header class="bar"><div style="display:flex;align-items:center;gap:6px;font-size:13px">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span style="color:var(--text);font-weight:500">${c}</span>` : `<span class="t3">${c}</span><span class="t3" style="display:flex">${ic("chev")}</span>`)).join("")}</div><div style="margin-left:auto;display:flex;align-items:center;gap:8px"><div class="input" style="width:260px;height:30px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search tickets, people, projects</span><kbd style="margin-left:auto">⌘K</kbd></div><span class="btn primary" style="height:30px">${ic("plus")}New</span><span class="btn ghost" style="width:30px;padding:0;justify-content:center">${ic("bell")}</span>${avatar("AA", 26)}</div></header>`;
const shell = (active, crumbs, body) => `<div class="shell">${rail(active)}${barx(crumbs)}<div class="main">${body}</div></div>`;

/* ------------------------------------------------------------- tickets */
const COLS = "120px minmax(0,1fr) 72px 48px 176px 40px 32px 44px";
const thead = () => `<div class="thead label" style="grid-template-columns:${COLS}"><span>Ticket</span><span>Subject</span><span>Plan</span><span>Replies</span><span>Status</span><span>Pri</span><span></span><span style="text-align:right">Age</span></div>`;
const trow = (t) => `<div class="trow" style="grid-template-columns:${COLS}">${spine(t.p, t.heat, t.hot)}${ref(t.r)}<div style="display:flex;align-items:center;gap:8px;min-width:0"><span class="t">${t.t}</span>${t.tags.map((x) => `<span class="tag">${x}</span>`).join("")}</div><div>${t.plan ? `<span class="t3" style="display:inline-flex;align-items:center;gap:6px"><span style="width:32px;height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden;display:inline-block"><i style="display:block;height:100%;width:${Math.round((t.plan[0] / t.plan[1]) * 100)}%;background:var(--brand)"></i></span><span class="mono" style="font-size:11px">${t.plan[0]}/${t.plan[1]}</span></span>` : ""}</div><div>${t.rep ? `<span class="t3" style="display:inline-flex;align-items:center;gap:4px">${ic("msg")}<span class="mono" style="font-size:11.5px">${t.rep}</span></span>` : ""}</div><div>${status(t.s)}</div><div>${bars(t.p)}</div><div>${avatar(t.a)}</div><div class="mono tnum" style="font-size:12px;text-align:right;color:${t.hot ? `var(--p-${t.p})` : "var(--text-3)"}">${t.age}</div></div>`;
const tableBody = (n = 13) => thead() + T.slice(0, n).map(trow).join("") + `<div class="tfoot">1–${n} of 23<span class="btn ghost sm">Previous</span><span class="btn outline sm" style="margin-left:0">Next</span></div>`;
const headTools = `<div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn outline sm">${ic("layers")}Columns</span><span class="btn outline sm">Urgent first ${ic("chevd")}</span></div>`;
const filterRow = (withViews = true) => `<div class="filters">${withViews ? `<span class="seg"><span class="chip on">All open <span class="mono" style="font-size:11px;opacity:.7">23</span></span><span class="chip">Mine</span><span class="chip">My groups</span><span class="chip">Unassigned</span><span class="chip">Everything</span></span>` : ""}<span class="pv">Any status ${ic("chevd", "t3")}</span><span class="pv">Any priority ${ic("chevd", "t3")}</span><span class="pv">Any type ${ic("chevd", "t3")}</span><span class="pv">All projects ${ic("chevd", "t3")}</span><span class="pv">Anyone ${ic("chevd", "t3")}</span><div class="input" style="width:220px;height:28px;margin-left:auto"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Filter by title or reference</span></div></div>`;

function ticketsA() {
  return shell("tickets", ["Tickets"], `
    <div class="ph2"><h1>Tickets</h1><span class="mono t3" style="font-size:11.5px">23 open · 3 past target</span>${headTools}</div>
    ${filterRow()}
    <div class="sheet" style="margin:0 24px 20px;overflow:hidden">${tableBody(12)}</div>`);
}
function ticketsB() {
  return shell("tickets", ["Tickets"], `
    <div class="sheet" style="flex:1;border-radius:14px;display:flex;flex-direction:column;overflow:hidden">
      <div class="ph2" style="border-bottom:1px solid var(--line)"><h1>Tickets</h1><span class="mono t3" style="font-size:11.5px">23 open · 3 past target</span>${headTools}</div>
      <div style="padding-top:12px;border-bottom:1px solid var(--line)">${filterRow()}</div>
      ${tableBody(13)}
    </div>`);
}
function ticketsC() {
  const views = `<div class="views">
    <div class="sec" style="padding-top:0">Views</div>
    <a class="on">${ic("inbox")}All open<span class="n">23</span></a><a>${ic("user")}Mine<span class="n">6</span></a><a>${ic("users")}My groups<span class="n">11</span></a><a>${ic("flag")}Unassigned<span class="n">4</span></a><a>${ic("layers")}Everything</a>
    <div class="sec">Saved</div>
    <a>${ic("star")}Past target<span class="n">3</span></a><a>${ic("star")}Network, this week</a><a>${ic("star")}Waiting on requester<span class="n">5</span></a>
    <a class="add">${ic("plus")}Save current view</a>
  </div>`;
  return shell("tickets", ["Tickets"], `
    <div class="ph2"><h1>Tickets</h1><span class="mono t3" style="font-size:11.5px">All open · 23 · 3 past target</span>${headTools}</div>
    <div style="display:flex;gap:20px;padding:0 20px 20px 0;flex:1;min-height:0">
      ${views}
      <div class="sheet" style="flex:1;overflow:hidden;display:flex;flex-direction:column"><div style="padding-top:12px;border-bottom:1px solid var(--line)">${filterRow(false)}</div>${tableBody(12)}</div>
    </div>`);
}

/* ------------------------------------------------------------ projects */
const PROJECTS = [
  ["NET", "#4f7bd9", "Network refresh 2026", "Replace every access point and both core switches across the three Utrecht floors.", "On track", "var(--positive)", 62, "Floor 2 cutover · 24 Sep", "MK", "31 Oct"],
  ["SUP", "#febe2e", "Service desk", "The standing queue. Tickets without a project land here.", "At risk", "var(--brand)", 78, "—", "AA", ""],
  ["OFF", "#e0567a", "Office move Rotterdam", "Floors 4 and 5 of the new building, ready for the October starters.", "Off track", "var(--negative)", 35, "Furniture delivery · 19 Sep", "JB", "1 Oct"],
  ["MFA", "#6366f1", "MFA rollout", "Every account on MFA before the insurer's audit.", "On track", "var(--positive)", 55, "Contractors enrolled · 22 Sep", "RD", "30 Sep"],
  ["INT", "#10b981", "Intranet hosting", "Move the intranet to the new hosting account before the old contract ends.", "Paused", "var(--text-3)", 20, "—", "SL", "15 Nov"],
];
const PCOLS = "32px minmax(0,1fr) 120px 170px 200px 130px 70px";
const prow = ([k, c, n, d, h, hc, pct, ms, lead, due]) => `<div class="trow" style="height:56px;grid-template-columns:${PCOLS};gap:16px"><span class="mono" style="width:32px;height:32px;border-radius:8px;background:color-mix(in oklab,${c} 16%,transparent);color:${c};display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600">${k}</span><div style="min-width:0"><div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</div><div class="t3" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div></div><span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px"><i style="width:7px;height:7px;border-radius:99px;background:${hc}"></i>${h}</span><span style="display:flex;align-items:center;gap:10px"><span style="width:100px;height:4px;border-radius:2px;background:var(--surface-3);display:inline-block;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${hc === "var(--negative)" ? "var(--negative)" : "var(--brand)"}"></i></span><span class="mono t3" style="font-size:11.5px">${pct}%</span></span><span style="font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ms}</span><span style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2)">${avatar(lead, 20)}${lead}</span><span class="mono tnum t3" style="font-size:12px;text-align:right">${due || "—"}</span></div>`;
const phead = `<div class="thead label" style="grid-template-columns:${PCOLS};gap:16px"><span></span><span>Project</span><span>Health</span><span>Progress</span><span>Next milestone</span><span>Lead</span><span style="text-align:right">Due</span></div>`;
const ptools = `<div style="margin-left:auto;display:flex;align-items:center;gap:8px"><div class="input" style="width:220px;height:30px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search projects</span></div><span class="seg"><span class="chip on">Active</span><span class="chip">Archived</span><span class="chip">All</span></span><span class="btn primary sm" style="height:30px">${ic("plus")}New project</span></div>`;
const pbody = phead + PROJECTS.map(prow).join("") + `<div class="tfoot">5 active · 1 archived</div>`;
function projectsA() { return shell("projects", ["Projects"], `<div class="ph2"><h1>Projects</h1><span class="mono t3" style="font-size:11.5px">5 active · 1 archived</span>${ptools}</div><div class="sheet" style="margin:0 24px 20px;overflow:hidden">${pbody}</div>`); }
function projectsB() { return shell("projects", ["Projects"], `<div class="sheet" style="flex:1;border-radius:14px;display:flex;flex-direction:column;overflow:hidden"><div class="ph2" style="border-bottom:1px solid var(--line)"><h1>Projects</h1><span class="mono t3" style="font-size:11.5px">5 active · 1 archived</span>${ptools}</div>${pbody}</div>`); }
function projectsC() {
  const views = `<div class="views"><div class="sec" style="padding-top:0">Views</div><a class="on">${ic("folder")}Active<span class="n">5</span></a><a>${ic("user")}Led by me<span class="n">1</span></a><a>${ic("flag")}Off track<span class="n">1</span></a><a>${ic("layers")}Archived<span class="n">1</span></a><div class="sec">Saved</div><a>${ic("star")}Due this quarter<span class="n">3</span></a><a class="add">${ic("plus")}Save current view</a></div>`;
  return shell("projects", ["Projects"], `<div class="ph2"><h1>Projects</h1><span class="mono t3" style="font-size:11.5px">Active · 5</span><div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn primary sm" style="height:30px">${ic("plus")}New project</span></div></div><div style="display:flex;gap:20px;padding:0 20px 20px 0;flex:1;min-height:0">${views}<div class="sheet" style="flex:1;overflow:hidden;display:flex;flex-direction:column"><div class="filters" style="padding-top:12px;border-bottom:1px solid var(--line)"><span class="pv">Any health ${ic("chevd", "t3")}</span><span class="pv">Any lead ${ic("chevd", "t3")}</span><div class="input" style="width:220px;height:28px;margin-left:auto"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search projects</span></div></div>${pbody}</div></div>`);
}

/* -------------------------------------------------------------- assets */
const ASSETS = [
  ["SRV-APP-01", "Server", "Rack B · Utrecht", "In use", "var(--positive)", "3 open"], ["SRV-DB-02", "Server", "Rack B · Utrecht", "In use", "var(--positive)", ""], ["UT-3-07", "Access point", "Floor 3 · Utrecht", "Degraded", "var(--p-high)", "1 open"], ["UT-2-02", "Access point", "Floor 2 · Utrecht", "Degraded", "var(--p-high)", "1 open"], ["LT-0412", "Laptop", "Sanne Lin", "In use", "var(--positive)", ""], ["LT-0398", "Laptop", "Jonas Berg", "In repair", "var(--brand)", "1 open"], ["PRN-1-01", "Printer", "Floor 1 · Utrecht", "In use", "var(--positive)", "1 open"], ["SW-CORE-A", "Switch", "Rack A · Utrecht", "In use", "var(--positive)", ""], ["SW-CORE-B", "Switch", "Rack A · Utrecht", "Spare", "var(--text-3)", ""], ["MON-0221", "Monitor", "Rotterdam · desk 14", "In use", "var(--positive)", ""],
];
const ACOLS = "24px 130px 110px minmax(0,1fr) 110px 70px";
const arow = ([n, ty, w, st, sc, open], i) => `<div class="trow" style="grid-template-columns:${ACOLS};${i === 2 ? "background:var(--surface-2)" : ""}"><span style="width:14px;height:14px;border-radius:4px;border:1.5px solid var(--line-strong)"></span><span class="mono" style="font-size:12px;font-weight:600">${n}</span><span class="t2">${ty}</span><span class="t2" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w}</span><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:99px;background:${sc}"></i>${st}</span><span class="t3" style="font-size:12px">${open}</span></div>`;
const ahead = `<div class="thead label" style="grid-template-columns:${ACOLS}"><span></span><span>Asset</span><span>Type</span><span>Where / who</span><span>State</span><span>Tickets</span></div>`;
const abody = ahead + ASSETS.map(arow).join("") + `<div class="tfoot">1–10 of 84<span class="btn ghost sm">Previous</span><span class="btn outline sm" style="margin-left:0">Next</span></div>`;
const typesCol = (inSheet = false) => `<div class="views" style="${inSheet ? "padding:12px 0 0 12px;width:190px" : ""}"><div class="sec" style="padding-top:0">Types</div><a class="on">${ic("layers")}All<span class="n">84</span></a><a>${ic("laptop")}Laptops<span class="n">31</span></a><a>${ic("panel")}Servers<span class="n">6</span></a><a>${ic("ext")}Network<span class="n">14</span></a><a>${ic("note")}Printers<span class="n">5</span></a><a>${ic("key")}Licences<span class="n">28</span></a><div class="sec">Saved views</div><a>${ic("star")}Expiring in 90 days<span class="n">4</span></a><a>${ic("star")}With open tickets<span class="n">7</span></a><a>${ic("star")}Not seen 30 days</a><a class="add">${ic("plus")}Save current view</a></div>`;
const peek = `<div class="card peek" style="align-self:flex-start"><div style="display:flex;align-items:center;gap:10px;padding:14px 16px 10px"><span class="mono" style="width:32px;height:32px;border-radius:8px;background:color-mix(in oklab,var(--p-high) 16%,transparent);color:var(--p-high);display:inline-flex;align-items:center;justify-content:center">${ic("ext")}</span><div style="line-height:1.2"><div style="font-weight:600;font-size:13.5px">UT-3-07</div><div class="t3" style="font-size:11.5px">Access point · Floor 3 · Utrecht</div></div><span style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:12px"><i style="width:7px;height:7px;border-radius:99px;background:var(--p-high)"></i>Degraded</span></div><div style="display:flex;gap:6px;padding:0 16px 12px"><span class="btn primary sm" style="flex:1;justify-content:center">Open</span><span class="btn outline sm">${ic("note")}Edit</span></div><div class="kv" style="border-top:1px solid var(--line)"><span class="k">Model</span><span>Aruba AP-535</span><span class="k">Firmware</span><span>8.10 <span class="tag" style="background:var(--brand-tint);color:var(--brand-deep)">known bug</span></span><span class="k">Serial</span><span class="mono">CNF2K3P0X9</span><span class="k">Bought</span><span>Sep 2025 · warranty to Sep 2028</span><span class="k">Last seen</span><span>3 min ago</span></div><div style="border-top:1px solid var(--line);padding:10px 16px"><div class="label" style="margin-bottom:8px">Open tickets</div><div style="display:flex;align-items:center;gap:8px;font-size:12.5px">${ref("INC-2609 0117")}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">VPN drops every 20 minutes…</span></div></div><div style="border-top:1px solid var(--line);padding:10px 16px"><div class="label" style="margin-bottom:8px">Activity</div><div class="t2" style="font-size:12px;line-height:1.5">Firmware 8.10 pushed · 10 Sep<br>Moved from floor 2 · 2 Sep<br>Added from the CSV feed · 28 Aug</div></div></div>`;
const atools = `<div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn outline sm">${ic("layers")}Columns</span><span class="btn outline sm">${ic("ext")}Export CSV</span><span class="btn primary sm" style="height:30px">${ic("plus")}Add asset</span></div>`;
const afilters = `<div class="filters" style="padding-top:12px;border-bottom:1px solid var(--line)"><span class="seg"><span class="chip on">List</span><span class="chip">Split</span></span><span class="pv">Any state ${ic("chevd", "t3")}</span><span class="pv">Any site ${ic("chevd", "t3")}</span><div class="input" style="width:220px;height:28px;margin-left:auto"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search assets by name, serial</span></div></div>`;
function assetsA() { return shell("assets", ["Assets"], `<div class="ph2"><h1>Assets</h1><span class="mono t3" style="font-size:11.5px">84 · 7 with open tickets</span>${atools}</div>${afilters.replace('style="padding-top:12px;border-bottom:1px solid var(--line)"', "")}<div style="display:flex;gap:20px;padding:0 24px 20px;flex:1;min-height:0"><div class="sheet" style="flex:1;overflow:hidden">${abody}</div>${peek}</div>`); }
function assetsB() { return shell("assets", ["Assets"], `<div class="sheet" style="flex:1;border-radius:14px;display:flex;flex-direction:column;overflow:hidden"><div class="ph2" style="border-bottom:1px solid var(--line)"><h1>Assets</h1><span class="mono t3" style="font-size:11.5px">84 · 7 with open tickets</span>${atools}</div><div style="display:flex;flex:1;min-height:0"><div style="border-right:1px solid var(--line)">${typesCol(true)}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column">${afilters}${abody}</div><div style="width:320px;border-left:1px solid var(--line);padding:12px">${peek.replace('class="card peek" style="align-self:flex-start"', 'style="width:100%"')}</div></div></div>`); }
function assetsC() { return shell("assets", ["Assets"], `<div class="ph2"><h1>Assets</h1><span class="mono t3" style="font-size:11.5px">All · 84 · 7 with open tickets</span>${atools}</div><div style="display:flex;gap:20px;padding:0 20px 20px 0;flex:1;min-height:0">${typesCol()}<div class="sheet" style="flex:1;overflow:hidden;display:flex;flex-direction:column">${afilters}${abody}</div>${peek}</div>`); }

/* --------------------------------------------------------------- output */
const doc = (theme, body) => `<!doctype html>
<html><head><meta charset="utf-8">${FONT}<style>:root{${TOKENS[theme]}} html,body{height:900px;overflow:hidden} ${BASE_CSS} ${LAYER}</style></head><body>${body.replace('<div class="shell">', `<div class="shell ${theme}">`)}</body></html>`;

const SCREENS = [["TicketsA", ticketsA()], ["ProjectsA", projectsA()], ["AssetsA", assetsA()], ["TicketsB", ticketsB()], ["ProjectsB", projectsB()], ["AssetsB", assetsB()], ["TicketsC", ticketsC()], ["ProjectsC", projectsC()], ["AssetsC", assetsC()]];
for (const [name, body] of SCREENS) for (const theme of ["dark", "light"]) writeFileSync(join(out, `Overview14${name}${theme === "light" ? "Light" : ""}.dc.html`), doc(theme, body));

const OPTS = [
  ["A", "Head and filters on the ground, the table is the sheet", "The page title, counts, Columns/Sort, the view segment and the filter pills sit directly on the grey work area, the way the ticket toolbar does. Only the table is a white sheet, with 24px of ground around it, so it reads as an object in the room rather than a lining of the room. Pagination is the sheet's footer. Assets: the table and the peek card side by side, both on the ground."],
  ["B", "The panel becomes the sheet", "On a one-object page the inset panel itself turns white: no grey rim, the rounded corner and the hairline are the only edge against the white frame. Everything inside stays where it is today, divided by hairlines. The least change; the frame reads as one piece of chrome with a white page inside it. Assets: the types column, the table and the peek are three regions of one sheet, divided by hairlines."],
  ["C", "A views column beside the sheet, on all three pages", "The same shape as settings: a column on the ground with the page's views (built-in ones with counts, then saved ones, then Save current view), the table as a sheet beside it with only the secondary filters in its header. Tickets get their saved views a permanent home; projects get Active / Led by me / Off track / Archived; assets keep their types plus saved views. One overview pattern for the whole desk; the segment control disappears."],
];
const viewer = `<title>Tiqo Desk · Overview Pages</title>${FONT}
<style>
:root{--bg:#fff;--surface:#fff;--surface-2:#f4f4f5;--line:rgba(9,9,11,.08);--text:#09090b;--text-2:#52525b;--text-3:#9d9da6;--seg-on:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#09090b;--surface:#121214;--surface-2:#18181b;--line:rgba(255,255,255,.08);--text:#fafafa;--text-2:#a1a1aa;--text-3:#6b6b74;--seg-on:#232326}}
:root[data-theme="dark"]{--bg:#09090b;--surface:#121214;--surface-2:#18181b;--line:rgba(255,255,255,.08);--text:#fafafa;--text-2:#a1a1aa;--text-3:#6b6b74;--seg-on:#232326}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Geist,system-ui,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1360px;margin:0 auto;padding-block:28px 80px;padding-inline:24px}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;position:sticky;top:0;background:var(--bg);padding:16px 0 14px;z-index:9;border-bottom:1px solid var(--line)}
.head h1{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0}.head p{margin:4px 0 0;color:var(--text-2);max-width:80ch}
.seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:2px;gap:2px}
.seg button{border:0;background:transparent;color:var(--text-2);font:inherit;font-size:13px;font-weight:500;height:28px;padding:0 12px;border-radius:6px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--seg-on);color:var(--text);box-shadow:0 1px 2px rgba(9,9,11,.12)}
.brief{margin:24px 0 8px;padding:18px 20px;border-radius:12px;background:var(--surface-2);color:var(--text-2);line-height:1.6}.brief b{color:var(--text)}
.opt{margin-top:48px;padding-top:24px;border-top:1px solid var(--line)}
.opt h2{font-size:19px;font-weight:600;letter-spacing:-.02em;margin:0}.opt .note{margin:6px 0 18px;color:var(--text-2);max-width:95ch}
.opt h3{font-size:14px;font-weight:600;margin:22px 0 10px;color:var(--text-2)}
.stage{position:relative;width:100%;overflow:hidden;border-radius:12px;background:var(--surface-2)}
.stage iframe{position:absolute;left:0;top:0;width:1440px;height:900px;border:0;transform-origin:0 0;display:none}
.stage iframe.show{display:block}
</style><div class="wrap">
<div class="head"><div><h1>Tiqo Desk · Overview pages</h1><p>Tickets, projects and assets inside the chosen frame: three ways to stop the sheet reading as a box in a box. Both themes; toggle here.</p></div>
<div class="seg" role="group"><button data-t="dark" aria-pressed="true">Dark</button><button data-t="light" aria-pressed="false">Light</button></div></div>
<div class="brief"><b>The problem.</b> With the white frame and the grey inset work area, a one-object page draws a white sheet that fills the work area: white frame, thin grey rim, white sheet — three nested rectangles, and the rim reads as a mistake rather than a surface. <b>Three answers below</b>, each shown on tickets, projects and assets. A keeps the ground and gives the sheet room; B removes the rim on these pages; C gives the ground a job — a views column — so the sheet has something to sit beside. My recommendation is C, with B as the fallback if the views column is more than you want.</div>
${OPTS.map(([k, t, n]) => `<section class="opt" id="o${k}"><h2>${k} · ${t}</h2><p class="note">${n}</p>${["Tickets", "Projects", "Assets"].map((p) => `<h3>${p}</h3><div class="stage"><iframe data-t="dark" class="show" src="./Overview14${p}${k}.dc.html" loading="lazy"></iframe><iframe data-t="light" src="./Overview14${p}${k}Light.dc.html" loading="lazy"></iframe></div>`).join("")}</section>`).join("")}
</div>
<script>
(function(){
  function fit(){document.querySelectorAll('.stage').forEach(function(st){var s=st.clientWidth/1440;st.style.height=Math.round(900*s)+'px';st.querySelectorAll('iframe').forEach(function(f){f.style.transform='scale('+s+')'})})}
  addEventListener('resize',fit);fit();
  var segs=document.querySelectorAll('.seg button[data-t]');
  segs.forEach(function(b){b.addEventListener('click',function(){segs.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});document.documentElement.dataset.theme=b.dataset.t;document.querySelectorAll('.stage iframe').forEach(function(f){f.classList.toggle('show',f.dataset.t===b.dataset.t)})})});
})();
</script>`;
writeFileSync(join(out, "Overview14.html"), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"></head><body>${viewer}</body></html>`);
writeFileSync(join(out, "Overview14.publish.html"), viewer);
console.log(`${SCREENS.length * 2} boards + viewer → ${out}`);
