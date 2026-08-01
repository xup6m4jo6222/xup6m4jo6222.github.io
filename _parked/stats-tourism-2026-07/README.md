# 封存：統計專案 #1（來臺旅客消費及動向）

> **這個資料夾隨時可能被整個刪掉，也隨時可能被撿回來。兩種都是預期中的結果。**
> 封存於 2026-07-30，由林郁為決定。

## 這裡是什麼

統計分析作品頁的四篇文章、兩個支援子頁、以及全部 21 張圖表。**四篇都已完成並通過本機驗收，
從來沒有上線過**（`public/robots.txt` 一直是 `Disallow: /`）。

```
content/     四篇文章（原本在 src/content/projects/stats/）
process/     兩個支援子頁（原本在 public/process/）
images/      21 張圖表（原本在 public/images/taiwan-tourism/）
```

| 檔案 | 原本的網址 |
|---|---|
| `content/taiwan-tourism.md` | `/projects/stats/taiwan-tourism/` |
| `content/taiwan-tourism-2-water.md` | `/projects/stats/taiwan-tourism-2-water/` |
| `content/taiwan-tourism-3-model.md` | `/projects/stats/taiwan-tourism-3-model/` |
| `content/taiwan-tourism-4-era.md` | `/projects/stats/taiwan-tourism-4-era/` |
| `process/tourism-univariate.html` | `/process/tourism-univariate.html` |
| `process/tourism-data-background.html` | `/process/tourism-data-background.html` |

## 為什麼封存

不是因為寫得不好，是因為**資料的來源說不清楚**。

那份分析用的是交通部觀光署十年（民國 103–113）的問卷，而政府這十年一直在微調變數——
原始超過 100 個變數逐年不同，合併後剩 44 個，刪掉大量未填的剩 30 幾個。這個合併是本人自己做的，
現在已經無法逐步交代清楚。抗辯過程實際查到的具體例子：

- `education_level`：**103 年代碼 2 是「高中以下」，其他年代碼 2 是「大學以上」，完全相反**
- `seen_ads`：109／110 年的代碼 9 沒被對應到 `Non_Tourist`，被錯記成 `Unknown`（未修）
- 幣別代碼三套（early／middle／text）；活動、住宿代碼逐年不同
- `currency_prepaid` 對不到碼時金額歸零——「真的沒付」和「對不到碼」變成同一個值，影響 31.8% 的資料

一個面試官只要問「103 年的學歷你怎麼處理」，這份分析就守不住。**可辯護性壓過樣本數。**

## 撿回來之前必須先修的一個真 bug

`#1-4`（`content/taiwan-tourism-4-era.md`）的年代分組有缺陷，**2026-07-30 經三鏡頭抗辯確認（2/3 存活）**，
而且主迴圈獨立驗證過數字：

原因在統計專案 repo 的 `tools/gen_modules.py:252`——`post = df[df['year'] >= 109]`
把 109、110 兩個封關年併進了「疫情後」。但那兩年的受訪者不是觀光樣態：

| 年 | 樣本數 | 停留中位 | 跟團% | 休閒目的% | 有幾個月 |
|---|---|---|---|---|---|
| 108 | 8,562 | 4 天 | 18.3 | 75.7 | 12 |
| **109** | 3,987 | **21 天** | 3.9 | 33.5 | **9** |
| **110** | 2,876 | **50 天** | **0.0** | **0.0** | **9** |
| 112 | 6,102 | 4 天 | 11.8 | 67.4 | 12 |

（`mon` 欄位只有 9 個月是最硬的排除依據——**調查作業本身停擺**，與任何結果變數無關，
所以用它排除不會被指控「拿結果挑資料」。）

**後果一：文章頭號結論的方向是反的。**

| 國籍 → 停留天數 ε² | |
|---|---|
| 疫情前 103–108 | 0.248 |
| **疫情後（文章現行的合併）** | **0.269** ← 據此說「穩健、帶得走」 |
| └ 崩塌期 109–110 | 0.201 |
| └ 復甦期 112–113 | **0.153** |

合併值高於兩個子區間的任何一個——典型的異質母體混池灌水。拆開來看復甦期只剩 0.153，
比疫情前低了四成。**這個結論不是「帶得走」，是「明顯減弱」。**

**後果二：敘事錨點被封關期撐著。**文章開頭「疫情後不願意的只剩 81 人」——其中
**58 人（71.6%）來自 109／110**。排除後只剩 23 人，信賴區間會寬到講不出話。

## 怎麼撿回來

1. **先修上面那個 bug**（改分組、重跑、改文章），否則撿回來就是上線一篇說錯話的文章。
2. `git mv _parked/stats-tourism-2026-07/content/*.md src/content/projects/stats/`
3. `git mv _parked/stats-tourism-2026-07/process/*.html public/process/`
4. `git mv _parked/stats-tourism-2026-07/images/taiwan-tourism public/images/taiwan-tourism`
5. 復原 `src/pages/projects/index.html` 的空分類隱藏（如果那時已經不需要）
6. 把 `scripts/verify/field-runtime.mjs` 與 `scripts/verify/fps-serve.mjs` 的閱讀頁測試目標
   改回 `/projects/stats/taiwan-tourism/`（封存時改成了 AI 專案頁）

四篇之間的交叉連結、以及兩個子頁回到 `#1-1` 的連結，都是這一組內部的相對關係，
**整組一起搬所以沒有斷連結**——一起回來也不會斷。

## 封存時順手改的兩處（不是這四篇的問題，是搬遷的連帶）

- `scripts/verify/field-runtime.mjs`、`scripts/verify/fps-serve.mjs`：兩支驗證腳本把
  `/projects/stats/taiwan-tourism/` 寫死成「閱讀頁」測試目標，搬走之後會 404。
  改指向 `/projects/ai/portfolio-site/`。
- `src/pages/projects/index.astro`：搬走之後 `stats` 分類會變成空的，列表頁原本會渲染出一個
  空的「統計分析」標題。改成沒有內容的分類不渲染。

## 相關紀錄

- 封存的決策與理由：`DECISIONS.md`（2026-07-30，未進版控）
- 統計專案 #2 的資料與命題重選：`Statistical Projects/.scratch/project-2/map.md`
- 原始分析與資料：`Statistical Projects/#1 Analysis of tourists visiting Taiwan/`（含 `交接文檔.md`）
