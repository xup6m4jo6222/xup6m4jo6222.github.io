/**
 * 最小 PNG 解碼器：只做本站驗證需要的事——把像素顏色數出來。
 * 支援 8/16 bit、color type 0/2/3/4/6、非交錯（本站 21 張圖與 og-card 皆屬此列）。
 * 用 node:zlib，零新相依。
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	return pb <= pc ? b : c;
}

/** 讀 PNG，回傳 { width, height, rgb: Uint8Array（每像素 3 bytes，已對不透明背景做過 alpha 合成前的原色） } */
export function readPng(file, { alphaBackground = [0, 0, 0] } = {}) {
	const buf = readFileSync(file);
	if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`不是 PNG：${file}`);

	let width = 0;
	let height = 0;
	let depth = 8;
	let colorType = 6;
	let interlace = 0;
	let palette = null;
	let paletteAlpha = null;
	const idat = [];

	let off = 8;
	while (off < buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString('ascii', off + 4, off + 8);
		const data = buf.subarray(off + 8, off + 8 + len);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			depth = data[8];
			colorType = data[9];
			interlace = data[12];
		} else if (type === 'PLTE') {
			palette = Buffer.from(data);
		} else if (type === 'tRNS') {
			paletteAlpha = Buffer.from(data);
		} else if (type === 'IDAT') {
			idat.push(Buffer.from(data));
		} else if (type === 'IEND') {
			break;
		}
		off += 12 + len;
	}

	if (interlace !== 0) throw new Error(`不支援交錯 PNG：${file}`);
	if (!(colorType in CHANNELS)) throw new Error(`不支援的 color type ${colorType}：${file}`);
	if (depth !== 8 && depth !== 16) throw new Error(`不支援的位元深度 ${depth}：${file}`);

	const channels = CHANNELS[colorType];
	const bytesPerPixel = Math.max(1, (channels * depth) / 8);
	const rowBytes = Math.ceil((width * channels * depth) / 8);
	const raw = inflateSync(Buffer.concat(idat));

	// 逐列解濾波（就地覆寫，前一列即 out 的前一段）
	const out = Buffer.alloc(height * rowBytes);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (rowBytes + 1)];
		const src = raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
		const cur = out.subarray(y * rowBytes, (y + 1) * rowBytes);
		const prev = y > 0 ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
		for (let x = 0; x < rowBytes; x++) {
			const a = x >= bytesPerPixel ? cur[x - bytesPerPixel] : 0;
			const b = prev ? prev[x] : 0;
			const c = prev && x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
			let v = src[x];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) v += paeth(a, b, c);
			else if (filter !== 0) throw new Error(`未知的列濾波器 ${filter}：${file}`);
			cur[x] = v & 0xff;
		}
	}

	// 攤平成 RGB。半透明像素依 alphaBackground 合成——驗證關心的是「看得到的顏色」。
	const rgb = new Uint8Array(width * height * 3);
	const sampleStride = depth === 16 ? 2 : 1;
	for (let i = 0; i < width * height; i++) {
		const y = Math.floor(i / width);
		const x = i % width;
		const base = y * rowBytes + x * channels * sampleStride;
		const s = (k) => out[base + k * sampleStride]; // 16-bit 取高位元組即可
		let r;
		let g;
		let b;
		let a = 255;
		if (colorType === 0) {
			r = g = b = s(0);
		} else if (colorType === 2) {
			[r, g, b] = [s(0), s(1), s(2)];
		} else if (colorType === 3) {
			const idx = out[y * rowBytes + x];
			r = palette[idx * 3];
			g = palette[idx * 3 + 1];
			b = palette[idx * 3 + 2];
			if (paletteAlpha && idx < paletteAlpha.length) a = paletteAlpha[idx];
		} else if (colorType === 4) {
			r = g = b = s(0);
			a = s(1);
		} else {
			[r, g, b, a] = [s(0), s(1), s(2), s(3)];
		}
		if (a !== 255) {
			const f = a / 255;
			r = Math.round(r * f + alphaBackground[0] * (1 - f));
			g = Math.round(g * f + alphaBackground[1] * (1 - f));
			b = Math.round(b * f + alphaBackground[2] * (1 - f));
		}
		rgb[i * 3] = r;
		rgb[i * 3 + 1] = g;
		rgb[i * 3 + 2] = b;
	}

	return { width, height, rgb };
}

/** 數出每個顏色的像素數，回傳 Map<'#rrggbb', count>，由多到少排序 */
export function countColors(file, opts) {
	const { width, height, rgb } = readPng(file, opts);
	const counts = new Map();
	for (let i = 0; i < width * height; i++) {
		const key = (rgb[i * 3] << 16) | (rgb[i * 3 + 1] << 8) | rgb[i * 3 + 2];
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	const out = new Map();
	for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) {
		out.set(`#${k.toString(16).padStart(6, '0')}`, v);
	}
	return { total: width * height, counts: out };
}
