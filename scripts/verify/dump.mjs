/**
 * 把一段探針注入產物副本、用無頭 Chrome 開起來，**把它印在 DOM 裡的文字取回來**。
 * 與 probe.mjs 的差別只有一個：那支拍照給人看，這支取數字給人比。
 *
 *   node scripts/verify/dump.mjs <頁面> <探針js> [寬x高] [埠] [查詢字串] [額外的 chrome 旗標…]
 *   例：node scripts/verify/dump.mjs index.html scripts/verify/probe-motif-band.js 1280x720
 *   例：… probe-text-boxes.js 1280x900 4401 "?nomotif" --screenshot=C:/tmp/bg.png
 *
 * 需要先 `npm run build`，並另開一個 `npx astro preview --port 4399`。
 * **埠要可以換**：多個對話同時在這個工作目錄裡跑，4399 常常已經被別人的伺服器佔著，
 * 而佔著它的那一台服的是**別的產物**——照預設埠量下去，量到的是別人的畫面。
 * 探針把結果放進 `<div id="probe-out">`。配 --force-prefers-reduced-motion 取確定性的
 * 呼吸中點幀（理由見 probe-uniform.js）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => p && existsSync(p));

const [page = 'index.html', probe, size = '1280x720', port = '4399', query = ''] = process.argv.slice(2);
const extra = process.argv.slice(7); // 額外的 chrome 旗標，例如 --screenshot=…
const file = join(ROOT, 'dist', page);
const original = readFileSync(file, 'utf8');
writeFileSync(file, original.replace('</body>', `<script>${readFileSync(join(ROOT, probe), 'utf8')}</script></body>`));

let dom = '';
try {
	dom = execFileSync(
		CHROME,
		[
			'--headless=new', '--disable-gpu', '--hide-scrollbars',
			`--window-size=${size.replace('x', ',')}`, '--force-device-scale-factor=1',
			'--force-prefers-reduced-motion', '--virtual-time-budget=8000', '--dump-dom',
			`--user-data-dir=${join(ROOT, 'node_modules', '.cache', 'dump-chrome')}`,
			...extra,
			`http://localhost:${port}/${page.replace(/index\.html$/, '')}${query}`,
		],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
	);
} finally {
	writeFileSync(file, original);
}
// 抓那個 div，不是拿標記去掃整份 DOM——注入的探針原始碼裡也有同樣的字串（uniform.mjs 踩過）
const m = dom.match(/id="probe-out"[^>]*>([^<]*)/);
console.log(m ? m[1].replace(/&amp;/g, '&') : '探針沒有輸出');
