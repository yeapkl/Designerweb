// @ts-check
// Security / vulnerability checks against a running instance. These are the
// automated part of docs/pentest/website-report.md; run them against the
// local container and again against the deployed Cloud Run URL.
const { test, expect } = require("@playwright/test");
const http = require("node:http");
const https = require("node:https");

const BASE = process.env.BASE_URL || "http://localhost:8080";

/**
 * Sends a request with the path exactly as given — no URL normalisation —
 * so traversal and odd-method probes reach the server untouched.
 * @returns {Promise<{status:number, headers:import('node:http').IncomingHttpHeaders, body:string}>}
 */
function raw(method, path, headers = {}) {
  const u = new URL(BASE);
  const lib = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      { host: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), method, path, headers, servername: u.hostname },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (body.length < 100_000) body += c; });
        res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const REQUIRED_HEADERS = {
  "content-security-policy": /default-src 'none'.*script-src 'self'.*frame-ancestors 'none'/,
  "x-content-type-options": /^nosniff$/,
  "x-frame-options": /^DENY$/,
  "referrer-policy": /strict-origin-when-cross-origin/,
  "permissions-policy": /camera=\(\)/,
  "strict-transport-security": /max-age=\d{7,}/,
  "cross-origin-opener-policy": /same-origin/,
};

test.describe("Security headers", () => {
  for (const path of ["/", "/ms/", "/zh/", "/assets/css/style.css", "/assets/js/main.js", "/assets/img/hero-living.svg", "/does-not-exist", "/health"]) {
    test(`SEC-1 hardened headers on ${path}`, async () => {
      const res = await raw("GET", path);
      for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
        expect(res.headers[name], `${name} on ${path}`).toMatch(pattern);
      }
    });
  }

  test("SEC-2 server does not disclose its version", async () => {
    const res = await raw("GET", "/");
    // Cloud Run's Google Frontend replaces the Server header; locally nginx
    // must at least hide its version.
    expect(res.headers["server"] || "").not.toMatch(/\d+\.\d+/);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    const notFound = await raw("GET", "/nope");
    expect(notFound.body).not.toMatch(/nginx\/?\d/i);
  });

  test("SEC-3 CSP forbids inline script and third-party origins", async () => {
    const csp = (await raw("GET", "/")).headers["content-security-policy"] || "";
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:|data:/);
  });
});

test.describe("Attack surface", () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE"]) {
    test(`SEC-4 ${method} is refused`, async () => {
      const res = await raw(method, "/");
      // nginx answers 405; on Cloud Run, Google's front end may refuse some
      // methods itself with another 4xx. Either way the page is never served.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).not.toBe(500);
      expect(res.body).not.toContain("Homes that feel");
    });
  }

  for (const path of [
    "/.git/config", "/.env", "/.htaccess", "/.DS_Store", "/assets/.hidden",
    "/../../../../etc/passwd", "/..%2f..%2f..%2fetc%2fpasswd", "/%2e%2e/%2e%2e/etc/passwd",
    "/assets/../../../etc/passwd", "/etc/nginx/nginx.conf", "/Dockerfile", "/package.json",
    "/nginx/default.conf", "/tests/security.spec.js",
    "/src/index.html", "/src/i18n/en.json", "/scripts/build.mjs",
  ]) {
    test(`SEC-5 sensitive / traversal path not served: ${path}`, async () => {
      const res = await raw("GET", path);
      expect(res.status).not.toBe(200);
      expect(res.body).not.toMatch(/root:x:0:0|\[core\]|worker_processes|devDependencies/);
    });
  }

  test("SEC-6 directory listing is disabled", async () => {
    for (const path of ["/assets/", "/assets/img/", "/assets/fonts/"]) {
      const res = await raw("GET", path);
      expect(res.status, path).not.toBe(200);
      expect(res.body).not.toMatch(/Index of/i);
    }
  });

  test("SEC-7 open redirect / host header injection does not redirect off-site", async () => {
    for (const path of ["//evil.example.com/", "/assets", "/%2F%2Fevil.example.com"]) {
      const res = await raw("GET", path, { Host: "evil.example.com" });
      expect(res.headers.location || "", path).not.toMatch(/^(https?:)?\/\/evil/);
    }
  });

  test("SEC-8 reflected input is never echoed back as HTML", async () => {
    const payload = "<script>alert(1)</script>";
    const res = await raw("GET", `/?q=${encodeURIComponent(payload)}`);
    expect(res.body).not.toContain(payload);
    const res404 = await raw("GET", `/${encodeURIComponent(payload)}`);
    expect(res404.body).not.toContain(payload);
  });

  test("SEC-9 oversized headers are rejected cleanly (no 5xx crash)", async () => {
    const res = await raw("GET", "/", { "X-Big": "a".repeat(64 * 1024) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

test.describe("Client-side", () => {
  test("SEC-10 page makes no third-party requests (privacy, supply chain)", async ({ page }) => {
    const origin = new URL(BASE).origin;
    const foreign = [];
    page.on("request", (r) => { if (!r.url().startsWith(origin)) foreign.push(r.url()); });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForLoadState("networkidle");
    expect(foreign).toEqual([]);
  });

  for (const path of ["/", "/ms/", "/zh/", "/404.html"]) {
    test(`SEC-11 ${path} ships no executable inline script, inline handlers or inline styles`, async () => {
      // Checks the HTML as served. (JS may later set CSSOM custom properties,
      // e.g. the slider's --pos, which CSP permits and is not injection.)
      const { body } = await raw("GET", path);
      const inlineScripts = [...body.matchAll(/<script\b(?![^>]*\bsrc=)([^>]*)>/gi)]
        .filter((m) => !/type="application\/ld\+json"/.test(m[1]));
      expect(inlineScripts.length).toBe(0);
      expect(body).not.toMatch(/\son[a-z]+\s*=/i);
      expect(body).not.toMatch(/\sstyle\s*=|<style\b/i);
    });
  }

  test("SEC-12 CSP blocks an injected inline script at runtime", async ({ page }) => {
    const violations = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto("/");
    const executed = await page.evaluate(async () => {
      // @ts-ignore
      window.__pwned = false;
      const s = document.createElement("script");
      s.textContent = "window.__pwned = true";
      document.body.appendChild(s);
      await new Promise((r) => setTimeout(r, 100));
      // @ts-ignore
      return window.__pwned;
    });
    expect(executed).toBe(false);
    expect(violations.length).toBeGreaterThan(0);
  });

  test("SEC-13 page cannot be framed (clickjacking)", async ({ page }) => {
    await page.goto("/404.html").catch(() => {});
    await page.setContent(`<iframe src="${BASE}/" id="f"></iframe>`);
    const frame = page.frame({ url: /\/$/ });
    const loaded = frame ? await frame.locator("h1").count().catch(() => 0) : 0;
    expect(loaded).toBe(0);
  });
});
