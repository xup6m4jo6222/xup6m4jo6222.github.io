#!/usr/bin/env node
/**
 * npm run verify:palette — 設計系統的部署前閘門。
 *
 * 讀的是 `astro build` 的產物 `dist/` 與 21 張圖表 PNG，不讀原始碼：
 * 重構 CSS、換 token 分層都不該讓這支腳本失敗。
 *
 * 七類檢查見 SPEC-design-system.md「Testing Decisions」、
 * SPEC-motion-and-shape.md「加進 verify:palette 的第六類檢查」與
 * SPEC-background-and-homepage.md「閘門要補的兩個洞」（票 01 補上第七類）。
 *
 * ── 這道閘門守得到什麼、守不到什麼（請不要過度信任它）────────────────────
 *
 * 它守的是**無心的漂移**：某個值被順手改掉、某個新元件忘了對齊判準、某張圖忘了
 * 重跑。三輪抗辯裡被實測證明會漏的每一種漂移，都已經在 verify-selftest.mjs
 * 變成一個會紅的例子。
 *
 * 它守不住**存心繞路的作者**，而且結構上守不住：這支腳本是掃產物的 CSS 文字，
 * 不是跑一個瀏覽器。已知且刻意不追的繞路（抗辯實測過）：
 *   · `-webkit-text-fill-color`、`filter: brightness()` 之類會改變最終文字顏色，
 *     但不叫 `color` 的屬性
 *   · 把 `opacity` 拆到父層規則上（守衛要求同一條規則同時有 color 與 opacity）
 *   · 在 `@media` 或 `body` 上重新宣告自訂屬性——這裡的 var 解析沒有層疊概念
 *   · `color-mix()` 之類無法靜態求值的底色
 *
 * 票 01 把觀察範圍擴到產物 JS 之後，多了三條同樣誠實的邊界：
 *   · **常駐動態只認「具名函式自己排自己」**。匿名遞迴的 `requestAnimationFrame(() => …)`、
 *     或改用 `setInterval` 逐幀繪製，都在這個結構之外，抓不到
 *   · **「有降低動態偏好的分支」的證明只到「同一個檔案裡出現 prefers-reduced-motion」**。
 *     它不保證那個分支真的把動態關掉——那要跑瀏覽器才驗得到
 *   · **母題比對的是 `data-motif` 與判準檔**。canvas 裡實際畫出來的像素不在觀察範圍內；
 *     繪製程式若不從那個屬性取值而是另外寫一份數字，這一項看不見。
 *     （「屬性根本不出現」這條已經堵上：有常駐迴圈卻沒有 `data-motif` 會紅）
 *   · **切函式身體用的是 CSS 那支括號配對**。它認得字串與區塊註解，但不認得
 *     樣板字面與正則字面裡的大括號；那種寫法會讓身體的範圍抓錯
 *
 * 要蓋掉這些得跑真的瀏覽器去取樣渲染結果，那是另一個量級的工具。
 * 在那之前，這一段就是這道閘門的誠實邊界——**綠燈的意思是「沒有漂移」，
 * 不是「不可能有問題」。**
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from './color-math.mjs';
import { countColors, readPng } from './png-read.mjs';
import * as CFG from './palette-config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// VERIFY_DIST 讓 verify-selftest.mjs 拿注入缺陷的產物副本來跑，不動真的 dist/
const DIST = process.env.VERIFY_DIST || join(ROOT, 'dist');
const CHART_DIR = join(ROOT, 'public', 'images', 'taiwan-tourism');

// ---------------------------------------------------------------------------
// 回報
// ---------------------------------------------------------------------------
const failures = [];
const notes = [];
const excepted = [];
const usedExceptions = new Set();

const seenFailures = new Set();

function fail(check, key, detail) {
	if (seenFailures.has(`${check}::${key}`)) return; // 同一個值只報一次
	seenFailures.add(`${check}::${key}`);
	const hit = (CFG.EXCEPTIONS[check] || []).find((e) => e.key === key);
	if (hit) {
		usedExceptions.add(`${check}::${key}`);
		excepted.push({ check, key, detail, reason: hit.reason, clearedBy: hit.clearedBy });
		return;
	}
	failures.push({ check, key, detail });
}

const note = (text) => notes.push(text);

// ---------------------------------------------------------------------------
// 檔案蒐集
// ---------------------------------------------------------------------------
function walk(dir, acc = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) walk(p, acc);
		else acc.push(p);
	}
	return acc;
}

const isProcessPage = (f) => relative(DIST, f).split(sep)[0] === 'process';

// ---------------------------------------------------------------------------
// 極簡 CSS 解析：夠用就好，只要能拿到「選擇器 → 宣告」與 at-rule 脈絡。
// ---------------------------------------------------------------------------
function matchBrace(src, open) {
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		const ch = src[i];
		if (ch === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			if (end < 0) break; // 未閉合的註解：不要讓 -1 把索引倒退回去變成無限迴圈
			i = end + 1;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const q = ch;
			i++;
			while (i < src.length && src[i] !== q) i += src[i] === '\\' ? 2 : 1;
			continue;
		}
		if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) return i;
	}
	return src.length;
}

/** 依頂層分隔字元切開（略過括號、字串、註解內的分隔字元） */
function splitTop(src, sepChar) {
	const out = [];
	let depth = 0;
	let buf = '';
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (ch === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			if (end < 0) break; // 未閉合的註解：不要讓 -1 把索引倒退回去變成無限迴圈
			i = end + 1;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const q = ch;
			let j = i + 1;
			while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
			buf += src.slice(i, j + 1);
			i = j;
			continue;
		}
		if (ch === '(' || ch === '[') depth++;
		else if (ch === ')' || ch === ']') depth--;
		if (ch === sepChar && depth === 0) {
			out.push(buf);
			buf = '';
			continue;
		}
		buf += ch;
	}
	out.push(buf);
	return out.map((s) => s.trim()).filter(Boolean);
}

function parseDeclarations(body) {
	return splitTop(body, ';')
		.map((d) => {
			const i = d.indexOf(':');
			if (i < 0) return null;
			return { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim() };
		})
		.filter(Boolean);
}

