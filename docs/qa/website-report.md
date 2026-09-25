# QA Report — Imili Design Studio website

**Verdict: PASS WITH NOTES**

**Tested:** the production Docker image (`nginx 1.30.5`, non-root) run
locally as `docker run -p 8080:8080 imili-web`, in Chromium 141 (Playwright
1.56.1), on two device profiles: *Desktop Chrome* (1280×720) and *Pixel 7*
(mobile, touch).
**Source of truth:** [`docs/requirements/website.md`](../requirements/website.md).

## How to reproduce

```bash
npm ci
docker build -t imili-web . && docker run -d --rm -p 8080:8080 imili-web
npm run lint:html      # builds EN/BM/中文 pages, then html-validate (recommended ruleset)
npm test               # QA + security suites, desktop and mobile
```

CI runs exactly these steps on every pull request
(`.github/workflows/ci-cd.yml`, job `test`).

## Results

| Check | Result |
|---|---|
| `npm run build` | ✅ 3 pages × 177 strings; every language has exactly the template's keys |
| `npm run lint:html` | ✅ 0 errors across `/`, `/ms/`, `/zh/`, `404.html` |
| `npm test` (both device profiles) | ✅ **179 passed, 0 failed, 3 skipped** |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilities |

The 3 skips are by design. The hamburger-menu test only runs on mobile.
The keyboard skip-link and keyboard slider tests only run on desktop.

Suites: `tests/qa.spec.js` (core pages and form), `tests/i18n.spec.js`
(languages, case studies, story), and `tests/security.spec.js`.

## Requirement → test → result

| Req | Test (tests/qa.spec.js) | Desktop | Mobile |
|---|---|---|---|
| FR-1 | home page loads with title, lang, one h1 and no console/CSP errors | ✅ | ✅ |
| FR-2 | every section in the brief is present (6 projects, 4 services, 4 steps, 4 FAQs) | ✅ | ✅ |
| FR-3 | every in-page nav link points at an element that exists | ✅ | ✅ |
| FR-4 | every same-origin asset referenced by the page loads (no 404s) | ✅ | ✅ |
| FR-5 | custom 404 page is served with a real 404 status | ✅ | ✅ |
| FR-6 | phone, WhatsApp, Instagram and Xiaohongshu links are correct | ✅ | ✅ |
| FR-7 | filter chips show the right projects and update aria-pressed | ✅ | ✅ |
| FR-8 | menu toggles, closes on link click and on Escape, returns focus | skip | ✅ |
| FR-9 | empty name shows an error and does not open WhatsApp | ✅ | ✅ |
| FR-9 | whitespace-only / too-short message is rejected; typing clears the error | ✅ | ✅ |
| FR-10 | valid enquiry opens wa.me with the right number and encoded message; page stays put | ✅ | ✅ |
| FR-10 / NFR-S4 | hostile input is encoded, trimmed to limits, stripped of control chars; no param injection | ✅ | ✅ |
| NFR-1 | no horizontal scroll at 320 / 390 / 768 / 1024 / 1440 px | ✅ | ✅ |
| NFR-2 | no axe WCAG 2.1 A/AA violations | ✅ | ✅ |
| NFR-2 | every image has alt text, every field has a label | ✅ | ✅ |
| NFR-2 | skip link is first focusable element and visible on focus | ✅ | skip |
| NFR-3 | content readable with JavaScript disabled | ✅ | ✅ |
| NFR-3 | reduced-motion users see content without animation | ✅ | ✅ |
| NFR-4 | full page < 500 KB and < 25 requests | ✅ | ✅ |
| FR-11 | each of `/`, `/ms/`, `/zh/`: 200, correct `lang` (`en`/`ms`/`zh-Hans`), localized title/h1/story, no `{{`, no console errors | ✅ | ✅ |
| FR-11 | `/ms` and `/zh` redirect (301) to the slash URL on the same host | ✅ | ✅ |
| FR-12 | switcher marks current language with `aria-current`, links all 3; hreflang en/ms/zh-Hans/x-default present | ✅ | ✅ |
| FR-12 | clicking EN → BM → 中文 → EN navigates to the right page | ✅ | ✅ |
| FR-13 | per language: empty-name error is translated; WhatsApp text starts with the translated greeting and keeps mixed BM/中文/EN input intact | ✅ | ✅ |
| FR-14 | before/after slider: Home → 0%, End → 100%, Arrow → 99% (keyboard) | ✅ | skip |
| FR-14 | slider follows a pointer click/drag | ✅ | ✅ |
| FR-14 | before/after images have "Before…/After…" alt text; slider has a label | ✅ | ✅ |
| FR-14 | every case study has 3 facts + brief/what we did/result; promise list has 4 items | ✅ | ✅ |
| FR-15 | story has the 3 chapters and sign-off | ✅ | ✅ |
| NFR-1 | no horizontal scroll at 320px in **each** language (long BM words, CJK) | ✅ | ✅ |
| NFR-2 | axe WCAG 2.1 AA clean on **each** language page | ✅ | ✅ |
| NFR-3 | without JS the comparison shows both images, and the (useless) range input is hidden | ✅ | ✅ |
| NFR-I1 | build fails when a key is removed from `ms.json` (`✖ ms.json is missing "cases.c2_title"`, exit 1); `<script>` in a normal key is rendered as `&lt;script&gt;`; `SITE_URL=javascript:x` is rejected | ✅ (manual) | — |
| NFR-S1…S5 | see [`docs/pentest/website-report.md`](../pentest/website-report.md) (`tests/security.spec.js`) | ✅ | ✅ |

