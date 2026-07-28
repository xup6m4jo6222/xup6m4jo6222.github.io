/**
 * 把一段探針腳本注入產物副本、用無頭 Chrome 開啟，把結果印在畫面上再拍下來。
 * 「跑一個真的瀏覽器、從外部觀察」——不是 console.log，也不是人工目視推論。
 *   node scripts/verify/probe.mjs <頁面> <探針js檔> <輸出png>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => p && existsSync(p));
const [page, probe, out] = process.argv.slice(2);
const file = join(ROOT, 'dist', page);
const original = readFileSync(file, 'utf8');
const js = readFileSync(join(ROOT, probe), 'utf8');
writeFileSync(file, original.replace('</body>', `<script>${js}</script></body>`));
try {
	execFileSync(CHROME, ['--headless=new','--disable-gpu','--hide-scrollbars','--window-size=1280,720',
		'--force-device-scale-factor=1','--virtual-time-budget=15000',
		`--user-data-dir=${join(ROOT,'node_modules','.cache','shoot-chrome')}`,
		`--screenshot=${out}`, `http://localhost:4399/${page.replace(/index\.html$/,'')}`], { stdio: 'ignore' });
} finally { writeFileSync(file, original); }
console.log('拍好', out);