/** → { rules: [{selectors, decls, at, source}], keyframes: Map<name, body> } */
function parseCss(src, source) {
	const rules = [];
	const keyframes = new Map();

	(function scan(text, at) {
		let i = 0;
		let buf = '';
		while (i < text.length) {
			const ch = text[i];
			if (ch === '/' && text[i + 1] === '*') {
				const end = text.indexOf('*/', i + 2);
				if (end < 0) break; // 未閉合的註解：不要讓 -1 把索引倒退回去變成無限迴圈
				i = end + 2;
				continue;
			}
			if (ch === '"' || ch === "'") {
				const q = ch;
				let j = i + 1;
				while (j < text.length && text[j] !== q) j += text[j] === '\\' ? 2 : 1;
				buf += text.slice(i, j + 1);
				i = j + 1;
				continue;
			}
			if (ch === ';' && buf.trimStart().startsWith('@')) {
				buf = '';
				i++;
				continue;
			}
			if (ch === '{') {
				const prelude = buf.trim();
				buf = '';
				const close = matchBrace(text, i);
				const body = text.slice(i + 1, close);
				if (prelude.startsWith('@')) {
					if (/^@(-\w+-)?keyframes\b/.test(prelude)) {
						keyframes.set(prelude.replace(/^@(-\w+-)?keyframes\s+/, '').trim(), body);
					} else {
						scan(body, [...at, prelude]);
					}
				} else if (/[{}]/.test(body)) {
					// 巢狀規則：先取自己的宣告，再往下掃
					const own = body.replace(/[^{}]*\{[\s\S]*?\}/g, '');
					rules.push({ selectors: splitTop(prelude, ','), decls: parseDeclarations(own), at, source });
					scan(body, at);
				} else {
					rules.push({ selectors: splitTop(prelude, ','), decls: parseDeclarations(body), at, source });
				}
				i = close + 1;
				continue;
			}
			if (ch === '}') {
				i++;
				buf = '';
				continue;
			}
			buf += ch;
			i++;
		}
	})(src, []);

	return { rules, keyframes };
}

// ---------------------------------------------------------------------------
// 值的正規化
// ---------------------------------------------------------------------------
function normalizeColor(raw) {
	const t = raw.trim().toLowerCase();
	const hex = t.match(/^#([0-9a-f]{3,8})$/);
	if (hex) {
		let h = hex[1];
		if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
		return `#${h}`.replace(/ff$/, (m, o, s) => (s.length === 9 ? '' : m));
	}
	const fn = t.match(/^rgba?\(([^)]*)\)$/);
	if (fn) {
		const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
		const n = parts.slice(0, 3).map((v) => Math.round(v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v)));
		const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
		const hexOf = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
		return `#${n.map(hexOf).join('')}${a >= 1 ? '' : hexOf(Math.round(a * 255))}`;
	}
	return null;
}

/** hex（可能帶 alpha）→ 不含 alpha 的 6 碼 */
const opaque = (hex) => (hex.length === 9 ? hex.slice(0, 7) : hex);

/** 解析 `:root` 的自訂屬性，供 var() 解析 */
function collectRootVars(rules) {
	const vars = new Map();
	for (const r of rules) {
		if (!r.selectors.some((s) => s === ':root' || s === 'html' || s === ':root,html')) continue;
		for (const d of r.decls) if (d.prop.startsWith('--')) vars.set(d.prop, d.value);
	}
	return vars;
}

function resolveVars(value, vars, depth = 0) {
	if (depth > 8 || !value.includes('var(')) return value;
	const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g, (m, name, fallback) =>
		vars.has(name) ? vars.get(name) : (fallback ?? m).trim(),
	);
	return out === value ? out : resolveVars(out, vars, depth + 1);
}

/** 長度字串 → px（1rem = 16px；無法靜態求值回傳 null） */
function toPx(raw) {
	const t = raw.trim().toLowerCase();
	if (t === '0') return 0;
	const m = t.match(/^(-?[\d.]+)(rem|em|px)$/);
	if (m) return parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16);
	const calc = t.match(/^calc\((.*)\)$/s);
	if (calc) return evalCalc(calc[1]);
	return null;
}

/** 只支援 + - * / 與括號的極簡求值器（夠應付 calc(var(--rhythm) * 2)） */
function evalCalc(expr) {
	const tokens = expr.match(/(-?[\d.]+(?:rem|em|px)?|[()+\-*/])/g);
	if (!tokens) return null;
	let pos = 0;
	const peek = () => tokens[pos];
	function primary() {
		if (peek() === '(') {
			pos++;
			const v = sum();
			pos++;
			return v;
		}
		const t = tokens[pos++];
		if (t === '-') return -primary();
		const n = parseFloat(t);
		if (Number.isNaN(n)) return null;
		return /rem|em$/.test(t) ? n * 16 : n;
	}
	function product() {
		let v = primary();
		while (peek() === '*' || peek() === '/') {
			const op = tokens[pos++];
			const r = primary();
			if (v === null || r === null) return null;
			v = op === '*' ? v * r : v / r;
		}
		return v;
	}
	function sum() {
		let v = product();
		while (peek() === '+' || peek() === '-') {
			const op = tokens[pos++];
			const r = product();
			if (v === null || r === null) return null;
			v = op === '+' ? v + r : v - r;
		}
		return v;
	}
	const result = sum();
	return pos === tokens.length ? result : null;
}

const nearly = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

// ===========================================================================
// 檢查 1 — 色碼白名單
// ===========================================================================
function checkColorWhitelist(textFiles, allowedCss) {
	for (const file of textFiles) {
		const text = readFileSync(file, 'utf8');
		const rel = relative(ROOT, file);
		const seen = new Set();
		for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g)) {
			const norm = normalizeColor(m[0]);
			if (!norm) {
				// 白名單是一張 hex 字面清單。用另一種色彩函式寫同一個顏色，等於繞過字面比對——
				// 就算值相等也不放行，否則「掃字串比對白名單」這件事本身就沒有意義了。
				// **`/process/` 九頁不套這條新規則**：那是標了日期的歷史存檔（CLAUDE.md 換色協議），
				// 今天新增的規則不該回頭套到凍結的檔案上。
				if (/^(hsla?|oklch)\(/i.test(m[0]) && !seen.has(m[0]) && !isProcessPage(file)) {
					seen.add(m[0]);
					fail('colors', `${m[0]} @ ${rel}`, '顏色不得以 hsl()／oklch() 書寫——白名單是 hex 字面清單');
				}
				continue;
			}
			if (seen.has(norm)) continue;
			seen.add(norm);
			if (!allowedCss.has(norm)) fail('colors', `${norm} @ ${rel}`, `產物出現不在白名單上的顏色 ${m[0]}`);
		}
	}
}

