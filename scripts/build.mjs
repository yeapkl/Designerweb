// Builds the static site into dist/: one pre-rendered page per language,
// plus the shared assets from site/. No dependencies — plain Node 18+.
//
//   node scripts/build.mjs              → dist/
//   SITE_URL=https://example.com node scripts/build.mjs
//     → also emits absolute canonical + hreflang links (recommended once a
//       domain is known; Google ignores relative hreflang URLs).
//
// Template syntax in src/index.html: {{section.key}}. Values are
// HTML-escaped unless the key ends in "_html" (trusted markup like <em>).
// The build fails on any missing/extra key so a language can never ship
// half-translated.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Default language first; `path` is where the page is served.
const LANGS = [
  { code: "en", path: "/", hreflang: "en" },
  { code: "ms", path: "/ms/", hreflang: "ms" },
  { code: "zh", path: "/zh/", hreflang: "zh-Hans" },
];

const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");
if (siteUrl && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(siteUrl)) {
  throw new Error(`SITE_URL must look like https://example.com (got "${siteUrl}")`);
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Flattens {a:{b:"x"}} into {"a.b":"x"}. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
    else throw new Error(`${key}: translation values must be strings`);
  }
  return out;
}

const template = readFileSync(join(root, "src/index.html"), "utf8");
const used = new Set([...template.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]));
const dicts = Object.fromEntries(
  LANGS.map(({ code }) => [code, flatten(JSON.parse(readFileSync(join(root, `src/i18n/${code}.json`), "utf8")))]),
);

// --- Consistency checks ----------------------------------------------------
const errors = [];
for (const { code } of LANGS) {
  const keys = new Set(Object.keys(dicts[code]));
  for (const k of used) if (!keys.has(k)) errors.push(`${code}.json is missing "${k}"`);
  for (const k of keys) if (!used.has(k)) errors.push(`${code}.json has unused key "${k}"`);
  for (const [k, v] of Object.entries(dicts[code])) {
    if (!v.trim()) errors.push(`${code}.json "${k}" is empty`);
    if (k.endsWith("_html") && /<(?!\/?(em|strong|br)\b)[^>]*>/i.test(v)) {
      errors.push(`${code}.json "${k}" contains markup other than <em>/<strong>/<br>`);
    }
  }
}
if (errors.length) {
  console.error(errors.map((e) => `✖ ${e}`).join("\n"));
  process.exit(1);
}

// --- Render ----------------------------------------------------------------
rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "site"), dist, { recursive: true });

const abs = (path) => `${siteUrl}${path}`;

for (const lang of LANGS) {
  const dict = dicts[lang.code];
  let html = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) =>
    key.endsWith("_html") ? dict[key] : escapeHtml(dict[key]));

  // hreflang alternates + canonical (absolute when SITE_URL is known).
  const alternates = [
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${abs(l.path)}">`),
    `<link rel="alternate" hreflang="x-default" href="${abs("/")}">`,
    siteUrl ? `<link rel="canonical" href="${abs(lang.path)}">` : "",
  ].filter(Boolean).join("\n  ");
  html = html.replace("<!-- @alternates -->", alternates);

  // Mark the current language in the switcher.
  html = html.replace(`data-lang-link="${lang.code}"`, `data-lang-link="${lang.code}" aria-current="page"`);

  const outDir = join(dist, lang.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  console.log(`✔ ${lang.path.padEnd(5)} (${lang.code}) ${Object.keys(dict).length} strings`);
}

if (siteUrl) {
  const urls = LANGS.map((l) => `  <url><loc>${abs(l.path)}</loc>${LANGS.map((a) =>
    `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${abs(a.path)}"/>`).join("")}</url>`).join("\n");
  writeFileSync(join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${abs("/sitemap.xml")}\n`);
  console.log("✔ sitemap.xml");
}
