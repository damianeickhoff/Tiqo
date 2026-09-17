// Round 8: the remaining pages, drawn with the same Signal vocabulary as gen.mjs.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { I, ic as ic1, bars, status, ring, avatar, AV_NAME, ref, spine, T, shell, logo, row, cardHead, page, GROW, STATUS_NAME } from "./shared.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "boards2");
mkdirSync(out, { recursive: true });

/* ------------------------------------------------------------------- icons */

const I2 = {
  text: '<path d="M3 3.5h10M8 3.5v9"/>',
  para: '<path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h6"/>',
  list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".8"/><circle cx="2.8" cy="8" r=".8"/><circle cx="2.8" cy="12" r=".8"/>',
  radio: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/>',
  checksq: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="m5.5 8 2 2 3.5-4"/>',
  hash: '<path d="M6 2.5 4.5 13.5M11.5 2.5 10 13.5M2.5 6h11M2 10h11"/>',
  book: '<path d="M2.5 3.5a2 2 0 0 1 2-2h9v11h-9a2 2 0 0 0-2 2z"/><path d="M4.5 12.5h9"/>',
  arrowr: '<path d="M3 8h10M9 4l4 4-4 4"/>',
  chevu: '<path d="m4 10 4-4 4 4"/>',
  sliders: '<path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h2M7.5 11.5h6"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.5v3.5M8 5.2v.1"/>',
  warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2v.1"/>',
  target: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/>',
  archive: '<rect x="2" y="3" width="12" height="3" rx="1"/><path d="M3 6v7h10V6M6.5 9h3"/>',
  grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
  shield: '<path d="M8 1.8 13 3.8v4c0 3-2.2 5.2-5 6.4-2.8-1.2-5-3.4-5-6.4v-4z"/>',
  globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11"/>',
  mappin: '<path d="M8 14s4-4 4-7.5a4 4 0 0 0-8 0C4 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.5"/>',
  edit: '<path d="m10.5 2.5 3 3-7.5 7.5H3v-3z"/>',
  filter: '<path d="M2.5 3.5h11l-4.5 5v4l-2 1v-5z"/>',
  monitor: '<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 13.5h4M8 11v2.5"/>',
  wifi: '<path d="M2 6.5a9 9 0 0 1 12 0M4.5 9a5.5 5.5 0 0 1 7 0M6.8 11.3a2 2 0 0 1 2.4 0"/><circle cx="8" cy="13" r=".6" fill="currentColor"/>',
  print: '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-4a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v4h-2"/><rect x="4.5" y="9.5" width="7" height="4"/>',
  mailopen: '<path d="M2 6.5 8 2.5l6 4V13H2z"/><path d="m2 6.5 6 4 6-4"/>',
  sendfwd: '<path d="m2.5 8 11-5-3 11-2.5-4.5z"/>',
  play: '<path d="M5 3.5v9l7-4.5z"/>',
  pause: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
  dot: '<circle cx="8" cy="8" r="2.5" fill="currentColor"/>',
  circle: '<circle cx="8" cy="8" r="5.5"/>',
  link: '<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1"/>',
  drag: '<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 16 16">${I2[n] ?? I[n]}</svg>`;

/* ------------------------------------------------------------------- bits */

const h1 = (t, size = 20) => `<h1 style="font-size:${size}px;font-weight:600;letter-spacing:-.02em;margin:0;line-height:1.2">${t}</h1>`;
const dotpill = (color, label, extra = "") =>
  `<span class="chip" style="height:28px;gap:8px;padding:0 10px"><i style="width:8px;height:8px;border-radius:99px;background:${color}"></i><span style="color:var(--text);font-weight:500">${label}</span>${extra}</span>`;
const tab = (n, on, count) =>
  `<span style="display:flex;align-items:center;gap:7px;height:40px;margin-right:22px;font-size:13px;font-weight:500;color:${on ? "var(--text)" : "var(--text-2)"};border-bottom:2px solid ${on ? "var(--brand)" : "transparent"}">${n}${count ? `<span class="mono t3" style="font-size:11px">${count}</span>` : ""}</span>`;
const field = (label, control, opts = {}) =>
  `<div style="display:flex;flex-direction:column;gap:6px;${opts.style ?? ""}"><span style="font-size:${opts.size ?? 12.5}px;font-weight:500;display:flex;gap:4px">${label}${opts.req ? '<span style="color:var(--negative)" title="Required">*</span>' : ""}</span>${control}${opts.hint ? `<span class="t3" style="font-size:12px">${opts.hint}</span>` : ""}</div>`;
const input = (v, opts = {}) =>
  `<div class="input" style="height:${opts.h ?? 32}px;${opts.focus ? "border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint);" : ""}${opts.style ?? ""}">${opts.icon ? `<span class="t3" style="display:flex">${ic(opts.icon)}</span>` : ""}<span class="${opts.ph ? "ph" : ""}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${v}</span>${opts.focus ? '<i style="width:1px;height:16px;background:var(--text)"></i>' : ""}${opts.right ?? ""}</div>`;
const select = (v, opts = {}) => input(v, { ...opts, right: `<span class="t3" style="display:flex">${ic("chevd")}</span>` });
const textarea = (v, rows = 4, opts = {}) =>
  `<div class="input" style="height:${rows * 22 + 16}px;align-items:flex-start;padding:8px 10px;white-space:normal;line-height:1.5;${opts.style ?? ""}"><span class="${opts.ph ? "ph" : ""}" style="white-space:normal">${v}</span></div>`;
const checkbox = (label, on, opts = {}) =>
  `<label style="display:flex;align-items:center;gap:9px;font-size:${opts.size ?? 13}px;${opts.style ?? ""}"><span style="width:16px;height:16px;border-radius:4px;border:1px solid ${on ? "var(--brand)" : "var(--line-strong)"};background:${on ? "var(--brand)" : "var(--paper)"};display:flex;align-items:center;justify-content:center;color:var(--brand-ink)">${on ? '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3 3 7-7"/></svg>' : ""}</span>${label}</label>`;
const toggle = (on, label) =>
  `<span style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500"><span style="width:30px;height:18px;border-radius:99px;background:${on ? "var(--brand)" : "var(--surface-3)"};position:relative"><i style="position:absolute;top:2px;${on ? "right:2px" : "left:2px"};width:14px;height:14px;border-radius:99px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)"></i></span>${label}</span>`;
const saveBar = (dirty) =>
  dirty
    ? `<div style="display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:10px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow)"><span class="btn primary sm" style="height:28px">${ic("check")}Save</span><span class="btn ghost sm" style="height:28px">Discard</span><span class="t3" style="font-size:12px;margin-left:auto;display:flex;align-items:center;gap:6px"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>Unsaved changes</span></div>`
    : `<div style="display:flex;align-items:center;gap:10px;height:36px"><span class="btn outline sm" style="height:28px;opacity:.5">${ic("check")}Save</span><span class="t3" style="font-size:12px">No changes</span></div>`;
const emptyAvatarStack = (keys, size = 22) =>
  `<span style="display:inline-flex">${keys.map((k, i) => `<span style="margin-left:${i ? -6 : 0}px;border-radius:99px;box-shadow:0 0 0 2px var(--surface);display:inline-flex">${avatar(k, size)}</span>`).join("")}</span>`;

/* ===================================================================== */
/*                               PORTAL                                  */
/* ===================================================================== */

function portalShell(active, body, opts = {}) {
  const h = opts.h ?? 900;
  const pill = (label, key, extra = "") =>
    `<span class="chip ${active === key ? "on" : ""}" style="height:32px;padding:0 14px;border:0;border-radius:999px;font-size:13.5px;font-weight:500;${active === key ? "" : "background:transparent;"}">${label}${extra}</span>`;
  return `
  <div class="portal" style="width:1440px;height:${h}px;background:var(--bg);overflow:hidden;position:relative;display:flex;flex-direction:column;font-size:14px">
    <header style="height:60px;flex:none;display:flex;align-items:center;padding:0 48px;gap:14px;border-bottom:1px solid var(--line)">
      ${logo(28)}<span style="font-weight:700;font-size:16px;letter-spacing:-.02em">Tiqo</span><span class="t3" style="font-size:13px;padding-left:12px;border-left:1px solid var(--line-strong)">Service portal</span>
      <nav style="margin-left:auto;display:flex;gap:2px;align-items:center">
        ${pill("Home", "home")}${pill("Answers", "answers")}${pill("My requests", "requests", '<span class="mono" style="font-size:11px;background:var(--brand);color:var(--brand-ink);padding:1px 6px;border-radius:99px;margin-left:6px">3</span>')}
        <span style="width:1px;height:18px;background:var(--line-strong);margin:0 10px"></span>
        <span class="btn ghost" style="width:32px;padding:0;justify-content:center">${ic("sun")}</span>
        ${avatar("SL", 30)}
      </nav>
    </header>
    <div style="flex:1;min-height:0;overflow:hidden;padding:32px 48px 0">${body}</div>
    <footer class="t3" style="flex:none;border-top:1px solid var(--line);padding:18px 48px;font-size:13px;display:flex;gap:6px">Tiqo service desk<span>·</span><a>Service desk</a></footer>
  </div>`;
}

const crumbs = (items) =>
  `<nav style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-3)">${items.map((c, i) => (i === items.length - 1 ? `<span style="color:var(--text-2)">${c}</span>` : `<a style="color:var(--text-3)">${c}</a><span style="display:flex">${ic("chev")}</span>`)).join("")}</nav>`;

/* ---- /portal/requests ------------------------------------------------ */

const MY = [
  { r: "INC-2609 0117", t: "VPN drops every 20 minutes on the Utrecht office Wi-Fi", form: "Something stopped working", p: "urgent", s: "progress", age: "3h", rep: 6, heat: 0.92, hot: true, with: "MK", last: "Mila replied 25 min ago" },
  { r: "INC-2609 0119", t: "Laptop will not wake from sleep after Monday's patch", form: "My laptop or phone has a problem", p: "high", s: "waiting", age: "6h", rep: 3, heat: 0.55, with: "JB", last: "Jonas asked you something 2h ago" },
  { r: "QST-2609 0122", t: "How do I get a second monitor for the Rotterdam desk?", form: "Ask a question", p: "medium", s: "new", age: "12m", rep: 0, heat: 0.05 },
  { r: "QST-2609 0112", t: "Onboarding checklist for the two September starters", form: "Ask a question", p: "low", s: "resolved", age: "2d", rep: 3, heat: 1, with: "TP" },
  { r: "QST-2609 0108", t: "Request access to the HR SharePoint site", form: "Request access to a system", p: "low", s: "resolved", age: "6d", rep: 1, heat: 1, with: "MK" },
];

function portalRequests() {
  const reqRow = (t, last) => `
    <div style="display:grid;grid-template-columns:4px 128px minmax(0,1fr) 190px 16px;gap:16px;align-items:center;padding:14px 20px 14px 16px;${last ? "" : "border-bottom:1px solid var(--line)"};opacity:${t.s === "resolved" ? 0.7 : 1}">
      <span style="position:relative;width:4px;height:36px;border-radius:2px;overflow:visible">${spine(t.p, t.heat, t.hot)}</span>
      ${ref(t.r)}
      <div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:14.5px"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.t}</span>${t.s === "waiting" ? '<span class="tag" style="background:var(--brand-tint);color:var(--brand-deep);flex:none">Waiting for your reply</span>' : ""}</div><div class="t3" style="font-size:12.5px;margin-top:3px;display:flex;gap:6px;align-items:center">${t.form}<span>·</span><span class="mono">${t.age} ago</span>${t.rep ? `<span>·</span><span style="display:inline-flex;align-items:center;gap:4px">${ic("msg")}${t.rep} replies</span>` : ""}${t.last ? `<span>·</span><span>${t.last}</span>` : ""}</div></div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px">${status(t.s)}${t.with ? `<span style="margin-left:auto">${avatar(t.with, 22)}</span>` : '<span style="margin-left:auto"><span class="empty-avatar"></span></span>'}</div>
      <span class="t3" style="display:flex">${ic("chev")}</span>
    </div>`;
  const group = (label, n, items) => `
    <div style="margin-top:24px">
      <div class="label" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">${label}<span class="mono" style="letter-spacing:0">${n}</span></div>
      <div class="card" style="overflow:hidden">${items.map((t, i) => reqRow(t, i === items.length - 1)).join("")}</div>
    </div>`;
  const body = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:flex-end;gap:24px">
        <div>${h1("My requests", 24)}<p class="t2" style="margin:6px 0 0;font-size:14px">Everything you have asked us for, and where it stands.</p></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span class="seg"><span class="chip on">All <span class="mono t3" style="font-size:11px;margin-left:4px">5</span></span><span class="chip">Open <span class="mono t3" style="font-size:11px;margin-left:4px">3</span></span><span class="chip">Settled <span class="mono t3" style="font-size:11px;margin-left:4px">2</span></span></span>
          <div class="input" style="width:240px;height:34px;border-radius:999px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search your requests</span></div>
          <span class="btn primary" style="height:34px;border-radius:999px;padding:0 14px">${ic("plus")}Make a request</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:24px;padding:12px 16px;border-radius:12px;background:var(--brand-wash);border:1px solid color-mix(in oklab,var(--brand) 25%,transparent);font-size:13.5px"><span style="display:flex;color:var(--brand-deep)">${ic("msg")}</span><span><b style="font-weight:600">Jonas is waiting for your answer</b> on <span class="ref inc" style="font-size:12px"><b>INC</b>-2609 0119</span> · Laptop will not wake from sleep</span><a style="margin-left:auto;font-weight:500;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">Reply${ic("chev")}</a></div>
      ${group("Still open", 3, MY.slice(0, 3))}
      ${group("Settled", 2, MY.slice(3))}
    </div>`;
  return portalShell("requests", body);
}

/* ---- /portal/answers ------------------------------------------------- */

const KB = {
  "Accounts and access": [
    ["Reset your own password", "Use the self-service page before the desk opens. Works from any network."],
    ["Get into a shared mailbox", "Who can grant it, how long it takes and where it shows up in Outlook."],
    ["MFA on a new phone", "Move the authenticator without losing access to Teams and mail."],
    ["Request a Figma or Adobe licence", "Licences are pooled per team; ask your lead first, then the desk."],
    ["SharePoint: I can see the site but not the files", "Site access and library access are granted separately."],
  ],
  "Devices": [
    ["Laptop will not wake from sleep", "Hold power for 10 seconds; if that fails, bring it to floor 1."],
    ["Second monitor at a flex desk", "Every dock supports two screens. Use the USB-C cable, not HDMI."],
    ["Print from your own laptop", "Add the FollowMe queue once; badge at any printer."],
  ],
  "Working from home": [
    ["VPN keeps dropping", "Switch to the wired adapter or the 5 GHz network; the 2.4 GHz band drops every 20 minutes on some routers."],
    ["Teams call quality", "Turn off video for the call, or use the desk phone app."],
  ],
};

function portalAnswers() {
  const card = ([title, sub]) => `
    <div class="card" style="display:flex;gap:14px;padding:16px 18px;align-items:flex-start">
      <span style="width:38px;height:38px;flex:none;border-radius:10px;background:var(--surface-3);color:var(--text-2);display:flex;align-items:center;justify-content:center">${ic("book")}</span>
      <div style="min-width:0"><div style="font-weight:600;font-size:14.5px;line-height:1.3">${title}</div><div class="t2" style="font-size:13px;margin-top:4px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${sub}</div></div>
    </div>`;
  const section = (name, items) => `
    <section style="margin-top:28px">
      <div class="label" style="display:flex;align-items:center;gap:8px;margin-bottom:12px">${name}<span class="mono" style="letter-spacing:0">${items.length}</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${items.map(card).join("")}</div>
    </section>`;
  const body = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;align-items:flex-end;gap:24px">
        <div>${h1("Answers", 24)}<p class="t2" style="margin:6px 0 0;font-size:14px">Solve it yourself, in a minute, without waiting for us.</p></div>
        <div class="input" style="margin-left:auto;width:320px;height:36px;border-radius:999px;background:var(--surface)"><span class="t3" style="display:flex">${ic("search")}</span><span class="ph">Search answers</span><kbd style="margin-left:auto">/</kbd></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:20px;flex-wrap:wrap"><span class="label" style="margin-right:6px">Often read</span>${["Reset your own password", "VPN keeps dropping", "MFA on a new phone", "Second monitor at a flex desk"].map((x) => `<a class="chip" style="height:30px;color:var(--text);font-size:12.5px">${ic("book")}${x}</a>`).join("")}</div>
      ${Object.entries(KB).map(([n, items]) => section(n, items)).join("")}
    </div>`;
  return portalShell("answers", body);
}

/* ---- /portal/kb/[slug] ------------------------------------------------ */

function portalArticle() {
  const svc = (icon, title, sub) => `
    <div class="card" style="display:flex;gap:14px;padding:14px 16px;align-items:center">
      <span style="width:40px;height:40px;flex:none;border-radius:10px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center">${ic(icon)}</span>
      <div style="min-width:0;flex:1"><div style="font-weight:600;font-size:14px">${title}</div><div class="t3" style="font-size:12.5px;margin-top:2px">${sub}</div></div>
      <span class="t3" style="display:flex">${ic("arrowr")}</span>
    </div>`;
  const body = `
    <article style="max-width:760px;margin:0 auto">
      ${crumbs(["Home", "Working from home"])}
      <h1 style="font-size:28px;font-weight:600;letter-spacing:-.025em;margin:18px 0 0;line-height:1.15">VPN keeps dropping</h1>
      <p class="t2" style="font-size:16px;line-height:1.55;margin:10px 0 0;max-width:62ch">Switch to the wired adapter or the 5 GHz network. The 2.4 GHz band drops every 20 minutes on some home routers, and the client reconnects a few seconds later.</p>
      <div class="t3" style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin-top:14px">${avatar("MK", 18)}<span>Mila Kuipers</span><span>·</span><span class="mono">Updated 2 Sep</span><span>·</span><span>1 min read</span></div>
      <div class="card" style="padding:28px 32px;margin-top:22px;font-size:14.5px;line-height:1.75;color:var(--text)">
        <p style="margin:0">The drop is almost always the router moving the laptop between its 2.4 GHz and 5 GHz networks. The VPN client sees a new address and has to start over.</p>
        <p style="margin:14px 0 0;font-weight:600;font-size:15px">Try this first</p>
        <ol style="margin:6px 0 0;padding-left:20px;color:var(--text-2)"><li style="padding-left:4px">Forget the Wi-Fi network and join the one ending in <span class="mono" style="color:var(--text);font-size:13px">-5G</span> only.</li><li style="padding-left:4px;margin-top:4px">If your router shows a single name, plug the USB-C adapter in and use the cable for calls.</li><li style="padding-left:4px;margin-top:4px">Open the VPN client and turn on <b style="font-weight:600;color:var(--text)">Always reconnect</b>.</li></ol>
        <p style="margin:14px 0 0;font-weight:600;font-size:15px">If it still drops</p>
        <p style="margin:6px 0 0;color:var(--text-2)">Note the time of two drops and raise a request below. We will look at the client logs, which are collected automatically.</p>
        <div style="display:flex;align-items:center;gap:10px;margin-top:22px;padding-top:16px;border-top:1px solid var(--line);font-size:13px"><span class="t2">Did this solve it?</span><span class="btn outline sm" style="height:28px;border-radius:999px">${ic("check")}Yes</span><span class="btn outline sm" style="height:28px;border-radius:999px">${ic("x")}Not really</span><span class="t3" style="margin-left:auto;font-size:12px">Helped 41 people this month</span></div>
      </div>
      <div style="margin-top:24px"><div class="label" style="margin-bottom:6px">Related answers</div>${[["Teams call quality", "Turn off video for the call, or use the desk phone app."], ["Laptop will not wake from sleep", "Hold power for 10 seconds; if that fails, bring it to floor 1."]].map(([t, s]) => `<a style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line);color:var(--text);font-size:14px"><span style="display:flex" class="t3">${ic("book")}</span><span style="font-weight:500;white-space:nowrap">${t}</span><span class="t3" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</span><span class="t3" style="margin-left:auto;display:flex">${ic("chev")}</span></a>`).join("")}</div>
      <div style="margin-top:24px;padding-top:22px;border-top:1px solid var(--line)">
        <div style="font-size:14px;font-weight:500;margin-bottom:12px">Still stuck? Raise a request and we will pick it up.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${svc("wifi", "Something stopped working", "Tell us what stopped working")}${svc("laptop", "My laptop or phone has a problem", "Hardware, docking, batteries")}</div>
      </div>
    </article>`;
  return portalShell("answers", body, { h: 1000 });
}

/* ---- /portal/f/[slug] -------------------------------------------------- */

function portalForm() {
  const F = 14;
  const pin = (v, o = {}) => input(v, { h: 38, style: "font-size:14px;", ...o });
  const psel = (v, o = {}) => select(v, { h: 38, style: "font-size:14px;", ...o });
  const radioRow = (label, on) =>
    `<label style="display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:8px;border:1px solid ${on ? "color-mix(in oklab,var(--brand) 45%,transparent)" : "var(--line)"};background:${on ? "var(--brand-tint)" : "var(--paper)"};font-size:14px"><span style="width:16px;height:16px;border-radius:99px;border:${on ? "5px solid var(--brand)" : "1px solid var(--line-strong)"};background:${on ? "#fff" : "var(--paper)"}"></span>${label}</label>`;
  const legend = (t, d) => `<div style="margin-bottom:14px"><div style="font-size:15px;font-weight:600">${t}</div><div class="t3" style="font-size:13px;margin-top:2px">${d}</div></div>`;
  const suggestions = `
    <div style="border:1px solid var(--line);background:var(--surface-2);border-radius:12px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600"><span class="t2" style="display:flex">${ic("book")}</span>This might already answer it<span class="btn ghost sm" style="margin-left:auto;height:26px">None of these</span></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        ${[["SharePoint: I can see the site but not the files", "Site access and library access are granted separately."], ["Get into a shared mailbox", "Who can grant it, how long it takes and where it shows up in Outlook."]].map(([t, s]) => `<a style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);font-size:13.5px"><span style="font-weight:500;white-space:nowrap">${t}</span><span class="t3" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</span><span class="t3" style="margin-left:auto;display:flex">${ic("arrowr")}</span></a>`).join("")}
      </div>
    </div>`;
  const body = `
    <div style="max-width:760px;margin:0 auto">
      ${crumbs(["Home", "Accounts and access", "Request access to a system"])}
      <div style="display:flex;gap:16px;align-items:flex-start;margin-top:18px">
        <span style="width:48px;height:48px;flex:none;border-radius:12px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center"><svg class="i" viewBox="0 0 16 16" style="width:22px;height:22px">${I.key}</svg></span>
        <div><h1 style="font-size:26px;font-weight:600;letter-spacing:-.025em;margin:0;line-height:1.15">Request access to a system</h1><p class="t2" style="font-size:14.5px;margin:6px 0 0;max-width:62ch">Shared drives, SharePoint sites, applications and admin roles. Access is granted by the owner of the system; the desk routes it and keeps you posted.</p></div>
      </div>
      <div class="card" style="margin-top:22px;padding:28px 32px 24px;display:flex;flex-direction:column;gap:28px">
        ${suggestions}
        <fieldset style="border:0;margin:0;padding:0">
          ${legend("What you need", "The more precise, the faster the owner can say yes.")}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${field("What do you need access to?", pin("HR SharePoint site, the Contracts library", { focus: true }), { req: true, size: F, style: "grid-column:span 2" })}
            ${field("Which system?", psel("SharePoint"), { req: true, size: F })}
            ${field("Needed by", pin("14 / 09 / 2026", { icon: "cal" }), { size: F })}
            ${field("Access level", `<div style="display:flex;flex-direction:column;gap:6px">${radioRow("Read", false)}${radioRow("Edit", true)}${radioRow("Admin", false)}</div>`, { req: true, size: F, style: "grid-column:span 2" })}
          </div>
        </fieldset>
        <fieldset style="border:0;margin:0;padding:0">
          ${legend("Approval", "Owners answer faster when the manager already knows.")}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${field("Who approves this?", pin("", { ph: true, icon: "user" }), { size: F, hint: "Usually your manager or the system owner." })}
            ${field("Their email", pin("name@company.com", { ph: true, icon: "mail" }), { size: F })}
            <label style="grid-column:span 2;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--paper)">${checkbox("", true).replace("<label", "<span").replace("</label>", "</span>")}My manager has already approved this</label>
            ${field("Anything else we should know", textarea("", 4, { ph: true, style: "font-size:14px" }), { size: F, style: "grid-column:span 2", hint: "Deadlines, colleagues who already have the same access, anything that helps." })}
          </div>
        </fieldset>
        <div style="display:flex;align-items:center;gap:12px;padding-top:20px;border-top:1px solid var(--line)"><span class="t3" style="font-size:12.5px;line-height:1.5"><span style="display:block">Raised as a <span class="ref qst" style="font-size:12px"><b>QST</b></span> question · answered by Accounts within about 2 hours</span><span style="display:block">Updates go to <span class="mono" style="font-size:12px">sanne.lin@contoso.nl</span> and to My requests</span></span><span class="btn primary" style="margin-left:auto;height:38px;padding:0 16px;font-size:14px">${ic("send")}Send</span></div>
      </div>
    </div>`;
  return portalShell("home", body, { h: 1420 });
}

/* ===================================================================== */
/*                            FORM DESIGNER                              */
/* ===================================================================== */

function formDesigner(opts = {}) {
  const KINDS = [["text", "One line"], ["para", "Paragraph"], ["list", "Dropdown"], ["radio", "Choice"], ["checksq", "Tick box"], ["hash", "Number"], ["mail", "Email"], ["phone", "Phone"], ["cal", "Date"]];
  const palette = `
    <div class="card" style="padding:12px;align-self:start">
      <div class="label" style="padding:4px 6px 8px">Add a question…</div>
      <div style="display:flex;flex-direction:column;gap:1px">${KINDS.map(([i, n]) => `<span style="display:flex;align-items:center;gap:9px;height:30px;padding:0 8px;border-radius:6px;font-size:13px;color:var(--text-2)"><span style="display:flex;color:var(--text-3)">${ic(i)}</span>${n}<span class="t3" style="margin-left:auto;display:flex;opacity:.5">${ic("plus")}</span></span>`).join("")}</div>
      <div class="hair" style="margin:8px 0"></div>
      <span style="display:flex;align-items:center;gap:9px;height:30px;padding:0 8px;border-radius:6px;font-size:13px;font-weight:500"><span style="display:flex;color:var(--text-3)">${ic("layers")}</span>Group of questions<span class="t3" style="margin-left:auto;display:flex">${ic("plus")}</span></span>
    </div>`;
  const fcard = (icon, label, meta, o = {}) => `
    <div style="position:relative;grid-column:span ${o.half ? 1 : 2};padding:10px 12px;border-radius:10px;border:1px solid ${o.sel ? "color-mix(in oklab,var(--brand) 50%,transparent)" : "var(--line)"};background:${o.sel ? "var(--brand-tint)" : "var(--surface)"};">
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500">${o.sel ? `<span style="display:flex;color:var(--text-3);margin-left:-6px">${ic("drag")}</span>` : ""}<span style="display:flex;color:var(--text-3)">${ic(icon)}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>${o.req ? '<span style="color:var(--negative)">*</span>' : ""}</div>
      <div class="t3" style="font-size:11.5px;margin-top:3px;display:flex;gap:6px;align-items:center">${meta.join("<span>·</span>")}</div>
      ${o.sel ? `<div style="position:absolute;right:6px;top:6px;display:flex;gap:2px"><span class="btn outline sm" style="width:22px;height:22px;padding:0;justify-content:center">${ic("chevu")}</span><span class="btn outline sm" style="width:22px;height:22px;padding:0;justify-content:center">${ic("chevd")}</span></div>` : ""}
    </div>`;
  const groupHead = (t, d) => `<div style="display:flex;flex-direction:column;gap:2px;padding:8px 10px;margin:0 -10px 10px;border-radius:8px"><span style="font-size:13.5px;font-weight:600">${t}</span><span class="t3" style="font-size:12px">${d}</span></div>`;
  const canvas = `
    <div class="card" style="overflow:hidden;align-self:start">
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--line);${opts.form ? "background:var(--brand-wash);" : ""}">
        <span style="width:40px;height:40px;border-radius:10px;background:var(--brand-tint);color:var(--brand-deep);display:flex;align-items:center;justify-content:center">${ic("key")}</span>
        <div style="min-width:0"><div style="font-size:15px;font-weight:600">Request access to a system</div><div class="t3" style="font-size:12.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Shared drives, SharePoint sites, applications and admin roles. Access is granted by the owner…</div></div>
        <span class="mono t3" style="margin-left:auto;font-size:11px;white-space:nowrap">8 questions · 3 required · ~2 min</span><span class="btn ghost sm" style="flex:none">${ic("edit")}Edit</span>
      </div>
      <div style="padding:18px 20px 20px">
        ${groupHead("What you need", "The more precise, the faster the owner can say yes.")}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${fcard("text", "What do you need access to?", ["One line", "The subject"], { req: true })}
          ${fcard("list", "Which system?", ["Dropdown", "A line in the description"], { req: true, half: true })}
          ${fcard("cal", "Needed by", ["Date"], { half: true })}
          ${fcard("radio", "Access level", ["Choice", "A line in the description"], { req: true })}
        </div>
        ${groupHead("Approval", "Owners answer faster when the manager already knows.").replace('margin:0 -10px 10px', 'margin:22px -10px 10px')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${fcard("text", "Who approves this?", ["One line", "A line in the description"], { half: true })}
          ${fcard("mail", "Their email", ["Email", "A line in the description", '<span style="display:inline-flex;align-items:center;gap:4px;color:var(--brand-deep)">' + ic("link") + "Conditional</span>"], { half: true, sel: !opts.form })}
          ${fcard("checksq", "My manager has already approved this", ["Tick box"])}
          ${fcard("para", "Anything else we should know", ["Paragraph", "The description"])}
        </div>
        <div style="margin-top:14px;border:1px dashed var(--line-strong);border-radius:10px;height:40px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12.5px" class="t3">${ic("plus")}Drop a question here, or pick one from the left</div>
      </div>
    </div>`;
  const panel = (title, inner) => `<div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:12px"><div class="label" style="display:flex;align-items:center;gap:7px">${ic("sliders")}${title}</div>${inner}</div>`;
  const inspector = `
    <div style="display:flex;flex-direction:column;gap:12px;align-self:start">
      ${panel("Question", `
        ${field("Label", input("Their email"))}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${field("Kind", select("Email"))}${field("Placeholder", input("name@company.com", { ph: true }))}</div>
        ${field("Help text", input("Optional", { ph: true }))}
        <div style="display:flex;gap:18px;padding-top:2px">${checkbox("Required", false)}${checkbox("Half width", true)}</div>`)}
      ${panel("Where the answer goes", `
        ${field("Becomes", select("A line in the description"))}
        ${field("Group", select("Approval"))}`)}
      ${panel("Only ask this when", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${field("Depends on", select("Who approves this?", { style: "border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)" }))}${field("Is", select("Choose one…", { ph: true }))}</div>
        <span class="t3" style="font-size:12px;display:flex;gap:6px;align-items:flex-start;line-height:1.4">${ic("info")}Only earlier dropdown, choice and tick-box questions can be picked.</span>`)}
      ${saveBar(true)}
      <span class="btn ghost sm" style="height:30px;justify-content:center;color:var(--negative)">${ic("trash")}Delete this question</span>
    </div>`;
  const formInspector = `
    <div style="display:flex;flex-direction:column;gap:12px;align-self:start">
      ${panel("About this form", `${field("Name", input("Request access to a system"))}${field("One-line summary", input("Shared drives, SharePoint sites, applications and admin roles"))}${field("Introduction", textarea("Access is granted by the owner of the system; the desk routes it and keeps you posted.", 2))}<div style="display:grid;grid-template-columns:1fr 72px;gap:10px">${field("Icon", select("key"))}${field("Colour", '<span style="height:32px;border-radius:8px;border:1px solid var(--line);background:var(--brand);display:block"></span>')}</div>`)}
      ${panel("Being found", `${field("Section", select("Accounts and access"))}${field("Search words", input("access, sharepoint, drive, licence"))}${checkbox("Show on the front page", true)}<span class="t3" style="font-size:11.5px;margin-top:-6px;line-height:1.4">Featured forms fill the “Common requests” band on the portal front page.</span>`)}
      ${panel("What it raises", `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${field("Type", select("Question"))}${field("Priority", select("Medium"))}</div>${field("Team", select("Accounts"))}${field("Project", select("No project", { ph: true }))}`)}
      ${panel("After sending", field("Confirmation message", textarea("We have it. The system owner usually answers within two working days; you can follow it under My requests.", 3)))}
      ${saveBar(false)}
    </div>`;
  const body = `
    <div class="pagehead" style="gap:10px">
      <span class="btn ghost sm" style="margin-left:-8px;padding:0 6px">${ic("arrowl")}Forms</span>
      <span style="width:1px;height:18px;background:var(--line)"></span>
      <h1>Request access to a system</h1><span class="tag">Accounts and access</span>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        ${opts.form ? "" : '<span class="t3" style="font-size:12px;display:flex;align-items:center;gap:6px;margin-right:6px"><i style="width:6px;height:6px;border-radius:99px;background:var(--brand)"></i>Unsaved changes</span>'}
        ${dotpill("var(--positive)", "Live", ic("chevd"))}
        <span class="btn outline sm" style="height:28px">${ic("ext")}Preview</span>
        <span class="btn ghost sm" style="height:28px">${ic("dots")}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:196px minmax(0,1fr) 320px;gap:16px;padding:20px 24px 0">${palette}${canvas}${opts.form ? formInspector : inspector}</div>`;
  return shell("settings", ["Settings", "Portal", "Forms", "Request access to a system"], body);
}

