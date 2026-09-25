# Requirements — Imili Design Studio website

**Brief (from the studio owner):** A website for an interior designer that
feels **young, simple and fresh**, informed by the best interior-design
websites. It links to the studio's Instagram
(`@imilidesignstudio`) and Xiaohongshu (小红书) profiles, shows the phone
number **+60 14-322 3601**, deploys to **GCP the same way as
`yeapkl/ai-assisted-api`**, and passes QA and a vulnerability test.

## Design research that shaped the site

Recurring patterns across top-ranked interior-design sites
([Colorlib](https://colorlib.com/wp/interior-design-portfolios/),
[Format](https://www.format.com/online-portfolio-website/interior-design/best),
[Minimalio](https://minimalio.org/architecture-interior-designer-portfolio-websites-examples/)):

| Pattern seen on the best sites | How this site applies it |
|---|---|
| Visuals speak first, text second | Large hero illustration + short headline; project grid is the second thing you see |
| Portfolio is the centrepiece | "Selected work" sits straight after the hero, with category filters |
| Invisible navigation, lots of breathing room | 4-link sticky nav, generous section spacing, one accent colour at a time |
| Typography frames, doesn't distract | One soft serif (Fraunces) for headings, one clean sans (Manrope) for body |
| Clear, low-friction contact | WhatsApp is the primary channel (standard for Malaysian studios), floating button + enquiry form |

"Young & fresh" is carried by a soft pastel palette (sage, blush, butter,
sky on warm cream), rounded shapes, an italic accent in the headline, a
moving ticker and gentle scroll-in animation.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Home page returns 200 with a descriptive title, `lang`, a single `h1`, meta description, and no console/CSP errors |
| FR-2 | Sections: hero, work (6 projects), services (4), process (4 steps), studio/about, FAQ (4), contact |
| FR-3 | Every in-page nav link resolves to an existing section |
| FR-4 | Every same-origin asset loads (no 404s) |
| FR-5 | Unknown URLs return a styled 404 page with a real 404 status |
| FR-6 | Phone `+60143223601` (tel: link), WhatsApp (`wa.me/60143223601`), Instagram and Xiaohongshu links present and correct |
| FR-7 | Project filter (All / Homes / Commercial) shows the right projects and exposes `aria-pressed` |
| FR-8 | Mobile menu opens/closes, closes on link click and Escape, returns focus |
| FR-9 | Enquiry form validates name and message and shows an accessible error |
| FR-10 | Valid enquiry opens WhatsApp to the studio number with the message pre-filled; nothing is sent to or stored by the website |
| FR-11 | The site is available in **English (`/`), Bahasa Melayu (`/ms/`) and Mandarin/Simplified Chinese (`/zh/`)**. Each page is fully translated, has the correct `lang`, and never shows untranslated template keys |
| FR-12 | Every page has a language switcher (EN · BM · 中文) marking the current language, plus `hreflang` alternates (incl. `x-default`) for search engines |
| FR-13 | Form errors and the pre-filled WhatsApp message use the visitor's page language |
| FR-14 | **Case studies** section: a featured project with a before/after slider (mouse, touch and keyboard), plus two more case studies. Each shows facts (space, scope, timeline) and brief → what we did → result, followed by a "what every client gets" promise and a CTA |
| FR-15 | **Our story** section: the founding story in three chapters, a closing quote and the studio's values |

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Responsive with no horizontal scroll from 320px to 1440px |
| NFR-2 | WCAG 2.1 AA: no axe violations, alt text on all images, labelled fields, skip link |
| NFR-3 | Readable without JavaScript; honours `prefers-reduced-motion` |
| NFR-4 | Light: < 500 KB and < 25 requests for the full page |
| NFR-S1 | Strict security headers (CSP without `unsafe-inline`, HSTS, nosniff, frame DENY, Referrer/Permissions policy, COOP/CORP) on every response |
| NFR-S2 | No third-party requests at all (fonts and images self-hosted) — no tracking, no supply-chain script risk |
| NFR-S3 | External links use `target="_blank" rel="noopener noreferrer"` |
| NFR-S4 | Enquiry input is length-limited, stripped of control characters and URL-encoded; cannot inject parameters or HTML |
| NFR-S5 | Only GET/HEAD accepted; hidden files, source/config files, traversal paths and directory listings are never served |
| NFR-S6 | Container runs as non-root; image has no fixable HIGH/CRITICAL CVEs (CI gate) |
| NFR-I1 | Translations are built into static pages at build time; the build fails if any language is missing or has extra strings, and escapes all text unless a key is explicitly `_html` (limited to `<em>/<strong>/<br>`) |
| NFR-D1 | Deploys to Cloud Run via GitHub Actions + Workload Identity Federation (no service-account keys), matching `ai-assisted-api` |
