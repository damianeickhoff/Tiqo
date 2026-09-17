// Builds the sign-in concepts board: inlines the shared markup into
// login-src.html. Run from this folder: `node build.mjs`.
// Extra arguments are further paths to write the same output to.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "login-src.html"), "utf8");
const img = (file) => "data:image/jpeg;base64," + readFileSync(join(here, "img", file)).toString("base64");

const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-label="Tiqo" role="img"><defs><mask id="n${size}"><rect width="32" height="32" rx="9" fill="#fff"/><circle cx="32" cy="16" r="4.5"/><circle cx="0" cy="16" r="4.5"/></mask></defs><rect width="32" height="32" rx="9" fill="#febe2e" mask="url(#n${size})"/><g fill="#1c1300"><rect x="9" y="17" width="3.2" height="6" rx="1.6" opacity=".55"/><rect x="14.4" y="13" width="3.2" height="10" rx="1.6" opacity=".75"/><rect x="19.8" y="9" width="3.2" height="14" rx="1.6"/></g></svg>`;
const lockup = `<span class="lockup">${mark(28)}<span>Tiqo</span></span>`;
const ic = (d, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const eye = `<span class="eye">${ic('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>')}</span>`;
const arrow = ic('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', 15);
const lock = ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 14);
const google = `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.5l4 3.1C6.3 6.8 8.9 4.7 12 4.7z"/></svg>`;
const ms = `<svg width="15" height="15" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>`;
const sso = `<div class="sso"><button class="b" type="button">${google} Google</button><button class="b" type="button">${ms} Microsoft</button></div>`;
const form = `<form class="form" onsubmit="return false">
  <div><label class="lbl">Email</label><div class="in"><input type="email" value="ada@tiqo.local" autocomplete="off"></div></div>
  <div><div class="lblrow"><label class="lbl">Password</label><a>Forgot?</a></div><div class="in pw"><input type="password" value="hunter2hunter2">${eye}</div></div>
  <button class="primary" type="submit">Sign in ${arrow}</button>
</form>`;
const pill = `<span class="pill"><span class="dot"></span><b data-deskstate>Desk open</b><span class="next" data-desknext>closes 18:00</span></span>`;

const out = src
  .replaceAll("{{LOCKUP}}", lockup)
  .replaceAll("{{MARK40}}", mark(40))
  .replaceAll("{{FORM}}", form)
  .replaceAll("{{SSO}}", sso)
  .replaceAll("{{PILL}}", pill)
  .replaceAll("{{LOCK}}", lock)
  .replaceAll("{{P60}}", img("p_60.jpg"))
  .replaceAll("{{P1067}}", img("p_1067.jpg"))
  .replaceAll("{{P396}}", img("p_396.jpg"))
  .replaceAll("{{P534}}", img("p_534.jpg"))
  .replaceAll("{{P3}}", img("p_3.jpg"))
  .replaceAll("{{P175}}", img("p_175.jpg"))
  .replaceAll("{{P403}}", img("p_403.jpg"));

const board = join(here, "..", "..", "boards", "LoginConcepts.html");
writeFileSync(board, out);
for (const extra of process.argv.slice(2)) writeFileSync(extra, out);
console.log("wrote", board, out.length, "bytes");
