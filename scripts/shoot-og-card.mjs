/**
 * 重新生成分享卡 `public/images/og-card.png`（1200×630）。
 *
 * 這張卡原本是 2026-07-19 的手工 PNG，**沒有任何產生器**——換色協議寫著
 * 「og-card 需重生成」，但沒有東西生得出來。這支補上那個洞。
 *
 * 作法是把卡當成一個暫時的頁面丟進 dist、用無頭 Chrome 拍下來再刪掉。
 * 這樣做的唯一理由是**色與字自動吃站上真正的 token**：卡片連的是建置產出的
 * global.css，`--color-bg`／`--color-accent`／`--font-display` 改了卡就跟著改，
 * 不會變成第二套色碼定義（換色協議最怕的就是那個）。
 *
 *   npm run build && npx astro preview --port 4399   # 另開
 *   node scripts/shoot-og-card.mjs 4399
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryLabel } from '../src/categories.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const port = process.argv[2] || '4321';
const CHROME = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => p && existsSync(p));

/**
 * 各類有幾件作品。
 *
 * **票 02 之前這裡是數標題裡的「#N」。** 序號從標題收回 collection 之後，那個正則
 * 一個都比不到，卡上會印兩個 0——而且是安靜地印，沒有人會發現，直到分享連結長那樣。
 *
 * 現在數檔案，因為票 02 起「一件作品一個 .md、序號依日期算」是全站唯一的規則。
 * **已知待決**：封存區那四篇觀光文章原本是同一個專案的 #1-1～#1-4，撿回來會被數成
 * 四件。要嘛 frontmatter 補一個「同屬一個專案」的欄位，要嘛接受它就是四件——
 * 那要等統計 #2 上線時由郁為決定，不是這支腳本能替他決定的事。
 */
const countProjects = (category) =>
	readdirSync(join(ROOT, 'src', 'content', 'projects', category)).filter((f) => f.endsWith('.md')).length;

// 分類名一律查單一來源（票 02）。卡上寫死一份，就是站上第二個顯示名。
const stats = countProjects('stats');
const ai = countProjects('ai');
console.log(`${categoryLabel('stats')} ${stats}　${categoryLabel('ai')} ${ai}`);

// 建置後的樣式表檔名帶雜湊，每次建置都不同——用找的，不要寫死
const css = readdirSync(join(ROOT, 'dist', '_astro')).find(
	(f) => f.startsWith('BaseLayout') && f.endsWith('.css'),
);
if (!css) throw new Error('找不到建置後的 global.css，先跑 npm run build');

const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&family=Noto+Serif+TC:wght@400;600&display=block" rel="stylesheet">
<link rel="stylesheet" href="/_astro/${css}">
<style>
	/* 卡是固定尺寸的畫布，不吃站上的 flex 版面 */
	html, body { width: 1200px; height: 630px; overflow: hidden; display: block; }
	/* class 一律 og- 前綴。第一版用了 .card，直接撞上 global.css 的卡片元件，
	   底色被靜默蓋成 --n-200（#483a45），整張卡變成淺紫灰——
	   那正是看板記過的「自訂 class 名撞到既有元件」同一個症狀。 */
	.og { position: relative; width: 1200px; height: 630px; box-sizing: border-box; }
	/* 角框：只有兩條邊，左上與右下各一個，呼應站上「線是分隔不是外框」那條 */
	.og-corner { position: absolute; width: 52px; height: 62px; border-color: var(--color-border-strong); }
	.og-corner--tl { top: 30px; left: 38px; border-left: 1px solid; border-top: 1px solid; }
	.og-corner--br { bottom: 30px; right: 38px; border-right: 1px solid; border-bottom: 1px solid; }
	.og-inner { position: absolute; top: 50%; left: 105px; transform: translateY(-50%); }
	.og-name {
		font-family: var(--font-display); font-weight: 400; font-size: 88px;
		line-height: 1.1; margin: 0 0 26px; color: var(--color-text); letter-spacing: 0.02em;
	}
	.og-tagline { margin: 0; font-size: 27px; color: var(--color-text-muted); }
	.og-meta { position: absolute; left: 105px; bottom: 78px; margin: 0; font-size: 21px; color: var(--color-text-muted); }
	.og-meta b { color: var(--color-accent); font-weight: 500; }
	.og-meta i { font-style: normal; color: var(--color-border-strong); margin: 0 12px; }
</style></head><body>
<div class="og">
	<span class="og-corner og-corner--tl"></span><span class="og-corner og-corner--br"></span>
	<div class="og-inner">
		<div class="og-name">林郁為</div>
		<p class="og-tagline">統計背景，正朝資料科學邁進。</p>
	</div>
	<p class="og-meta">${categoryLabel('stats')} <b>${stats}</b><i>·</i>${categoryLabel('ai')} <b>${ai}</b><i>·</i>持續更新中</p>
</div></body></html>`;

const tmp = join(ROOT, 'dist', 'og-card-tmp.html');
writeFileSync(tmp, html);
try {
	execFileSync(CHROME, [
		'--headless=new', '--disable-gpu', '--hide-scrollbars',
		'--window-size=1200,630', '--force-device-scale-factor=1',
		'--force-prefers-reduced-motion', '--virtual-time-budget=8000',
		`--user-data-dir=${join(ROOT, 'node_modules', '.cache', 'shoot-chrome')}`,
		`--screenshot=${join(ROOT, 'public', 'images', 'og-card.png')}`,
		`http://127.0.0.1:${port}/og-card-tmp.html`,
	], { stdio: 'ignore' });
} finally {
	rmSync(tmp, { force: true });
}
console.log('拍好 og-card.png');
