import { I, ic, bars, status, ring, avatar, AV_NAME, ref, spine, T, shell, logo, row, columns, cardHead } from "./shared.mjs";
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

export { ticket2, PLAN, STEP, stepRing, stepChip };
