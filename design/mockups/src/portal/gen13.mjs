// Round 13 — the desk's composed pages on the ground: one level of fill per page.
// The queue keeps its white panel (it is one object); the ticket page and settings
// drop the panel and sit their blocks as cards on the grey ground.
// Usage: node src/portal/gen13.mjs boards
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FONT, BASE_CSS, I, ic, bars, ring, status, avatar, AV_NAME, ref, T, rail, logo } from "../shared.mjs";
import { TOKENS } from "./css12.mjs";

const out = process.argv[2] ?? "build";
mkdirSync(out, { recursive: true });

// The fill layer on top of the desk vocabulary. Same values as css12 / the queue board.
const LAYER = `
  :root { --chrome: var(--bg); --highlight: var(--card); --shadow: var(--lift); }
  .shell { background: var(--bg); height: 100%; }
  .rail { border-right: 0; background: var(--bg); }
  .bar { border-bottom: 0; background: var(--bg); }
  .rail .nav a.on { background: var(--surface); box-shadow: var(--card); }
  .card { border: 0; box-shadow: var(--card); border-radius: 12px; }
  .input { border-color: transparent; background: var(--surface); box-shadow: var(--card); }
  .btn.outline { border-color: transparent; box-shadow: var(--card); }
  .chip { border-color: transparent; background: var(--surface); box-shadow: var(--card); }
  .chip.on { background: var(--text); color: var(--bg); box-shadow: none; }
  .seg { background: var(--surface); box-shadow: var(--card); } .seg .chip { box-shadow: none; background: transparent; } .seg .chip.on { background: var(--text); color: var(--bg); }
  .pv:hover, .pv.open { background: var(--surface-2); }
  .well { background: var(--surface-2); border-radius: 10px; }
  .main { overflow: auto; }
  .toolbar { display: flex; align-items: center; gap: 4px; height: 44px; padding: 0 24px; }
  .toolbar .btn.ghost { background: var(--surface); box-shadow: var(--card); color: var(--text); }
  /* the ground, three ways (options H–J on top of C) */
  .g-light { --bg: #f7f7f9; --card: 0 0 0 1px rgba(9,9,11,.05), 0 1px 2px rgba(9,9,11,.04), 0 8px 24px -12px rgba(9,9,11,.10); }
  .g-light.dark { --bg: #0e0e11; --surface: #17171b; --card: 0 0 0 1px rgba(255,255,255,.06), 0 12px 30px -16px rgba(0,0,0,.7); }
  .g-cool { --bg: #eef0f5; }
  .g-cool.dark { --bg: #0a0b10; --surface: #15161c; --surface-2: #1d1e26; }
  .g-chrome { --bg: #f4f4f6; }
  .g-chrome .rail, .g-chrome .bar { background: var(--surface); }
  .g-chrome .rail { border-right: 1px solid var(--line); }
  .g-chrome .bar { border-bottom: 1px solid var(--line); }
  .g-chrome .rail .nav a.on { background: var(--surface-2); box-shadow: none; }
  .g-chrome .bar .input, .g-chrome .bar .btn.ghost { box-shadow: none; background: var(--surface-2); }
  .g-chrome.dark { --bg: #0a0a0c; }
  .g-chrome.dark .rail, .g-chrome.dark .bar { background: #101013; }
  /* the chosen shape: white chrome as one L-shaped frame, the work area an inset rounded panel on the lighter grey */
  .g-final { --bg: #f7f7f9; --card: 0 0 0 1px rgba(9,9,11,.05), 0 1px 2px rgba(9,9,11,.04), 0 8px 24px -12px rgba(9,9,11,.10); background: var(--surface); }
  .g-final .rail, .g-final .bar { background: var(--surface); border: 0; }
  .g-final .main { margin: 0 12px 12px 0; border-radius: 14px; background: var(--bg); }
  .g-final .rail .nav a.on { background: var(--surface-2); box-shadow: none; }
  .g-final .bar .input, .g-final .bar .btn.ghost { box-shadow: none; background: var(--surface-2); }
  .g-final.dark { --bg: #0e0e11; --surface: #17171b; --surface-2: #202025; --card: 0 0 0 1px rgba(255,255,255,.06), 0 12px 30px -16px rgba(0,0,0,.7); background: #111114; }
  .g-final.dark .rail, .g-final.dark .bar { background: #111114; }
  .page { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; padding: 0 20px 20px 24px; align-items: start; }
  .stack { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .ch { display: flex; align-items: center; justify-content: space-between; height: 38px; padding: 0 16px; font-weight: 600; font-size: 13px; }
  .msg { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 14px 16px; }
  .msg + .msg { border-top: 1px solid var(--line); }
  .msg .who { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
  .msg .who b { font-weight: 600; }
  .msg .who .when { margin-left: auto; color: var(--text-3); font-size: 11.5px; }
  .msg .body { margin-top: 6px; font-size: 13px; line-height: 1.5; color: var(--text); }
  .msg.note { background: var(--brand-wash); }
  .ev { padding: 6px 16px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; }
  .two > div { padding: 12px 16px; }
  .two > div + div { border-left: 1px solid var(--line); }
  .two .l { font-size: 11px; color: var(--text-3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .two .v { margin-top: 6px; display: flex; align-items: center; gap: 8px; font-weight: 500; }
  .snav { width: 200px; padding: 8px 0 0 24px; }
  .snav a { display: flex; align-items: center; height: 30px; padding: 0 10px; border-radius: 8px; color: var(--text-2); font-size: 13px; }
  .snav a.on { background: var(--surface); color: var(--text); font-weight: 500; box-shadow: var(--card); }
  .snav .sec { font-size: 11px; color: var(--text-3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 14px 10px 6px; }
  .srow { display: grid; grid-template-columns: 220px 1fr; gap: 24px; padding: 14px 16px; align-items: start; }
  .srow + .srow { border-top: 1px solid var(--line); }
  .srow .k { font-weight: 500; font-size: 13px; } .srow .d { font-size: 12px; color: var(--text-3); margin-top: 2px; }
  .trow { display: grid; grid-template-columns: 24px 190px 1fr 80px 100px 50px; gap: 12px; align-items: center; min-height: 42px; padding: 6px 16px; font-size: 12.5px; }
  .trow + .trow { border-top: 1px solid var(--line); }
  /* option B: the main region is one sheet; its blocks lose their own card and become sections */
  .sheet .blk { box-shadow: none; border-radius: 0; background: transparent; }
  .sheet .blk + .blk { border-top: 1px solid var(--line); }
  .sheet .blk.composer { background: var(--surface-2); border-radius: 12px; margin: 4px 16px 16px; border-top: 0; }
  .sheet .blk .thead { border-radius: 0; }
  .sheet .composer .well { background: var(--surface); }
  /* options C–F: three cards — request (title inside), conversation, reply */
  .req .reqhead { padding: 12px 16px 12px; }
  .req .reqhead > div { padding: 0; }
  .req .descsec { border-top: 1px solid var(--line); }
  .v-tintreq .req { background: var(--brand-wash); }
  .v-tintreq .req .descsec { border-top-color: color-mix(in oklab, var(--brand) 22%, transparent); }
  .v-tintreq .req .chip { background: var(--surface) !important; }
  .v-tintreply .composer { background: var(--brand-wash); }
  .v-tintreply .composer .well { background: var(--surface); }
  .v-tintreply .composer .seg { background: var(--surface); }
  .v-edge .req { box-shadow: inset 4px 0 0 var(--p-urgent), var(--card); }
  .v-edge .composer { box-shadow: inset 4px 0 0 var(--brand), var(--card); }
  .v-band .req .reqhead { background: var(--brand); color: var(--brand-ink); border-radius: 12px 12px 0 0; }
  .v-band .req .reqhead .t3, .v-band .req .reqhead .ref, .v-band .req .reqhead .ref b { color: rgba(28,19,0,.65) !important; }
  .v-band .req .reqhead .tag { background: rgba(28,19,0,.12); color: var(--brand-ink); }
  .v-band .req .reqhead svg circle, .v-band .req .reqhead svg path { stroke: var(--brand-ink); }
  .v-band .req .reqhead span[style*="color:var(--text-2)"] { color: var(--brand-ink) !important; }
  .v-band .req .descsec { border-top: 0; }
  .thead { display: grid; grid-template-columns: 24px 190px 1fr 80px 100px 50px; gap: 12px; height: 30px; align-items: center; padding: 0 16px; background: var(--surface-2); border-radius: 12px 12px 0 0; }
`;