/**
 * 白名單本身也要受管：網站自己的色必須落在中性階上，或是凍結色的透明度衍生。
 * 這一項才是「值在無人察覺的情況下擴散」的真正防線——白名單只擋新色，這裡擋舊色賴著不走。
 */
function checkSiteColorsOnRamp() {
	const ramp = new Set(Object.values(CFG.NEUTRAL_RAMP));
	const frozen = new Set([CFG.NEUTRAL_RAMP[50], '#7998c3']);
	for (const [hex, why] of Object.entries(CFG.SITE_PALETTE)) {
		const norm = normalizeColor(hex);
		if (norm.length === 9 && norm.endsWith('00')) continue; // 全透明（transparent 的縮寫）不是顏色選擇
		const base = opaque(norm);
		if (norm.length > 7 && frozen.has(base)) continue; // 凍結色的透明度衍生
		if (ramp.has(base) || base === '#7998c3') continue;
		const { L } = C.hexToOklch(base);
		fail('offramp', hex, `${why}：L=${L.toFixed(1)}，不在中性階的任何一階上`);
	}
	for (const [hex, why] of Object.entries(CFG.PNG_LEGACY)) {
		fail('pnglegacy', hex, `${why}：舊圖表色仍在 PNG 白名單上`);
	}
}

function checkChartPixels() {
	if (!existsSync(CHART_DIR)) {
		fail('colors', 'charts-missing', `找不到圖表目錄 ${CHART_DIR}`);
		return;
	}
	const files = readdirSync(CHART_DIR).filter((f) => f.endsWith('.png'));
	const endpoints = Object.keys(CFG.PNG_PALETTE).map((h) => C.parseHex(h).slice(0, 3));
	const bg = C.parseHex(CFG.NEUTRAL_RAMP[50]).slice(0, 3);

	/** 到「任兩個白名單端點連線」的最短距離（sRGB 各通道最大差） */
	function segmentDistance(p) {
		let best = Infinity;
		for (let i = 0; i < endpoints.length; i++) {
			for (let j = i; j < endpoints.length; j++) {
				const a = endpoints[i];
				const b = endpoints[j];
				const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
				const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
				let t = len2 === 0 ? 0 : ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / len2;
				t = Math.max(0, Math.min(1, t));
				const dist = Math.max(...[0, 1, 2].map((k) => Math.abs(p[k] - (a[k] + t * d[k]))));
				if (dist < best) best = dist;
			}
		}
		return best;
	}

	let checked = 0;
	for (const name of files) {
		const { total, counts } = countColors(join(CHART_DIR, name), { alphaBackground: bg });
		const floor = total * CFG.PNG_MIN_PIXEL_RATIO;
		for (const [hex, n] of counts) {
			if (n < floor) continue;
			checked++;
			const dist = segmentDistance(C.parseHex(hex).slice(0, 3));
			if (dist > CFG.PNG_SEGMENT_TOLERANCE) {
				fail(
					'colors',
					`${hex} @ ${name}`,
					`圖表像素顏色不在白名單、也不落在任兩個白名單色的連線上（距離 ${dist.toFixed(1)}／容差 ${CFG.PNG_SEGMENT_TOLERANCE}，佔 ${((100 * n) / total).toFixed(2)}%）`,
				);
			}
		}
	}
	note(`圖表 PNG：${files.length} 張、主要顏色 ${checked} 個（門檻 ${CFG.PNG_MIN_PIXEL_RATIO * 100}% 像素）已逐一比對`);
	if (files.length !== 21) note(`⚠ 圖表張數為 ${files.length}，判準寫的是 21 張`);
}

// ===========================================================================
// 檢查 2 — 對比度（含「opacity 不得表達文字層級」）
// ===========================================================================
/**
 * 表面規格 → 實際渲染色。支援兩層合成：
 *   `bloom:<色>@<alpha>/<底>`  背景漸層疊在頁底上（radial 的 0% stop 不透明）
 *   `grain:<材質灰階>/<底>`     顆粒層，soft-light ＋ 17%
 */
function resolveSurface(spec, vars) {
	const grain = spec.match(/^grain:(\d+)\/(.+)$/s);
	if (grain) {
		const base = resolveSurface(grain[2], vars);
		return base && C.applyGrain(opaque(base), Number(grain[1]), CFG.GRAIN.alpha);
	}
	const bloom = spec.match(/^bloom:(.+)@([\d.]+)\/(.+)$/s);
	if (bloom) {
		const over = normalizeColor(resolveVars(bloom[1], vars));
		const base = normalizeColor(resolveVars(bloom[3], vars));
		return over && base ? C.blend(opaque(over), opaque(base), Number(bloom[2])) : null;
	}
	return normalizeColor(resolveVars(spec, vars));
}

/**
 * 顆粒層的模型端點必須與材質檔本身對得上。
 * 沒有這道核對，材質哪天被換掉或重生成，「量的是渲染值」就悄悄變回一句空話——
 * 而那正是這整支腳本要修的 failure mode。
 */
function checkGrainModel() {
	const file = join(ROOT, CFG.GRAIN.texture);
	if (!existsSync(file)) {
		fail('grain', CFG.GRAIN.texture, '找不到顆粒材質，背景的渲染值模型失去依據');
		return;
	}
	const { width, height, rgb } = readPng(file);
	let lo = 255;
	let hi = 0;
	for (let i = 0; i < width * height; i++) {
		const v = (rgb[i * 3] + rgb[i * 3 + 1] + rgb[i * 3 + 2]) / 3;
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}
	note(`顆粒材質 ${width}×${height}　實測極值 ${lo.toFixed(0)}–${hi.toFixed(0)}　模型用 ${CFG.GRAIN.low}–${CFG.GRAIN.high}`);
	if (Math.round(lo) !== CFG.GRAIN.low || Math.round(hi) !== CFG.GRAIN.high) {
		fail(
			'grain',
			'端點與材質不符',
			`材質實測極值 ${lo.toFixed(0)}–${hi.toFixed(0)}，判準寫的是 ${CFG.GRAIN.low}–${CFG.GRAIN.high}——背景的渲染值模型已與實物脫節`,
		);
	}
}

