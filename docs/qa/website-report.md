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
npm run lint:html      # HTML validation (html-validate, recommended ruleset)
npm test               # QA + security suites, desktop and mobile
```

CI runs exactly these steps on every pull request
(`.github/workflows/ci-cd.yml`, job `test`).

## Results

| Check | Result |
|---|---|
| `npm run lint:html` | ✅ 0 errors (after fixing 5: doctype case, non-breaking phone number) |
| `npm test` (both device profiles) | ✅ **118 passed, 0 failed, 2 skipped** |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilities |

The 2 skips are by design: the hamburger-menu test only runs on mobile, and
the keyboard skip-link test only runs on desktop.

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
| NFR-S1…S5 | see [`docs/pentest/website-report.md`](../pentest/website-report.md) (`tests/security.spec.js`) | ✅ | ✅ |

## Bugs found during QA (all fixed and re-verified)

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | axe (NFR-2) | Contact-panel labels ("WhatsApp / Call", …) had 4.13:1 contrast on green; AA needs 4.5:1 | Label colour changed to `#e3e9de` — re-run passes |
| 2 | html-validate | Phone number could wrap mid-number on narrow screens | Non-breaking space/hyphen in the displayed number |
| 3 | Code review | `window.open(url, "_blank", "noopener")` always returns `null`, so the popup-blocked fallback would *also* navigate the current tab — WhatsApp opened twice | Replaced with a real `<a target=_blank rel=noopener>` click; FR-10 test asserts the original page stays on `/` |
| 4 | Visual check | Anchor links landed under the sticky header | `scroll-padding-top` added |

## Notes

- **Content is placeholder where I had no source.** Instagram and
  Xiaohongshu are blocked from the build sandbox, so the six project
  names/types, the illustrations and the About copy are written to fit a
  young studio, not taken from Imili's real portfolio. No invented
  statistics, awards or client testimonials were added. Swap in real
  photos and project names before launch (see README → "Updating content").
- Visual review was done from screenshots at 1440px and 390px
  (`docs/screenshots/`). Real-device testing on iOS Safari was not possible
  in this environment. The CSS uses only widely supported features (grid,
  `aspect-ratio`, `backdrop-filter` with `-webkit-` prefix).