## Bugs found during QA (all fixed and re-verified)

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | axe (NFR-2) | Contact-panel labels ("WhatsApp / Call", …) had 4.13:1 contrast on green; AA needs 4.5:1 | Label colour changed to `#e3e9de` — re-run passes |
| 2 | html-validate | Phone number could wrap mid-number on narrow screens | Non-breaking space/hyphen in the displayed number |
| 3 | Code review | `window.open(url, "_blank", "noopener")` always returns `null`, so the popup-blocked fallback would *also* navigate the current tab — WhatsApp opened twice | Replaced with a real `<a target=_blank rel=noopener>` click; FR-10 test asserts the original page stays on `/` |
| 4 | Visual check | Anchor links landed under the sticky header | `scroll-padding-top` added |
| 5 | axe (NFR-2) | Case-study labels ("FEATURED PROJECT") in terracotta on cream were 3.15:1 | Darkened to `#a3482a` |
| 6 | Visual check (中文) | Chinese hero headline wrapped one character ("家。") onto its own line, and the ticker/badge were faux-italicised | Chinese-specific heading size, no italics for CJK, CJK system-font fallbacks |
| 7 | Test design | SEC-11 counted `style` attributes in the live DOM, so it flagged the slider's CSSOM `--pos` (CSP allows that; it isn't injection) | Test now inspects the HTML **as served** for each page |

## Notes

- **Some content is placeholder where I had no source.** Instagram and
  Xiaohongshu are blocked from the build sandbox, so the project names,
  **case-study facts**, illustrations and the **founding story** are written
  to fit a young studio, not taken from Imili's real work. No statistics,
  awards or testimonials were invented. See
  [`docs/CONTENT-CHECKLIST.md`](../CONTENT-CHECKLIST.md) before launch.
- **Translations** were written for Malaysian readers (BM, and Simplified
  Chinese with local terms such as 排屋 / 共管公寓). A native speaker at the
  studio should proofread them before launch.
- CJK text uses the visitor's system fonts (PingFang / Noto Sans SC /
  Microsoft YaHei), so no extra font download is needed. The screenshots use
  the sandbox's fallback font.
- Visual review was done from screenshots at 1440px and 390px
  (`docs/screenshots/`). Real-device testing on iOS Safari was not possible
  in this environment. The CSS uses only widely supported features (grid,
  `aspect-ratio`, `backdrop-filter` with `-webkit-` prefix).