/** 找出某個選擇器實際宣告的顏色（取最後一條，即層疊後勝出的那個） */
function declaredValue(siteRules, selector, props, vars) {
	let found = null;
	for (const rule of siteRules) {
		if (rule.at.length) continue; // 媒體查詢內的覆蓋不算基準態
		if (!rule.selectors.includes(selector)) continue;
		for (const d of rule.decls) {
			if (!props.includes(d.prop)) continue;
			// background 簡寫可以有多層，底色是最後一層（.tl-solo 就是漸層＋底色兩層）
			const layers = splitTop(resolveVars(d.value, vars), ',');
			const last = layers[layers.length - 1] ?? '';
			for (const token of last.trim().split(/\s+/)) {
				const hex = normalizeColor(token);
				if (hex) {
					found = opaque(hex);
					break;
				}
			}
		}
	}
	return found;
}

function checkContrast(vars, siteRules) {
	const declaredFg = new Set();
	const claimedSelectors = new Set();

	for (const pair of CFG.CONTRAST_PAIRS) {
		const fg = resolveSurface(pair.fg, vars);
		if (!fg) {
			fail('contrast', `${pair.fg} 無法解析`, `無法解析前景色值（${pair.where}）`);
			continue;
		}
		const min = pair.min ?? CFG.CONTRAST_MIN;
		/**
		 * 認領有兩種強度，混在一起就是漏洞：
		 *   **無條件**——配對的背景是頁面表面，代表這個顏色疊在頁上到處都安全。
		 *   **限定選擇器**——配對的背景是某個元件的底，那它只在那幾條規則上安全。
		 * 早期版本把兩者混為一談，於是「深字反白」那組把頁底色登記成合法文字色，
		 * 誰在別處寫 `color: var(--color-bg)` 都會過——實際對比 1.00，隱形字。
		 */
		if (min === CFG.CONTRAST_MIN) {
			if (pair.bgs === CFG.PAGE_SURFACES) declaredFg.add(opaque(fg));
			else for (const s of pair.fgOn ?? []) claimedSelectors.add(s);
		}

		// 一組配對可以有多個背景狀態（漸層 × 顆粒）。全部量，只回報最壞的那個——
		// 報九行只是噪音，但少量八個就得假設「前景一定比背景亮」這個會過期的前提。
		const specs = pair.bgs ?? [pair.bg];
		let worst = null;
		for (const spec of specs) {
			const bg = resolveSurface(spec.bg ?? spec, vars);
			if (!bg) {
				fail('contrast', `${spec.bg ?? spec} 無法解析`, `無法解析背景色值（${pair.where}）`);
				continue;
			}
			const ratio = C.contrast(opaque(fg), opaque(bg));
			if (!worst || ratio < worst.ratio) worst = { ratio, bg: opaque(bg), label: spec.label ?? '' };
		}
		if (!worst) continue;

		const label = `${opaque(fg)} on ${worst.bg}`;
		note(
			`對比 ${worst.ratio.toFixed(2)}（門檻 ${min}）　${label}　${pair.where}` +
				(specs.length > 1 ? `　← ${specs.length} 種背景狀態裡最壞的：${worst.label}` : ''),
		);
		if (worst.ratio < min) {
			fail(
				'contrast',
				`${label} ＜${min}`,
				`${pair.where}：最壞情況（${worst.label || '單一背景'}）實測 ${worst.ratio.toFixed(2)}，低於 ${min}`,
			);
		}

		// 兩端釘到真的選擇器：配對說「誰疊在誰上面」，這裡驗產物真的是那樣接的。
		for (const sel of pair.fgOn ?? []) {
			const got = declaredValue(siteRules, sel, ['color'], vars);
			if (got !== opaque(fg)) {
				fail(
					'contrast',
					`${sel} 的文字色`,
					`${pair.where}：判準說 ${sel} 的文字色是 ${opaque(fg)}，產物是 ${got ?? '（找不到這條規則）'}`,
				);
			}
		}
		if (pair.bgOn) {
			const bgHex = resolveSurface(pair.bg, vars);
			const got = declaredValue(siteRules, pair.bgOn, ['background-color', 'background'], vars);
			if (bgHex && got !== opaque(bgHex)) {
				fail(
					'contrast',
					`${pair.bgOn} 的底色`,
					`${pair.where}：判準說 ${pair.bgOn} 的底是 ${opaque(bgHex)}，產物是 ${got ?? '（找不到這條規則）'}`,
				);
			}
		}
	}

	/**
	 * 上面那一段驗的是「判準宣告的配對」，驗不到「產物實際把哪個顏色當文字用」。
	 * 只有前者的話，把某條規則的 color 換成一個沒人管的階，閘門照樣綠——
	 * 這一段就是那個漏洞的補丁：**產物裡每一個當文字用的顏色，都必須被某一組配對認領。**
	 */
	for (const rule of siteRules) {
		for (const d of rule.decls) {
			if (d.prop !== 'color') continue;
			const hex = normalizeColor(resolveVars(d.value, vars));
			if (!hex) continue; // color-mix()／currentColor／inherit 等無法靜態求值
			if (hex.length === 9 && hex.endsWith('00')) continue;
			// 半透明的文字色＝宣告值不等於渲染值，與 opacity 當層級用是同一件事
			if (hex.length === 9) {
				fail(
					'contrast',
					`半透明文字色 ${hex}`,
					`${rule.selectors.join(', ')} 的文字色帶 alpha，實際渲染會與底色混色——對比度量不到真的東西`,
				);
				continue;
			}
			if (declaredFg.has(hex)) continue;
			if (rule.selectors.some((s) => claimedSelectors.has(s))) continue;
			fail(
				'contrast',
				`未認領的文字色 ${hex}`,
				`${rule.selectors.join(', ')} 用 ${d.value} 當文字色，但 CONTRAST_PAIRS 裡沒有任何一組在管它`,
			);
		}
	}
}

function checkOpacityNotLevel(siteRules) {
	for (const rule of siteRules) {
		const decls = Object.fromEntries(rule.decls.map((d) => [d.prop, d.value]));
		if (!('opacity' in decls) || !('color' in decls)) continue;
		// opacity: 0 是「顯隱」，合規；0 與 1 之間才是拿透明度當層級用
		const alpha = parseFloat(decls.opacity);
		if (!(alpha > 0 && alpha < 1)) continue;
		const key = rule.selectors.join(', ');
		fail(
			'opacity',
			key,
			`同一條規則同時設 color 與 opacity: ${decls.opacity}——實際渲染色偏離宣告值，對比度檢查量不到真的東西`,
		);
	}
}

