#!/usr/bin/env node
/**
 * npm run verify:palette — 設計系統的部署前閘門。
 *
 * 讀的是 `astro build` 的產物 `dist/` 與 21 張圖表 PNG，不讀原始碼：
 * 重構 CSS、換 token 分層都不該讓這支腳本失敗。
 *
 * 十三類檢查見 SPEC-design-system.md「Testing Decisions」、
 * SPEC-motion-and-shape.md「加進 verify:palette 的第六類檢查」、
 * SPEC-background-and-homepage.md「閘門要補的兩個洞」（票 01 補上第七類）、
 * SPEC-focus-groups.md「T3 孤兒檢查」（票 03 補上第八類）與
 * SPEC-signature-tags-and-frame.md「接縫一」（票 02 補上第十三類：分類顯示名的單一來源）。
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
 *   · **背景設計比對的是 `data-motif` 與判準檔**。canvas 裡實際畫出來的像素不在觀察範圍內；
 *     繪製程式若不從那個屬性取值而是另外寫一份數字，這一項看不見。
 *     （「屬性根本不出現」這條已經堵上：有常駐迴圈卻沒有 `data-motif` 會紅）
 *   · **切函式身體用的是 CSS 那支括號配對**。它認得字串與區塊註解，但不認得
 *     樣板字面與正則字面裡的大括號；那種寫法會讓身體的範圍抓錯
 *
 * 元素主色份量票 03 的第十二類（辨識通道）再加兩條：
 *   · **`shape`（形狀與位置）這種通道機器查不到**，只登記不查——`.cs-wipe-handle:after`
 *     的辨識來自「它釘在把手正中央、外面有個同色圓框」，沒有一個屬性宣告得出這件事。
 *     那一條由清單的 `why` 交給人審，收工的 note 會講明「N 條裡有幾條查不到」
 *   · **有一個測試用的環境變數 `VERIFY_CHANNEL_EXTRA`**（自我檢查用它注入假的清單條目）。
 *     它**只可能讓閘門更紅**：注入的條目只進第十二類的輸入，不進 `claimedSelectors`、
 *     不進 `fgOn`，所以放行不了任何一個主色文字，最壞情況是讓建置失敗。
 *     這一點與 `VERIFY_DIST` 不同（那個換掉的是被讀的產物），拿它繞路沒有意義
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
// 分類名的單一來源與版面共用同一份（票 02）。閘門自己抄一份舊名，就又生出一個定義。
import * as CATS from '../src/categories.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// VERIFY_DIST 讓 verify-selftest.mjs 拿注入缺陷的產物副本來跑，不動真的 dist/
const DIST = process.env.VERIFY_DIST || join(ROOT, 'dist');

/**
 * VERIFY_CHANNEL_EXTRA 讓自我檢查注入**允許清單的假條目**（第十二類要驗的缺陷有兩種
 * 在判準檔那一側，光改產物造不出來）。
 *
 * **它只可能讓閘門更紅**：注入的條目只進第十二類的輸入，不進 `claimedSelectors`、
 * 不進 `fgOn`，所以它放行不了任何一個主色文字，最壞情況是讓建置失敗。
 * 這一點與 `VERIFY_DIST` 不同（那個換掉的是被讀的產物），拿它繞路沒有意義。
 */
const EXTRA_CHANNEL_ENTRIES = process.env.VERIFY_CHANNEL_EXTRA ? JSON.parse(process.env.VERIFY_CHANNEL_EXTRA) : [];
/**
 * 圖表 PNG 的所在。統計專案 #1 於 2026-07-30 封存到 `_parked/`，而那個資料夾
 * **隨時可能被整個刪掉、也隨時可能被 `git mv` 搬回原位**（見它自己的 README）——
 * 所以兩個位置都找，都不在就整項跳過並在 note 講明。
 *
 * 兩邊都要找，是因為寫死任何一邊都會壞：寫死原路徑就是封存當天那個紅燈（而且它讓
 * 每一次執行都退出碼 1，`verify-selftest.mjs` 的六個「應該綠」基準案例因此全數失真，
 * 整組自我檢查等於失效）；寫死封存路徑則是資料夾一刪就換它紅。
 * 這樣寫的附帶好處是撿回來時不必回頭改這裡——README 的復原步驟不用多一條。
 */
