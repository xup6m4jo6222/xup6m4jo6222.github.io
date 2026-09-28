/**
 * 網站上所有固定文字的讀取口（2026-09-28，本人同意經雜事主控轉交）。
 *
 * 正本是同資料夾的 `site-text.md`，格式沿用 AI 專案 07 共用編輯系統的「文字.md」：
 *   ## 分組 · 用途
 *   <!-- text:代號 -->
 *   正文
 *   <!-- /text -->
 * 檔尾一段 `<!-- layout -->{}<!-- /layout -->` 是 07 舊版相容用，這裡不讀。
 * 將來 07 做「檔案型來源」的管理頁，可以直接接這個檔，不必改格式。
 *
 * **網站新增任何會顯示的文字，一律加進 site-text.md，再用 t('代號') 取，不要寫死在 .astro 裡。**
 * 例外只有 `src/prompt.mjs`（證物，逐字凍結，閘門會比對）與 `src/content/projects/`（文章本身就是 Markdown）。
 *
 * 用 fs 讀而不是 Vite 的 `?raw`：`categories.mjs` 也被配色閘門、分享卡腳本這些純 Node 程式 import，
 * 兩邊都要讀得到。路徑以專案根目錄（npm 與 CI 的工作目錄）為準；建置時程式會被打包搬走，
 * import.meta.url 不可靠。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = 'site-text.md';
const candidates = [resolve(process.cwd(), 'src', FILE)];
try { candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), FILE)); } catch {}
const path = candidates.find((p) => existsSync(p));
if (!path) throw new Error(`找不到網站文字檔 src/${FILE}（工作目錄要在網站根目錄）`);

const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');

// 與 07 的 content_store.decode 同一條規則：一段一個代號，正文夾在標記之間
const blocks = [...raw.matchAll(/^<!-- text:([^\r\n]+) -->\r?\n([\s\S]*?)\r?\n<!-- \/text -->$/gm)];
const TEXT = new Map();
for (const [, key, body] of blocks) {
	if (TEXT.has(key)) throw new Error(`網站文字檔的代號重複：${key}`);
	if (body.length > 8000) throw new Error(`網站文字過長（上限 8000 字）：${key}`);
	if (body.includes('<!--')) throw new Error(`網站文字不能含「<!--」：${key}`);
	TEXT.set(key, body.replace(/\r/g, ''));
}
if ((raw.match(/^<!-- layout -->$/gm) || []).length !== 1) throw new Error('網站文字檔檔尾的 layout 區塊遺漏或重複（07 相容用，內容保持 {} 即可）');

const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

/**
 * 取一段文字。代號不存在 → 直接丟錯，建置失敗（頁面用到的字一定要在文字檔裡）。
 * vars 會代入 {變數}；文字裡的 {變數} 必須剛好是呼叫端給的那幾個，少了多了都算錯。
 */
export function t(key, vars) {
	if (!TEXT.has(key)) throw new Error(`網站文字檔裡找不到代號「${key}」——請在 src/${FILE} 加一段 <!-- text:${key} -->`);
	const s = TEXT.get(key);
	const want = vars ? Object.keys(vars).sort().join(',') : '';
	if (slots(s) !== want) throw new Error(`網站文字「${key}」的 {變數} 對不上：文字裡是 {${slots(s)}}，程式給的是 {${want}}`);
	return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k])) : s;
}

export const TEXT_KEYS = [...TEXT.keys()];
