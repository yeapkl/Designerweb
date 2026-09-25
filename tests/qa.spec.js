// @ts-check
// Functional QA suite — verifies docs/requirements/website.md against a
// running instance of the site. Requirement IDs are in each test title.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const PHONE = "60143223601";
const INSTAGRAM = "https://www.instagram.com/imilidesignstudio/";
const XHS = "https://xhslink.cn/m/60CBuLx36rZ";

/** Collects console errors, page errors and CSP violations for a page. */
function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("Page basics", () => {
  test("FR-1 home page loads with title, lang, one h1 and no console/CSP errors", async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Imili Design Studio/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("meta[name=description]")).toHaveAttribute("content", /.{50,}/);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("FR-2 every section in the brief is present", async ({ page }) => {
    await page.goto("/");
    for (const id of ["top", "work", "services", "process", "about", "faq", "contact"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator("#work .project")).toHaveCount(6);
    await expect(page.locator("#services .service")).toHaveCount(4);
    await expect(page.locator("#process .step")).toHaveCount(4);
    await expect(page.locator("#faq details")).toHaveCount(4);
  });

  test("FR-3 every in-page nav link points at an element that exists", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator('a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      await expect(page.locator(href), `target of ${href}`).toHaveCount(1);
    }
  });

  test("FR-4 every same-origin asset referenced by the page loads (no 404s)", async ({ page, request }) => {
    const failed = [];
    page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto("/", { waitUntil: "networkidle" });
    const srcs = await page.locator("img[src], link[href], script[src]").evaluateAll((els) =>
      els.map((e) => e.getAttribute("src") || e.getAttribute("href")).filter((u) => u && u.startsWith("/")));
    for (const src of srcs) {
      const r = await request.get(src);
      expect(r.status(), src).toBe(200);
    }
    expect(failed).toEqual([]);
  });

  test("FR-5 custom 404 page is served with a real 404 status", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1")).toContainText("doesn't exist");
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});

test.describe("Contact details", () => {
  test("FR-6 phone, WhatsApp, Instagram and Xiaohongshu links are correct", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(`a[href="tel:+${PHONE}"]`)).toHaveCount(1);
    await expect(page.locator(`a[href="tel:+${PHONE}"]`)).toHaveText(/\+60\s14.322\s3601/);
    expect(await page.locator(`a[href="https://wa.me/${PHONE}"]`).count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator(`a[href="${INSTAGRAM}"]`).count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator(`a[href="${XHS}"]`).count()).toBeGreaterThanOrEqual(2);
  });

  test("NFR-S3 every external link opens in a new tab with noopener noreferrer", async ({ page }) => {
    await page.goto("/");
    const bad = await page.locator('a[href^="http"]').evaluateAll((as) =>
      as.filter((a) => a.target !== "_blank" || !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel))
        .map((a) => a.outerHTML));
    expect(bad).toEqual([]);
  });
});

test.describe("Project filter", () => {
  test("FR-7 filter chips show the right projects and update aria-pressed", async ({ page }) => {
    await page.goto("/");
    const visible = page.locator("#work .project:not([hidden])");
    await expect(visible).toHaveCount(6);

    await page.getByRole("button", { name: "Homes" }).click();
    await expect(visible).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Homes" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    for (const p of await visible.all()) await expect(p).toBeVisible();

    await page.getByRole("button", { name: "Commercial" }).click();
    await expect(visible).toHaveCount(2);

    await page.getByRole("button", { name: "All" }).click();
    await expect(visible).toHaveCount(6);
  });
});

test.describe("Mobile navigation", () => {
  test("FR-8 menu toggles, closes on link click and on Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "hamburger menu only exists at mobile widths");
    await page.goto("/");
    const toggle = page.locator("[data-nav-toggle]");
    const nav = page.locator("#site-nav");
    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Services" }).click();
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(nav).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
  });
});

