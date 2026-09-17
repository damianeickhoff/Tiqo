// Round 9: a better ticket rail (properties · clock · requester · activity).
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { I, bars, status, ring, avatar, AV_NAME, ref, T, page } from "./shared.mjs";
import { ticket2 } from "./ticket.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "boards2");

const I3 = {
  link: '<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1"/>',
  edit: '<path d="m10.5 2.5 3 3-7.5 7.5H3v-3z"/>',
  chevu: '<path d="m4 10 4-4 4 4"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 16 16">${I3[n] ?? I[n]}</svg>`;

const t = T[0]; // INC 0117 · urgent · Mila · 0h 19m left, past 90% of target

/* ------------------------------------------------------------ shared bits */

const head = (label, right = "") =>
  `<div style="display:flex;align-items:center;justify-content:space-between;height:34px;padding:0 14px;border-bottom:1px solid var(--line)"><span class="label">${label}</span>${right}</div>`;
const cell = (label, value, o = {}) =>
  `<div style="display:flex;flex-direction:column;gap:5px;padding:9px 12px 9px 14px;${o.dirty ? "background:var(--brand-tint);" : ""}${o.right ? "border-left:1px solid var(--line);" : ""}"><span class="t3" style="font-size:11px">${label}</span><span style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500">${value}<span class="t3" style="margin-left:auto;display:flex">${ic("chevd")}</span></span></div>`;
const prow = (label, value, d = false) =>
  `<div class="prow" style="grid-template-columns:78px minmax(0,1fr);min-height:28px"><span class="pl">${label}</span><span class="pv ${d ? "dirty" : ""}" style="height:24px">${value}${ic("chevd", "t3")}</span></div>`;
const twoUp = (dirty) =>
  `<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)">${cell("Status", status("progress"))}${cell("Priority", `${bars("urgent")}Urgent`, { right: true, dirty })}</div>`;
const propRows = (change = false) => `
  <div style="padding:6px 8px">
    ${prow("Type", change ? "Change" : "Incident")}
    ${prow("Assignee", `${avatar("MK", 18)}Mila Kuipers`)}
    ${prow("Team", "Network")}
    ${prow("Project", '<span class="ref" style="color:var(--text)"><b style="color:var(--text-3)">NET</b></span> Network refresh')}
    ${prow("Milestone", "Floor 2 access points")}
    ${change ? prow("Plan", `${ic("layers", "t3")}Automate a process <span class="mono t3" style="font-size:11px">2/6</span>`) : ""}
    ${prow("Tags", '<span class="tag">network</span><span class="t3" style="font-size:15px;line-height:1">+</span>')}
  </div>`;
const saveFoot = (dirty) =>
  dirty
    ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid var(--line);background:var(--surface-2)"><span class="btn primary sm">${ic("check")}Save</span><span class="btn ghost sm">Discard</span><span class="t3" style="font-size:11.5px;margin-left:auto">High → Urgent</span></div>`
    : "";

const clockIncident = `
  <div style="padding:12px 14px 14px">
    <div style="display:flex;align-items:baseline;gap:6px"><span class="mono tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;color:var(--p-urgent);line-height:1">0h 19m</span><span class="t2" style="font-size:12.5px">left to first response</span></div>
    <div style="height:6px;border-radius:3px;background:var(--surface-3);margin-top:10px;overflow:hidden"><i style="display:block;height:100%;width:92%;background:var(--p-urgent);box-shadow:0 0 8px var(--p-urgent)"></i></div>
    <div class="t3" style="display:flex;justify-content:space-between;font-size:11px;margin-top:7px"><span>Raised 09:12 · pauses while waiting</span><span>Target 10:12 · 1h for Urgent</span></div>
  </div>`;
const clockChange = `
  <div style="padding:12px 14px 14px">
    <div style="display:flex;align-items:baseline;gap:6px"><span class="mono tnum" style="font-size:22px;font-weight:600;letter-spacing:-.02em;line-height:1">Sun 13 Sep</span><span class="t2" style="font-size:12.5px">· 4d left</span></div>
    <div style="display:flex;gap:2px;margin-top:10px">${Array.from({ length: 14 }, (_, i) => `<i style="flex:1;height:6px;border-radius:2px;background:${i < 10 ? "var(--brand)" : "var(--surface-3)"}"></i>`).join("")}</div>
    <div class="t3" style="display:flex;justify-content:space-between;font-size:11px;margin-top:7px"><span>Committed 30 Aug</span><span>No response target for changes</span></div>
  </div>`;

const requesterBody = `
  <div style="display:flex;gap:10px;align-items:center;padding:12px 14px 10px">
    ${avatar("SL", 36)}
    <div style="line-height:1.25;min-width:0;flex:1"><div style="font-weight:600;font-size:13.5px">Sanne Lin</div><div class="t2" style="font-size:12px;margin-top:2px">Finance controller · Finance</div></div>
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:var(--positive);background:color-mix(in oklab,var(--positive) 10%,transparent);padding:3px 8px;border-radius:999px;white-space:nowrap"><i style="width:6px;height:6px;border-radius:99px;background:currentColor"></i>In office · 09:41</span>
  </div>
  <div style="display:grid;grid-template-columns:70px 1fr;gap:4px 10px;padding:0 14px 12px;font-size:12.5px;align-items:center">
    <span class="t3" style="font-size:11.5px">Company</span><span>Tiqo · Utrecht</span>
    <span class="t3" style="font-size:11.5px">Email</span><span class="mono" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">s.lin@tiqo.local</span>
    <span class="t3" style="font-size:11.5px">Phone</span><span class="mono" style="font-size:12px">+31 6 1234 5678</span>
    <span class="t3" style="font-size:11.5px">Hours</span><span>Mon–Fri 08:30–17:30 <span class="t3">· CET</span></span>
  </div>
  <div style="display:flex;padding:6px 8px;border-top:1px solid var(--line)">
    <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("mail")}Email</span>
    <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("phone")}Call</span>
    <span class="btn ghost sm" style="flex:1;justify-content:center">${ic("user")}Profile</span>
  </div>`;

const EVENTS = [
  ["link", "<b>Ada</b> linked project <b>NET · Network refresh</b>", "10:03"],
  ["flag", "<b>Ada</b> raised priority from High to <b>Urgent</b>", "10:02"],
  ["lock", "<b>Mila</b> added an internal note", "09:36"],
  ["user", "<b>Mila</b> took the ticket", "09:31"],
  ["inbox", "<b>Sanne</b> raised this ticket through <b>Something stopped working</b>", "09:12"],
];
const activityRows = (items, pad = "0 14px") => `
  <div style="padding:${pad}">
    <div class="t3" style="font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:8px 0 2px">Today</div>
    ${items.map(([i, x, w]) => `<div style="display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:start;padding:6px 0"><span style="width:18px;height:18px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--text-3);margin-top:1px"><svg class="i" viewBox="0 0 16 16" style="width:10px;height:10px">${I3[i] ?? I[i]}</svg></span><span class="t2" style="font-size:12px;line-height:1.4;min-width:0">${x.replace(/<b>/g, '<b style="font-weight:600;color:var(--text)">')}</span><span class="mono t3" style="font-size:10.5px;padding-top:2px">${w}</span></div>`).join("")}
  </div>`;

/* ------------------------------------------------------------- A: cards */

function railA({ dirty = true, change = false, frame = false } = {}) {
  const card = (inner) => `<div class="card" style="overflow:hidden;flex:none">${inner}</div>`;
  const inner = `
    ${card(head("Properties", dirty ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--brand-deep);font-weight:500"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>1 unsaved</span>' : "") + twoUp(dirty) + propRows(change) + saveFoot(dirty))}
    ${card(head(change ? "Due" : "Response target", change ? `<a style="font-size:11.5px;display:inline-flex;align-items:center;gap:4px">${ic("edit")}Edit</a>` : '<span class="t3" style="font-size:11px">Clock running</span>') + (change ? clockChange : clockIncident))}
    ${card(head("Requester", `<span style="display:flex;align-items:center;gap:10px"><a style="font-size:11.5px">3 other requests</a><span class="t3" style="display:flex" title="Change requester">${ic("edit")}</span></span>`) + requesterBody)}
    ${card(head("Activity", '<a style="font-size:11.5px">All 12</a>') + activityRows(EVENTS.slice(0, 4)))}`;
  const style = frame
    ? "position:relative;width:320px;height:1000px"
    : "position:absolute;top:44px;right:0;bottom:0;width:320px";
  return `<aside style="${style};border-left:1px solid var(--line);overflow:hidden;background:var(--chrome);display:flex;flex-direction:column;gap:12px;padding:12px">${inner}</aside>`;
}

/* -------------------------------------------------------------- B: tabs */

function railB(tabName, { change = false } = {}) {
  const tabs = ["Details", "Requester", "Activity"].map((n) => `<span style="display:flex;align-items:center;gap:6px;height:40px;font-size:12.5px;font-weight:500;color:${n === tabName ? "var(--text)" : "var(--text-2)"};border-bottom:2px solid ${n === tabName ? "var(--brand)" : "transparent"}">${n}${n === "Activity" ? '<span class="mono t3" style="font-size:11px">12</span>' : ""}</span>`).join("");
  let body = "";
  if (tabName === "Details") {
    body = `
      ${twoUp(true)}
      ${propRows(change)}
      ${saveFoot(true)}
      <div style="border-top:1px solid var(--line)">${head(change ? "Due" : "Response target", change ? `<a style="font-size:11.5px;display:inline-flex;align-items:center;gap:4px">${ic("edit")}Edit</a>` : '<span class="t3" style="font-size:11px">Clock running</span>').replace("border-bottom:1px solid var(--line)", "")}${change ? clockChange : clockIncident}</div>`;
  } else if (tabName === "Requester") {
    body = requesterBody + `<div style="border-top:1px solid var(--line)">${head("Their other requests", "")}${[T[4], T[8], T[15]].map((x) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid var(--line);font-size:12px">${ref(x.r)}<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${x.t}</span><span class="mono t3" style="margin-left:auto;font-size:11px">${x.age}</span></div>`).join("")}</div>`;
  } else {
    body = `<div style="display:flex;gap:6px;padding:10px 14px 4px"><span class="chip on" style="height:24px;font-size:11.5px">Everything</span><span class="chip" style="height:24px;font-size:11.5px">Changes</span><span class="chip" style="height:24px;font-size:11.5px">Replies</span></div>` + activityRows(EVENTS) + activityRows([["msg", "<b>Sanne</b> replied", "Yesterday 16:40"], ["clock", "Response target set to <b>1h</b>", "Yesterday 16:02"]]).replace(">Today<", ">Yesterday<");
  }
  return `<aside style="position:relative;width:320px;height:1000px;border-left:1px solid var(--line);overflow:hidden;background:var(--bg);display:flex;flex-direction:column">
    <div style="display:flex;gap:18px;padding:0 14px;border-bottom:1px solid var(--line);flex:none">${tabs}</div>
    <div style="flex:1;overflow:hidden">${body}</div>
  </aside>`;
}

/* ------------------------------------------------------------ boards */

const railToday = () => {
  const html = ticket2("incident");
  const a = html.indexOf('<aside style="position:absolute;top:44px;right:0;bottom:0;width:320px');
  const aside = html.slice(a, html.lastIndexOf("</aside>") + 8);
  return aside.replace("position:absolute;top:44px;right:0;bottom:0;width:320px", "position:relative;width:320px;height:1000px");
};
const pageWithRail = (rail) => {
  const html = ticket2("incident");
  const a = html.indexOf('<aside style="position:absolute;top:44px;right:0;bottom:0;width:320px');
  const b = html.lastIndexOf("</aside>") + 8;
  return html.slice(0, a) + rail + html.slice(b);
};
function options() {
  const col = (title, sub, rail) => `<div style="display:flex;flex-direction:column;gap:10px;width:320px"><div><div style="font-size:14px;font-weight:600">${title}</div><div class="t3" style="font-size:12px;margin-top:2px;line-height:1.45;min-height:34px">${sub}</div></div><div style="border:1px solid var(--line-strong);border-radius:4px;overflow:hidden">${rail}</div></div>`;
  return `
  <div style="width:1440px;height:1120px;background:var(--bg);padding:28px 20px 0;overflow:hidden">
    <div style="display:flex;gap:40px">
      ${col("Today · round 5", "Flush sections with different rhythms; Save always visible; four headers compete.", railToday())}
      ${col("A · Cards", "One card per section on the chrome tint. Status and priority as a two-up readout. Save only when dirty. Clock has its own card.", railA({ frame: true }))}
      ${col("B · Tabs — Details", "Rail gets a tab row; Details = properties + clock at full height. Shown here on a change, so the clock is a Due date.", railB("Details", { change: true }))}
      ${col("B · Tabs — Activity", "Activity gets the whole rail: filter chips, day groups, full sentences. Requester tab adds their other requests.", railB("Activity"))}
    </div>
  </div>`;
}

const boards = [
  ["TicketRail", "dark", pageWithRail(railA()), 1440, 1080, "Ticket · rail A · dark"],
  ["TicketRailLight", "light", pageWithRail(railA()), 1440, 1080, "Ticket · rail A · light"],
];
for (const [name, theme, body, , h] of boards) writeFileSync(join(out, `${name}.dc.html`), page(theme, body, h !== 900 ? `.shell{height:${h}px}` : ""));

const prev = JSON.parse(readFileSync(join(out, "layout.json"), "utf8"));
const last = prev.artboards.reduce((m, a) => Math.max(m, a.y + a.h), 0);
const y = last + 180;
const layout = [
  { file: "TicketRail.dc.html", x: 0, y, w: 1440, h: 1080, title: "Ticket · rail A · dark" },
  { file: "TicketRailLight.dc.html", x: 1560, y, w: 1440, h: 1080, title: "Ticket · rail A · light" },
];
const annotations = [
  { id: "note-rail", x: 0, y: y - 150, w: 620, text: "Round 9 — the ticket rail, decided: build rail A (these two boards). Every section is a contained card on the chrome tint with the same 34px header. Properties open with Status · Priority as a two-up readout, then label/value rows; the Save footer exists only while something is dirty. The clock is its own card — countdown in the priority colour with raised / target times, or the due date with Edit for a change. Requester keeps the contact card (pencil changes the requester, local time in the in-office pill); Activity uses event icons, grouped by day, latest four with a link to all." },
];
writeFileSync(join(out, "layout3.json"), JSON.stringify({ artboards: layout, annotations }, null, 2));
console.log(`wrote ${boards.length} rail boards at y=${y}`);
