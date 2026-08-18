/**
 * 一次性量測（票 02／03 的驗收證據，不進 npm scripts）：
 * 把產物副本裡的文字改成透明，用本機 Chrome 無頭模式拍下**純背景**，
 * 再由 measure-contrast.mjs 對每個文字方框找最亮的像素、算對比。
 *
 *   node scripts/verify/shot-background.mjs <頁面路徑> <輸出png> [hide|nomotif] [視窗高] [埠]
 *
 * 埠要可以換（票 04 實測踩到）：多個對話共用這個工作目錄，4399 常被別人的伺服器佔著，
 * 而佔著它的那一台服的是別的產物——照預設埠拍下去拍到的是別人的畫面。
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

const [page, out, mode, height = '720', port = '4399'] = process.argv.slice(2);
const file = join(ROOT, 'dist', page);
const original = readFileSync(file, 'utf8');
const hide =
	'body,body *{color:transparent!important;border-color:transparent!important;text-decoration-color:transparent!important}' +
	'[data-reveal]{opacity:1!important;transform:none!important}' +
	(mode === 'nomotif' ? 'canvas.motif{display:none!important}' : '');
if (mode) writeFileSync(file, original.replace('</head>', `<style>${hide}</style></head>`));
try {
	execFileSync(
		CHROME,
		[
			'--headless=new', '--disable-gpu', '--hide-scrollbars',
			`--window-size=1280,${height}`, '--force-device-scale-factor=1',
			'--virtual-time-budget=6000',
			`--user-data-dir=${join(ROOT, 'node_modules', '.cache', 'shoot-chrome')}`,
			`--screenshot=${out}`,
			`http://localhost:${port}/${page.replace(/index\.html$/, '')}`,
		],
		{ stdio: 'ignore' },
	);
} finally {
	writeFileSync(file, original);
}
console.log('拍好', out);
