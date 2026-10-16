// Renders the raster icons and the Open Graph image from public/icon.svg with headless Chrome.
// Usage: node scripts/icons.mjs   (override the browser with CHROME_PATH=/path/to/chrome)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Rasters always use the light-scheme stroke: drop the dark media rule so the host's colour scheme can't leak in.
const svg = readFileSync(join(pub, "icon.svg"), "utf8").replace(/@media \(prefers-color-scheme: dark\)[^\n]*\n/, "");
const svgUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const work = mkdtempSync(join(tmpdir(), "ta-icons-"));

const BG = "#f6f3ee";
const INK = "#16141a";
const MUTED = "#6b6672";
const ACCENT = "#6d5dfc";
const MINT = "#2fd3a6";

function page(width, height, body, head = "") {
  return `<!doctype html><html><head><meta charset="utf-8">${head}<style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}
img{display:block}
</style></head><body>${body}</body></html>`;
}

function shoot(name, width, height, html) {
  const file = join(work, `${name}.html`);
  writeFileSync(file, html);
  const out = join(work, `${name}.png`);
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    "--virtual-time-budget=4000", // let web fonts load before the capture
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    pathToFileURL(file).href,
  ], { stdio: "ignore" });
  return readFileSync(out);
}

/** The mark centred on a canvas, `inset` px from each edge; optional solid background. */
function markPage(size, inset, background = "transparent") {
  const s = size - inset * 2;
  return page(size, size, `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${background}">
<img src="${svgUri}" width="${s}" height="${s}" alt=""></div>`);
}

/** A PNG-in-ICO container: 6-byte ICONDIR + one 16-byte ICONDIRENTRY + the PNG bytes. */
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size >= 256 ? 0 : size, 6); // width
  header.writeUInt8(size >= 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette colours
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([header, png]);
}

const outputs = {
  "icon-192.png": shoot("icon-192", 192, 192, markPage(192, 16)),
  "icon-512.png": shoot("icon-512", 512, 512, markPage(512, 40)),
  // iOS flattens transparency (to black) and applies its own corner mask, so fill the whole square.
  "apple-touch-icon.png": shoot("apple-touch-icon", 180, 180, markPage(180, 26, BG)),
  "favicon.ico": pngToIco(shoot("favicon-32", 32, 32, markPage(32, 0)), 32),
  "og.png": shoot("og", 1200, 630, page(1200, 630, `
<div style="position:relative;width:1200px;height:630px;background:${BG};font-family:Sora,system-ui,sans-serif;color:${INK};
  display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 85% 10%, ${ACCENT}1f, transparent 70%)"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:16px;background:linear-gradient(${ACCENT}, ${MINT})"></div>
  <img src="${svgUri}" width="160" height="160" alt="" style="position:relative;margin-left:-8px">
  <div style="position:relative;margin-top:36px;font-size:64px;font-weight:700;letter-spacing:-0.02em;line-height:1.1">TA Load Distribution</div>
  <div style="position:relative;margin-top:20px;font-size:28px;font-weight:500;color:${MUTED};line-height:1.4;max-width:900px">Fair, capacity-weighted task sharing for teaching assistants</div>
  <div style="position:relative;margin-top:44px;width:120px;height:8px;border-radius:999px;background:${ACCENT}"></div>
</div>`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;700&display=block">`)),
};

for (const [name, bytes] of Object.entries(outputs)) {
  writeFileSync(join(pub, name), bytes);
  console.log(`public/${name}  ${bytes.length} bytes`);
}
rmSync(work, { recursive: true, force: true });
