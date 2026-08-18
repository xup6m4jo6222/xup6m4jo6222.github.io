/**
 * 第 4 層強度的定案量測（背景敘事輪票 02 的「不可跳過」那一條）。
 * 掃幾檔強度，量**文字帶最壞對比**對 4.5。
 *
 *   node scripts/verify/measure-field-ink.mjs <埠> [ink…]
 *
 * 要先 `npm run build`，並另開 `npx astro preview --port <埠>`。
 *
 * 四件事寫在這裡，免得下次又用歪：
 *
 * ① **必須量全開態（`reveal: 1`），不是出貨的表面態。** 出貨停在表面態只是因為浮現的
 *    驅動留給票 03；最壞的一格是存活走到 100% 的那一態，量表面態等於量一個比較容易的
 *    題目。所以這支把產物的 `data-field` 直接改成 `reveal: 1` 再拍——**改屬性就等於
 *    改參數**，那是產物端契約付出來的紅利。
 * ② **量法是「每個文字方框各找該塊最亮的像素」**（`probe-text-boxes.js` ＋
 *    `measure-contrast.mjs`）。本輪原型用「整張圖最亮的 0.1% 像素」代替，抓到的是邊框
 *    與卡片底不是背景，那組數字已判定作廢。
 * ③ **方框與截圖要分兩次跑，而且要先校準。** 無頭 Chrome 的 `--dump-dom` 與
 *    `--screenshot` 看到的版面視窗不一樣大（見 probe-text-boxes.js 的說明）。差值是這台
 *    機器與這版 Chrome 的性質，不寫死——先跑一次拿 `vw`／`vh` 回推，再據此下兩次旗標。
 * ④ 對照組是 `?nofield`（把第 4 層藏起來），所以印出來的「差」就是**這一層自己造成的
 *    降幅**，讀法與背景設計那一組一致。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD } from '../palette-config.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const [port = '4488', ...inks] = process.argv.slice(2);
const INKS = (inks.length ? inks : [String(FIELD.ink)]).map(Number);
const PAGE = 'index.html';
/** 目標版面視窗——所有讀數都在這個尺寸上，方框與截圖都要對齊到它。 */
const TARGET = { w: 1280, h: 900 };

const file = join(ROOT, 'dist', PAGE);
const original = readFileSync(file, 'utf8');
const out = mkdtempSync(join(tmpdir(), 'field-ink-'));

const node = (args) =>
	execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** 跑一次 probe-text-boxes，回傳它吐出來的 JSON（順便可以帶截圖旗標）。 */
const boxes = (size, query = '', extra = []) =>
	JSON.parse(
		node([
			'scripts/verify/dump.mjs', PAGE, 'scripts/verify/probe-text-boxes.js',
			`${size.w}x${size.h}`, port, query, ...extra,
		]).trim(),
	);

/** 把產物裡的 `data-field` 換成指定的參數。改屬性就等於改參數（產物端契約）。 */
const patch = (params) => {
	const json = JSON.stringify(params).replace(/"/g, '&#34;');
	const next = original.replace(/data-field="[^"]*"/, `data-field="${json}"`);
	if (next === original) throw new Error('產物裡找不到 data-field，這一輪不算數');
	writeFileSync(file, next);
};

try {
	// ── 校準：`--window-size` 減掉多少才是 dump 當下的版面視窗 ────────────
	const cal = boxes(TARGET);
	const dx = TARGET.w - cal.vw;
	const dy = TARGET.h - cal.vh;
	const boxSize = { w: TARGET.w + dx, h: TARGET.h + dy };
	console.log(
		`校準：--window-size ${TARGET.w}×${TARGET.h} 時 dump 的版面視窗是 ${cal.vw}×${cal.vh}` +
			`（差 ${dx}／${dy}）→ 量方框改用 ${boxSize.w}×${boxSize.h}`,
	);

	for (const ink of INKS) {
		patch({ ...FIELD, ink, reveal: 1 });

		// 方框：版面視窗校準到 TARGET
		const spec = boxes(boxSize);
		if (spec.vw !== TARGET.w || spec.vh !== TARGET.h) {
			throw new Error(`校準沒有成功：量到 ${spec.vw}×${spec.vh}，要的是 ${TARGET.w}×${TARGET.h}`);
		}
		const specPath = join(out, `ink-${ink}.json`);
		writeFileSync(specPath, JSON.stringify(spec));

		// 截圖：拍那一幀的版面視窗就是 TARGET，所以 --window-size 直接下 TARGET
		const withPng = join(out, `ink-${ink}-with.png`);
		const withoutPng = join(out, `ink-${ink}-without.png`);
		boxes(TARGET, '', [`--screenshot=${withPng}`]);
		boxes(TARGET, '?nofield', [`--screenshot=${withoutPng}`]);

		console.log(`\n══ 第 4 層強度 ${ink}（全開態 reveal=1）`);
		console.log(node(['scripts/verify/measure-contrast.mjs', withPng, withoutPng, specPath, '第 4 層']).trim());
	}
} finally {
	writeFileSync(file, original);
}
console.log(`\n截圖與方框在 ${out}`);
