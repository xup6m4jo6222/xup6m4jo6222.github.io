/**
 * 票 05：把幀率探針注入產物、印出手機連得到的網址。
 *
 *   npm run build
 *   node scripts/verify/fps-serve.mjs
 *   npx astro preview --host --port 4399
 *
 * 收工用 `npm run build` 還原（dist 是產物，不必寫還原邏輯）。
 * 為什麼要走區網而不是無頭截圖：看板 2026-07-28 那條教訓——無頭環境的 rAF 幾乎不前進，
 * 量到的幀率是量測環境的假象。手機那組數字只有真的裝置給得出來。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const probeName = process.env.PROBE || 'probe-fps.js';
const js = readFileSync(new URL(probeName, import.meta.url), 'utf8');
const pages = process.argv.slice(2).length
	? process.argv.slice(2)
	: ['index.html', 'projects/stats/taiwan-tourism/index.html'];

for (const p of pages) {
	const file = join(ROOT, 'dist', p);
	const html = readFileSync(file, 'utf8');
	if (html.includes('/* probe */')) continue; // 重跑不要疊第二份
	writeFileSync(file, html.replace('</body>', `<script>/* probe */\n${js}</script></body>`));
	console.log('已注入', p);
}

const lan = Object.values(networkInterfaces())
	.flat()
	.filter((i) => i && i.family === 'IPv4' && !i.internal)
	.map((i) => i.address);

console.log('\n手機連同一個 wifi，開下面任一個網址：');
for (const ip of lan) {
	console.log(`  首頁      http://${ip}:4399/`);
	console.log(`  閱讀頁    http://${ip}:4399/projects/stats/taiwan-tourism/`);
}
console.log('\n畫面最上方那塊黑底綠字就是讀數。放著幾分鐘再截圖。');
