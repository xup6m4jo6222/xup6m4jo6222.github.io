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

   **理念五的範圍（2026-07-28 本人釐清，AI 曾誤讀一次）**：它指的是**內容文字的作者權**——所有內容文字由本人決定，AI 生成的必須經本人看過甚至直接修改。**它不是「不得用符號代替文字」。**相反地，**符號能取代文字時是好事**，因為增加可視化就是增加易讀性——那由**理念一**拉動。
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

- 元素主色：`#7998c3`（含捲軸變體 `#7998c355`）＋漸層內聯 RGB `rgba(121, 152, 195, 0.1)`（global.css 有空格格式）/`rgba(121,152,195,.1)`（process 頁緊湊格式）＋**「面」的淡底 `rgba(121, 152, 195, 0.07)`**（2026-07-29 票 05 新增，產物縮寫成 `#7998c312`；漏掉它的話，換色後比對器本人側、統計表頭、文字所有權本人側三塊淡底會留著舊主色的 RGB，而**閘門對這種殘留是無感的**——它只驗「淡底＝判準說的那個宣告值」，不驗「淡底有沒有跟上新主色」）
- 中性色家族：底 `#1d1119`、token 背景 `#20131d`（另有 `#20131dd9` 導覽列半透明）、黑莓暗暈 `#2a1829`、卡底 `#2f1e2b`、hover 底 `#33222f`、邊框 `#3d2e3a`／`#56506a`、muted `#a79aa5`、內文 `#ebe5eb`、hover 文 `#f2ecf2`、favicon 底板 `#191017`（在 favicon.svg，2026-07-19 盤點時即因不在清單而漏掃過一次）
- **排除**：talks-*.html 示範元件內的色碼（`#0d0e10`、`#ffffff0d`、`#c6c4bd`、`#26292c`、`#24282c`、`#191018` 等）是歷史對話原件的展示內容，凍結不遷移
- 涉及檔案：`global.css`＋process 頁＋`favicon.svg`；**`public/process/` 的九個 `.html` 每一個都有自己的 `--a`，一個都不能漏**（以 `ls public/process/` 為準，2026-07-28 實測更正）；收工前 `grep -ri "<舊色碼>" src public` 必須零殘留
- 色碼改完≠完成：og-card.png 與 current-vN/page-timeline-vN 比對截圖需重生成、portfolio-site.md 版次角標進位（重大視覺版本慣例），對比度需驗 ≥4.5

## 元素主色當文字色（2026-07-29 重寫，**範圍限 `src/`**）

一句話的規則，其餘四條都是它的展開：

> **主色可以當文字色，但只在那個字的「認得出來」不靠顏色的時候。**
> 辨識由字重、字體、字級或底線先承擔；顏色只負責份量。

這條規則是**推翻主色的那組量測回過頭來授權它**：主色對周圍文字的可辨識度只有 0.058（門檻 0.185），它做不到辨識——既然不扛辨識，它才可以放心扛份量。同一組數字，兩輪得到相反結論，兩次都對，因為第一次問「它能不能分」，第二次問「它該做什麼」。

**判準一——辨識通道認四種：字重（≥500）、字體（襯線）、字級、底線。**
另有兩種**沒有任何宣告證明得了**的，明文登記、由人負責：`state`（狀態改變，用在 hover 條目，前提是靜止態已在中性階頂端 n-900）與 `shape`（形狀與位置，只有把手字符 `.cs-wipe-handle:after` 一條）。
**「獨立成行」不算通道**——本人否決的比對器小標與角標卡小標正是靠獨立成行在區分的東西，規則不該放行剛被否決的畫面。連帶效果：任何要拿主色的短標籤都必須另外帶字重或字體，不能只把顏色加回去。

**判準二——面 vs 線：主色鋪成「面」的地方，字用內文色；主色只走「線」的地方，字才用主色。**
理由是量出來的：主色是中明度色，**鋪面的同時也在削自己的字對比**。7% 主色淡底上，主色字九態最壞只有 4.33（統計表頭）與 4.36（比對器），都低於 4.5；改用內文色是 10.34 與 10.42。線不會，因為線不改變字底下那塊底。**這是硬邊界不是偏好——理念一壓過份量。**

**這條講的是「主色鋪的面」，不是「任何面」**（2026-07-29 補，本人問過同一個問題）：**鋪暗的面是易讀性的朋友**，方向剛好相反。列聯表行標後面那道墨渲染（`--color-ink-wash`＝背景主色 55%）把底壓暗，同一個主色字從 4.81 升到 5.51。分界是**底往字的顏色靠還是往反方向走**——往字靠就是互相抵銷，往反方向走就是加分。

**判準三——主色只給「貼著內容」的標籤。**
給：列聯表行標 `.dmr th`（左緣 2px 主色線）、時間軸角標卡小標 `.tl-solo em`（既有的四角與 hover 墨線）。
不給：**獨立成塊、四周有留白的**——決策開關分類名 `.cs-toggle-name`、擦除比對器標籤 `.cs-wipe-tag`、證據列 `.cs-evi`。分界沿用 `CONTEXT.md` 既有的「版面 vs 內容」：**留白是版面在做的事，顏色不必重做一次**。
注意統計表頭 `.st-table thead th` 是**面**的元件，所以它拿的是淡底、字是內文色——它在判準二那一關就被分走了。

