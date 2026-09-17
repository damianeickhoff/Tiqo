# Signal mockups

The design boards for the Signal redesign, as published on the canvas
(https://claude.ai/code/artifact/fc5aaa04-eb2c-4a20-a647-9af2aab5aa16).

- `boards/` — one `.dc.html` per artboard plus `canvas.json` (positions and
  the notes). Each board is plain HTML: serve the folder and open a file to see
  it at 1440 wide, or run `mock-preview` from `.claude/launch.json`
  (port 3312, e.g. http://localhost:3312/Projects.dc.html).
- `src/` — the generators that produced the boards (`gen.mjs` rounds 1–7,
  `gen2.mjs` + `desk.mjs` round 8, `gen3.mjs` the ticket rail, `gen4.mjs`
  round 10 — assets, documentation, mail settings and change templates, on
  the canvas's second page; run it with an output folder as its argument). `shared.mjs`
  holds the vocabulary: tokens, base CSS, icons, glyphs, shell. Exact sizes
  and colours are in there.

Boards are drawn at the canvas scale (13px body, 48px bar, 220px rail); the
app is one step larger. See `docs/plans/signal-round-8.md` for the mapping.

## Sign-in concepts

`boards/LoginConcepts.html` is a single page with five takes on the Ledger
sign-in, each with a workplace photograph (Window, Skyline, Lobby, Cover,
Triptych), each a 1440×860 frame. The page-level Dark/Light toggle previews
both themes (the door itself has no theme selector) and the Clock presets
show the desk light in its three states: green open, orange in the last
hour, red closed, with the next opening time. Source in `src/login/`: edit
`login-src.html`, then `node build.mjs` from that folder inlines the shared
markup and the photos (`img/`, Unsplash via Lorem Picsum, ids 60, 1067, 396,
534, 3, 175, 403) and rewrites the board. No ticket data.

## Round 11 — the portal, redrawn

`boards/PortalRound11.html` is one page holding the new requester portal:
eleven screens (home, home with the search and user menu open, category,
request form, one request, my requests, answers, one answer, search results,
approvals, closed) in both themes behind a Dark/Light toggle, each with a note
under its title. The same screens exist as `boards/Portal11*.dc.html` and are
on the canvas's third page ("Round 11 · Portal"). Generator:
`node src/portal/gen.mjs boards` — it rewrites the boards and the viewer;
`canvas.json` was extended by hand once and is not touched by it. The portal
boards read one step larger than the desk boards (14px copy, 64px bar,
1200px column) because a requester reads, not scans.

## Round 12 — the portal, by fill

The round-11 screens judged bland (lines everywhere, every card the same
weight), redrawn with a new visual layer and nothing else changed: grey
ground, borderless white cards with a low shadow, the brand colour as the
hero field, solid colour tiles, larger type, a 1320px column, notices as
solid bands under the bar, a six-across shelf whose sixth slot is always
Browse everything. Viewer `boards/PortalRound12.html` (Home, Home with
search and menu, Request form, My requests, plus today's queue with only the
fill rule applied, as `Queue12*.dc.html`). Sources: `src/portal/css12.mjs`
is the layer; `src/portal/make12.mjs` patches `gen.mjs` into `gen12.mjs`
and writes the queue boards; `src/portal/canvas12.mjs` lays page 4 of the
canvas. Build: `node src/portal/make12.mjs && node src/portal/gen12.mjs
boards && node src/portal/canvas12.mjs`.
