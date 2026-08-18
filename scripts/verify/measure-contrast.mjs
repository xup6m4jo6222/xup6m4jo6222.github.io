/** 比較「有背景設計」與「沒有背景設計」兩張純背景截圖：每個文字方框最亮像素的對比各是多少。 */
import { readFileSync } from 'node:fs';
import { readPng } from '../png-read.mjs';
import * as C from '../color-math.mjs';

/** 第四個參數是**對照組叫什麼**。預設沿用背景設計那一組；票 02 的對照組是「沒有第 4 層」，
    印成「無背景設計」會讓讀的人以為量的是另一層。 */
const [withPng, withoutPng, jsonPath, control = '背景設計'] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(jsonPath, 'utf8'));
const imgs = [readPng(withPng), readPng(withoutPng)];

/* **方框的座標系必須與圖的座標系是同一個。**無頭 Chrome 的 `--dump-dom` 與 `--screenshot`
   看到的版面視窗**不一樣大**（實測 `--window-size=1280,900` → dump 當下 1262×804、
   拍那一幀 1280×900），畫面在被拍之前重新排了一次版。兩邊沒對齊的話，錨在視窗底部的
   東西整整差 96px，量到的是它上面那片沒有減光的背景——票 04 得到 4.22（真值 5.63）、
   票 02 得到 1.37。那是一個**看起來完全合理的數字**，所以這裡 fail-closed。
   對齊的辦法在 probe-text-boxes.js 的說明，執行版在 measure-field-ink.mjs。 */
for (const [img, name] of [[imgs[0], withPng], [imgs[1], withoutPng]]) {
	if (img.width !== spec.vw || img.height !== spec.vh) {
		console.error(
			`✗ 座標系對不上：方框量在 ${spec.vw}×${spec.vh} 的版面視窗上，` +
				`但 ${name} 是 ${img.width}×${img.height}。這一輪的讀數不算數。`,
		);
		process.exit(2);
	}
}
const brightest = (img, e) => {
	let best = null;
	let bestL = -1;
	for (let y = e.y; y < Math.min(img.height, e.y + e.h); y++) {
		for (let x = e.x; x < Math.min(img.width, e.x + e.w); x++) {
			const i = (y * img.width + x) * 3;
			const hex = C.toHex([img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]]);
			const l = C.relLuminance(hex);
			if (l > bestL) {
				bestL = l;
				best = hex;
			}
		}
	}
	return best;
};

let worst = Infinity;
let worstDrop = 0;
for (const e of spec.els) {
	const fg = C.toHex(e.color.match(/\d+/g).slice(0, 3).map(Number));
	const [a, b] = imgs.map((img) => C.contrast(fg, brightest(img, e)));
	const drop = b - a;
	worst = Math.min(worst, a);
	worstDrop = Math.max(worstDrop, drop);
	const flag = a >= 4.5 ? '✓' : '✗';
	if (a < 4.5 || drop > 0.05)
		console.log(`${flag} ${a.toFixed(2)}（無${control} ${b.toFixed(2)}，差 ${drop.toFixed(2)}）  ${e.tag} ${fg} on ${brightest(imgs[0], e)}`);
}
console.log(`\n有${control}最壞 ${worst.toFixed(2)}（門檻 4.5）；${control}造成的最大降幅 ${worstDrop.toFixed(2)}`);