// ===========================================================================
// 檢查 3 — 色盲安全
// ===========================================================================
function checkColorVision() {
	const list = CFG.CATEGORICAL;
	for (let i = 0; i < list.length; i++) {
		for (let j = i + 1; j < list.length; j++) {
			const { worst, per } = C.worstDeltaEok(list[i], list[j]);
			const detail = Object.entries(per)
				.map(([k, v]) => `${k} ${v.toFixed(3)}`)
				.join('　');
			note(`類別色 ${list[i]} / ${list[j]}：最壞 ΔEok ${worst.toFixed(3)}（${detail}）`);
			if (worst < CFG.CVD_MIN_DELTA_EOK) {
				fail(
					'colorvision',
					`${list[i]}/${list[j]}`,
					`最壞 ΔEok ${worst.toFixed(3)} < ${CFG.CVD_MIN_DELTA_EOK}（${detail}）`,
				);
			}
		}
	}
}

// ===========================================================================
// 檢查 4 — 色階規律
// ===========================================================================
function checkRamps(vars) {
	const steps = Object.keys(CFG.RAMP_SPEC)
		.map(Number)
		.sort((a, b) => a - b);
	const R = CFG.RAMP_RULES;

	// (a) 推導參數本身要合規：ΔL 等距、C 隨 L 線性遞減
	for (let i = 1; i < steps.length; i++) {
		const d = CFG.RAMP_SPEC[steps[i]].L - CFG.RAMP_SPEC[steps[i - 1]].L;
		if (!nearly(d, R.deltaL, R.deltaLTolerance)) {
			fail('ramp', `ΔL ${steps[i - 1]}→${steps[i]}`, `ΔL=${d.toFixed(2)}，超出 ${R.deltaL}±${R.deltaLTolerance}`);
		}
		if (CFG.RAMP_SPEC[steps[i]].C >= CFG.RAMP_SPEC[steps[i - 1]].C) {
			fail(
				'ramp',
				`C ${steps[i - 1]}→${steps[i]}`,
				`C 未單調遞減：${CFG.RAMP_SPEC[steps[i - 1]].C} → ${CFG.RAMP_SPEC[steps[i]].C}`,
			);
		}
	}
	steps.forEach((s, i) => {
		const want = R.chromaEnds[0] + ((R.chromaEnds[1] - R.chromaEnds[0]) * i) / (steps.length - 1);
		if (Math.abs(CFG.RAMP_SPEC[s].C - want) > R.chromaTolerance) {
			fail('ramp', `C 線性 ${s}`, `C=${CFG.RAMP_SPEC[s].C}，線性內插應為 ${want.toFixed(4)}`);
		}
	});

	// (b) 列出的 hex 必須就是那組參數的公式值
	for (const s of steps) {
		const spec = CFG.RAMP_SPEC[s];
		const hex = CFG.NEUTRAL_RAMP[s];
		const formula = C.oklchToHex({ L: spec.L, C: spec.C, H: R.hue }).hex;
		const d = C.deltaEok(hex, formula);
		const limit = spec.anchor ? R.anchorDeltaEok : R.formulaDeltaEok;
		note(
			`階 ${s} ${hex}　公式值 ${formula}　ΔEok ${d.toFixed(4)}${spec.anchor ? `（錨點：${spec.anchor}）` : ''}　對背景對比 ${C.contrast(hex, CFG.NEUTRAL_RAMP[50]).toFixed(2)}`,
		);
		if (d > limit) fail('ramp', `階 ${s}`, `${hex} 與公式值 ${formula} 的 ΔEok ${d.toFixed(4)} 超過 ${limit}`);
	}

	// 產物裡若已有 --n-* token，值必須與判準一致（票 02 起有牙齒）
	let wired = 0;
	for (const [name, value] of vars) {
		const m = name.match(/^--n-(\d+)$/);
		if (!m) continue;
		wired++;
		const want = CFG.NEUTRAL_RAMP[Number(m[1])];
		const got = normalizeColor(value);
		if (!want) fail('ramp', name, `產物有判準沒有的階 ${name}`);
		else if (got !== want) fail('ramp', name, `產物為 ${got}，判準為 ${want}`);
	}
	note(wired ? `產物已接上 ${wired} 個中性階 token` : '產物尚未接上 --n-* token（票 02 之前的正常狀態）');

	// 連續色帶：L 單調遞增、步距等距
	const bandL = CFG.SEQUENTIAL.map((h) => C.hexToOklch(h).L);
	const gaps = bandL.slice(1).map((v, i) => v - bandL[i]);
	const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	note(`連續色帶 L：${bandL.map((v) => v.toFixed(1)).join(' → ')}（步距 ${gaps.map((v) => v.toFixed(1)).join('／')}）`);
	gaps.forEach((g, i) => {
		if (g <= 0) fail('ramp', `band ${i}`, `色帶 L 未單調遞增（步距 ${g.toFixed(2)}）`);
		else if (Math.abs(g - mean) > CFG.SEQUENTIAL_STEP_TOLERANCE) {
			fail('ramp', `band ${i}`, `色帶步距 ${g.toFixed(2)} 與平均 ${mean.toFixed(2)} 相差超過 ${CFG.SEQUENTIAL_STEP_TOLERANCE}`);
		}
	});

	// 示意色：色相自由，L/C/對比受限
	const bg = CFG.NEUTRAL_RAMP[50];
	for (const [hex, where] of Object.entries(CFG.ILLUSTRATIVE_PALETTE)) {
		const { L, C: chroma } = C.hexToOklch(hex);
		const ratio = C.contrast(hex, bg);
		const R = CFG.ILLUSTRATIVE_RULES;
		const problems = [];
		if (L < R.minL - R.lTolerance || L > R.maxL + R.lTolerance) problems.push(`L=${L.toFixed(1)} 不在 600–700 區`);
		if (chroma > R.maxC + R.cTolerance) problems.push(`C=${chroma.toFixed(4)} > ${R.maxC}`);
		if (ratio < CFG.ILLUSTRATIVE_RULES.minContrast) problems.push(`對比 ${ratio.toFixed(2)} < ${CFG.ILLUSTRATIVE_RULES.minContrast}`);
		if (problems.length) fail('illustrative', hex, `${where}：${problems.join('；')}`);
	}
}