const CHART_DIRS = [
	join(ROOT, 'public', 'images', 'taiwan-tourism'),
	join(ROOT, '_parked', 'stats-tourism-2026-07', 'images', 'taiwan-tourism'),
];
const CHART_DIR = CHART_DIRS.find(existsSync) || null;

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
	if (!CHART_DIR) {
		// 圖表不在站上就沒有像素可以驗——但**要講出來**，否則「跳過」與「驗過了」
		// 在輸出上長得一模一樣，那是這道閘門最不該有的沉默。
		note(`圖表 PNG：跳過——${CHART_DIRS.map((d) => relative(ROOT, d)).join('、')} 都不存在`);
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
	note(
		`圖表 PNG：${files.length} 張、主要顏色 ${checked} 個（門檻 ${CFG.PNG_MIN_PIXEL_RATIO * 100}% 像素）已逐一比對於 ${relative(ROOT, CHART_DIR)}`,
	);
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
	/**
	 * `over:<半透明色>/<底>` —— 用那個色**自己的 alpha** 疊上去（票 05 的 7% 主色淡底）。
	 * 與 `bloom:` 的差別是這裡不在判準檔重寫一次濃度：淡底的濃度只寫在 CSS 的
	 * `--color-accent-tint` 一個地方，改那裡就會連帶改這裡量到的底。底可以是另一個
	 * 表面規格（淡底是半透明的，底下透出來的是頁面那九種狀態）。
	 */
	const over = spec.match(/^over:(.+?)\/(.+)$/s);
	if (over) {
		const top = normalizeColor(resolveVars(over[1], vars));
		const base = resolveSurface(over[2], vars);
		if (!top || !base) return null;
		const alpha = top.length === 9 ? parseInt(top.slice(7), 16) / 255 : 1;
		return C.blend(opaque(top), opaque(base), alpha);
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
		 *   **限定選擇器**——配對帶了 `fgOn`，那它只認領清單上的那幾條規則。
		 * 早期版本把兩者混為一談，於是「深字反白」那組把頁底色登記成合法文字色，
		 * 誰在別處寫 `color: var(--color-bg)` 都會過——實際對比 1.00，隱形字。
		 *
		 * **`fgOn` 優先於頁面表面。**元素主色疊在頁底九種狀態都 ≥4.5 是真的，但那只
		 * 證明「看得見」，不證明「該用在這裡」；早期版本讓這一組無條件認領，主色因此
		 * 對任何選擇器都是通行證——注入一條純虛構的 `.rogue{color:#7998c3}` 到真實產物，
		 * 八類全過、退出碼 0（實測）。對比驗證不變，變的是它不再發通行證。
		 */
		if (min === CFG.CONTRAST_MIN) {
			if (pair.fgOn) for (const s of pair.fgOn) claimedSelectors.add(s);
			else if (pair.bgs === CFG.PAGE_SURFACES) declaredFg.add(opaque(fg));
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
		if (pair.bgOn && pair.bgLiteral) {
			/**
			 * 半透明的底（票 05 的 7% 主色淡底）：**宣告值不等於渲染值**，所以這裡比的是
			 * 「產物宣告了哪個色」而不是合成之後的色——後者永遠對不上。
			 * 比對含 alpha（用 `declaredProp` 拿原始宣告，不走 `declaredValue` 的 `opaque()`），
			 * 所以把 7% 換成 33% 會紅，那正是這道守衛要擋的漂移。
			 */
			const want = normalizeColor(resolveVars(pair.bgLiteral, vars));
			const decl = declaredProp(siteRules, pair.bgOn, ['background-color', 'background']);
			const resolved = decl && resolveVars(decl.value, vars);
			/**
			 * 淡底可以是**漸層**（2026-07-29 本人否決純色平塗的「一塊感」），所以宣告值不一定
			 * 是單一顏色，而可能是一串色停。逐一取出來看：**全透明的那些跳過，其餘每一個都
			 * 必須是判準說的那個色**。只比對「有沒有出現過那個色」的話，
			 * `linear-gradient(#7998c355, #7998c312, transparent)` 會過——峰值偷偷加濃，
			 * 而峰值正是對比模型假設的最壞情況。
			 */
			const stops = resolved
				? [...resolved.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)]
						.map((m) => normalizeColor(m[0]))
						.filter((h) => h && !(h.length === 9 && h.endsWith('00')))
				: [];
			const strays = [...new Set(stops.filter((h) => h !== want))];
			if (want && (!stops.length || strays.length)) {
				fail(
					'contrast',
					`${pair.bgOn} 的底色`,
					`${pair.where}：判準說 ${pair.bgOn} 宣告的底是 ${want}（半透明淡底，可以是漸層的色停），` +
						`產物是 ${resolved ?? '（找不到這條規則）'}${strays.length ? `——不該出現的色停：${strays.join('、')}` : ''}`,
				);
			}
		} else if (pair.bgOn) {
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
			// **逐選擇器判定，不是整條規則。**用 `some()` 的話，`.rogue,a{color:主色}`
			// 會被同群組的 `a` 順帶認領——實測八類全過、退出碼 0。允許清單一旦成為
			// 唯一守門人，「群組裡有一個合法就全放行」就等於清單可以被繞過。
			const orphans = rule.selectors.filter((s) => !claimedSelectors.has(s));
			if (!orphans.length) continue;
			fail(
				'contrast',
				`未認領的文字色 ${hex}`,
				`${orphans.join(', ')} 用 ${d.value} 當文字色，但 CONTRAST_PAIRS 裡沒有任何一組在管它`,
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
// 檢查 6 — 可及性偏好的逃生口：降低動態、增加對比（不得有例外：可及性是硬下限）
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
 * 增加對比逃生口（聚焦組票 01 的 T2）——與上面那條同型，只是換一個偏好。
 *
 * 量的是**產物裡有沒有東西在糊化內容**，不是「有沒有標記屬性」：驗外部行為不驗實作細節，
 * 日後改標記屬性的命名、重構 CSS 都不該讓它誤紅。糊化的那條規則要嘛不存在，
 * 要嘛在 `@media (prefers-contrast: more)` 裡有一條把它關掉——沒有第三種寫法。
 *
 * 誠實邊界：只認 `filter: blur()`。`backdrop-filter`（導覽列那個）不在內——它糊的是
 * 元素背後的畫面，不是內容本身；而單靠 `opacity` 降權、不糊化的寫法這裡也看不見。
 */
const CONTRAST_RE = /prefers-contrast\s*:\s*more/;
const BLUR_RE = /\bblur\(\s*(?!0[a-z%]*\s*\))/;

function checkContrastEscape(siteParsed) {
	const covered = new Set();
	const inScope = new Map(); // selector → 原因

	for (const { rules } of siteParsed) {
		for (const rule of rules) {
			const relaxed = rule.at.some((a) => CONTRAST_RE.test(a));
			for (const sel of rule.selectors) {
				const key = sel.replace(/\s+/g, ' ').trim();
				if (relaxed) {
					covered.add(key);
					continue;
				}
				for (const d of rule.decls) {
					if (d.prop === 'filter' && BLUR_RE.test(d.value)) inScope.set(key, `filter: ${d.value}`);
				}
			}
		}
	}

	for (const [sel, why] of inScope) {
		if (!covered.has(sel)) {
			// 與降低動態偏好那一半同樣不吃例外清單：可及性是硬下限，不能掛著等後續票
			failures.push({
				check: 'contrast-escape',
				key: sel,
				detail: `${why} 糊化了內容，但未出現在 @media (prefers-contrast: more) 區塊內——非焦點文字的實測對比只有 1.66`,
			});
		}
	}
	note(`增加對比逃生口：${inScope.size} 個糊化內容的選擇器，覆蓋區塊涵蓋 ${covered.size} 個選擇器`);
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
// 檢查 7 — 背景設計參數必須落在票 00 定的檔位上
// ===========================================================================
/**
 * 值一律取自 `palette-config.mjs` 的 `MOTIF`，**這支腳本裡不寫值**。
 *
 * 產物端的契約：背景設計的 canvas 帶一個 `data-motif` 屬性，內容是判準檔 `MOTIF` 的 JSON。
 * 繪製程式從那個屬性取值，所以「判準檔 → 產物 → 執行期」是同一條路，
 * 沒有第二份數字可以偷偷漂掉。背景設計尚未上線時這一項只驗判準檔本身。
 */
/** 檢查 6 的 JS 那一半找到的常駐迴圈，檢查 7 要用它判斷「背景設計是不是已經上線了」。 */
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

/**
 * 產物端契約的共用查法。背景設計（第七類）與場（第九類）是同一個形狀：
 * canvas 帶一個屬性、內容是判準檔那組參數的 JSON、繪製程式從屬性取值。
 *
 * **抽成一支而不是照抄一份**：兩份會分家，而分家的那一天不會有人發現——
 * 第九類是照第七類「補過的樣子」寫的，包含 fail-open 那條防線，
 * 抄一份等於把「補洞的理由」也抄成兩份各自維護。
 *
 * `onParsed` 讓各自加自己的檢查（場要驗回彈的紅線），其餘完全共用。
 */
function checkParamContract({ check, attr, config, label, htmlFiles, onParsed }) {
	const found = [];
	// `data-motif=` 不會誤中 `data-motif-craft=`：等號緊接在屬性名後面
	const re = new RegExp(`${attr}=("([^"]*)"|'([^']*)')`, 'g');
	for (const f of htmlFiles) {
		const text = readFileSync(f, 'utf8');
		for (const m of text.matchAll(re)) found.push({ rel: relative(ROOT, f), raw: m[2] ?? m[3] });
	}
	if (!found.length) {
		// fail-open 的防線：有常駐迴圈就代表它已經在跑，那產物裡就必須找得到它的參數。
		// 沒有這一條，把 canvas 改成由 JS 建立就能讓整個這一類靜靜地不作用。
		if (standingLoopFiles.length) {
			fail(
				check,
				`${attr} @ ${standingLoopFiles.join('、')}`,
				`產物裡有常駐逐幀動態，卻找不到任何 ${attr}——${label}參數必須由伺服器端渲染進 HTML，才驗得到它落在檔位上`,
			);
			return;
		}
		note(`${label}尚未上線（沒有常駐迴圈也沒有 ${attr}），本項只驗了判準檔`);
		return;
	}

	const expect = canonicalJson(config);
	for (const { rel, raw } of found) {
		let parsed;
		try {
			parsed = JSON.parse(decodeEntities(raw));
		} catch {
			fail(check, rel, `${attr} 不是合法的 JSON`);
			continue;
		}
		onParsed?.(parsed, rel);
		if (canonicalJson(parsed) === expect) continue;
		const keys = new Set([...Object.keys(config), ...Object.keys(parsed)]);
		for (const k of keys) {
			const a = canonicalJson(parsed[k]);
			const b = canonicalJson(config[k]);
			if (a !== b) fail(check, `${rel} :: ${k}`, `產物是 ${a}，判準檔是 ${b}——${label}參數漂離檔位`);
		}
	}
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
	note(`背景設計峰值速度 ${peak.toFixed(1)} px/s（呼吸 ${breath.toFixed(1)}／漂移 ${drift.toFixed(1)}，紅線③ ${limit}）`);

	checkParamContract({
		check: 'motif',
		attr: 'data-motif',
		config: CFG.MOTIF,
		label: '背景設計',
		htmlFiles,
	});
}

// ===========================================================================
// 檢查 9（票 03）— 場的參數必須落在票 02 定版的檔位上
// ===========================================================================
/**
 * 與第七類同一個接縫、同一種寫法，理由也相同：閘門看不到畫布像素，只能比對屬性。
 *
 * 多守一條**紅線**：回彈幅度 4px 這個值本身看不出有沒有超線，超線的是
 * 幅度 × 角速度。所以量的是**參數的解析上界**，不是目測、不是實測幀——
 * 值一漂，算出來的上界就過線。
 *
 * **角速度取自判準檔而不是產物**：它在 `data-field-craft` 裡，是技法不是判準，
 * 這一類不比對它。誠實的邊界是「有人同時改掉角速度與判準檔，這裡看不出來」——
 * 但那已經不是漂移，是有意識的改動。
 */
/**
 * 契約的 fail-open 防線是**存在性**不是**全稱性**：`found` 跨所有 HTML 檔累積，
 * 只要任一頁有屬性就不會進那個分支，其餘頁缺屬性完全沒人看。
 * 第二輪抗辯實測：把 `dist/projects/index.html` 的兩個屬性拿掉（那一頁的場等於整個
 * 不畫），閘門照樣印「✓ 十三類檢查全部通過」。
 *
 * 補法不是「每一頁都必須有場」——`BaseLayout` 的 `motif` prop 沒給就沒有背景層，
 * 那是明文允許的。要守的是**兩者同進同出**：`Field` 與 `Motif` 在 `BaseLayout` 裡
 * 由同一個條件渲染，所以有背景設計的頁面就必須有場。少一個就是元件被漏掉了。
 */
function checkFieldCoverage(htmlFiles) {
	let both = 0;
	for (const f of htmlFiles) {
		const text = readFileSync(f, 'utf8');
		if (!/data-motif=/.test(text)) continue;
		const rel = relative(ROOT, f);
		for (const attr of ['data-field', 'data-field-craft']) {
			if (new RegExp(`${attr}=`).test(text)) continue;
			fail(
				'field',
				`${rel} :: 缺 ${attr}`,
				`這一頁有 data-motif 卻沒有 ${attr}——兩者在 BaseLayout 由同一個條件渲染，少一個代表場的元件被漏掉了，那一頁的場整個不畫`,
			);
		}
		both++;
	}
	note(`場的覆蓋：${both} 個有背景設計的頁面，兩個屬性都在`);
}

function checkField(htmlFiles) {
	checkFieldCoverage(htmlFiles);
	const limit = CFG.STANDING_MOTION_PEAK_SPEED;
	const maxMs = Math.max(...CFG.DURATION_TIERS.map((t) => parseFloat(t) * 1000));
	const omega = CFG.FIELD_CRAFT.shockOmega[0];
	note(
		`場的回彈峰值速度 ${(CFG.FIELD.shockAmp * omega).toFixed(1)} px/s` +
			`（幅度 ${CFG.FIELD.shockAmp} × 角速度 ${omega}，紅線③ ${limit}）`,
	);

	/* **技法也要驗。**紅隊 2026-07-29 指出的缺口：`data-field-craft` 先前只出現在註解裡，
	   從來沒跟判準檔比對過，於是 `alphaBuckets`／`crackCapPerMpx`／`emberPeakAlpha` 這些
	   全數零覆蓋——而 `alphaBuckets` 自己的註解寫著「這不是效能參數，是正確性參數」。
	   契約同型，所以直接沿用同一支。 */
	checkParamContract({
		check: 'field',
		attr: 'data-field-craft',
		config: CFG.FIELD_CRAFT,
		label: '場的技法',
		htmlFiles,
		onParsed: (k, rel) => {
			/* 退化值要單獨守：它們不是「漂離檔位」，是**產物照著判準檔跑但畫面壞掉**。
			   實測（照抄元件公式算）：
			     alphaBuckets = 1 → dimOf 除以 B−1 得 NaN → strokeStyle 變成非法色碼 →
			                        canvas 靜靜忽略、沿用預設的不透明純黑 →
			                        **整場等高線畫成黑線**，而部署前閘門全綠
			     alphaBuckets = 0 → bucketOf 回 −1 → lines[−1].push → TypeError，場整個不畫
			     shockYRatio > 1 → 垂直位移超過 pad（pad 只綁 shockAmp）→ 貼圖時上下露白帶 */
			if (!(Number.isInteger(k.alphaBuckets) && k.alphaBuckets >= 2)) {
				fail(
					'field',
					`${rel} :: alphaBuckets（退化值）`,
					`分桶數 ${k.alphaBuckets} 不是 ≥2 的整數——1 會讓整場畫成不透明黑線（NaN 色碼被靜靜忽略），0 會直接丟例外`,
				);
			}
			if (!(k.shockYRatio <= 1)) {
				fail('field', `${rel} :: shockYRatio（退化值）`, `垂直幅度比 ${k.shockYRatio} 大於 1，垂直位移會超過留白、貼圖時露出白帶`);
			}
			if (!(Number.isInteger(k.levels) && k.levels >= 2)) {
				fail('field', `${rel} :: levels（退化值）`, `等高線層數 ${k.levels} 不是 ≥2 的整數，畫不出任何一條線`);
			}
			if (!(k.march > 0)) fail('field', `${rel} :: march（退化值）`, `掃描步長 ${k.march} 不是正數，掃描迴圈不會前進`);
			if (k.fbmWeights.length !== k.fbmOctaves.length) {
				fail('field', `${rel} :: fbm`, `疊加的權重 ${k.fbmWeights.length} 個與頻率 ${k.fbmOctaves.length} 個對不起來`);
			}
			/* **下限是推導出來的，不是隨手挑的**：敘事是「我恢復得很快」，回彈之後必須有
			   一段看得見的靜止，否則沒有「恢復」可言。所以冷卻要明顯大於回位時間——
			   取兩倍當硬下限（工作週期 ≤50%，再高它就不是事件而是常駐動態，
			   連適用哪一條紅線都變了）。
			   先前只要求「大於回位時間」，設 351ms 一樣過關，而那是回位後 10ms 又滿幅。 */
			/* **兩端都要夾。**下限由關三推導：敘事是「我恢復得很快」，回彈後必須有一段
			   看得見的靜止，所以冷卻要明顯大於回位時間（取兩倍；再低工作週期過半，
			   它就不是事件而是常駐動態，適用的紅線都換了一條）。

			   **上限是抗辯第三輪逼出來的**：先前只有下限，於是把冷卻改成 7000 以上
			   整條管線全綠——而那正是第二輪判定「敘事不可觀察」、這一輪宣稱修掉的
			   那個失敗態。執行期的節奏檢查也擋不住它，因為那邊的期望值是拿**產物
			   自己的 rearm** 去算的，任何值都自我一致（實測 rearm=60000 → 六秒
			   一次都沒晃，而檢查印「✓ 節奏對得上」）。
			   上限取「一次連續捲動的量級（探針的 6 秒視窗）內至少要出現兩次」，
			   ＝ 視窗 ÷ 2 ＝ 3000ms。本人選的 2700 落在 700–3000 之間。
			   **要改到 3000 以上必須先改這個判準並講出理由**——那正是這條線的用意。 */
			const floor = 2 * CFG.FIELD.shockMs;
			const ceil = CFG.FIELD_CRAFT.rhythmWindowMs / 2;
			if (!(k.shockRearmMs >= floor)) {
				fail(
					'field',
					`${rel} :: shockRearmMs（退化值）`,
					`回彈冷卻 ${k.shockRearmMs}ms 小於回位時間的兩倍（${floor}ms）——回彈之間沒有看得見的靜止，工作週期超過一半，那不是「恢復得很快」而是持續震動`,
				);
			} else if (!(k.shockRearmMs <= ceil)) {
				fail(
					'field',
					`${rel} :: shockRearmMs（退化值）`,
					`回彈冷卻 ${k.shockRearmMs}ms 超過 ${ceil}ms——一次連續捲動（${CFG.FIELD_CRAFT.rhythmWindowMs}ms）裡回彈少於兩次，敘事「捲動觸發整場回彈」實質不可觀察`,
				);
			}
		},
	});

	checkParamContract({
		check: 'field',
		attr: 'data-field',
		config: CFG.FIELD,
		label: '場的',
		htmlFiles,
		onParsed: (p, rel) => {
			const peak = p.shockAmp * omega;
			if (peak > limit) {
				fail(
					'field',
					`${rel} :: shockAmp（紅線）`,
					`回彈峰值速度 ${peak.toFixed(1)} px/s（幅度 ${p.shockAmp} × 角速度 ${omega}）超過紅線③ 的 ${limit} px/s`,
				);
			}
			if (p.shockMs > maxMs) {
				fail('field', `${rel} :: shockMs（紅線）`, `回位時間 ${p.shockMs}ms 超過動效紅線① 的 ${maxMs}ms`);
			}
		},
	});
}

// ===========================================================================
// 檢查 10（票 03）— 全站不用陰影
// ===========================================================================
/**
 * 判準：「**深度用顏色表達，不用光影**」（SPEC-motion-and-shape「陰影」）。
 *
 * `/process/` 的凍結存檔除外——那九頁是標了日期的歷史重演，裡面的兩個陰影
 * （`talks-buttons` 的 inset 與一條 transition）是當時那個元件長的樣子，不是本站的設計。
 * 豁免不是靠這支函式記得跳過，是靠 `siteRules` 本來就不含 `/process/`。
 *
 * `drop-shadow()` 要一起認：同一件事換一個屬性講。只認 `box-shadow`／`text-shadow`
 * 的話這條路是敞開的，而它就長在既有的 `filter` 旁邊（糊化那一類已經在掃 filter 了）。
 */
const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', '-webkit-box-shadow']);

function checkNoShadow(siteRules) {
	let found = 0;
	for (const rule of siteRules) {
		for (const d of rule.decls) {
			// `box-shadow: none` 是「明講不要」，不是陰影
			const shadowProp = SHADOW_PROPS.has(d.prop) && !/^none$/i.test(d.value.trim());
			const dropShadow = /drop-shadow\s*\(/i.test(d.value);
			if (!shadowProp && !dropShadow) continue;
			found++;
			fail(
				'shadow',
				`${rule.selectors.join(', ')} @ ${rule.source}`,
				`${d.prop}: ${d.value}——全站不用陰影，深度用顏色表達（SPEC-motion-and-shape「陰影」）`,
			);
		}
	}
	note(`陰影：網站端 ${found} 個（/process/ 的凍結存檔不在觀察範圍內）`);
}

// ===========================================================================
// 檢查 11（票 03）— z 層級白名單
// ===========================================================================
/**
 * 判準：產物 CSS 的 `z-index` 必須落在 `Z_LAYERS` 的三個位置上。
 * 規則是「內容永遠待在 `z-index: auto` 的常規流，只有背景與釘住的導覽可以離開」。
 *
 * **要掃 HTML 內聯的 `<style>`，不能只掃 `.css`**：Astro 元件自己的 `<style>` 可能被
 * 編成獨立檔也可能內聯進 HTML，而那正是新元件加第四個位置的路徑（`Motif.astro`
 * 的 −1 就是這樣來的）。`siteRules` 兩邊都涵蓋了，所以這裡不必自己再找一次。
 */
function checkZIndex(siteRules) {
	const allowed = new Set([...Object.keys(CFG.Z_LAYERS), ...CFG.Z_KEYWORDS]);
	const seen = new Set();
	for (const rule of siteRules) {
		for (const d of rule.decls) {
			if (d.prop !== 'z-index') continue;
			const v = d.value.trim().replace(/\s*!important$/i, '');
			seen.add(v);
			if (allowed.has(v.toLowerCase())) continue;
			fail(
				'zindex',
				`${rule.selectors.join(', ')} @ ${rule.source}`,
				`z-index: ${v} 不在白名單 {${Object.keys(CFG.Z_LAYERS).join(', ')}}——` +
					'內容永遠待在常規流，要加第四個位置必須先講出它為什麼不能待在常規流',
			);
		}
	}
	note(`z 層級：產物用到 ${[...seen].sort().join('、') || '（無）'}，白名單 ${Object.keys(CFG.Z_LAYERS).join('、')}`);
}

// ===========================================================================
// 檢查 12（元素主色份量票 03）— 允許清單宣稱的辨識通道必須真的成立
// ===========================================================================
/**
 * 判準：**主色可以當文字色，但只在那個字的「認得出來」不靠顏色的時候。**
 * 辨識由字重、字體、字級或底線先承擔，顏色只負責份量。
 *
 * 第二類守的是「誰可以用主色」（清單即規則），這一類守的是「清單說的理由是不是真的」。
 * 兩件事本來就是兩件事：**「這個位置可以用主色」是人的決定，該留在清單；「辨識真的另有
 * 通道」是事實，該由機器查。**合成任一邊都會丟掉另一邊——只有清單的話，把一個只有顏色、
 * 沒有字重也沒有襯線的選擇器加進去就過了，而那正是上一輪之前比對器小標的狀態。
 *
 * **「獨立成行」不算通道**，所以詞彙表裡沒有這個鍵——本人否決的比對器小標與角標卡小標
 * 正是靠獨立成行在區分的東西，規則不該放行剛被否決的畫面。
 *
 * 誠實邊界：`shape`（形狀與位置）沒有任何宣告證明得了，這一類**查不到它**，只把它列出來
 * 交給人審。收工的 note 會講清楚「N 條裡有幾條是機器查不到的」——綠燈不等於全部查過。
 */
const STATE_SELECTOR_RE = /:(hover|focus|focus-visible|focus-within|active|target)\b/;

/**
 * 某個選擇器實際宣告的某一組屬性（取最後一條，即層疊後勝出的那個）。
 *
 * **刻意不與 `declaredValue` 合併**，雖然外層迴圈長得一樣：那一支「最後一條」的定義是
 * 「最後一條解析得出顏色的」——後面若再來一條 `background: none`，它會保留前一條的色。
 * 這一支要的是「最後一條宣告」本身（可能就是 `none`，第十二類正要靠它認出
 * `text-decoration: none` 是明講不要底線）。把兩者併起來會悄悄改掉對比檢查的語義，
 * 換到的只是省下四行——不划算。
 */
function declaredProp(siteRules, selector, props) {
	let found = null;
	for (const rule of siteRules) {
		if (rule.at.length) continue; // 媒體查詢內的覆蓋不算基準態
		if (!rule.selectors.includes(selector)) continue;
		for (const d of rule.decls) if (props.includes(d.prop)) found = d;
	}
	return found;
}

/** `font-weight` 的關鍵字折算成數字；認不得的回 NaN（fail-closed） */
const weightNumber = (v) => ({ bold: 700, normal: 400 })[v.trim().toLowerCase()] ?? parseFloat(v);

function checkIdentificationChannels(siteRules, vars) {
	const entries = [...CFG.ACCENT_TEXT_ALLOWLIST, ...EXTRA_CHANNEL_ENTRIES];
	const n900 = normalizeColor(resolveVars('var(--color-text)', vars));
	let humanOnly = 0;

	for (const e of entries) {
		const kind = CFG.ACCENT_CHANNELS[e.channel];
		if (!kind) {
			fail('channel', e.sel, `辨識通道「${e.channel}」不在 ACCENT_CHANNELS 詞彙表裡——清單只能用表上有的鍵`);
			continue;
		}
		if (!e.why || !e.why.trim()) {
			fail('channel', e.sel, '清單條目沒有寫理由——這份清單的存在意義就是「有理由的名單」');
		}

		// ── 宣告得出來的通道（字重／襯線／字級／底線）─────────────────────
		if (kind.props.length) {
			if (!e.on) {
				fail('channel', e.sel, `宣稱辨識通道是「${kind.name}」，卻沒說它宣告在哪個選擇器上（on 是空的）`);
				continue;
			}
			const got = declaredProp(siteRules, e.on, kind.props);
			if (!got) {
				fail(
					'channel',
					e.sel,
					`宣稱辨識通道是「${kind.name}」，但產物裡 ${e.on} 沒有宣告 ${kind.props.join('／')}——` +
						'清單說的理由與產物已經對不上，不是改回來就是把這條退出清單',
				);
				continue;
			}
			// 底線：`text-decoration: none` 是「明講不要」，不是有線（`.st-table a` 就長這樣）
			if (e.channel === 'underline' && /^none$/i.test(got.value.trim())) {
				fail('channel', e.sel, `宣稱辨識通道是「${kind.name}」，但產物裡 ${e.on} 寫的是 ${got.prop}: none——那是明講不要底線`);
				continue;
			}
			if (e.channel === 'weight') {
				const w = weightNumber(resolveVars(got.value, vars));
				if (!(w >= 500)) {
					fail('channel', e.sel, `宣稱辨識通道是「${kind.name}」，但 ${e.on} 的字重是 ${got.value}——不到 500 撐不起辨識`);
					continue;
				}
			}
			note(`辨識通道 ${e.sel}　${kind.name}　由 ${e.on} 的 ${got.prop}: ${got.value} 承擔`);
			continue;
		}

		// ── 狀態改變：sel 要真的是狀態選擇器，且靜止態必須已在 n-900 ────────
		if (e.channel === 'state') {
			if (!STATE_SELECTOR_RE.test(e.sel)) {
				fail(
					'channel',
					e.sel,
					'宣稱辨識通道是「狀態改變」，但這是一條靜止態選擇器——靜止的字沒有「它變了」這回事可以當辨識',
				);
				continue;
			}
			if (!e.on) {
				fail('channel', e.sel, '宣稱辨識通道是「狀態改變」，卻沒說靜止態是哪一條選擇器（on 是空的）');
				continue;
			}
			const rest = declaredValue(siteRules, e.on, ['color'], vars);
			if (rest !== n900) {
				fail(
					'channel',
					e.sel,
					`宣稱「靜止態已在中性階頂端，所以只能靠變色回饋」，但產物裡 ${e.on} 的文字色是 ` +
						`${rest ?? '（找不到這條規則）'}，不是 n-900 ${n900}——中性階之上還有得換，就不該動用主色`,
				);
				continue;
			}
			note(`辨識通道 ${e.sel}　${kind.name}　靜止態 ${e.on} 已在 n-900`);
			continue;
		}

		// ── 沒有任何宣告證明得了（目前只有 shape）：登記，不查 ──────────────
		humanOnly++;
		note(`辨識通道 ${e.sel}　${kind.name}　**機器查不到**，由清單的 why 交給人審`);
	}

	note(
		`辨識通道：清單 ${entries.length} 條，其中 ${humanOnly} 條沒有機器查得到的通道` +
			`${EXTRA_CHANNEL_ENTRIES.length ? `（含自我檢查注入的 ${EXTRA_CHANNEL_ENTRIES.length} 條假條目）` : ''}`,
	);
}

/**
 * 檢查 8（票 03）：聚焦組標記的孤兒。
 *
 * 手動標記是 D4 明選的做法，代價是「沒有人標就沒有效果」。防線有兩道：AI 的長期記憶，
 * 以及這一道。**設計上假設第一道會失效**，所以這一道不能靠任何人記得。
 *
 * 認的是**時間軸卡**不是「內容容器的直接子元素」。規格原文寫的是後者，那是照統計頁的
 * 形狀寫的——`.content--ai` 的直接子元素沒有一個帶標記，8 組全部是 `ul.tl` 裡的
 * `li.tl-item`。照原文實作，唯一真的在用這個機制的那一頁會滿江紅。
 *
 * `li.tl-era`（起點／開始實作／上線後三張章節卡）刻意不入組：它們是分隔標記不是內容，
 * 糊掉章節標題等於讀者找不到自己在哪。它們也沒有 `.tl-item` 那條位移規則，所以不會錯位。
 *
 * **忘了標記的後果是實測出來的，不是從 CSS 推的**：那張卡永遠清晰（糊化掛在屬性上，
 * 沒屬性就沒糊化），而且永遠停在 `translateX(-36px)`——位移歸零靠觀察器加 `is-centered`，
 * 觀察器只認標記過的元素。所以它是一張比別人左偏 36px、永遠不滑進來的卡，
 * 不是「永遠糊掉的卡」。第一版的失敗訊息寫反了，靠無頭瀏覽器實測才發現。
 *
 * 統計四頁不驗——2026-07-28 郁為推翻了那一半（「統計分析幾乎不適合做模糊」），
 * 那四頁 0 組是決定不是遺漏。
 */
const FOCUS_ATTR_RE = /<[a-z][a-z0-9-]*\b[^>]*?\sdata-focus-group(?=[\s=>])/gi;
const TL_ITEM_RE = /<li\b[^>]*\bclass=("[^"]*"|'[^']*')[^>]*>/gi;

function checkFocusOrphans(htmlFiles) {
	// 內聯的觀察器腳本裡有 '[data-focus-group]' 這個字串，掃屬性之前要先拿掉，
	// 否則腳本本身會讓「這頁有標記」永遠成立——那是 fail-open。
	const stripScripts = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '');

	const aiPages = htmlFiles.filter((f) => {
		const parts = relative(DIST, f).split(sep);
		return parts[0] === 'projects' && parts[1] === 'ai';
	});

	if (!aiPages.length) {
		fail('focus-orphan', '產物', '找不到任何 AI 專案內頁——這條檢查失去對象，先確認路由沒被改掉');
		return;
	}

	let cards = 0;
	let groups = 0;

	for (const f of aiPages) {
		const rel = relative(DIST, f);
		const html = stripScripts(readFileSync(f, 'utf8'));

		const n = (html.match(FOCUS_ATTR_RE) || []).length;
		groups += n;

		let i = 0;
		for (const m of html.matchAll(TL_ITEM_RE)) {
			if (!/\btl-item\b/.test(m[1])) continue;
			i++;
			cards++;
			if (!/\sdata-focus-group(?=[\s=>])/.test(m[0])) {
				// 不吃例外清單：這不是「可以有理由保留」的那種違規，是純粹的遺漏。
				failures.push({
					check: 'focus-orphan',
					key: `${rel} :: 第 ${i} 張 li.tl-item`,
					detail:
						'時間軸卡沒有 data-focus-group。實測後果（無頭瀏覽器量的，不是推論）：那張卡永遠清晰、' +
						'而且永遠停在 translateX(-36px)——位移歸零靠的是觀察器加上 is-centered，而觀察器只認標記過的元素。' +
						'結果是一張比其他卡左偏 36px、永遠不滑進來的卡',
				});
			}
		}

		if (n === 0) {
			failures.push({
				check: 'focus-orphan',
				key: rel,
				detail: 'AI 專案內頁的聚焦組數為 0——這一條擋的是「新增一個不是時間軸形狀的 AI 頁」，上面那條認 li.tl-item，遇到那種頁會整條空過',
			});
		}
	}

	note(`聚焦組：${aiPages.length} 個 AI 專案內頁、${cards} 張時間軸卡、${groups} 組（統計頁不在範圍內）`);
}

/**
 * 檢查 13（票 02）：一個分類只能有一個顯示名。
 *
 * 票 02 之前，分類名散在四個地方各寫一次（導覽列、列表頁、內頁的 map、以及人手打在
 * frontmatter 標題裡的「AI 專案 #1」）。四份的漂移方式很具體：改了三處、漏掉第四處，
 * 於是導覽列寫「AI 實作」、專案標題寫「AI 專案」，**同一個地方在同一屏上有兩個名字**。
 * 30 秒的陌生人分不出那是不是兩個東西。
 *
 * 守法是掃產物找**登記過的舊名**（`src/categories.mjs` 的 `RETIRED_LABELS`）。
 * 這裡刻意與版面共用同一份清單——閘門若自己抄一份舊名，就又生出第五個定義。
 *
 * ── 誠實邊界（三條，都是結構性的，不是懶）────────────────────────────
 *
 * · **只認得登記過的舊名。** 明天有人發明第三個叫法（「AI 作品」）而不登記，這條看不見。
 *   它擋的是回頭路，不是想像力。
 * · **不驗語意，只驗字串。** 一句「這是我第一個 AI 專案」與一個分類徽章「AI 專案」
 *   在產物裡長得一模一樣，這條分不出來，兩個都會紅。**這是刻意的**：分不出來的時候
 *   寧可紅，讓人來判斷；換成「只在某個 class 裡面才算」就會被下一個版型繞過去。
 * · **`/process/` 的九頁豁免。** 那些是標了日期的歷史重演存檔，裡面的「AI 專案」是
 *   當時的真實狀態，改它等於讓存檔說謊（與 CLAUDE.md 的明文豁免同一條理由）。
 */
function checkCategoryNames(htmlFiles) {
	let hits = 0;
	for (const f of htmlFiles) {
		const rel = relative(DIST, f);
		const html = readFileSync(f, 'utf8');
		for (const r of CATS.RETIRED_LABELS) {
			if (!html.includes(r.label)) continue;
			hits++;
			fail(
				'category-name',
				`${rel} :: ${r.label}`,
				`「${r.label}」是分類 ${r.key} 的舊顯示名（${r.retiredOn} 退役），正名是「${CATS.categoryLabel(r.key)}」。` +
					'產物裡同時出現兩個名字指同一個分類，讀者分不出那是不是兩個地方。' +
					'改的是原始碼那一份，不是這裡——分類名的單一來源在 src/categories.mjs',
			);
		}
	}
	note(
		`分類顯示名：${CATS.CATEGORIES.map((c) => `${c.key}→${c.label}`).join('、')}；` +
			`退役名 ${CATS.RETIRED_LABELS.length} 個，掃過 ${htmlFiles.length} 頁，命中 ${hits} 次`,
	);
	checkCategoryIndexRules();
}

/**
 * 序號規則的自我檢查（票 02）。
 *
 * **為什麼要一組假資料**：站上現在只有一件 AI 實作，所以產物裡那個「#1」不管排序邏輯
 * 對不對都會印出來——寫死一個 1 也長一樣。序號真正要撐的三件事（依日期由舊到新、
 * 每個分類各自數、同一天不得隨機排）在真實資料上一件都驗不到。
 *
 * **為什麼寫在閘門裡**：這個 repo 沒有測試框架，而閘門是唯一一個「紅了就不會部署」的
 * 地方。序號算錯的後果是首頁展示卡掛一個錯號碼（票 05），那正是不該讓它上線的事。
 */
function checkCategoryIndexRules() {
	const fake = [
		{ id: 'ai/late', data: { category: 'ai', date: new Date('2026-03-01') } },
		{ id: 'ai/early', data: { category: 'ai', date: new Date('2026-01-01') } },
		{ id: 'stats/b-same-day', data: { category: 'stats', date: new Date('2026-02-01') } },
		{ id: 'stats/a-same-day', data: { category: 'stats', date: new Date('2026-02-01') } },
	];
	const got = CATS.categoryIndexes(fake);
	const want = { 'ai/early': 1, 'ai/late': 2, 'stats/a-same-day': 1, 'stats/b-same-day': 2 };
	for (const [id, n] of Object.entries(want)) {
		if (got.get(id) === n) continue;
		fail(
			'category-name',
			`序號規則 :: ${id}`,
			`categoryIndexes 給 ${id} 的號碼是 ${got.get(id)}，應該是 ${n}。` +
				'三條規則各對應一個案例：依日期由舊到新（ai/early 要是 #1）、每個分類各自數' +
				'（stats 不受 ai 影響）、同一天用 id 定序（否則同一份原始碼在不同機器上會給出不同號碼）',
		);
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

	// 票 01：`.js` 進來了。背景設計的色碼寫在腳本裡，不掃 JS 等於留一條白名單看不見的路。
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

	console.log('— 1／13 色碼白名單');
	checkColorWhitelist(textFiles, allowedCss);
	checkSiteColorsOnRamp();
	checkChartPixels();

	console.log('— 2／13 對比度');
	checkGrainModel();
	checkContrast(vars, siteRules);
	checkOpacityNotLevel(siteRules);

	console.log('— 3／13 色盲安全');
	checkColorVision();

	console.log('— 4／13 色階規律');
	checkRamps(vars);

	console.log('— 5／13 排版與間距規律');
	checkTypographyAndSpacing(siteRules, vars);

	console.log('— 6／13 可及性偏好的逃生口（降低動態／增加對比）');
	checkReducedMotion(siteParsed);
	checkStandingMotionReducedMotion(scriptSources);
	checkContrastEscape(siteParsed);

	console.log('— 7／13 背景設計參數與常駐動態');
	checkMotif(siteHtmlFiles);

	console.log('— 8／13 聚焦組標記完整（孤兒檢查）');
	checkFocusOrphans(siteHtmlFiles);

	console.log('— 9／13 場的參數與回彈紅線');
	checkField(siteHtmlFiles);

	console.log('— 10／13 全站不用陰影');
	checkNoShadow(siteRules);

	console.log('— 11／13 z 層級白名單');
	checkZIndex(siteRules);

	console.log('— 12／13 允許清單宣稱的辨識通道');
	checkIdentificationChannels(siteRules, vars);

	console.log('— 13／13 分類顯示名的單一來源');
	checkCategoryNames(siteHtmlFiles);

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

	console.log(`\n✓ 十三類檢查全部通過${excepted.length ? `（${excepted.length} 項明文例外）` : ''}`);
}

main();
