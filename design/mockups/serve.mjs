import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "boards");
createServer((req, res) => {
  try {
    const name = decodeURIComponent(req.url.slice(1).split("?")[0]) || "Main.dc.html";
    const body = readFileSync(join(root, name));
    res.writeHead(200, { "content-type": name.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(3312, () => console.log("mock server on 3312"));