/* ===================================================================== */
/*                                DESK                                   */
/* ===================================================================== */

import { makeDesk } from "./desk.mjs";
const desk = makeDesk({ ic, I, bars, status, avatar, AV_NAME, ref, spine, T, shell, row, cardHead, h1, dotpill, tab, field, input, select, textarea, checkbox, saveBar });

/* ===================================================================== */
/*                                WRITE                                  */
/* ===================================================================== */

const boards = [
  ["Projects", "dark", desk.projects(), 1440, 900, "Projects · dark"],
  ["ProjectsLight", "light", desk.projects(), 1440, 900, "Projects · light"],
  ["Milestones", "dark", desk.milestones(), 1440, 1040, "Project milestones · dark"],
  ["MilestonesLight", "light", desk.milestones(), 1440, 1040, "Project milestones · light"],
  ["People", "dark", desk.people(), 1440, 900, "People · dark"],
  ["PeopleLight", "light", desk.people(), 1440, 900, "People · light"],
  ["Person", "dark", desk.person(), 1440, 900, "A person · dark"],
  ["PersonLight", "light", desk.person(), 1440, 900, "A person · light"],
  ["FormDesigner", "light", formDesigner(), 1440, 900, "Form designer · light"],
  ["FormDesignerDark", "dark", formDesigner(), 1440, 900, "Form designer · dark"],
  ["FormDesignerForm", "light", formDesigner({ form: true }), 1440, 1240, "Form designer · form settings · light"],
  ["PortalRequests", "light", portalRequests(), 1440, 900, "Portal · My requests · light"],
  ["PortalRequestsDark", "dark", portalRequests(), 1440, 900, "Portal · My requests · dark"],
  ["PortalAnswers", "light", portalAnswers(), 1440, 900, "Portal · Answers · light"],
  ["PortalAnswersDark", "dark", portalAnswers(), 1440, 900, "Portal · Answers · dark"],
  ["PortalArticle", "light", portalArticle(), 1440, 1000, "Portal · An answer · light"],
  ["PortalArticleDark", "dark", portalArticle(), 1440, 1000, "Portal · An answer · dark"],
  ["PortalForm", "light", portalForm(), 1440, 1420, "Portal · A request form · light"],
  ["PortalFormDark", "dark", portalForm(), 1440, 1420, "Portal · A request form · dark"],
];

