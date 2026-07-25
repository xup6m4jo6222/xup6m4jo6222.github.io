/**
 * 色彩數學：sRGB ↔ OKLab/OKLCH、WCAG 對比度、Machado 2009 色盲模擬。
 * 零相依——這些全部是幾十行的公式，裝一包相依進來才是過度工程。
 */

/** '#rgb' / '#rrggbb' / '#rrggbbaa' → [r,g,b,a]，各 0–255（a 預設 255） */
export function parseHex(hex) {
	const h = hex.replace('#', '').toLowerCase();
	const expand = (s) => parseInt(s.length === 1 ? s + s : s, 16);
	if (h.length === 3 || h.length === 4) {
		return [expand(h[0]), expand(h[1]), expand(h[2]), h.length === 4 ? expand(h[3]) : 255];
	}
	if (h.length === 6 || h.length === 8) {
		return [
			parseInt(h.slice(0, 2), 16),
			parseInt(h.slice(2, 4), 16),
			parseInt(h.slice(4, 6), 16),
			h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
		];
	}
	throw new Error(`不是合法的 hex：${hex}`);
}

export function toHex([r, g, b]) {
	const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
	return `#${c(r)}${c(g)}${c(b)}`;
}

/** sRGB 0–255 → 線性 0–1 */
export function toLinear(v) {
	const s = v / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** 線性 0–1 → sRGB 0–255 */
export function fromLinear(v) {
	const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
	return s * 255;
}

/** 線性 RGB（0–1）→ OKLab（Ottosson 2020） */
export function linearToOklab([r, g, b]) {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

/** OKLab → 線性 RGB（0–1，未裁切） */
export function oklabToLinear([L, a, b]) {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

export function hexToOklab(hex) {
	const [r, g, b] = parseHex(hex);
	return linearToOklab([toLinear(r), toLinear(g), toLinear(b)]);
}

/** hex → { L, C, H }，L 為百分數（0–100）、H 為度 */
export function hexToOklch(hex) {
	const [L, a, b] = hexToOklab(hex);
	return {
		L: L * 100,
		C: Math.hypot(a, b),
		H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
	};
}

/** { L(0–100), C, H(度) } → hex（超出色域時裁切，裁切量以 clipped 回報） */
export function oklchToHex({ L, C, H }) {
	const rad = (H * Math.PI) / 180;
	const lin = oklabToLinear([L / 100, C * Math.cos(rad), C * Math.sin(rad)]);
	const clipped = lin.some((v) => v < -0.0005 || v > 1.0005);
	return { hex: toHex(lin.map(fromLinear)), clipped };
}

/** WCAG 2.x 相對亮度 */
export function relLuminance(hex) {
	const [r, g, b] = parseHex(hex);
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x 對比度（1–21） */
export function contrast(fg, bg) {
	const a = relLuminance(fg);
	const b = relLuminance(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 前景以 alpha 疊在背景上的實際渲染色（sRGB 空間合成，與瀏覽器一致） */
export function blend(fg, bg, alpha) {
	const f = parseHex(fg);
	const b = parseHex(bg);
	return toHex([0, 1, 2].map((i) => f[i] * alpha + b[i] * (1 - alpha)));
}

/**
 * Machado, Oliveira & Fernandes 2009 色盲模擬矩陣（severity 1.0），作用於線性 RGB。
 */
const CVD_MATRICES = {
	protan: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deutan: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritan: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

export const CVD_TYPES = Object.keys(CVD_MATRICES);

/** 模擬某一型色盲看到的顏色 */
export function simulateCvd(hex, type) {
	const m = CVD_MATRICES[type];
	if (!m) throw new Error(`未知的色盲類型：${type}`);
	const [r, g, b] = parseHex(hex).slice(0, 3).map(toLinear);
	const out = m.map((row) => Math.max(0, Math.min(1, row[0] * r + row[1] * g + row[2] * b)));
	return toHex(out.map(fromLinear));
}

/** OKLab 空間的歐氏距離 */
export function deltaEok(a, b) {
	const x = hexToOklab(a);
	const y = hexToOklab(b);
	return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** 一對顏色在正常視覺與三型色盲下的最壞 ΔEok */
export function worstDeltaEok(a, b) {
	const per = { normal: deltaEok(a, b) };
	for (const t of CVD_TYPES) per[t] = deltaEok(simulateCvd(a, t), simulateCvd(b, t));
	const worst = Math.min(...Object.values(per));
	return { worst, per };
}
