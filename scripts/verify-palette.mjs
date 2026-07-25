#!/usr/bin/env node
/**
 * npm run verify:palette — 設計系統的部署前閘門。
 *
 * 讀的是 `astro build` 的產物 `dist/` 與 21 張圖表 PNG，不讀原始碼：
 * 重構 CSS、換 token 分層都不該讓這支腳本失敗。
 *
 * 六類檢查見 SPEC-design-system.md「Testing Decisions」與
 * SPEC-motion-and-shape.md「加進 verify:palette 的第六類檢查」。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from './color-math.mjs';
import { countColors } from './png-read.mjs';
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
			i = src.indexOf('*/', i + 2) + 1;
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
			i = src.indexOf('*/', i + 2) + 1;
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
				i = text.indexOf('*/', i + 2) + 2;
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
		for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
			const norm = normalizeColor(m[0]);
			if (!norm || seen.has(norm)) continue;
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
function checkContrast(vars) {
	const resolve = (v) => normalizeColor(resolveVars(v, vars));
	for (const pair of CFG.CONTRAST_PAIRS) {
		const fg = resolve(pair.fg);
		const bg = resolve(pair.bg);
		if (!fg || !bg) {
			fail('contrast', `${pair.fg} on ${pair.bg}`, `無法解析色值（${pair.where}）`);
			continue;
		}
		const ratio = C.contrast(opaque(fg), opaque(bg));
		const label = `${opaque(fg)} on ${opaque(bg)}`;
		note(`對比 ${ratio.toFixed(2)}　${label}　${pair.where}`);
		if (ratio < CFG.CONTRAST_MIN) {
			fail('contrast', label, `${pair.where}：實測 ${ratio.toFixed(2)}，低於 ${CFG.CONTRAST_MIN}`);
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

// ===========================================================================
// 主流程
// ===========================================================================
function main() {
	if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
		console.error(`找不到 ${DIST}——先跑 astro build。`);
		process.exit(2);
	}

	const allFiles = walk(DIST);
	const textFiles = allFiles.filter((f) => /\.(html|css|svg)$/i.test(f));
	const siteCssFiles = textFiles.filter((f) => f.endsWith('.css'));

	const allowedCss = new Set(
		[
			...Object.keys(CFG.SITE_PALETTE),
			...Object.keys(CFG.RAMP_PALETTE),
			...CFG.CATEGORICAL,
			...CFG.SEQUENTIAL,
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
		const inline = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
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

	console.log('— 1／6 色碼白名單');
	checkColorWhitelist(textFiles, allowedCss);
	checkSiteColorsOnRamp();
	checkChartPixels();

	console.log('— 2／6 對比度');
	checkContrast(vars);
	checkOpacityNotLevel(siteRules);

	console.log('— 3／6 色盲安全');
	checkColorVision();

	console.log('— 4／6 色階規律');
	checkRamps(vars);

	console.log('— 5／6 排版與間距規律');
	checkTypographyAndSpacing(siteRules, vars);

	console.log('— 6／6 降低動態偏好覆蓋');
	checkReducedMotion(siteParsed);

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

	console.log(`\n✓ 六類檢查全部通過${excepted.length ? `（${excepted.length} 項明文例外）` : ''}`);
}

main();
