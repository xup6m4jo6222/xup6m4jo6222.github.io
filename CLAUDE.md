## Project context

Personal site for 林郁為 (stats background moving into data science). **Not shared publicly yet** — stays unlisted until `/projects` has real content, then goes into the resume.

Deliberate decisions — don't "fix" these without asking first:
- The two categories (`stats` 統計分析, `ai` AI實作) are intentionally empty right now. Do **not** add "under construction" text or placeholder/sample projects to fill the gap.
- The homepage entry links intentionally omit LinkedIn and the resume PDF (neither exists yet). Add them the same way once the user provides them — no placeholder link in the meantime.
- `public/robots.txt` intentionally blocks all crawlers (`Disallow: /`) until the site is ready to go into the resume — remove it then, not before.

How to add a project (no route/nav changes needed):
- Drop a `.md` file into `src/content/projects/stats/` or `src/content/projects/ai/`. Schema is in `src/content.config.ts` (title, summary, category, tags?, links?, date). The list page and `/projects/{category}/{slug}/` detail page pick it up automatically.

Architecture notes:
- Nested URLs: `/projects/{category}/{slug}/` (category is baked into the URL, not a flat tag).
- i18n is pre-wired for a future English version: `locales: ['zh']`, `defaultLocale: 'zh'`, `routing.prefixDefaultLocale: false` in `astro.config.mjs`. Adding `'en'` later won't change existing `zh` URLs.
- Deploy: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`, `withastro/action`), auto-deploys on push to `main`. Repo is `xup6m4jo6222.github.io` (GitHub user site, root domain).

## 換色協議（全站色彩遷移的唯一標準程序）

`public/process/` 七頁的 token 與 `src/styles/global.css` **刻意雙源**——那七頁是標了日期的歷史重演存檔，隔離是特性；勿抽共用 CSS、勿只改一邊（2026-07-19 結構診斷＋抗辯定案）。

換任何主題色時，一律全域字面值取代（repo 內 grep 可完全枚舉，node_modules/dist 除外）：

- 元素主色：`#7998c3`（含捲軸變體 `#7998c355`）＋漸層內聯 RGB `rgba(121, 152, 195, 0.1)`（global.css 有空格格式）/`rgba(121,152,195,.1)`（process 頁緊湊格式）
- 中性色家族：底 `#1d1119`、token 背景 `#20131d`（另有 `#20131dd9` 導覽列半透明）、黑莓暗暈 `#2a1829`、卡底 `#2f1e2b`、hover 底 `#33222f`、邊框 `#3d2e3a`／`#56506a`、muted `#a79aa5`、內文 `#ebe5eb`、hover 文 `#f2ecf2`、favicon 底板 `#191017`（在 favicon.svg，2026-07-19 盤點時即因不在清單而漏掃過一次）
- **排除**：talks-*.html 示範元件內的色碼（`#0d0e10`、`#ffffff0d`、`#c6c4bd`、`#26292c`、`#24282c`、`#191018` 等）是歷史對話原件的展示內容，凍結不遷移
- 涉及檔案：`global.css`＋process 七頁＋`favicon.svg`；收工前 `grep -ri "<舊色碼>" src public` 必須零殘留
- 色碼改完≠完成：og-card.png 與 current-vN/page-timeline-vN 比對截圖需重生成、portfolio-site.md 版次角標進位（重大視覺版本慣例），對比度需驗 ≥4.5

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Decision log（決策紀錄協議）

當使用者在協作中做出「拍板／否決／推翻先前方案／修正流程」的決策時，當下 append 一行到本地檔 `DECISIONS.md`（已 gitignore，不進版控；私人備份在 sandbox repo）：

```
- YYYY-MM-DD | [拍板|否決|修正] 決策一句話 | 理由（使用者原話優先；若是推斷，標註「推斷」）
```

規則：只記使用者做的決策，AI 自己的實作選擇不記；沒有明說的理由不得腦補；這份檔案是日後撰寫 README「人的貢獻」章節的原始材料，寧缺勿假。
