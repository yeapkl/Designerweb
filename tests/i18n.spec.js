// @ts-check
// Language (EN / BM / 中文), case-study and story checks — FR-11…FR-15 in
// docs/requirements/website.md.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const LANGS = [
  { code: "en", path: "/", htmlLang: "en", title: /Interior Design/, h1: /Homes that feel/, errName: "Please tell us your name.", greeting: "Hi Imili Design Studio! I'm", story: /tiny rented flat/ },
  { code: "ms", path: "/ms/", htmlLang: "ms", title: /Reka Bentuk Dalaman/, h1: /Rumah yang terasa/, errName: "Sila beritahu nama anda.", greeting: "Hai Imili Design Studio! Saya", story: /flat sewa yang kecil/ },
  { code: "zh", path: "/zh/", htmlLang: "zh-Hans", title: /室内设计/, h1: /像你/, errName: "请告诉我们你的名字。", greeting: "你好 Imili Design Studio！我是", story: /出租屋/ },
];

for (const L of LANGS) {
  test.describe(`${L.code} page`, () => {
    test(`FR-11 ${L.path} renders fully translated with correct lang, title and no leftover template keys`, async ({ page }) => {
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      const res = await page.goto(L.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", L.htmlLang);
      await expect(page).toHaveTitle(L.title);
      await expect(page.locator("h1")).toHaveText(L.h1);
      await expect(page.locator("#story-title")).toHaveText(L.story);
      const html = await page.content();
      expect(html).not.toMatch(/\{\{|\}\}/);
      expect(html).not.toContain("undefined");
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });

    test(`FR-12 ${L.path} language switcher marks the current page and links every language`, async ({ page }) => {
      await page.goto(L.path);
      const sw = page.locator(".lang-switch");
      await expect(sw.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(sw.locator(`[data-lang-link="${L.code}"]`)).toHaveAttribute("aria-current", "page");
      for (const other of LANGS) {
        await expect(sw.locator(`a[href="${other.path}"]`)).toHaveCount(1);
      }
      // hreflang alternates for search engines, including x-default.
      for (const hl of ["en", "ms", "zh-Hans", "x-default"]) {
        await expect(page.locator(`link[rel=alternate][hreflang="${hl}"]`)).toHaveCount(1);
      }
    });

    test(`FR-13 ${L.path} enquiry form errors and WhatsApp message are in the page language`, async ({ page, context }) => {
      await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "stub" }));
      await page.goto(L.path);
      await page.locator("#f-message").fill("Condo 3 bilik / 三房公寓 / 3-bedroom");
      await page.locator("form[data-enquiry] button[type=submit]").click();
      await expect(page.locator("[data-form-error]")).toHaveText(L.errName);

      await page.locator("#f-name").fill("Aisyah 陈");
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        page.locator("form[data-enquiry] button[type=submit]").click(),
      ]);
      const url = new URL(popup.url());
      expect(url.pathname).toBe("/60143223601");
      const text = url.searchParams.get("text") || "";
      expect(text.startsWith(`${L.greeting} Aisyah 陈\n`)).toBe(true);
      expect(text).toContain("三房公寓");
    });

    test(`NFR-2 ${L.path} has no axe WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(L.path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
      await page.waitForTimeout(900);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude(".ticker")
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} — ${v.help}`)).toEqual([]);
    });

    test(`NFR-1 ${L.path} has no horizontal scroll at 320px (long BM words, CJK)`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(L.path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("FR-12 clicking the switcher goes to the translated page", async ({ page }) => {
  await page.goto("/");
  await page.locator(".lang-switch").getByText("BM").click();
  await expect(page).toHaveURL(/\/ms\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  await page.locator(".lang-switch").getByText("中文").click();
  await expect(page).toHaveURL(/\/zh\/$/);
  await page.locator(".lang-switch").getByText("EN").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("FR-11 /ms and /zh without trailing slash redirect to the page on the same host", async ({ request }) => {
  for (const p of ["/ms", "/zh"]) {
    const res = await request.get(p, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toBe(`${p}/`);
  }
});

test.describe("Case studies & story", () => {
  test("FR-14 before/after slider responds to keyboard and reveals each side", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard interaction checked on desktop");
    await page.goto("/");
    const compare = page.locator("[data-compare]");
    const range = page.locator("[data-compare-range]");
    await range.focus();
    await expect(range).toBeFocused();
    const pos = () => compare.evaluate((el) => el.style.getPropertyValue("--pos"));
    expect(await pos()).toBe("50%");
    await page.keyboard.press("Home");
    expect(await pos()).toBe("0%");
    await page.keyboard.press("End");
    expect(await pos()).toBe("100%");
    await page.keyboard.press("ArrowLeft");
    expect(await pos()).toBe("99%");
  });

  test("FR-14 slider can be dragged with a pointer", async ({ page }) => {
    await page.goto("/");
    const compare = page.locator("[data-compare]");
    await compare.scrollIntoViewIfNeeded();
    const box = await compare.boundingBox();
    if (!box) throw new Error("no compare box");
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
    const v = Number((await compare.evaluate((el) => el.style.getPropertyValue("--pos"))).replace("%", ""));
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(30);
  });

  test("FR-14 both before and after images have descriptive alt text and the slider is labelled", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".compare-after")).toHaveAttribute("alt", /^After/);
    await expect(page.locator(".compare-before img")).toHaveAttribute("alt", /^Before/);
    await expect(page.getByLabel("Drag to compare before and after")).toHaveCount(1);
  });

  test("FR-14 each case study shows facts plus brief → what we did → result", async ({ page }) => {
    await page.goto("/");
    for (const c of await page.locator("#cases .case").all()) {
      await expect(c.locator(".case-facts > div")).toHaveCount(3);
      await expect(c.locator(".case-steps h4")).toHaveText(["The brief", "What we did", "The result"]);
    }
    await expect(page.locator(".promise li")).toHaveCount(4);
  });

  test("FR-15 story has three chapters and a sign-off", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#story .chapter h3")).toHaveText(["The no-nails flat", "\"Can you do mine?\"", "Imili is born"]);
    await expect(page.locator(".story-quote footer")).toHaveText("— The Imili team");
  });

  test("NFR-3 without JavaScript the comparison still shows both images", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator(".compare-before img")).toBeVisible();
    await expect(page.locator(".compare-after")).toBeVisible();
    await expect(page.locator("[data-compare-range]")).toBeHidden();
    await ctx.close();
  });
});