test.describe("WhatsApp enquiry form", () => {
  /** Stubs link clicks to wa.me so the test captures the URL instead of leaving. */
  async function captureWhatsApp(page) {
    await page.route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "stub" }));
  }

  test("FR-9 empty name shows an error and does not open WhatsApp", async ({ page, context }) => {
    await page.goto("/");
    let opened = false;
    context.on("page", () => { opened = true; });
    await page.locator("#f-message").fill("A three bedroom condo please");
    await page.getByRole("button", { name: "Send on WhatsApp" }).click();
    await expect(page.locator("[data-form-error]")).toHaveText("Please tell us your name.");
    await expect(page.locator("#f-name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#f-name")).toBeFocused();
    await page.waitForTimeout(300);
    expect(opened).toBe(false);
  });

  test("FR-9 whitespace-only / too-short message is rejected", async ({ page }) => {
    await page.goto("/");
    await page.locator("#f-name").fill("Mei");
    await page.locator("#f-message").fill("    hi   ");
    await page.getByRole("button", { name: "Send on WhatsApp" }).click();
    await expect(page.locator("[data-form-error]")).toHaveText(/few words/);
    // Typing clears the error state.
    await page.locator("#f-message").fill("Need help with my kitchen");
    await expect(page.locator("[data-form-error]")).toBeHidden();
    await expect(page.locator("#f-message")).not.toHaveAttribute("aria-invalid", /.*/);
  });

  test("FR-10 valid enquiry opens wa.me with the correct number and encoded message", async ({ page, context }) => {
    await captureWhatsApp(page);
    await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "stub" }));
    await page.goto("/");
    await page.locator("#f-name").fill("Mei Ling");
    await page.locator("#f-type").selectOption("Landed home");
    await page.locator("#f-message").fill("Renovating a 2-storey terrace & want light wood + sage.");
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Send on WhatsApp" }).click(),
    ]);
    const url = new URL(popup.url());
    expect(url.origin + url.pathname).toBe(`https://wa.me/${PHONE}`);
    const text = url.searchParams.get("text") || "";
    expect(text).toContain("I'm Mei Ling.");
    expect(text).toContain("Space: Landed home");
    expect(text).toContain("terrace & want light wood + sage.");
    // The original page stays put.
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("FR-10 / NFR-S4 hostile input is encoded, trimmed to limits and stripped of control chars", async ({ page, context }) => {
    await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "stub" }));
    await page.goto("/");
    // maxlength is bypassable via devtools, so set values directly like an attacker would.
    await page.evaluate(() => {
      /** @type {HTMLInputElement} */ (document.getElementById("f-name")).value = "<img src=x onerror=alert(1)>\u0000\u0007" + "x".repeat(200);
      /** @type {HTMLTextAreaElement} */ (document.getElementById("f-message")).value = "&text=hijack#frag?x=1\n" + "y".repeat(2000);
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById("f-type"));
      sel.options[0].value = "javascript:alert(1)"; // tampered option value
    });
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Send on WhatsApp" }).click(),
    ]);
    const url = new URL(popup.url());
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe(`/${PHONE}`);
    expect([...url.searchParams.keys()]).toEqual(["text"]); // no parameter injection
    expect(url.hash).toBe("");
    const text = url.searchParams.get("text") || "";
    expect(text).not.toMatch(/[\u0000-\u0009\u000B-\u001F]/);
    const name = text.match(/I'm (.*)\.\n/)?.[1] || "";
    expect(name.length).toBeLessThanOrEqual(60);
    expect(text.split("\n\n")[1].length).toBeLessThanOrEqual(500);
    // The page itself never rendered the payload as HTML.
    expect(await page.locator("img[src=x]").count()).toBe(0);
  });
});

test.describe("Layout & accessibility", () => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`NFR-1 no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/", { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("NFR-2 no automatically detectable WCAG 2.1 AA violations (axe)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Reveal animations would otherwise catch axe mid-fade and misreport contrast.
    await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
    await page.waitForTimeout(900);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".ticker") // decorative, aria-hidden marquee
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
  });

  test("NFR-2 every image has alt text and form fields have labels", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("img:not([alt])").count()).toBe(0);
    for (const id of ["f-name", "f-type", "f-message"]) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test("NFR-2 skip link is the first focusable element and jumps to main", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation checked on desktop");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
  });

  test("NFR-3 content is readable with JavaScript disabled", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#services .service").first()).toBeVisible();
    await expect(page.locator(`a[href="tel:+${PHONE}"]`)).toBeVisible();
    await ctx.close();
  });

  test("NFR-3 reduced-motion users see content without animation", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const faq = page.locator("#faq .section-title");
    await faq.scrollIntoViewIfNeeded();
    await expect(faq).toHaveCSS("opacity", "1");
    await ctx.close();
  });
});

test.describe("Performance budget", () => {
  test("NFR-4 total page weight under 500 KB and fewer than 25 requests", async ({ page }) => {
    let bytes = 0;
    let count = 0;
    page.on("response", async (r) => {
      count++;
      try { bytes += (await r.body()).length; } catch { /* redirects have no body */ }
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForLoadState("networkidle");
    expect(count).toBeLessThan(25);
    expect(bytes).toBeLessThan(500 * 1024);
  });
});