// ===========================================================================
// 檢查 5 — 排版與間距規律
// ===========================================================================
function fontSizeAllowed(value, vars) {
	const resolved = resolveVars(value, vars).trim().toLowerCase();
	const ends = [];
	const clamp = resolved.match(/^clamp\((.*)\)$/s);
	if (clamp) {
		const parts = splitTop(clamp[1], ',');
		ends.push(parts[0], parts[parts.length - 1]);
	} else {
		ends.push(resolved);
	}
	return ends.every((end) => {
		const px = toPx(end);
		if (px === null) return true; // 無法靜態求值（vw 等）不追究
		// 容差只留給三位小數 rem 的進位誤差——不是給「剛好很接近某一階」的手挑值
		return CFG.TYPE_SCALE.some((s) => nearly(px, s.mobile * 16, 0.05) || nearly(px, s.desktop * 16, 0.05));
	});
}

function spacingAllowed(px) {
	if (px === 0) return true;
	const abs = Math.abs(px);
	return (
		CFG.LAYOUT_MULTIPLES.some((m) => nearly(abs, m * CFG.RHYTHM_BASE_REM * 16, 0.4)) ||
		CFG.COMPONENT_SPACING_PX.some((m) => nearly(abs, m, 0.4))
	);
}

function checkTypographyAndSpacing(siteRules, vars) {
	for (const rule of siteRules) {
		const where = rule.selectors.join(', ') || rule.at.join(' ');
		const decls = rule.decls;
		const has = (p) => decls.some((d) => d.prop === p);

		for (const d of decls) {
			if (d.prop === 'font-size') {
				const v = resolveVars(d.value, vars).trim();
				if (!fontSizeAllowed(v, vars)) {
					fail('typography', `字級 ${v}`, `字級 ${v} 不在九階（含 clamp 兩端）內（例：${where}）`);
				}
				if (!has('line-height') && !has('font')) {
					fail('typography', `缺 line-height：${where}`, '設了 font-size 卻沒有同時設 line-height');
				}
			}
			if (d.prop === 'font-weight') {
				const v = resolveVars(d.value, vars).trim();
				if (!CFG.ALLOWED_FONT_WEIGHTS.includes(v)) {
					fail('typography', `字重 ${v}`, `字重 ${v} 不在載入清單（Sans 400/500、Serif 400/600）內（例：${where}）`);
				}
			}
			if (d.prop === 'letter-spacing') {
				const v = resolveVars(d.value, vars).trim();
				const num = parseFloat(v);
				const ok = CFG.ALLOWED_LETTER_SPACING.some((a) =>
					Number.isNaN(parseFloat(a)) ? a === v : nearly(parseFloat(a), num, 0.0005) && /em$/.test(v) === /em$/.test(a),
				);
				if (!ok) fail('typography', `字距 ${v}`, `字距 ${v} 不在三檔（0／.06em／.04em）內（例：${where}）`);
			}
			if (CFG.SPACING_PROPERTIES.includes(d.prop)) {
				const resolved = resolveVars(d.value, vars);
				for (const part of splitTop(resolved.replace(/\s+/g, ' '), ' ')) {
					const clamp = part.match(/^clamp\((.*)\)$/is);
					const candidates = clamp ? [splitTop(clamp[1], ',')[0], splitTop(clamp[1], ',').at(-1)] : [part];
					for (const cand of candidates) {
						const px = toPx(cand);
						if (px === null) continue; // auto／vw／%／無法靜態求值
						if (!spacingAllowed(px)) {
							fail(
								'spacing',
								`間距 ${px.toFixed(1)}px`,
								`${cand}（${px.toFixed(1)}px）不在版面節奏倍數或元件內階梯上（例：${d.prop} @ ${where}）`,
							);
						}
					}
				}
			}
		}
	}
}

// ===========================================================================
// 檢查 6 — 降低動態偏好覆蓋（不得有例外：可及性是硬下限）
// ===========================================================================
const REDUCE_RE = /prefers-reduced-motion\s*:\s*reduce/;
const MOVING_RE = /\b(transform|filter|all)\b/;

function checkReducedMotion(siteParsed) {
	const covered = new Set();
	const inScope = new Map(); // selector → 原因

	for (const { rules, keyframes } of siteParsed) {
		const movingKeyframes = new Set(
			[...keyframes].filter(([, body]) => /\b(transform|filter)\s*:/.test(body)).map(([name]) => name),
		);

		for (const rule of rules) {
			const reduced = rule.at.some((a) => REDUCE_RE.test(a));
			for (const sel of rule.selectors) {
				const key = sel.replace(/\s+/g, ' ').trim();
				if (reduced) {
					covered.add(key);
					continue;
				}
				for (const d of rule.decls) {
					if (/^transition(-property)?$/.test(d.prop) && MOVING_RE.test(d.value)) {
						inScope.set(key, `transition 涉及 ${d.value.match(MOVING_RE)[0]}`);
					}
					if (/^animation(-name)?$/.test(d.prop)) {
						const hit = [...movingKeyframes].find((n) => new RegExp(`(^|[\\s,])${n}([\\s,]|$)`).test(d.value));
						if (hit) inScope.set(key, `animation ${hit} 的 keyframes 動到 transform／filter`);
					}
				}
			}
		}
	}

	for (const [sel, why] of inScope) {
		if (!covered.has(sel)) {
			// 第 6 類不吃例外清單，直接進 failures
			failures.push({
				check: 'reduced-motion',
				key: sel,
				detail: `${why}，但未出現在 @media (prefers-reduced-motion: reduce) 區塊內`,
			});
		}
	}
	note(`降低動態偏好：${inScope.size} 個會位移／模糊的選擇器，覆蓋區塊涵蓋 ${covered.size} 個選擇器`);
}

/**
 * 檢查 6 的 JavaScript 那一半（票 01）。
 *
 * 上面那一段看的是 CSS 的動態宣告。**JavaScript 驅動的逐幀動態沒有 CSS animation 可以被它掃到**，
 * 換一個實作技術就整個從可及性檢查裡消失——這是實際讀腳本查出來的洞，不是推測。
 *
 * 要分清楚兩種 rAF：捲動時才排一次的（`.tl-fill`、`.nav-progress`）不是常駐動態，
 * 沒有人在等它、它也不會自己一直跑。**常駐＝自己排自己**，所以認的是「函式的身體裡
 * 有 requestAnimationFrame(它自己)」這個結構，不是「檔案裡出現過 rAF」。
 */