const X = { ...I, drag: I.grip, plus: I.plus };
const t = T[0];

/* ------------------------------------------------------------ ticket page */
function ticket(mode = "cards") {
  const toolbar = `
    <div class="toolbar">
      <span class="btn primary sm" style="height:28px">${ic("reply")}Reply<kbd style="background:transparent;border-color:rgba(0,0,0,.25);color:var(--brand-ink);opacity:.7">R</kbd></span>
      <span class="btn outline sm" style="height:28px">${ic("note")}Note</span>
      <span class="btn outline sm" style="height:28px">${ic("user")}Assign</span>
      <span class="btn outline sm" style="height:28px">${ic("check")}Resolve</span>
      <span class="btn ghost sm" style="height:28px">${ic("dots")}</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:4px">
        <span class="btn ghost sm" style="height:28px">${ic("layers")}Plan</span>
        <span class="btn ghost sm" style="height:28px">${ic("clock")}Activity</span>
        <span style="width:1px;height:18px;background:var(--line-strong);margin:0 6px"></span>
        <span class="btn ghost sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("chevl")}</span>
        <span class="mono t3" style="font-size:11.5px">3 / 23</span>
        <span class="btn ghost sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("chev")}</span>
      </span>
    </div>`;

  const head = `
    <div style="padding:6px 0 2px">
      <div style="display:flex;align-items:center;gap:10px">${ref(t.r)}${status(t.s)}<span class="tag">network</span><span class="t3" style="font-size:12px;margin-left:auto">opened 3h ago by Sanne Lin · Utrecht</span></div>
      <h1 style="font-size:20px;font-weight:600;letter-spacing:-.02em;margin:6px 0 0;line-height:1.25">${t.t}</h1>
    </div>`;

  const description = `
    <div class="card blk">
      <div class="ch">What Sanne wrote<span class="t3" style="font-weight:400;font-size:12px">Today 09:12 · via the portal</span></div>
      <div style="padding:2px 16px 16px;font-size:13px;line-height:1.55">
        Since Monday the VPN drops every twenty minutes on the office Wi-Fi, on both floors. Wired is fine. It reconnects on its own but Teams calls die each time.<br><br>Happens on my MacBook and on Jonas's Windows laptop, so it is not one machine.
        <div style="display:flex;gap:8px;margin-top:12px"><span class="chip" style="box-shadow:none;background:var(--surface-2)">${ic("note")}vpn-log.txt <span class="mono t3">14 KB</span></span><span class="chip" style="box-shadow:none;background:var(--surface-2)">${ic("note")}IMG_4401.jpg <span class="mono t3">2.1 MB</span></span></div>
      </div>
    </div>`;

  const conversation = `
    <div class="card blk">
      <div class="ch">Conversation<span class="t3" style="font-weight:400;font-size:12px">6 replies · 2 notes</span></div>
      <div class="msg" style="border-top:1px solid var(--line)">${avatar("MK", 28)}<div><div class="who"><b>Mila Kuipers</b><span class="t3">to Sanne</span><span class="when">09:30</span></div><div class="body">Thanks Sanne. Which access point are you on when it drops? The name is in the Wi-Fi menu, something like UT-3-07.</div></div></div>
      <div class="msg">${avatar("SL", 28)}<div><div class="who"><b>Sanne Lin</b><span class="t3">requester</span><span class="when">09:41</span></div><div class="body">UT-3-07 on floor 3, UT-2-02 downstairs. Both do it.</div></div></div>
      <div class="msg note">${avatar("MK", 28)}<div><div class="who"><b>Mila Kuipers</b><span class="tag" style="background:var(--brand-tint);color:var(--brand-deep)">${ic("lock")}internal</span><span class="when">09:44</span></div><div class="body">Both are the new Aruba APs from last week's swap. Firmware 8.10 has the known roaming bug. Pinging Jonas for the rollback.</div></div></div>
      <div class="ev" style="border-top:1px solid var(--line)"><span class="dot">${ic("user")}</span><span><b>Jonas Berg</b> was added as a watcher</span><span class="mono">10:02</span></div>
      <div class="msg" style="border-top:1px solid var(--line)">${avatar("JB", 28)}<div><div class="who"><b>Jonas Berg</b><span class="t3">to Sanne</span><span class="when">11:20</span></div><div class="body">We are rolling the two access points back to the previous firmware at 12:00. You will lose Wi-Fi for about a minute. Could you tell us afterwards whether it holds through a full call?</div></div></div>
    </div>`;

  const composer = `
    <div class="card blk composer" style="padding:12px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="seg"><span class="chip on">Reply</span><span class="chip">Note</span></span><span class="t3" style="font-size:12px">to Sanne Lin · updates go to the portal and her e-mail</span></div>
      <div class="well" style="height:72px;padding:10px 12px;font-size:13px;color:var(--text-3)">Write a reply… <span class="mono" style="font-size:11px">#</span> to reference a ticket or asset</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:10px"><span class="btn ghost sm">${ic("note")}Attach</span><span class="btn ghost sm">${ic("spark")}Insert answer</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="pv" style="background:var(--surface-2)">${status("waiting")}${ic("chevd", "t3")}</span><span class="btn primary sm">${ic("send")}Send</span></span></div>
    </div>`;

  const pill = (icon, label, dirty = false) => `<span class="pv ${dirty ? "dirty" : ""}">${icon}${label}${ic("chevd", "t3")}</span>`;
  const prow = (l, v) => `<div class="prow"><span class="pl">${l}</span>${v}</div>`;
  const railA = `
    <div class="stack">
      <div class="card two">
        <div><div class="l">Status</div><div class="v">${ring("progress")}In progress</div></div>
        <div><div class="l">Priority</div><div class="v">${bars("urgent")}Urgent</div></div>
      </div>
      <div class="card">
        <div class="ch">Details</div>
        <div style="padding:2px 8px 10px">
          ${prow("Assignee", pill(avatar("MK", 18), "Mila Kuipers"))}
          ${prow("Team", pill(ic("users", "t3"), "Infrastructure"))}
          ${prow("Type", pill(ic("flag", "t3"), "Incident"))}
          ${prow("Project", pill(ic("folder", "t3"), "Network refresh 2026", true))}
          ${prow("Tags", `<span style="display:flex;gap:4px;padding-left:8px"><span class="tag">network</span><span class="tag" style="opacity:.6">+ add</span></span>`)}
          ${prow("Asset", pill(ic("laptop", "t3"), "UT-3-07 · Aruba AP"))}
        </div>
        <div style="display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--line)"><span class="btn primary sm">Save</span><span class="btn ghost sm">Cancel</span><span class="t3" style="margin-left:auto;font-size:11.5px;align-self:center">1 change</span></div>
      </div>
      <div class="card">
        <div class="ch">Requester<span class="btn ghost sm" style="height:24px;width:24px;padding:0;justify-content:center">${ic("note")}</span></div>
        <div style="display:flex;align-items:center;gap:10px;padding:0 16px 12px">${avatar("SL", 32)}<div style="line-height:1.25;min-width:0"><div style="font-weight:600;font-size:13px">Sanne Lin</div><div class="t3" style="font-size:11.5px">Marketing · Utrecht · local time 11:32</div></div></div>
        <div style="display:flex;gap:6px;padding:0 16px 14px"><span class="btn outline sm" style="height:26px">${ic("mail")}Email</span><span class="btn outline sm" style="height:26px">${ic("phone")}Call</span><span class="t3" style="margin-left:auto;font-size:11.5px;align-self:center">4 open · 12 total</span></div>
      </div>
      <div class="card">
        <div class="ch">Response target<span class="mono" style="font-size:12px;color:var(--p-urgent);font-weight:600">28m left</span></div>
        <div style="padding:0 16px 14px"><div style="height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden"><i style="display:block;height:100%;width:92%;background:var(--p-urgent);box-shadow:0 0 8px var(--p-urgent)"></i></div><div class="t3" style="font-size:11.5px;margin-top:8px">First reply due 12:00 · resolve by tomorrow 09:12</div></div>
      </div>
      <div class="card">
        <div class="ch">Activity<span class="t3" style="font-weight:400;font-size:12px">today</span></div>
        <div style="padding:0 4px 8px">
          <div class="ev"><span class="dot">${ic("user")}</span><span><b>Jonas</b> added as watcher</span><span class="mono">10:02</span></div>
          <div class="ev"><span class="dot">${ic("note")}</span><span><b>Mila</b> left a note</span><span class="mono">09:44</span></div>
          <div class="ev"><span class="dot">${ic("reply")}</span><span><b>Mila</b> replied</span><span class="mono">09:30</span></div>
          <div class="ev"><span class="dot">${ic("flag")}</span><span>priority set to <b>Urgent</b></span><span class="mono">09:15</span></div>
          <div class="ev"><span class="dot">${ic("ticket")}</span><span><b>Sanne</b> opened via the portal</span><span class="mono">09:12</span></div>
        </div>
      </div>
    </div>`;

  return `<div class="shell">${rail("tickets")}${barx(["Tickets", t.r.slice(0, 3) + "-2609 0117"])}<div class="main">${toolbar}<div class="page">${mode === "sheet"
    ? `<div class="card sheet"><div class="blk" style="padding:10px 16px 6px">${head}</div>${description}${conversation}${composer}</div>`
    : mode === "cards"
      ? `<div class="stack">${head}${description}${conversation}${composer}</div>`
      : `<div class="stack v-${mode}"><div class="card blk req"><div class="reqhead">${head}</div>${description.replace('<div class="card blk">', '<div class="descsec">')}</div>${conversation}${composer}</div>`}${railA}</div></div></div>`;
}