**判準四——數字不是標籤，統計數字維持內文色。**
判斷方法：拿掉表頭還讀得到資料，拿掉數字那句話就沒有了——**數字是內容本身**。而且新規則說顏色只負責份量，數字要的卻是被讀準：主色是站上最低的文字對比，數字又是最不能猜的字。

**唯一的清單**是 `scripts/palette-config.mjs` 的 `ACCENT_TEXT_ALLOWLIST`，目前**九條**，每一條都帶著四件事：選擇器、辨識通道、**那個通道宣告在哪個選擇器上**（可以不是它自己——`a` 的底線就宣告在 `.content a`）、以及為什麼成立。對比配對的 `fgOn` 由它推導，不要另外列一份。
兩道閘門守它：不在清單上而把主色當文字色，第二類會紅；**在清單上但宣稱的通道在產物裡不成立，第十二類會紅**（清單是人的決定，通道成不成立是事實——合成一邊就會丟掉另一邊）。
**這條規則的敘述一律不得寫「全站」**——它管不到 `public/`。

**`public/process/` 明文豁免：那裡的主色文字是刻意保留的歷史狀態，不是漏網的違規。** 那些頁的說話者標籤、選項標籤、表頭、數字用主色而且**不可點**，用的又是真變數 `--a`（不是展示用的凍結色碼），所以掃描一定會掃到——掃到就跳過，不要再為此開一輪討論。理由：換色協議授權的是「同一個角色換一個色碼」，**不授權「改變誰扮演哪個角色」**，後者會讓歷史存檔不再是當時的樣子。

可枚舉，不必憑印象：`grep -nE "(^|[^-])color: ?var\(--a[,)]" public/process/*.html` — 2026-07-28 實測**九個檔共 39 處**，組成是每頁一條 `a`（9，可點的內文連結，與 `src/` 的落點一致）＋示範按鈕 `.btn`（3）＋展示圓角的 `.rbox`（1）＋**其餘 26 處不可點**。舊敘述的「七頁 41 處」是把兩處 `border-color: var(--a)` 一起數了（39＋2），而框線是非文字通道、本規則不管它——以上面那條命令為準。

**四件刻意不修的，登記在案，不必再當成新發現（下一個人不必重新發現一次）：**

- **「閘門有顆粒缺口」這件事 2026-07-29 實測推翻了，不要再把它當待辦。** 曾經登記的說法是「顆粒蓋著整個視窗，所以 `.tl-solo em` 閘門算 4.84、實際只有 4.32」。**量真的像素之後不成立**：同一張截圖裡，卡片外的頁底像素標準差 1.44（顆粒在），卡片內部平均 `#342630`、標準差 **0.00**（完全均勻）。顆粒（`body::before`，`z-index: -1`）畫在內容之下，**有不透明底的元件確實不吃顆粒**——`palette-config.mjs` 原本的註解是對的，SPEC 那句是錯的。所以 **4.84 就是真值，本來就過 4.5**，不需要任何補救。
  量法留著備查：`.scratch/accent-weight/sample-grain.mjs`（滑動小窗格取變異數最小的一塊——第一版隨手取樣抓到文字，標準差 35，差點得出相反結論）。
  **半透明的表面另當別論**：7% 主色淡底是透的，底下透出來的頁面仍然有顆粒——那幾組配對本來就疊在含顆粒的九態上（`TINTED_PAGE_SURFACES`），沒有這個問題。

- **`.cs-wipe-tag--new` 的邊框沒有任何閘門在看**——對比檢查只驗文字色，不驗 `border-color`。今天安全是截圖角落顏色的巧合：實測 `rejected-v1.png` 的金色角落對主色框只有 **1.322**，只因標籤落在另一側才沒事。
- **`.dmr th` 左緣那條 2px 主色線同樣沒有閘門在看**（2026-07-29 票 04 新增，同一個缺口的第二例）。它疊在頁底上實測 **6.05**，就算比照非文字通道的 3.0 也過得很寬——但那是我算的，不是閘門算的。**改動它或改動它底下那塊底時，沒有東西會攔你。**
- **`--color-bg-alt`（決策開關、角標卡）封頂在 n-100 的理由 2026-07-29 回來了，而且比原本更硬。** 票 04 把角標卡的前導小標 `.tl-solo em` 改回主色（「線」的落點），所以那塊底再提亮就會壓到它自己的字：實測**主色字在 n-100 上 4.84（過），提到 n-200 剩 3.61（破線）**。要提階就得先把那個小標的顏色收回去——**兩件事現在是綁在一起的**，不再是「另一個決定」。
  （原本這裡寫「含顆粒的實際值是 4.32／3.18」，2026-07-29 實測推翻——元件表面不吃顆粒，見上面第一條。4.84 與 3.61 就是真值。）

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
