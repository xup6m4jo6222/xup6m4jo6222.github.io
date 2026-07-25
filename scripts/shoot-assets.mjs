#!/usr/bin/env node
/**
 * 產出比對截圖（current-vN／page-timeline-vN），沿用站上 760×470 的慣例。
 *
 *   npm run shoot -- v8            對執行中的 dev server 拍
 *   npm run shoot -- v8 4322       指定埠號
 *
 * 用本機已安裝的 Chrome 無頭模式，不裝任何相依：視窗開 1520×940、
 * device scale factor 0.5，輸出剛好就是 760×470，不需要再縮圖。
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readPng } from './png-read.mjs';
import { writePng, cropAndHalve } from './png-write.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'images', 'portfolio-site');
const PROFILE = join(ROOT, 'node_modules', '.cache', 'shoot-chrome');

const CHROME = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

const version = process.argv[2];
const port = process.argv[3] || '4321';
if (!version || !/^v\d+$/.test(version)) {
	console.error('用法：npm run shoot -- v8 [port]');
	process.exit(2);
}
if (!CHROME) {
	console.error('找不到 Chrome。這支腳本靠本機瀏覽器，不裝相依。');
	process.exit(2);
}

/**
 * 時間軸那張要拍的是頁面中段，而 Chrome 無頭模式的 --screenshot 只拍視窗左上角，
 * 錨點捲動又常常在畫面還沒穩定時就快門。所以改成：整頁拍一張大的，再裁。
 *
 * TIMELINE_TOP 是「專案歷史」標題在 1520px 寬下距文件頂端的位置（CSS px）。
 * 版面改動後要重量：在 1520 寬的視窗跑
 *   document.querySelector('.content h2').getBoundingClientRect().top + scrollY
 */
const TIMELINE_TOP = 930;
const SHOT_W = 1520;
const SHOT_H = 940;

function chrome(args) {
	execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', ...args], {
		stdio: 'ignore',
	});
}

mkdirSync(PROFILE, { recursive: true });

// 首頁：整頁剛好一屏，device scale factor 0.5 直接輸出 760×470，不用再縮
chrome([
	'--virtual-time-budget=8000',
	`--window-size=${SHOT_W},${SHOT_H}`,
	'--force-device-scale-factor=0.5',
	`--user-data-dir=${PROFILE}`,
	`--screenshot=${join(OUT, `current-${version}.png`)}`,
	`http://localhost:${port}/`,
]);
console.log(`拍好 current-${version}.png`);

// 專案頁：整頁拍完再裁中段。強制「降低動態偏好」，時間軸卡才會全部清晰
// （站上的糊化只發生在視窗中央帶之外，那是常駐態不是缺陷，但不適合當比對圖）。
const full = join(tmpdir(), `shoot-${version}-full.png`);
chrome([
	'--virtual-time-budget=10000',
	`--window-size=${SHOT_W},4200`,
	'--force-device-scale-factor=1',
	'--force-prefers-reduced-motion',
	`--user-data-dir=${PROFILE}`,
	`--screenshot=${full}`,
	`http://localhost:${port}/projects/ai/portfolio-site/`,
]);
const src = readPng(full);
writePng(
	join(OUT, `page-timeline-${version}.png`),
	cropAndHalve(src, { x: 0, y: TIMELINE_TOP, width: SHOT_W, height: SHOT_H }),
);
rmSync(full, { force: true });
console.log(`拍好 page-timeline-${version}.png`);