/* -------------------------------------------------------------- settings */
function settings(mode = "cards") {
  const nav = `
    <div class="snav">
      <div class="sec" style="padding-top:0">Desk</div><a>General</a><a>Opening hours</a><a>People & teams</a>
      <div class="sec">Tickets</div><a class="on">Statuses</a><a>Priorities</a><a>Types</a><a>Change templates</a>
      <div class="sec">Portal</div><a>Front page</a><a>Catalogue</a><a>Announcements</a>
      <div class="sec">System</div><a>Mail</a><a>Asset types</a><a>Documentation</a>
    </div>`;
  const rows = [["new", "New", "Just arrived, nobody has looked yet", "—", "Yes", ""], ["progress", "In progress", "Someone is working on it", "—", "Yes", ""], ["waiting", "Waiting on requester", "The desk asked something and is waiting", "Pauses", "Yes", "portal"], ["resolved", "Resolved", "Done; closes by itself after 5 days", "Settles", "No", ""]];
  const table = `
    <div class="card blk">
      <div class="ch">Statuses<span style="display:flex;gap:6px"><span class="btn outline sm" style="height:26px">${ic("eye")}Preview</span><span class="btn primary sm" style="height:26px">${ic("plus")}Add status</span></span></div>
      <div class="thead label" style="border-radius:0"><span></span><span>Status</span><span>Meaning</span><span>Clock</span><span>Open on desk</span><span></span></div>
      ${rows.map(([s, n, d, clock, open, extra]) => `<div class="trow"><span class="t3" style="display:flex">${ic("grip")}</span><span style="display:flex;align-items:center;gap:8px;font-weight:500">${ring(s)}${n}${extra ? `<span class="tag">${extra}</span>` : ""}</span><span class="t2">${d}</span><span class="${clock === "—" ? "t3" : ""}">${clock}</span><span class="${open === "Yes" ? "" : "t3"}">${open}</span><span class="btn ghost sm" style="height:24px;justify-self:end">Edit</span></div>`).join("")}
    </div>`;
  const rules = `
    <div class="card blk">
      <div class="ch">How statuses behave</div>
      <div class="srow" style="border-top:1px solid var(--line)"><div><div class="k">Default for new tickets</div><div class="d">Every ticket starts here, from the portal, mail or the desk.</div></div><span class="pv" style="background:var(--surface-2);width:max-content">${ring("new")}New${ic("chevd", "t3")}</span></div>
      <div class="srow"><div><div class="k">Close resolved tickets after</div><div class="d">Resolved tickets settle on their own if nobody reopens them.</div></div><div style="display:flex;align-items:center;gap:8px"><span class="input" style="width:80px;height:28px">5</span><span class="t2" style="font-size:12.5px">days</span></div></div>
      <div class="srow"><div><div class="k">Show on the portal</div><div class="d">Requesters see these on their front page as “waiting for your reply”.</div></div><div style="display:flex;gap:6px"><span class="chip on">Waiting on requester</span><span class="chip">+ add</span></div></div>
      <div style="display:flex;gap:6px;padding:10px 16px;border-top:1px solid var(--line)"><span class="btn primary sm" style="opacity:.5">Save</span><span class="btn ghost sm">Cancel</span><span class="t3" style="margin-left:auto;font-size:11.5px;align-self:center">Nothing to save</span></div>
    </div>`;
  const preview = `
    <div class="card" style="width:300px;flex:none">
      <div class="ch">How it reads<span class="t3" style="font-weight:400;font-size:12px">queue row</span></div>
      <div style="padding:0 16px 14px;font-size:12.5px;display:flex;flex-direction:column;gap:10px">
        ${rows.map(([s, n]) => `<div style="display:flex;align-items:center;gap:8px">${ring(s)}<span>${n}</span><span class="mono t3" style="margin-left:auto">${{ new: 4, progress: 11, waiting: 5, resolved: 3 }[s]}</span></div>`).join("")}
      </div>
    </div>`;
  const body = `
    <div style="display:flex;align-items:center;gap:12px;height:48px;padding:0 24px"><h1 style="font-size:16px;font-weight:600;margin:0;letter-spacing:-.01em">Settings</h1><span class="t3" style="font-size:12.5px">How this desk behaves, for everyone who uses it</span></div>
    <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;padding:0 20px 20px 0">
      ${nav}
      <div style="display:flex;gap:20px;align-items:start">${mode === "sheet" ? `<div class="card sheet" style="flex:1">${table}${rules}</div>` : `<div class="stack" style="flex:1">${table}${rules}</div>`}${preview}</div>
    </div>`;
  return `<div class="shell">${rail("settings")}${barx(["Settings", "Statuses"])}<div class="main">${body}</div></div>`;
}

