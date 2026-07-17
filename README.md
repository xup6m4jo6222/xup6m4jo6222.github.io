# xup6m4jo6222.github.io

個人作品集網站的原始碼。建站過程與決策紀錄見網站專案頁 [「這個網站就是我的第一個 AI 專案」](https://xup6m4jo6222.github.io/projects/ai/portfolio-site/)，原始決策材料在 [DECISIONS.md](DECISIONS.md)。

## 技術

Astro，部署於 GitHub Pages（GitHub Actions 自動建置，push 到 main 即部署）。

本地開發

```sh
npm install
npm run dev
```

新增專案：在 `src/content/projects/stats/` 或 `src/content/projects/ai/` 放一個 `.md` 檔，欄位定義在 `src/content.config.ts`，列表與內頁自動生成。
