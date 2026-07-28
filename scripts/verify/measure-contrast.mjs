/** 比較「有母題」與「沒有母題」兩張純背景截圖：每個文字方框最亮像素的對比各是多少。 */
import { readFileSync } from 'node:fs';
import { readPng } from '../png-read.mjs';
import * as C from '../color-math.mjs';

const [withPng, withoutPng, jsonPath] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(jsonPath, 'utf8'));
const imgs = [readPng(withPng), readPng(withoutPng)];
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
		console.log(`${flag} ${a.toFixed(2)}（無母題 ${b.toFixed(2)}，差 ${drop.toFixed(2)}）  ${e.tag} ${fg} on ${brightest(imgs[0], e)}`);
}
console.log(`\n有母題最壞 ${worst.toFixed(2)}（門檻 4.5）；母題造成的最大降幅 ${worstDrop.toFixed(2)}`);