/* a bar without the search's border (the layer handles it) */
function barx(crumbs) {
  const crumb = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span style="color:var(--text);font-weight:500">${c}</span>` : `<span class="t3">${c}</span><span class="t3" style="display:flex">${ic("chev")}</span>`)).join("");
  return `<header class="bar"><div style="display:flex;align-items:center;gap:6px;font-size:13px">${crumb}</div><div style="margin-left:auto;display:flex;align-items:center;gap:8px"><div class="input" style="width:260px;height:30px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search tickets, people, projects</span><kbd style="margin-left:auto">⌘K</kbd></div><span class="btn primary" style="height:30px">${ic("plus")}New</span><span class="btn ghost" style="width:30px;padding:0;justify-content:center">${ic("bell")}</span>${avatar("AA", 26)}</div></header>`;
}

const doc = (theme, body) => `<!doctype html>
<html><head><meta charset="utf-8">${FONT}<style>:root{${TOKENS[theme]}} html,body{height:960px;overflow:hidden} ${BASE_CSS} ${LAYER}</style></head><body>${body}</body></html>`;

const SCREENS = [["Ticket13", ticket()], ["Settings13", settings()], ["Ticket14", ticket("sheet")], ["Settings14", settings("sheet")], ["Ticket15C", ticket("three")], ["Ticket15D", ticket("tintreq")], ["Ticket15E", ticket("tintreply")], ["Ticket15F", ticket("edge")], ["Ticket15G", ticket("band")],
  ["Ticket17", ticket("three"), "g-final"], ["Settings17", settings("sheet"), "g-final"],
  ["Ticket16H", ticket("three"), "g-light"], ["Ticket16I", ticket("three"), "g-cool"], ["Ticket16J", ticket("three"), "g-chrome"], ["Settings16H", settings("sheet"), "g-light"], ["Settings16J", settings("sheet"), "g-chrome"]];
