// Desk screens for round 8 — imported by gen2.mjs. Uses the same primitives.
export function makeDesk({ ic, I, bars, status, avatar, AV_NAME, ref, spine, T, shell, row, cardHead, h1, dotpill, tab, field, input, select, textarea, checkbox, saveBar }) {
  const HEALTH = { on: ["var(--positive)", "On track"], risk: ["var(--brand)", "At risk"], off: ["var(--negative)", "Off track"], paused: ["var(--text-3)", "Paused"], done: ["var(--p-medium)", "Delivered"] };
  const keyTile = (key, color, size = 32) =>
    `<span class="mono" style="width:${size}px;height:${size}px;flex:none;border-radius:${size > 36 ? 10 : 8}px;background:color-mix(in oklab,${color} 16%,transparent);color:${color};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${size > 36 ? 13 : 11.5}px">${key}</span>`;
  const progress = (pct, w = 120, h = 4, color = "var(--brand)") =>
    `<span style="display:inline-block;width:${w}px;height:${h}px;border-radius:2px;background:var(--surface-3);overflow:hidden;vertical-align:middle"><i style="display:block;height:100%;width:${pct}%;background:${color}"></i></span>`;

  /* ---- /projects ------------------------------------------------------ */

  const PROJECTS = [
    { key: "NET", color: "#4f7bd9", name: "Network refresh 2026", desc: "Replace every access point and both core switches across the three Utrecht floors.", health: "on", done: 24, total: 35, ms: [3, 5], next: ["Floor 2 access points", "8 Sep"], watch: true, lead: "MK", due: "38d left" },
    { key: "SUP", color: "#febe2e", name: "Service desk", desc: "The standing queue. Tickets without a project land here.", health: "risk", done: 112, total: 140, ms: [1, 2], next: ["Q3 backlog under 20", "9 Sep"], watch: true, lead: "AA", due: "Due today", dueTone: "var(--brand-deep)" },
    { key: "OFF", color: "#e0567a", name: "Office move Rotterdam", desc: "Floors 4 and 5 of the new building, ready for the October starters.", health: "off", done: 8, total: 20, ms: [1, 4], next: ["Floor 4 desks delivered", "6 Sep"], over: 3, lead: "JB", due: "3d over", dueTone: "var(--negative)" },
    { key: "MFA", color: "#6366f1", name: "MFA rollout", desc: "Every account on MFA before the insurer's audit.", health: "on", done: 5, total: 9, ms: [1, 3], next: ["Contractors enrolled", "30 Sep"], lead: "RD", due: "21d left" },
    { key: "INT", color: "#10b981", name: "Intranet hosting", desc: "Move the intranet to the new hosting account before the old contract ends.", health: "paused", done: 30, total: 31, ms: [1, 1], lead: "TP", due: "60d left" },
    { key: "WEB", color: "#9d9da6", name: "Website 2025", desc: "Marketing site relaunch.", health: "done", done: 48, total: 48, ms: [6, 6], lead: "SL", due: "", archived: true },
  ];
  function projects() {
    const prow = (p) => {
      const [hc, hn] = HEALTH[p.health];
      const pct = Math.round((p.done / p.total) * 100);
      return `
      <div style="display:grid;grid-template-columns:32px minmax(0,1fr) 130px 190px 200px 150px 88px;align-items:center;gap:16px;height:56px;padding:0 24px;border-bottom:1px solid var(--line);opacity:${p.archived ? 0.55 : 1}">
        ${keyTile(p.key, p.color)}
        <div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</span>${p.watch ? `<svg viewBox="0 0 16 16" style="width:12px;height:12px;flex:none;fill:var(--brand);stroke:var(--brand);stroke-width:1.5;stroke-linejoin:round">${I.star}</svg>` : ""}${p.archived ? '<span class="tag">Archived</span>' : ""}</div><div class="t3" style="font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.desc}</div></div>
        <span style="display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--text-2);line-height:1.3"><span style="display:inline-flex;align-items:center;gap:7px"><i style="width:8px;height:8px;border-radius:99px;background:${hc};${p.health === "off" ? `box-shadow:0 0 6px ${hc}` : ""}"></i>${hn}</span>${p.over ? `<span style="font-size:11px;color:var(--negative)">${p.over} past target</span>` : ""}</span>
        <span style="display:flex;align-items:center;gap:10px">${progress(pct, 100, 4, p.health === "off" ? "var(--negative)" : "var(--brand)")}<span class="mono t3" style="font-size:11.5px;white-space:nowrap">${p.done}/${p.total}</span></span>
        <span style="display:flex;flex-direction:column;min-width:0;font-size:12px;line-height:1.3"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2)">${p.next ? p.next[0] : '<span class="t3">All reached</span>'}</span><span class="mono t3" style="font-size:11px">${p.next ? `${p.next[1]} · ${p.ms[0]}/${p.ms[1]} reached` : `${p.ms[0]}/${p.ms[1]}`}</span></span>
        <span style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2)">${avatar(p.lead, 20)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${AV_NAME[p.lead]}</span></span>
        <span class="mono tnum" style="font-size:12px;text-align:right;color:${p.dueTone ?? "var(--text-3)"}">${p.due || "—"}</span>
      </div>`;
    };
    const head = `<div class="label" style="display:grid;grid-template-columns:32px minmax(0,1fr) 130px 190px 200px 150px 88px;gap:16px;height:32px;align-items:center;padding:0 24px;border-bottom:1px solid var(--line);background:var(--bg)"><span></span><span>Project</span><span>Health</span><span>Settled</span><span>Next milestone</span><span>Lead</span><span style="text-align:right">Due</span></div>`;
    const body = `
      <div class="pagehead">
        <h1>Projects</h1><span class="mono t3" style="font-size:11.5px">5 active · 1 archived</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <div class="input" style="width:240px;height:30px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search projects</span></div>
          <span class="seg"><span class="chip">Active</span><span class="chip">Archived</span><span class="chip on">All</span></span>
          <span class="btn primary sm" style="height:30px">${ic("plus")}New project</span>
        </div>
      </div>
      ${head}
      ${PROJECTS.map(prow).join("")}
      <div style="display:flex;align-items:center;gap:12px;padding:16px 24px" class="t3"><span style="font-size:12.5px">Six projects. A ticket does not need one.</span></div>`;
    return shell("projects", ["Projects"], body);
  }

  /* ---- project header (shared by the milestones page) ----------------- */

  function projectHead(activeTab) {
    const tabs = [["Overview"], ["Board"], ["Tickets", "11"], ["Milestones", "5"], ["People", "6"]];
    return `
    <div style="padding:20px 24px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:16px">
        ${keyTile("NET", "#4f7bd9", 44).replace("color-mix(in oklab,#4f7bd9 16%,transparent);color:#4f7bd9", "#4f7bd9;color:#fff")}
        <div>${h1("Network refresh 2026")}<div class="t2" style="font-size:12.5px;margin-top:3px;display:flex;align-items:center;gap:8px">Lead ${avatar("MK", 16)} Mila Kuipers · Team Infrastructure · <span class="mono">12 Aug → 17 Oct</span></div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          ${dotpill("var(--positive)", "On track", ic("chevd"))}
          <span class="btn outline sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("star")}</span>
          <span class="btn primary sm" style="height:28px">${ic("plus")}New ticket</span>
          <span class="btn ghost sm" style="height:28px;width:28px;padding:0;justify-content:center">${ic("dots")}</span>
        </div>
      </div>
      <div style="display:flex;margin-top:10px">${tabs.map(([n, c]) => tab(n, n === activeTab, c)).join("")}</div>
    </div>`;
  }

  /* ---- /projects/[key]/milestones ------------------------------------- */

  const MS = [
    { t: "Site survey", due: "12 Aug", state: "done", done: 6, total: 6, desc: "Every floor walked with the installer; AP positions agreed and marked." },
    { t: "Core switches", due: "29 Aug", state: "done", done: 9, total: 9, desc: "Both cores replaced over the weekend; old units kept as cold spares until October." },
    { t: "Floor 2 access points", due: "8 Sep", state: "now", done: 4, total: 9, desc: "All 14 APs on floor 2 on the new controller. Firmware pinned to 8.10.x until the rollback is understood.", editing: true },
    { t: "Floors 1 & 3", due: "26 Sep", state: "", done: 0, total: 7, desc: "" },
    { t: "Guest network cut-over", due: "17 Oct", state: "", done: 0, total: 4, desc: "Guest SSID moves to the new controller; old network switched off the same evening." },
  ];
  function milestones() {
    const iconBtn = (i, dis = false, danger = false) => `<span class="btn outline sm" style="width:26px;height:26px;padding:0;justify-content:center;${dis ? "opacity:.4;" : ""}${danger ? "color:var(--negative);" : ""}">${ic(i)}</span>`;
    const card = (m, i) => {
      const reached = m.state === "done";
      const sub = reached ? '<span style="color:var(--positive)">Reached</span>' : m.state === "now" ? '<span style="color:var(--brand-deep)">Due today</span>' : `${[17, 38][i - 3]}d left`;
      const pct = Math.round((m.done / m.total) * 100);
      const editor = m.editing
        ? `<div style="display:grid;grid-template-columns:minmax(0,1fr) 176px;gap:12px;margin-top:14px">${field("Description", textarea(m.desc, 2))}${field("Due", input("08 / 09 / 2026", { icon: "cal" }))}</div>
           <div style="margin-top:12px">${saveBar(true)}</div>`
        : m.desc ? `<p class="t2" style="margin:8px 0 0;font-size:12.5px;line-height:1.55;max-width:620px">${m.desc}</p>` : `<p class="t3" style="margin:8px 0 0;font-size:12.5px">No description · <a>Add one</a></p>`;
      return `
      <div class="card" style="padding:16px 18px;opacity:${reached ? 0.75 : 1};${m.editing ? "border-color:color-mix(in oklab,var(--brand) 45%,transparent);" : ""}">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:28px;height:28px;border-radius:99px;display:flex;align-items:center;justify-content:center;background:${reached ? "var(--positive)" : m.state === "now" ? "var(--brand)" : "var(--surface-3)"};color:${reached || m.state === "now" ? "#fff" : "var(--text-3)"};${m.state === "now" ? "color:var(--brand-ink);box-shadow:0 0 0 4px var(--brand-tint);" : ""}">${reached ? ic("check") : ic("flag")}</span>
          <div style="min-width:0;flex:1"><div style="font-weight:600;font-size:14px">${m.t}</div><div class="t3" style="font-size:12px;margin-top:2px;display:flex;gap:6px">${sub}<span>·</span><span class="mono">${m.due}</span><span>·</span><a class="mono" style="color:var(--text-2)">${m.done}/${m.total} tickets</a>${m.state === "now" ? '<span>·</span><span style="color:var(--negative)">1 past target</span>' : ""}</div></div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="btn ${reached ? "ghost" : "outline"} sm" style="height:26px">${reached ? "Not yet" : "Mark reached"}</span>
            <span style="width:1px;height:16px;background:var(--line);margin:0 4px"></span>
            ${iconBtn("chevu", i === 0)}${iconBtn("chevd", i === MS.length - 1)}${iconBtn("trash", false, true)}
          </div>
        </div>
        <div style="margin-top:12px">${progress(pct, 9999, 5, reached ? "var(--positive)" : "var(--brand)").replace("width:9999px", "width:100%").replace("display:inline-block", "display:block")}</div>
        ${editor}
      </div>`;
    };
    const track = `
      <div class="card" style="padding:16px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="label">Track</span><span class="mono t3" style="font-size:11.5px">2 of 5 reached</span></div>
        <div style="position:relative;margin:18px 0 0 6px;padding-left:22px;border-left:2px solid var(--line-strong)">
          <span style="position:absolute;left:-2px;top:0;width:2px;height:36%;background:var(--brand)"></span>
          ${MS.map((m) => `<div style="position:relative;padding:0 0 18px;font-size:12.5px"><span style="position:absolute;left:-30px;top:2px;width:14px;height:14px;border-radius:99px;background:${m.state === "done" ? "var(--brand)" : m.state === "now" ? "var(--bg)" : "var(--surface-3)"};border:${m.state === "now" ? "3px solid var(--brand)" : m.state === "done" ? "0" : "2px solid var(--line-strong)"};box-shadow:${m.state === "now" ? "0 0 0 4px var(--brand-tint)" : "none"}"></span><div style="font-weight:${m.state === "now" ? 600 : 500}">${m.t}</div><div class="mono t3" style="font-size:11px;margin-top:1px">${m.due}${m.state === "now" ? " · today" : ""}</div></div>`).join("")}
        </div>
      </div>`;
    const body = `
      ${projectHead("Milestones")}
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;padding:20px 24px 0">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px dashed var(--line-strong)">
            <span class="t3" style="display:flex">${ic("flag")}</span>
            <div class="input" style="flex:1;height:30px;background:var(--surface);border-color:transparent;box-shadow:none"><span class="ph">What has to be true — e.g. Old mail server switched off</span></div>
            <span class="btn outline sm" style="height:28px;opacity:.5">${ic("plus")}Add milestone</span>
          </div>
          ${MS.map(card).join("")}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">${track}
          <div class="t3" style="font-size:12px;line-height:1.5;padding:0 4px">The dated points this project is working towards. Reorder with the arrows; reaching one marks it in the track and on the overview.</div>
        </div>
      </div>`;
    return shell("projects", ["Projects", '<span class="ref" style="color:var(--text)">NET</span>', "Milestones"], body);
  }

  /* ---- /people ---------------------------------------------------------- */

  const EXTRA = { EJ: "#0ea5e9", NV: "#a855f7", LB: "#f59e0b", YD: "#64748b", PN: "#ec4899", BO: "#22c55e" };
  const av2 = (k, size = 22, name = "") => `<span class="avatar" style="background:${EXTRA[k]};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px" title="${name}">${k}</span>`;
  const PEOPLE = [
    { k: "AA", n: "Ada Admin", you: true, email: "ada@tiqo.local", phone: "+31 6 1200 0001", company: "Tiqo", job: "Head of service desk", dept: "IT", teams: [["Service desk", "#febe2e"], ["Infrastructure", "#4f7bd9"]], role: "Master", seen: "2m", open: 2, office: true },
    { k: "MK", n: "Mila Kuipers", email: "mila@tiqo.local", phone: "+31 6 1200 0014", company: "Tiqo", job: "Network engineer", dept: "IT", teams: [["Infrastructure", "#4f7bd9"]], role: "Agent", seen: "9m", open: 4, office: true },
    { k: "JB", n: "Jonas Berg", email: "jonas@tiqo.local", phone: "+31 6 1200 0022", company: "Tiqo", job: "Field engineer", dept: "IT", teams: [["Infrastructure", "#4f7bd9"], ["Facilities", "#10b981"]], role: "Agent", seen: "1h", open: 3, office: true },
    { k: "RD", n: "Rami Daoud", email: "rami@tiqo.local", phone: "", company: "Tiqo", job: "Security engineer", dept: "IT", teams: [["Security", "#e0567a"]], role: "Agent", seen: "3h", open: 2 },
    { k: "TP", n: "Tomás Pereira", email: "tomas@tiqo.local", phone: "+31 6 1200 0038", company: "Tiqo", job: "Facilities liaison", dept: "Facilities", teams: [["Facilities", "#10b981"]], role: "Agent", seen: "1d", open: 2 },
    { k: "SL", n: "Sanne Lin", email: "sanne.lin@contoso.nl", phone: "+31 6 5500 1187", company: "Contoso", job: "Financial analyst", dept: "Finance", teams: [], role: "Requester", seen: "5m", office: true },
    { k: "EJ", n: "Eva Jansen", email: "eva.jansen@contoso.nl", phone: "+31 6 5500 1043", company: "Contoso", job: "Office manager", dept: "Operations", teams: [], role: "Requester", seen: "2h", office: true },
    { k: "NV", n: "Noah de Vries", email: "noah@contoso.nl", phone: "", company: "Contoso", job: "Account manager", dept: "Sales", teams: [], role: "Requester", seen: "2d" },
    { k: "LB", n: "Lotte Bakker", email: "lotte.bakker@contoso.nl", phone: "+31 6 5500 1290", company: "Contoso", job: "HR adviser", dept: "People", teams: [], role: "Requester", seen: "4d" },
    { k: "PN", n: "Priya Nair", email: "priya@contoso.nl", phone: "", company: "Contoso", job: "Controller", dept: "Finance", teams: [], role: "Requester", seen: "1w" },
    { k: "BO", n: "Ben Okafor", email: "ben.okafor@contoso.nl", phone: "+31 6 5500 1301", company: "Contoso", job: "Warehouse lead", dept: "Logistics", teams: [], role: "Requester", seen: "never" },
    { k: "YD", n: "Yusuf Demir", email: "yusuf@contoso.nl", phone: "", company: "Contoso", job: "Intern", dept: "Marketing", teams: [], role: "Requester", seen: "3mo", inactive: true },
  ];
  const AVX = (k, size) => (EXTRA[k] ? av2(k, size) : avatar(k, size));
  const teamChip = ([n, c]) => `<span class="tag" style="gap:6px"><i style="width:6px;height:6px;border-radius:99px;background:${c}"></i>${n}</span>`;
  function people() {
    const cols = "minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 96px 56px 80px";
    const prow = (p) => `
      <div style="display:grid;grid-template-columns:${cols};align-items:center;gap:16px;height:52px;padding:0 24px;border-bottom:1px solid var(--line);opacity:${p.inactive ? 0.55 : 1}">
        <div style="display:flex;align-items:center;gap:12px;min-width:0"><span style="position:relative;display:inline-flex;flex:none">${AVX(p.k, 28)}${p.office ? '<i style="position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:99px;background:var(--positive);box-shadow:0 0 0 2px var(--bg)"></i>' : ""}</span><div style="min-width:0"><div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px"><span>${p.n}</span>${p.you ? '<span class="tag" style="background:var(--brand-tint);color:var(--brand-deep)">you</span>' : ""}${p.inactive ? '<span class="tag">inactive</span>' : ""}</div><div class="t3 mono" style="font-size:11.5px;margin-top:1px;display:flex;gap:10px"><span style="display:inline-flex;align-items:center;gap:4px">${ic("mail")}${p.email}</span>${p.phone ? `<span style="display:inline-flex;align-items:center;gap:4px">${ic("phone")}${p.phone}</span>` : ""}</div></div></div>
        <div style="min-width:0"><div style="font-size:13px">${p.company}</div><div class="t3" style="font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.job} · ${p.dept}</div></div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${p.teams.length ? p.teams.map(teamChip).join("") : '<span class="t3">—</span>'}</div>
        <span class="t2" style="font-size:12.5px">${p.role}</span>
        <span class="mono tnum" style="font-size:12px;text-align:right;color:var(--text-2)">${p.open ?? '<span class="t3">—</span>'}</span>
        <span class="mono tnum" style="font-size:12px;text-align:right;color:${p.seen === "never" ? "var(--text-3)" : "var(--text-2)"}">${p.seen === "never" ? "never" : p.seen + " ago"}</span>
      </div>`;
    const head = `<div class="label" style="display:grid;grid-template-columns:${cols};gap:16px;height:32px;align-items:center;padding:0 24px;border-bottom:1px solid var(--line);background:var(--bg)"><span>Person</span><span>Organisation</span><span>Teams</span><span>Role</span><span style="text-align:right">Open</span><span style="text-align:right">Last seen</span></div>`;
    const body = `
      <div class="pagehead">
        <h1>People</h1>
        <div class="input" style="width:300px;height:30px;background:var(--surface);margin-left:12px"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search people, teams, job titles</span></div>
        <span class="chip">Any role${ic("chevd")}</span><span class="chip">Any team${ic("chevd")}</span>
        <span class="mono t3" style="font-size:11.5px">12 of 12</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="btn primary sm" style="height:30px">${ic("plus")}New person</span></div>
      </div>
      ${head}
      ${PEOPLE.map(prow).join("")}`;
    return shell("people", ["People"], body);
  }

  /* ---- /people/[id] ------------------------------------------------------ */

  function person() {
    const stat = (l, v, icon) => `<div><div class="label">${l}</div><div class="tnum" style="font-size:18px;font-weight:600;margin-top:6px;display:flex;align-items:center;gap:6px;letter-spacing:-.01em">${icon ? `<span class="t3" style="display:flex">${ic(icon)}</span>` : ""}${v}</div></div>`;
    const ro = (l, v) => `<div style="display:flex;flex-direction:column;gap:6px"><span class="t3" style="font-size:12px;font-weight:500">${l}</span><span style="font-size:13px;min-height:32px;display:flex;align-items:center">${v || '<span class="t3">—</span>'}</span></div>`;
    const day = (d, on) => `<span class="chip ${on ? "on" : ""}" style="height:28px;padding:0 11px;${on ? "background:var(--brand-tint);color:var(--brand-deep);font-weight:600;" : ""}">${d}</span>`;
    const body = `
      <div style="padding:16px 24px 20px;border-bottom:1px solid var(--line)">
        <a class="t2" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500">${ic("arrowl")}All people</a>
        <div style="display:flex;align-items:center;gap:20px;margin-top:14px">
          ${avatar("MK", 64)}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:10px">${h1("Mila Kuipers", 24)}<span class="tag" style="background:var(--brand-tint);color:var(--brand-deep);height:20px">Agent</span></div>
            <div class="t2" style="font-size:12.5px;margin-top:5px;display:flex;align-items:center;gap:8px"><span class="mono t3">@mila</span><span>·</span>Network engineer · Infrastructure<span>·</span><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:99px;background:var(--positive)"></i>In office · until 17:30</span></div>
          </div>
          <div style="display:flex;gap:6px;margin-right:12px"><span class="btn outline sm" style="height:28px">${ic("mail")}Email</span><span class="btn outline sm" style="height:28px">${ic("phone")}Call</span></div>
          <div style="display:flex;gap:36px;padding-right:8px">${stat("Assigned", "4", "ticket")}${stat("Raised", "12")}${stat("Last seen", '<span class="mono" style="font-size:15px">9m ago</span>')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;padding:20px 24px 0">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:18px 20px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between"><div><div style="font-weight:600;font-size:14px">Details</div><div class="t3" style="font-size:12px;margin-top:2px">You maintain this profile.</div></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-top:16px">
              ${field("First name", input("Mila"))}${field("Last name", input("Kuipers"))}
              ${field("Email", input("mila@tiqo.local", { icon: "mail" }))}${field("Phone", input("+31 6 1200 0014", { icon: "phone", style: "background:var(--brand-tint);border-color:color-mix(in oklab,var(--brand) 45%,transparent)" }))}
              ${field("Company", input("Tiqo", { icon: "building" }))}${field("Department", input("IT"))}
              ${field("Function", input("Network engineer", { icon: "briefcase" }))}${field("Username", input("mila", { icon: "user" }), { hint: "Letters, numbers, dots, dashes and underscores." })}
            </div>
            <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
              <div style="display:flex;align-items:baseline;gap:10px"><span class="label">Working hours</span><span class="t3" style="font-size:12px">When you are normally reachable. Left blank, the desk's own opening hours are shown instead.</span></div>
              <div style="display:flex;gap:6px;margin-top:12px">${["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => day(d, true)).join("")}${day("Sat", false)}${day("Sun", false)}</div>
              <div style="display:grid;grid-template-columns:160px 160px;gap:14px 20px;margin-top:14px">${field("Opens", select("08:30"))}${field("Closes", select("17:30"))}</div>
            </div>
            <div style="margin-top:16px">${saveBar(true).replace("Unsaved changes", "Phone changed")}</div>
            <div class="t3" style="font-size:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">Member since <span class="mono">3 Mar 2024</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:16px 18px">
            <div style="font-weight:600;font-size:14px">Access</div><div class="t3" style="font-size:12px;margin-top:2px">What this account may do, and which desks it works.</div>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:14px">
              ${field('<span style="display:inline-flex;align-items:center;gap:5px">' + ic("shield") + "Role</span>", select("Agent"))}
              <div><div class="t3" style="font-size:12px;font-weight:500;margin-bottom:6px">Permissions</div><div style="display:flex;flex-wrap:wrap;gap:4px">${["Work the queue", "Assign tickets", "Add internal notes", "See every ticket", "Manage projects"].map((p) => `<span class="tag">${p}</span>`).join("")}</div></div>
              <div><div class="t3" style="font-size:12px;font-weight:500;margin-bottom:6px;display:flex;align-items:center">Teams<a style="margin-left:auto;font-size:11.5px;display:inline-flex;align-items:center;gap:4px">${ic("edit")}Edit teams</a></div><div style="display:flex;flex-wrap:wrap;gap:4px">${teamChip(["Infrastructure", "#4f7bd9"])}</div></div>
            </div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px">
              <span class="btn outline sm" style="height:30px;justify-content:center">${ic("pause")}Deactivate account</span>
              <span class="t3" style="font-size:11.5px;line-height:1.45">Signs them out everywhere and refuses new sign-ins. Their tickets and messages stay.</span>
              <span class="t3" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;opacity:.6;margin-top:4px" title="This person has tickets or messages. Deactivate them instead.">${ic("trash")}Delete account</span>
            </div>
          </div>
          <div class="card" style="padding:16px 18px 6px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span class="label">Assigned now</span><a style="font-size:12px">All 4</a></div>
            ${[T[0], T[8], T[15]].map((t) => `<div style="display:grid;grid-template-columns:4px minmax(0,1fr);gap:12px;padding:9px 0;border-top:1px solid var(--line)"><span style="position:relative;width:4px;border-radius:2px">${spine(t.p, t.heat, t.hot)}</span><div style="min-width:0"><div style="font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.t}</div><div style="display:flex;align-items:center;gap:8px;margin-top:3px">${ref(t.r)}${bars(t.p)}<span class="mono t3" style="margin-left:auto;font-size:11px">${t.age}</span></div></div></div>`).join("")}
          </div>
        </div>
      </div>`;
    return shell("people", ["People", "Mila Kuipers"], body);
  }

  return { projects, milestones, people, person };
}