const rowsOf = [
  ["Projects", "ProjectsLight"],
  ["Milestones", "MilestonesLight"],
  ["People", "PeopleLight"],
  ["Person", "PersonLight"],
  ["FormDesigner", "FormDesignerDark", "FormDesignerForm"],
  ["PortalRequests", "PortalRequestsDark"],
  ["PortalAnswers", "PortalAnswersDark"],
  ["PortalArticle", "PortalArticleDark"],
  ["PortalForm", "PortalFormDark"],
];

const notes = {
  Projects: "Projects: the card list becomes a flush table like the queue — key tile, name + one line, health dot, settled bar with n/m, milestones reached, lead, due (over in rose, today in amber). Archived rows sit last, dimmed. Search, Active / Archived / All and New project move into the page head; New project opens the same form as today in a dialog.",
  Milestones: "Milestones: same project header and tab row as the overview. Left: an add-line at the top, then one card per milestone (flag or check, title, Reached / Due today / n d left · date · done/total, progress bar, description). Controls kept: Mark reached / Not yet, move up / down, delete. The card being edited shows Description + Due and the SaveBar. Right: the same track as the overview card.",
  People: "People: flush table, 52px rows. Person (avatar, name, you / inactive tags, email · phone in mono), Organisation (company; job · department), Teams as dotted chips, Role, Last seen. Search and the n of n count sit in the page head with New person.",
  Person: "A person: back link, 64px avatar, name with the role as a tag, @username · job · department, in-office pill from their working hours; Assigned / Raised / Last seen as readouts. Details as a 2-column label/control grid; a changed field is amber-tinted and the SaveBar appears (drafted, saved on Save). Working hours as day chips + Opens / Closes. Right: Access (role, permission tags, teams + Edit teams, Deactivate, Delete disabled when they have tickets) and a proposed ‘Assigned now’ card — new, drop it if unwanted.",
  FormDesigner: "Form designer (third board: the form itself selected, so the inspector shows About this form / Being found / What it raises / After sending): the editor takes the full content width (no settings side-nav) with a back link to Forms. Palette · canvas · inspector, as today. The selected question is amber-tinted and shows its move arrows; the inspector keeps Question / Where the answer goes / Only ask this when, the SaveBar (dirty) and Delete. Live toggle and Preview stay in the page head.",
  PortalRequests: "My requests: same rows as the portal home (heat spine, reference, title, form · age · replies, status ring, who has it). All / Open / Settled as a segmented pill, search on the right, groups Still open and Settled.",
  PortalAnswers: "Answers: category label with a count, three cards per row, book tile in surface-3. The search field is the hero search from the front page, kept on this page so nobody has to go back.",
  PortalArticle: "An answer: 760px reading column, 28px title, author + updated line, body in one card at 14.5/1.75, then the ‘Still stuck?’ hand-off to the category's two forms.",
  PortalForm: "A request form: hero with the form's tile, one card with the sections as fieldsets (title + one-line help), 2-column grid, 38px controls at 14px, required stars, hints under the field, choice as selectable rows, tick box as a bordered row. ‘This might already answer it’ sits at the top once a subject is typed. Send is the only button; the footer line says what it raises and who answers.",
};

