/**
 * 兩張圖的差，放大之後畫成一張黑底白痕的圖——**「哪裡變了」的直接答案**。
 *
 * 為什麼需要它：這個站的背景很淡（出貨值只有 1.66% 的像素有墨），改前改後並排看
 * 幾乎一樣，而「幾乎一樣」與「完全沒變」在肉眼下是同一件事。相減之後沒變的地方
 * 一律是純黑，變了的地方才亮——看圖的人不必去比對兩張圖的細節。
 *
 * **只對決定性的畫面有意義**：場的種子固定，同尺寸永遠畫出同一張，所以差就是改動
 * 造成的。背景設計的點每次載入重擲，相減出來的是亂數不是改動（用 `?only=field` 拍）。
 *
 *   node scripts/verify/diff-png.mjs <改前.png> <改後.png> <輸出.png> [倍率]
 */
import { readPng } from '../png-read.mjs';
import { writePng } from '../png-write.mjs';

const [a, b, out, amp = '8'] = process.argv.slice(2);
const A = readPng(a);
const B = readPng(b);
if (A.width !== B.width || A.height !== B.height) {
	console.error(`兩張圖尺寸不同：${A.width}×${A.height} vs ${B.width}×${B.height}`);
	process.exit(1);
}

const k = Number(amp);
const rgb = new Uint8Array(A.rgb.length);
let changed = 0;
for (let i = 0; i < A.rgb.length; i += 3) {
	// 三個通道取最大差，避免一個通道變了另兩個沒變時被平均掉
	let d = 0;
	for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(B.rgb[i + c] - A.rgb[i + c]));
	if (d) changed++;
	const v = Math.min(255, d * k);
	rgb[i] = rgb[i + 1] = rgb[i + 2] = v;
}
writePng(out, { width: A.width, height: A.height, rgb });
console.log(
	`差圖寫好 ${out}　倍率 ${k}　有差的像素 ${changed} 個` +
		`（${((changed / (A.width * A.height)) * 100).toFixed(1)}%）`,
);