for (const [name, body, ground] of SCREENS) for (const theme of ["dark", "light"]) writeFileSync(join(out, `${name}${theme === "light" ? "Light" : ""}.dc.html`), doc(theme, ground ? body.replace('<div class="shell">', `<div class="shell ${ground} ${theme}">`) : body));

const viewer = `<title>Tiqo Desk · One Level of Fill</title>${FONT}
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
.screen{margin-top:44px;padding-top:22px;border-top:1px solid var(--line)}
.screen h2{font-size:17px;font-weight:600;letter-spacing:-.015em;margin:0}.screen .note{margin:4px 0 14px;color:var(--text-2);max-width:90ch}
.stage{position:relative;width:100%;overflow:hidden;border-radius:12px;background:var(--surface-2)}
.stage iframe{position:absolute;left:0;top:0;width:1440px;height:960px;border:0;transform-origin:0 0;display:none}
.stage iframe.show{display:block}
</style><div class="wrap">
<div class="head"><div><h1>Tiqo Desk · One level of fill</h1><p>The two desk pages where the white panel failed, redrawn with the blocks as cards on the ground. Both themes; toggle here.</p></div>
<div class="seg" role="group"><button data-t="dark" aria-pressed="true">Dark</button><button data-t="light" aria-pressed="false">Light</button></div></div>
<div class="brief"><b>The rule, restated.</b> Surfaces are a ladder with three rungs: <b>ground</b> (the grey page), <b>sheet</b> (a white surface for one object), <b>well</b> (the light-grey inset inside a sheet). A block always sits one rung above its parent, never on the same rung: no white on white, no grey on grey. From that follow the layouts, without a per-page switch: the main region is a sheet, because a ticket, a settings form, a register or a document is one object, and inside it separation is headings, space, faint dividers and wells; side regions sit on the ground, so their blocks are cards; only the dashboard and the project overview, which really are a set of cards, opt out of the main sheet.<br><br><b>Chosen (17 September, night): C on J, with H's lighter grey and rounded corners on the work area.</b> The rail and the bar are white and read as one L-shaped frame — no line between them; the work area is an inset panel with 14px corners on the lighter grey (#f7f7f9); cards keep a faint hairline so they hold their edge on it. The toolbar's Plan, Activity and prev/next have a fill like the other buttons. The two boards at the top are that. Everything below is the trail that led there.</div>
<section class="screen" id="tK"><h2>Ticket page · chosen</h2><div class="stage"><iframe data-t="dark" class="show" src="./Ticket17.dc.html"></iframe><iframe data-t="light" src="./Ticket17Light.dc.html"></iframe></div></section>
<section class="screen" id="sK"><h2>Settings · chosen</h2><div class="stage"><iframe data-t="dark" class="show" src="./Settings17.dc.html"></iframe><iframe data-t="light" src="./Settings17Light.dc.html"></iframe></div></section>
${[["H", "A lighter ground, hairline cards", "The ground goes from #f1f1f4 to #f7f7f9 — almost white — and cards get a faint hairline so they still hold their edge. The least grey possible before white on white returns. Settings below shows the same."], ["I", "A cool tint instead of grey", "The same depth of ground, but blue-leaning (#eef0f5) rather than neutral. Reads as chosen rather than unpainted; nothing else changes."], ["J", "White chrome, grey work area", "The rail and bar turn white with a hairline, so only the work area is grey — about half as much exposed ground. The active rail item drops its shadow. Settings below shows the same."]]
  .map(([k, t, n]) => `<section class="screen" id="t${k}"><h2>${k} · ${t}</h2><p class="note">${n}</p><div class="stage"><iframe data-t="dark" class="show" src="./Ticket16${k}.dc.html"></iframe><iframe data-t="light" src="./Ticket16${k}Light.dc.html"></iframe></div></section>`).join("")}
<section class="screen" id="sH"><h2>H · Settings on the lighter ground</h2><div class="stage"><iframe data-t="dark" class="show" src="./Settings16H.dc.html"></iframe><iframe data-t="light" src="./Settings16HLight.dc.html"></iframe></div></section>
<section class="screen" id="sJ"><h2>J · Settings with white chrome</h2><div class="stage"><iframe data-t="dark" class="show" src="./Settings16J.dc.html"></iframe><iframe data-t="light" src="./Settings16JLight.dc.html"></iframe></div></section>
${[["C", "Three cards, all white", "The request card holds the reference, status, title and what Sanne wrote; the conversation and the reply are their own cards. No colour beyond the glyphs. The quiet baseline for the four below."], ["D", "The request on the brand wash", "The request card sits on the amber wash — the desk's existing mark for “what the requester said” — so the source of the ticket reads differently from the desk's own work. Conversation and reply white."], ["E", "The reply on the brand wash", "The other way round: request and conversation white, the reply card on the amber wash. The one thing you can do on this page is the one thing in colour."], ["F", "Coloured edges", "Three white cards; the request carries a 4px edge in the priority colour (the heat spine, moved to the card), the reply a 4px edge in amber. Colour as a rule, not a fill."], ["G", "A brand band on the request", "The request card's header — reference, status, title — is a solid brand band, the body white underneath. The most colour of the five; the ticket's identity is the one bright thing on the page."]]
  .map(([k, t, n]) => `<section class="screen" id="t${k}"><h2>${k} · ${t}</h2><p class="note">${n}</p><div class="stage"><iframe data-t="dark" class="show" src="./Ticket15${k}.dc.html"></iframe><iframe data-t="light" src="./Ticket15${k}Light.dc.html"></iframe></div></section>`).join("")}
<section class="screen" id="tb"><h2>B · Ticket page — one sheet, rail cards</h2><p class="note">The main column is one white sheet: header, What Sanne wrote, the conversation and the composer as sections separated by faint dividers, the composer as a well at the foot. The rail keeps round-9 rail A: one card per section on the ground, Save only when dirty.</p><div class="stage"><iframe data-t="dark" class="show" src="./Ticket14.dc.html"></iframe><iframe data-t="light" src="./Ticket14Light.dc.html"></iframe></div></section>
<section class="screen" id="sb"><h2>B · Settings — one sheet, navigation on the ground</h2><p class="note">The navigation sits on the ground with the active entry as a white pill. The statuses table and the behaviour rows are sections of one sheet; the table header is a well. The read-out preview stays a card, because it is a side region.</p><div class="stage"><iframe data-t="dark" class="show" src="./Settings14.dc.html"></iframe><iframe data-t="light" src="./Settings14Light.dc.html"></iframe></div></section>
<section class="screen" id="t"><h2>A · Ticket page — every block a card</h2><p class="note">The first draft, kept for comparison: header, description, conversation and composer each their own card next to six rail cards.</p><div class="stage"><iframe data-t="dark" class="show" src="./Ticket13.dc.html"></iframe><iframe data-t="light" src="./Ticket13Light.dc.html"></iframe></div></section>
<section class="screen" id="s"><h2>A · Settings — every panel a card</h2><p class="note">The first draft: three floating cards beside the navigation.</p><div class="stage"><iframe data-t="dark" class="show" src="./Settings13.dc.html"></iframe><iframe data-t="light" src="./Settings13Light.dc.html"></iframe></div></section>
</div>
<script>
(function(){
  function fit(){document.querySelectorAll('.stage').forEach(function(st){var s=st.clientWidth/1440;st.style.height=Math.round(960*s)+'px';st.querySelectorAll('iframe').forEach(function(f){f.style.transform='scale('+s+')'})})}
  addEventListener('resize',fit);fit();
  var segs=document.querySelectorAll('.seg button[data-t]');
  segs.forEach(function(b){b.addEventListener('click',function(){segs.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});document.documentElement.dataset.theme=b.dataset.t;document.querySelectorAll('.stage iframe').forEach(function(f){f.classList.toggle('show',f.dataset.t===b.dataset.t)})})});
})();
</script>`;
writeFileSync(join(out, "DeskFill13.html"), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"></head><body>${viewer}</body></html>`);
writeFileSync(join(out, "DeskFill13.publish.html"), viewer);
console.log("4 boards + viewer → " + out);