const startY = 12100;
const layout = [];
let y = startY;
for (const r of rowsOf) {
  let x = 0, h = 0;
  for (const name of r) {
    const b = boards.find((b) => b[0] === name);
    layout.push({ file: `${name}.dc.html`, x, y, w: b[3], h: b[4], title: b[5] });
    x += b[3] + 120;
    h = Math.max(h, b[4]);
  }
  y += h + 180;
}
const annotations = [
  { id: "round8-review", x: 720, y: startY - 200, w: 720, text: "Review pass, same day. Fixed: filter segments now match what the lists show (All). Added: Projects — next milestone with date, watched star, past-target count under Off track · Milestones — ticket-count links and past target on the current one · People — role / team filters, in-office dot, open count for agents · Person — Email / Call in the header · Form designer — question count and time-to-fill readout, drag grip on the selected question, a third board with the form-level settings · Portal My requests — Make a request, a ‘waiting for your reply’ banner and tag, last-update line · Answers — Often read · An answer — ‘Did this solve it?’ and Related answers · Request form — where updates go · Ticket rail — change-requester pencil, local time in the in-office pill, clock note." },
  { id: "round8", x: 0, y: startY - 200, w: 640, text: "Round 8 — the remaining pages, in the same Signal vocabulary as above (13px working size, 48px bar, 220px rail; the build scales one step up as before).\nDesk: Projects list, Milestones, People, a person. Settings: the form designer. Portal: My requests, Answers, an answer, a request form." },
];
for (const [name, text] of Object.entries(notes)) {
  const l = layout.find((l) => l.file === `${name}.dc.html`);
  if (l) annotations.push({ id: `note-${name.toLowerCase()}`, x: rowsOf.find((r) => r.includes(name)).length === 3 ? 4680 : 3120, y: l.y, w: 400, text });
}

for (const [name, theme, body, , h] of boards) writeFileSync(join(out, `${name}.dc.html`), page(theme, body, (/^Portal/.test(name) ? GROW : "") + (h !== 900 ? `.shell{height:${h}px}` : "")));
writeFileSync(join(out, "layout.json"), JSON.stringify({ artboards: layout, annotations }, null, 2));
console.log(`wrote ${boards.length} artboards to ${out}`);
