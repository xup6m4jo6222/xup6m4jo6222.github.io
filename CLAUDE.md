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

## 設計決策的前提（每一次挑選都要過，換對話也不重來）

任何視覺／互動的選擇，依序過這四關。原始出處與逐條原話在 `DECISIONS.md`，這裡是每個對話都讀得到的正本摘要。

1. **五大理念為主**（2026-07-19 本人終版）：易讀永遠最優先／保持低調但不失高級感／具個人特色／不過度的互動設計／文字完全由本人主導。
2. **UIUX 理論為輔**：用理論**窮舉候選集**並回頭檢驗，**不用來決定方向**。方向永遠由理念決定。
3. **每個元素都要能敘述一個故事才定案**（2026-07-27 增修）。講不出來就不要硬編——**編出來的故事比沒有故事更糟**，選項是降格登記為「技法」或直接不做。
4. **成本要付得起，而且要用對的貨幣講**（2026-07-28 增修）。提案時一律把成本攤開，四種貨幣分開講，不要混為一談：
   - **位元組**（下載多少）
   - **每幀 CPU**（常駐的東西每秒要做多少事——這是唯一量得到常駐動態的貨幣）
   - **載入時間**
   - **讀者的注意力**（畫面上多一個會動的東西，就少一分注意力給文字）

   **明文否決「檔案越小＝設計越好」這條分界。**本站 2026-07-28 實測：首頁 HTML＋CSS＋JS 共約 46KB（背景母題的腳本只佔 6.5KB），真正的重量在兩套 CJK 字體與 `dist/images` 的 3.7MB。所以在這個站上「省 KB」的邊際效益很低，**該守的是每幀 CPU 與注意力**。省錯貨幣等於沒省。

## 換色協議（全站色彩遷移的唯一標準程序）

`public/process/` 各頁的 token 與 `src/styles/global.css` **刻意雙源**——那些頁是標了日期的歷史重演存檔，隔離是特性；勿抽共用 CSS、勿只改一邊（2026-07-19 結構診斷＋抗辯定案）。（本節原寫「七頁」，目錄實際是九個 `.html`；其中 tourism 兩頁其實是統計專案的正文附錄、被這一節誤歸類成存檔，整節在展示櫃票 04 要改寫。）

換任何主題色時，一律全域字面值取代（repo 內 grep 可完全枚舉，node_modules/dist 除外）：

- 元素主色：`#7998c3`（含捲軸變體 `#7998c355`）＋漸層內聯 RGB `rgba(121, 152, 195, 0.1)`（global.css 有空格格式）/`rgba(121,152,195,.1)`（process 頁緊湊格式）
- 中性色家族：底 `#1d1119`、token 背景 `#20131d`（另有 `#20131dd9` 導覽列半透明）、黑莓暗暈 `#2a1829`、卡底 `#2f1e2b`、hover 底 `#33222f`、邊框 `#3d2e3a`／`#56506a`、muted `#a79aa5`、內文 `#ebe5eb`、hover 文 `#f2ecf2`、favicon 底板 `#191017`（在 favicon.svg，2026-07-19 盤點時即因不在清單而漏掃過一次）
- **排除**：talks-*.html 示範元件內的色碼（`#0d0e10`、`#ffffff0d`、`#c6c4bd`、`#26292c`、`#24282c`、`#191018` 等）是歷史對話原件的展示內容，凍結不遷移
- 涉及檔案：`global.css`＋process 頁＋`favicon.svg`；**`public/process/` 的九個 `.html` 每一個都有自己的 `--a`，一個都不能漏**（以 `ls public/process/` 為準，2026-07-28 實測更正）；收工前 `grep -ri "<舊色碼>" src public` 必須零殘留
- 色碼改完≠完成：og-card.png 與 current-vN/page-timeline-vN 比對截圖需重生成、portfolio-site.md 版次角標進位（重大視覺版本慣例），對比度需驗 ≥4.5

## 元素主色當文字色（2026-07-28 定案，**範圍限 `src/`**）

`src/` 裡主色只允許當兩類文字：**內文連結靜止態**，以及**靜止態已在中性階頂端（n-900）的互動元素其 hover 態**（外加把手字符 `.cs-wipe-handle:after`）。唯一的清單是 `scripts/palette-config.mjs` 「連結」那組配對的 `fgOn`，共七條；不在清單上而把主色當文字色，`npm run verify:palette` 會紅。**這條規則的敘述一律不得寫「全站」**——它管不到 `public/`。

**`public/process/` 明文豁免：那裡的主色文字是刻意保留的歷史狀態，不是漏網的違規。** 那些頁的說話者標籤、選項標籤、表頭、數字用主色而且**不可點**，用的又是真變數 `--a`（不是展示用的凍結色碼），所以掃描一定會掃到——掃到就跳過，不要再為此開一輪討論。理由：換色協議授權的是「同一個角色換一個色碼」，**不授權「改變誰扮演哪個角色」**，後者會讓歷史存檔不再是當時的樣子。

可枚舉，不必憑印象：`grep -nE "(^|[^-])color: ?var\(--a[,)]" public/process/*.html` — 2026-07-28 實測**九個檔共 39 處**，組成是每頁一條 `a`（9，可點的內文連結，與 `src/` 的落點一致）＋示範按鈕 `.btn`（3）＋展示圓角的 `.rbox`（1）＋**其餘 26 處不可點**。舊敘述的「七頁 41 處」是把兩處 `border-color: var(--a)` 一起數了（39＋2），而框線是非文字通道、本規則不管它——以上面那條命令為準。

**兩件刻意不修的，登記在案，不必再當成新發現：**

- **`.cs-wipe-tag--new` 的邊框沒有任何閘門在看**——對比檢查只驗文字色，不驗 `border-color`。今天安全是截圖角落顏色的巧合：實測 `rejected-v1.png` 的金色角落對主色框只有 **1.322**，只因標籤落在另一側才沒事。
- **`--color-bg-alt`（決策開關、角標卡）封頂在 n-100 的理由已經消失**——那兩個元件的主色小標 2026-07-28 全數退場。要不要因此提到 n-200 是**另一個決定**（會動到它與列表卡的分離度），不是還有東西擋著。

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
