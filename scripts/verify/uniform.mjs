/**
 * 跑 probe-uniform.js N 次並彙總。點的位置每次載入都重擲，所以單次通過不算數——
 * 要看的是最差的那一次與不及格率。
 *
 *   node scripts/verify/uniform.mjs <頁面> [次數] [寬x高] [埠]
 *   例：node ...\uniform.mjs index.html 10 1280x720
 *
 * 需要先 `npm run build`，並另開一個 `npx astro preview --port 4399`。
 * **埠要可以換**（票 04 實測踩到）：多個對話同時在這個工作目錄裡跑，4399 常常已經被
 * 別人的伺服器佔著，而佔著它的那一台服的是別的產物——照預設埠量下去量到的是別人的畫面。
 * 用 --dump-dom 取文字結果而不是截圖：判準是數字，不是給人看的圖。
 * 配 --force-prefers-reduced-motion 取確定性的呼吸中點幀（理由見 probe-uniform.js）。
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

const [page = 'index.html', runs = '10', size = '1280x720', port = '4399'] = process.argv.slice(2);
const file = join(ROOT, 'dist', page);
const original = readFileSync(file, 'utf8');
const js = readFileSync(new URL('probe-uniform.js', import.meta.url), 'utf8');
writeFileSync(file, original.replace('</body>', `<script>${js}</script></body>`));

const rows = [];
try {
	for (let i = 0; i < Number(runs); i++) {
		const dom = execFileSync(
			CHROME,
			[
				'--headless=new', '--disable-gpu', '--hide-scrollbars',
				`--window-size=${size.replace('x', ',')}`, '--force-device-scale-factor=1',
				'--force-prefers-reduced-motion', '--virtual-time-budget=8000', '--dump-dom',
				// 每次換一個設定檔目錄，否則 Chrome 會復用同一個算繪程序、點不重擲
				`--user-data-dir=${join(ROOT, 'node_modules', '.cache', `uniform-${i}`)}`,
				`http://localhost:${port}/${page.replace(/index\.html$/, '')}`,
			],
			{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
		);
		// 抓輸出的那個 div，不是拿 /UNIFORM/ 去掃整份 DOM——注入的探針原始碼裡
		// 也有這個字串，會先被咬到（第一次跑就踩到了）。
		const m = dom.match(/id="uniform-out"[^>]*>([^<]*)/);
		if (!m) { console.log(`第 ${i + 1} 次：探針沒有輸出`); continue; }
		console.log(`第 ${i + 1} 次：${m[1]}`);
		rows.push(m[1]);
	}
} finally {
	writeFileSync(file, original);
}

const num = (s, k) => Number(s.match(new RegExp(`${k}=(-?\\d+)`))?.[1] ?? NaN);
const fails = rows.filter((r) => r.includes('判準=FAIL')).length;
const cells = rows.reduce((a, r) => a + num(r, '受測格'), 0);
const bad = rows.reduce((a, r) => a + num(r, '不及格'), 0);
const worst = Math.min(...rows.map((r) => num(r, '最少')));
console.log(
	`\n彙總 ${rows.length} 次：整體判準 ${fails === 0 ? 'PASS' : `FAIL（${fails} 次不過）`}` +
		`　不及格格數 ${bad}/${cells}（${((bad / cells) * 100).toFixed(1)}%）　全場最少元素數 ${worst}`,
);
