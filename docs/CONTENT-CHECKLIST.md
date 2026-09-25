# Content checklist — replace before launch

Instagram and Xiaohongshu couldn't be read from the build environment, so
some content is **written to fit a young studio, not taken from Imili's
real work**. The layout, code, translations and tests are final. The facts
below need to come from the studio.

All text lives in `src/i18n/en.json`, `ms.json` and `zh.json`. Change the
same key in all three files, then run `npm run build` (it will refuse to
build if a language is missing a string).

| Where | Keys | What to replace it with |
|---|---|---|
| **Case studies** (most important) | `cases.c1_*`, `cases.c2_*`, `cases.c3_*` | Three real projects: real size, scope, timeline, what the client asked for, what you did, and the outcome. The current sq ft figures and week counts are **illustrative**. Don't publish them as-is. |
| Case study images | `site/assets/img/case-condo-before.svg`, `case-condo-after.svg`, `project-kitchen.svg`, `project-study.svg` | Real before/after photos of the **same angle** (for the slider), about 1600×1200 JPG/WebP, under 300 KB each |
| **Our story** | `story.*` | The founder's real story. The current draft (the "no-nails flat" rental, friends asking "can you do mine?", the name Imili) is a suggested narrative. Keep the three-chapter shape and change the details to what actually happened. If "Imili" has a real meaning, `story.ch3_text` is the place to tell it. |
| Promise list | `cases.promise_1…4` | Only keep promises the studio actually offers (e.g. is the first consultation free? are updates weekly?) |
| Project grid | `work.p1…p6_*` + `site/assets/img/project-*.svg` | Real project names, types and photos |
| FAQ | `faq.q5/a5` | Confirm the studio really serves clients in all three languages |
| Testimonials | — | **Not included on purpose.** Send me 2–3 real client quotes (with their permission) and I'll add a testimonials block. Made-up reviews would be misleading. |

After replacing, run `npm test` locally or push. CI checks every language.
