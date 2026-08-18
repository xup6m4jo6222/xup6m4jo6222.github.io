/**
 * 第 4 層強度的**下限**量測（背景敘事輪票 02）。與顆粒共用同一把尺：
 *
 *   這一層自己貢獻的起伏 ÷ 該處背景自身的起伏 ≥ 1.5
 *
 *   node scripts/verify/measure-field-ripple.mjs <埠> [ink…]
 *
 * 要先 `npm run build`，並另開 `npx astro preview --port <埠>`。
 *
 * ── 量法（照抄 `GRAIN_RANGE` 那一段，只換了取樣塊與狀態）──────────────────
 *
 * 1280×720 首頁、**藏掉文字與背景設計畫布**，取一塊 120×120 算亮度標準差；
 * 這一層自己的貢獻用平方差還原（`√(σ總² − σ底²)`），對照組是 `?nofield`。
 *
 * **取樣塊改在左邊的留白**（顆粒那一組取 (560,120)）。理由是這一層**在文字帶裡是
 * 被減光的**——取在欄內量到的是減光後的殘量，不是這一層的強度。塊的位置一旦換過，
 * 比值就不可比，所以它在這裡寫死並且要與 `FIELD_INK_RANGE` 的註解一致。
 *
 * **量的是表面態（`reveal: 0`）**，也就是出貨的那一態，也是這一層最不明顯的一態：
 * 下限問的是「有沒有這一層看不看得出來」，那要拿最不明顯的那一態去問。
 * （上限相反，量全開態——見 `measure-field-ink.mjs`。兩端各取自己的最壞情況。）
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from '../png-read.mjs';
import { FIELD } from '../palette-config.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const [port = '4488', ...inks] = process.argv.slice(2);
const INKS = (inks.length ? inks : [String(FIELD.ink)]).map(Number);
const PAGE = 'index.html';
const SIZE = { w: 1280, h: 720 };
/** 取樣塊：左邊的留白，離文字欄夠遠（欄從 x≈273 起，化開寬度 40）。 */
const BLOCK = { x: 60, y: 300, s: 120 };

const file = join(ROOT, 'dist', PAGE);
const original = readFileSync(file, 'utf8');
const out = mkdtempSync(join(tmpdir(), 'field-ripple-'));

const shoot = (png, query) =>
	execFileSync(
		process.execPath,
		[
			'scripts/verify/dump.mjs', PAGE, 'scripts/verify/probe-text-boxes.js',
			`${SIZE.w}x${SIZE.h}`, port, query, `--screenshot=${png}`,
		],
		{ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);

/** 一塊區域的亮度標準差（0–255 階）。 */
const sigma = (png) => {
	const img = readPng(png);
	const v = [];
	for (let y = BLOCK.y; y < BLOCK.y + BLOCK.s; y++) {
		for (let x = BLOCK.x; x < BLOCK.x + BLOCK.s; x++) {
			const i = (y * img.width + x) * 3;
			v.push(0.2126 * img.rgb[i] + 0.7152 * img.rgb[i + 1] + 0.0722 * img.rgb[i + 2]);
		}
	}
	const m = v.reduce((s, a) => s + a, 0) / v.length;
	return { sd: Math.sqrt(v.reduce((s, a) => s + (a - m) ** 2, 0) / v.length), mean: m };
};

const patch = (params) => {
	const json = JSON.stringify(params).replace(/"/g, '&#34;');
	const next = original.replace(/data-field="[^"]*"/, `data-field="${json}"`);
	if (next === original) throw new Error('產物裡找不到 data-field，這一輪不算數');
	writeFileSync(file, next);
};

try {
	const basePng = join(out, 'base.png');
	shoot(basePng, '?nomotif&nofield');
	const base = sigma(basePng);
	console.log(
		`取樣塊 (${BLOCK.x},${BLOCK.y}) 起 ${BLOCK.s}×${BLOCK.s}　` +
			`背景自身起伏 ${base.sd.toFixed(3)} 階（平均亮度 ${base.mean.toFixed(1)}）`,
	);
	console.log('\n強度   整區起伏   第 4 層自己的起伏   比值（判準 ≥1.5）');
	for (const ink of INKS) {
		patch({ ...FIELD, ink, reveal: 0 });
		const png = join(out, `ink-${ink}.png`);
		shoot(png, '?nomotif');
		const all = sigma(png);
		const own = Math.sqrt(Math.max(0, all.sd ** 2 - base.sd ** 2));
		console.log(
			`${String(ink).padStart(5)}${all.sd.toFixed(3).padStart(11)}${own.toFixed(3).padStart(20)}` +
				`${(own / base.sd).toFixed(2).padStart(15)}`,
		);
	}
} finally {
	writeFileSync(file, original);
}
console.log(`\n截圖在 ${out}`);
