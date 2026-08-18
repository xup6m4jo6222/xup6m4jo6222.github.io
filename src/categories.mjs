/**
 * 分類的單一來源（票 02）。
 *
 * 在這之前，「這件作品屬於哪一類、是那一類的第幾件」散在四個地方各寫一次：
 * 導覽列一份陣列、列表頁一份陣列、專案內頁一份 map，序號則是人手打在 frontmatter
 * 的 title 字串裡（`AI 專案 #1 個人作品頁`）。四份會各自漂移，而序號會過期——
 * 統計專案從封存區回來、或第二篇 AI 實作上線，都得有人記得回去改字。
 *
 * ── 兩個刻意的選擇 ────────────────────────────────────────────────────
 *
 * **副檔名是 `.mjs` 不是 `.ts`。** 部署前閘門（`scripts/verify-palette.mjs`）是純
 * node 腳本，要 import 得到這份清單，才驗得了「同一個分類不得有兩個顯示名」。
 * 寫成 `.ts` 的話閘門只能用正則去猜這個檔的內容，那等於又生出第二份定義。
 *
 * **這裡不 import `astro:content`。** 那個模組只在 Astro 的建置環境裡存在，
 * 一 import 進來，上面那句就不成立了。所以序號做成純函式，由呼叫端把
 * `await getCollection('projects')` 的結果餵進來。
 */

/**
 * 分類的 key 與顯示名。**顯示名以導覽列既有用語為準**（2026-07-30 郁為拍板）：
 * 標籤化會讓分類名變成徽章，與導覽列同屏出現時兩個名字指同一個地方，
 * 30 秒的陌生人分不出那是不是兩個地方。
 *
 * 順序就是站上呈現的順序（統計在前、AI 在後）。
 */
export const CATEGORIES = [
	{ key: 'stats', label: '統計分析' },
	{ key: 'ai', label: 'AI 實作' },
];

/** 查一個分類該顯示成什麼。查不到就把 key 原樣吐出來——不要讓版面上出現空白。 */
export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

/**
 * 退役的分類名，閘門用。
 *
 * 為什麼要有這份清單：光有正名清單，機器分不出「AI 專案」是這個分類的舊名、
 * 還是一段剛好長這樣的中文。要擋「同一個分類冒出第二個顯示名」，就得指名道姓。
 *
 * **這道守衛的誠實邊界**：它只認得**登記過**的舊名。有人明天發明第三個叫法
 * （例如「AI 作品」）而不登記，閘門看不見。它擋的是回頭路，不是想像力。
 *
 * `stats` 沒有登記任何舊名，雖然封存區那四篇的標題確實寫著「統計專案 #1-1」——
 * 郁為 2026-07-30 只拍板了 `ai` 的統一，統計那一側等 #2 上線時連同「四篇是一個
 * 專案還是四個專案」一起決定。**這一條是待決不是遺漏。**
 */
export const RETIRED_LABELS = [
	{ key: 'ai', label: 'AI 專案', retiredOn: '2026-07-30' },
];

/**
 * 算出每件作品在自己分類裡是第幾件：回傳 `id → 序號` 的對照表。
 *
 * 規則是**依日期由舊到新**，最早的那件是 #1。所以第二篇 AI 實作一上線自動變 #2，
 * 而統計專案從封存區回來只會影響統計那一列的號碼，動不到 AI 這邊。
 *
 * 同一天的兩件作品用 id 當第二把尺——不是因為 id 有意義，是因為**沒有第二把尺
 * 的排序在不同機器上可以給出不同答案**，那會讓序號變成建置環境的函數。
 */
export function categoryIndexes(projects) {
	const counts = new Map();
	const indexes = new Map();
	const byDate = [...projects].sort((a, b) => +a.data.date - +b.data.date || a.id.localeCompare(b.id));
	for (const p of byDate) {
		const n = (counts.get(p.data.category) ?? 0) + 1;
		counts.set(p.data.category, n);
		indexes.set(p.id, n);
	}
	return indexes;
}
