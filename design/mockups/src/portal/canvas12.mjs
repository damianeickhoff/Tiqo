// Adds the round-12 boards to canvas.json as page-4. Run from design/mockups after gen12.mjs.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
const c = JSON.parse(readFileSync("boards/canvas.json", "utf8"));
const b = JSON.parse(readFileSync("boards/portal12-boards.json", "utf8"));
c.pages = c.pages.filter((p) => p.id !== "page-4");
c.pages.push({ id: "page-4", name: "Round 12 · Portal, by fill" });
c.artboards = c.artboards.filter((a) => a.page !== "page-4");
c.annotations = c.annotations.filter((a) => a.page !== "page-4");
c.annotations.push({ id: "r12-brief", x: 0, y: -190, w: 1400, page: "page-4", text: "Round 12 — 17 September 2026. Round 11 was judged bland: too many lines, every card the same weight. Same screens and data, new visual layer: grey ground, borderless white cards with a low shadow, the brand colour as the hero field with three product cards floating on it, solid colour tiles, larger type, 1320px column, notices as solid bands under the bar, a six-across shelf whose sixth slot is always Browse everything. Last row: the desk queue with only the fill rule applied, to judge whether the app should follow. Viewer: PortalRound12.html. Nothing built." });
let y = 0;
const rows = {};
for (const x of b) {
  if (!(x.screen in rows)) { rows[x.screen] = y; y += x.h + 180; }
  c.artboards.push({ file: x.file, x: x.theme === "dark" ? 0 : 1560, y: rows[x.screen], w: 1440, h: x.h, title: x.title, page: "page-4" });
}
for (const x of b.filter((x) => x.theme === "dark")) c.annotations.push({ id: "r12-" + x.file.replace(/\.dc\.html$/, "").toLowerCase(), x: 3120, y: rows[x.screen], w: 460, page: "page-4", text: x.note });
c.artboards.push({ file: "Queue12.dc.html", x: 0, y, w: 1440, h: 900, title: "Desk queue · fill rule · dark", page: "page-4" }, { file: "Queue12Light.dc.html", x: 1560, y, w: 1440, h: 900, title: "Desk queue · fill rule · light", page: "page-4" });
c.annotations.push({ id: "r12-queue", x: 3120, y, w: 460, page: "page-4", text: "Today's queue with only the fill rule: rail and bar on the ground, the work area one white panel, faint row dividers. Nothing else moved." });
writeFileSync("boards/canvas.json", JSON.stringify(c, null, 1));
unlinkSync("boards/portal12-boards.json");
console.log("canvas page-4:", c.artboards.filter((a) => a.page === "page-4").length, "boards");
