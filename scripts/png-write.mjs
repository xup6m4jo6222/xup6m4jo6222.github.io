/**
 * 最小 PNG 編碼器：只做本站產資產需要的事——把一塊 RGB 像素寫成檔。
 * 用 node:zlib，零新相依（與 png-read.mjs 成對）。
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

/** { width, height, rgb: Uint8Array（每像素 3 bytes） } → 8-bit truecolor PNG */
export function writePng(file, { width, height, rgb }) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: truecolor
	// 10–12：compression 0／filter 0／interlace 0，Buffer.alloc 已經是 0

	const raw = Buffer.alloc(height * (width * 3 + 1));
	for (let y = 0; y < height; y++) {
		raw[y * (width * 3 + 1)] = 0; // filter type: none
		Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(
			raw,
			y * (width * 3 + 1) + 1,
		);
	}

	writeFileSync(
		file,
		Buffer.concat([
			Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
			chunk('IHDR', ihdr),
			chunk('IDAT', deflateSync(raw, { level: 9 })),
			chunk('IEND', Buffer.alloc(0)),
		]),
	);
}

/** 從一張大圖裁一塊出來，再以 2×2 盒狀平均縮成一半 */
export function cropAndHalve(src, { x = 0, y = 0, width, height }) {
	const w = width >> 1;
	const h = height >> 1;
	const out = new Uint8Array(w * h * 3);
	for (let j = 0; j < h; j++) {
		for (let i = 0; i < w; i++) {
			for (let c = 0; c < 3; c++) {
				let sum = 0;
				for (let dy = 0; dy < 2; dy++) {
					for (let dx = 0; dx < 2; dx++) {
						const sx = x + i * 2 + dx;
						const sy = y + j * 2 + dy;
						sum += src.rgb[(sy * src.width + sx) * 3 + c];
					}
				}
				out[(j * w + i) * 3 + c] = Math.round(sum / 4);
			}
		}
	}
	return { width: w, height: h, rgb: out };
}