/**
 * 只找「被 rAF 排程過的那幾個名字」的定義，不是列舉全檔的函式——
 * **產物是壓縮過的**，`let a=0,loop=n=>{…}` 這種逗號串宣告、物件屬性、方法簡寫都要認得。
 * 第一版只認 `function X(` 與 `const X =`，實測六種寫法漏掉四種，其中逗號串正是 Vite 的輸出樣子。
 */
function findStandingLoops(text) {
	const scheduled = new Set(
		[...text.matchAll(/requestAnimationFrame\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map((m) => m[1]),
	);
	const loops = [];
	for (const name of scheduled) {
		const self = new RegExp(`requestAnimationFrame\\s*\\(\\s*${name}\\s*\\)`);
		// 這個名字的所有可能定義處：具名函式／賦值成函式或箭頭／物件屬性／方法簡寫
		const defRe = new RegExp(
			`(?:^|[^\\w$.])(?:function\\s*\\*?\\s*)?${name}\\s*` +
				`(?:[=:]\\s*(?:async\\s+)?(?:function\\s*\\*?\\s*[\\w$]*\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*(?:=>\\s*)?|\\([^)]*\\)\\s*)\\{`,
			'g',
		);
		for (const m of text.matchAll(defRe)) {
			const open = text.indexOf('{', m.index + m[0].length - 1);
			if (open < 0) continue;
			if (self.test(text.slice(open, matchBrace(text, open) + 1))) {
				loops.push(name);
				break;
			}
		}
	}
	return loops;
}

function checkStandingMotionReducedMotion(sources) {
	let found = 0;
	for (const { rel, text } of sources) {
		const loops = findStandingLoops(text);
		if (!loops.length) continue;
		found += loops.length;
		standingLoopFiles.push(rel);
		if (!/prefers-reduced-motion/.test(text)) {
			// 與 CSS 那一半同樣不吃例外清單：可及性是硬下限
			failures.push({
				check: 'reduced-motion',
				key: `${rel} :: ${loops.join('、')}`,
				detail: '常駐的逐幀動態（函式自己排自己），但整個檔案裡找不到 prefers-reduced-motion 的分支',
			});
		}
	}
	note(`常駐逐幀動態：${found} 個自我排程的迴圈`);
}

// ===========================================================================
// 檢查 7 — 母題參數必須落在票 00 定的檔位上
// ===========================================================================
/**
 * 值一律取自 `palette-config.mjs` 的 `MOTIF`，**這支腳本裡不寫值**。
 *
 * 產物端的契約：母題的 canvas 帶一個 `data-motif` 屬性，內容是判準檔 `MOTIF` 的 JSON。
 * 繪製程式從那個屬性取值，所以「判準檔 → 產物 → 執行期」是同一條路，
 * 沒有第二份數字可以偷偷漂掉。母題尚未上線時這一項只驗判準檔本身。
 */
/** 檢查 6 的 JS 那一半找到的常駐迴圈，檢查 7 要用它判斷「母題是不是已經上線了」。 */
const standingLoopFiles = [];

const decodeEntities = (s) =>
	s.replace(/&(#34|quot|#39|apos|#38|amp|#x27);/gi, (_, e) =>
		/^(#34|quot)$/i.test(e) ? '"' : /^(#38|amp)$/i.test(e) ? '&' : "'",
	);

/** 鍵排序後的 JSON——兩份參數只有寫入順序不同時不該被判成不一樣。 */
const canonicalJson = (v) =>
	JSON.stringify(v, (_, x) =>
		x && typeof x === 'object' && !Array.isArray(x)
			? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
			: x,
	);

/**
 * 紅線③ 的量法：每個振盪分量的 `振幅 × 2π頻率` 相加，再取各軸的向量和。
 *
 * **`travel` 是行程（峰對峰），不是振幅**，所以呼吸那一項要除以 2 才是振幅——
 * 少了那個 2 會算成 54.7 px/s，把一組合格的值判成超線。
 * 呼吸只發生在垂直方向，漂移兩軸都有，故最壞是 hypot(呼吸+漂移, 漂移)。
 */
function motifSpeeds(m) {
	const periods = [m.breathPeriod, m.breathPeriod / m.breathRatio, m.breathPeriod * m.breathRatio];
	const breathRate = m.breathWeights.reduce((s, w, i) => s + (w * 2 * Math.PI) / periods[i], 0);
	const breath = (m.travel.normal / 2) * breathRate;
	const drift = m.driftAmplitude.reduce((s, a, i) => s + a * 2 * Math.PI * m.driftFrequency[i], 0);
	return { breath, drift, peak: Math.hypot(breath + drift, drift) };
}

function checkMotif(htmlFiles) {
	const limit = CFG.STANDING_MOTION_PEAK_SPEED;
	const { breath, drift, peak } = motifSpeeds(CFG.MOTIF);
	if (peak > limit) {
		fail('motif', '判準檔本身', `MOTIF 算出的峰值速度 ${peak.toFixed(1)} px/s 超過紅線③ 的 ${limit} px/s`);
	}
	// 配額分配是技法，但它不能只是一句話：值一漂就對不上，這裡把它變成會報錯的線
	const budget = CFG.MOTIF_CRAFT.speedBudget;
	if (breath > budget.breath) fail('motif', '呼吸配額', `呼吸 ${breath.toFixed(1)} px/s 超過配額 ${budget.breath}`);
	if (drift > budget.drift) fail('motif', '漂移配額', `漂移 ${drift.toFixed(1)} px/s 超過每軸配額 ${budget.drift}`);
	note(`母題峰值速度 ${peak.toFixed(1)} px/s（呼吸 ${breath.toFixed(1)}／漂移 ${drift.toFixed(1)}，紅線③ ${limit}）`);

	const found = [];
	for (const f of htmlFiles) {
		const text = readFileSync(f, 'utf8');
		for (const m of text.matchAll(/data-motif=("([^"]*)"|'([^']*)')/g)) {
			found.push({ rel: relative(ROOT, f), raw: m[2] ?? m[3] });
		}
	}
	if (!found.length) {
		// fail-open 的防線：有常駐迴圈就代表母題已經在跑，那產物裡就必須找得到它的參數。
		// 沒有這一條，把 canvas 改成由 JS 建立就能讓整個第七類靜靜地不作用。
		if (standingLoopFiles.length) {
			fail(
				'motif',
				standingLoopFiles.join('、'),
				'產物裡有常駐逐幀動態，卻找不到任何 data-motif——母題參數必須由伺服器端渲染進 HTML，才驗得到它落在檔位上',
			);
			return;
		}
		note('母題尚未上線（沒有常駐迴圈也沒有 data-motif），本項只驗了判準檔');
		return;
	}

	const expect = canonicalJson(CFG.MOTIF);
	for (const { rel, raw } of found) {
		let parsed;
		try {
			parsed = JSON.parse(decodeEntities(raw));
		} catch {
			fail('motif', rel, 'data-motif 不是合法的 JSON');
			continue;
		}
		if (canonicalJson(parsed) === expect) continue;
		const keys = new Set([...Object.keys(CFG.MOTIF), ...Object.keys(parsed)]);
		for (const k of keys) {
			const a = canonicalJson(parsed[k]);
			const b = canonicalJson(CFG.MOTIF[k]);
			if (a !== b) fail('motif', `${rel} :: ${k}`, `產物是 ${a}，判準檔是 ${b}——母題參數漂離檔位`);
		}
	}
}

// ===========================================================================
// 主流程
// ===========================================================================
function main() {
	if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
		console.error(`找不到 ${DIST}——先跑 astro build。`);
		process.exit(2);
	}

	const allFiles = walk(DIST);

	// 票 01：`.js` 進來了。母題的色碼寫在腳本裡，不掃 JS 等於留一條白名單看不見的路。
	const textFiles = allFiles.filter((f) => /\.(html|css|svg|js)$/i.test(f));
	const siteCssFiles = textFiles.filter((f) => f.endsWith('.css') && !isProcessPage(f));

	const allowedCss = new Set(
		[
			...Object.keys(CFG.SITE_PALETTE),
			...Object.keys(CFG.RAMP_PALETTE),
			...Object.keys(CFG.FROZEN_DEMO_PALETTE),
			...Object.keys(CFG.ILLUSTRATIVE_PALETTE),
		].map((h) => normalizeColor(h)),
	);

	// 網站端 CSS（不含 /process/ 九頁的凍結副本）
	const siteParsed = siteCssFiles.map((f) => parseCss(readFileSync(f, 'utf8'), relative(ROOT, f)));
	for (const f of allFiles.filter((f) => /\.html$/i.test(f) && !isProcessPage(f))) {
		const html = readFileSync(f, 'utf8');
		for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
			siteParsed.push(parseCss(m[1], relative(ROOT, f)));
		}
		// 內聯 style="" 也是產物裡真實存在的宣告
		// 單引號版本原本漏掉——那是「掃字串找用法」型檢查最容易留的縫
		const inline = [...html.matchAll(/\sstyle=("([^"]*)"|'([^']*)')/g)].map((m) => m[2] ?? m[3]);
		if (inline.length) {
			siteParsed.push({
				rules: inline.map((body) => ({
					selectors: [`[style] @ ${relative(ROOT, f)}`],
					decls: parseDeclarations(body),
					at: [],
					source: relative(ROOT, f),
				})),
				keyframes: new Map(),
			});
		}
	}
	const siteRules = siteParsed.flatMap((p) => p.rules);
	const vars = collectRootVars(siteRules);

	// 腳本端的觀察範圍：網站自己的 HTML（內聯 script）與產物 JS，不含 /process/ 的凍結存檔
	const scriptSources = allFiles
		.filter((f) => /\.(html|js)$/i.test(f) && !isProcessPage(f))
		.map((f) => ({ rel: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
	const siteHtmlFiles = allFiles.filter((f) => /\.html$/i.test(f) && !isProcessPage(f));

	console.log('— 1／7 色碼白名單');
	checkColorWhitelist(textFiles, allowedCss);
	checkSiteColorsOnRamp();
	checkChartPixels();

	console.log('— 2／7 對比度');
	checkGrainModel();
	checkContrast(vars, siteRules);
	checkOpacityNotLevel(siteRules);

	console.log('— 3／7 色盲安全');
	checkColorVision();

	console.log('— 4／7 色階規律');
	checkRamps(vars);

	console.log('— 5／7 排版與間距規律');
	checkTypographyAndSpacing(siteRules, vars);

	console.log('— 6／7 降低動態偏好覆蓋');
	checkReducedMotion(siteParsed);
	checkStandingMotionReducedMotion(scriptSources);

	console.log('— 7／7 母題參數與常駐動態');
	checkMotif(siteHtmlFiles);

	// ---- 回報 ----
	if (process.env.VERIFY_VERBOSE) {
		console.log('\n量測值：');
		for (const n of notes) console.log(`  ${n}`);
	}

	if (excepted.length) {
		console.log(`\n明文例外（${excepted.length} 項，由後續票逐條清空）：`);
		const byCheck = new Map();
		for (const e of excepted) byCheck.set(e.check, (byCheck.get(e.check) || 0) + 1);
		for (const [check, n] of byCheck) {
			const first = excepted.find((e) => e.check === check);
			console.log(`  [${check}] ${n} 項　${first.reason}（${first.clearedBy}）`);
		}
	}

	const stale = [];
	for (const [check, list] of Object.entries(CFG.EXCEPTIONS)) {
		for (const e of list) if (!usedExceptions.has(`${check}::${e.key}`)) stale.push(`${check}::${e.key}`);
	}
	if (stale.length) {
		console.log(`\n⚠ 例外清單有 ${stale.length} 項已無對應違規，可以刪掉了：`);
		for (const s of stale) console.log(`  ${s}`);
	}

	if (failures.length) {
		console.log(`\n✗ ${failures.length} 項違規：\n`);
		const byCheck = new Map();
		for (const f of failures) {
			if (!byCheck.has(f.check)) byCheck.set(f.check, []);
			byCheck.get(f.check).push(f);
		}
		for (const [check, list] of byCheck) {
			console.log(`  [${check}] ${list.length} 項`);
			for (const f of list) console.log(`    ${f.key}\n      ${f.detail}`);
		}
		process.exit(1);
	}

	console.log(`\n✓ 七類檢查全部通過${excepted.length ? `（${excepted.length} 項明文例外）` : ''}`);
}

main();
