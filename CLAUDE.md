## 文件路由

| 情境 | 讀這份 |
|---|---|
| **任何視覺或互動的選擇** | `docs/CONSTITUTION.md` — 設計憲法。第零條 → 三道門檻 → 三條油門 → 兩條煞車，依序過 |
| 詞彙定義（版面 vs 內容、面 vs 線⋯⋯） | `CONTEXT.md` |
| 決策沿革與郁為的原話 | `docs/DECISIONS.md` |
| 某一輪工作的完整規格 | `docs/SPEC-*.md` |
| 主色當文字色的實測數字與豁免登記 | `docs/REFERENCE-accent-text.md` |

`docs/` 是私有的協作文件區：不進本 repo 版控，它自己是一個獨立的私有備份版本庫。
`CONTEXT.md` 例外——留在根目錄且公開進版控，性質同本檔，無決策弱點
（`docs/DECISIONS.md` 2026-07-25 拍板，2026-08-02 補執行）。

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

`public/process/` 各頁的 token 與 `src/styles/global.css` **刻意雙源**——那些頁是標了日期的歷史重演存檔，隔離是特性；勿抽共用 CSS、勿只改一邊（2026-07-19 結構診斷＋抗辯定案）。（本節原寫「七頁」，目錄實際是九個 `.html`；其中 tourism 兩頁其實是統計專案的正文附錄、被這一節誤歸類成存檔，整節在展示櫃票 04 要改寫。）

換任何主題色時，一律全域字面值取代（repo 內 grep 可完全枚舉，node_modules/dist 除外）：

- 元素主色：`#7998c3`（含捲軸變體 `#7998c355`）＋漸層內聯 RGB `rgba(121, 152, 195, 0.1)`（global.css 有空格格式）/`rgba(121,152,195,.1)`（process 頁緊湊格式）＋**「面」的淡底 `rgba(121, 152, 195, 0.07)`**（2026-07-29 票 05 新增，產物縮寫成 `#7998c312`；漏掉它的話，換色後比對器本人側、統計表頭、文字所有權本人側三塊淡底會留著舊主色的 RGB，而**閘門對這種殘留是無感的**——它只驗「淡底＝判準說的那個宣告值」，不驗「淡底有沒有跟上新主色」）
- 中性色家族：底 `#1d1119`、token 背景 `#20131d`（另有 `#20131dd9` 導覽列半透明）、黑莓暗暈 `#2a1829`、卡底 `#2f1e2b`、hover 底 `#33222f`、邊框 `#3d2e3a`／`#56506a`、muted `#a79aa5`、內文 `#ebe5eb`、hover 文 `#f2ecf2`、favicon 底板 `#191017`（在 favicon.svg，2026-07-19 盤點時即因不在清單而漏掃過一次）
- **排除**：talks-*.html 示範元件內的色碼（`#0d0e10`、`#ffffff0d`、`#c6c4bd`、`#26292c`、`#24282c`、`#191018` 等）是歷史對話原件的展示內容，凍結不遷移
- 涉及檔案：`global.css`＋process 頁＋`favicon.svg`；**`public/process/` 的九個 `.html` 每一個都有自己的 `--a`，一個都不能漏**（以 `ls public/process/` 為準，2026-07-28 實測更正）；收工前 `grep -ri "<舊色碼>" src public` 必須零殘留
- 色碼改完≠完成：og-card.png 與 current-vN/page-timeline-vN 比對截圖需重生成、portfolio-site.md 版次角標進位（重大視覺版本慣例），對比度需驗 ≥4.5

## 元素主色當文字色——門檻（完整判準見 `docs/REFERENCE-accent-text.md`）

**範圍限 `src/`。** 一句話的規則：

> **主色可以當文字色，但只在那個字的「認得出來」不靠顏色的時候。**
> 辨識由字重、字體、字級或底線先承擔；顏色只負責份量。

三條不能違反的硬邊界：

1. **面 vs 線**——主色鋪成「面」的地方，字用內文色；主色只走「線」的地方，字才用主色。這是量出來的硬邊界不是偏好：7% 主色淡底上主色字最壞只有 4.33，低於 4.5。（**注意分界是「底往字的顏色靠還是往反方向走」——鋪暗的面反而是易讀性的朋友。**）
2. **唯一的清單**是 `scripts/palette-config.mjs` 的 `ACCENT_TEXT_ALLOWLIST`，目前十條（前九條是元素主色，第十條是問句的強調色 `#c8b7ea`，票 03 加入——**清單自此管兩個強調色，靠條目的 `color` 欄區分**）。兩道閘門守它：不在清單上而用強調色當文字色 → 第二類紅；在清單上但宣稱的通道在產物裡不成立 → 第十二類紅。
3. **`public/process/` 明文豁免**——那裡的主色文字是刻意保留的歷史狀態，掃到就跳過，不要再開一輪討論。**本規則的敘述一律不得寫「全站」。**

合法的強調色是一份明列清單（`ACCENTS`），目前兩個：主色 `#7998c3` 與問句色 `#c8b7ea`。兩者彩度都釘在 0.073，**那不是自由參數**——新增強調色只有色相與明度兩個自由度，閘門會驗。

要判斷某個元素該不該拿主色、或要查實測數字與「刻意不修」的登記，讀 `docs/REFERENCE-accent-text.md`。

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

當使用者在協作中做出「拍板／否決／推翻先前方案／修正流程」的決策時，當下 append 一行到本地檔 `docs/DECISIONS.md`（不進本 repo 版控；備份在 `docs/` 自己的私有版本庫）：

```
- YYYY-MM-DD | [拍板|否決|修正] 決策一句話 | 理由（使用者原話優先；若是推斷，標註「推斷」）
```

規則：只記使用者做的決策，AI 自己的實作選擇不記；沒有明說的理由不得腦補；這份檔案是日後撰寫 README「人的貢獻」章節的原始材料，寧缺勿假。
