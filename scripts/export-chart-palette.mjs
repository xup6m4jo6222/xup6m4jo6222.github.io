#!/usr/bin/env node
/**
 * 把圖表要用的色票從 `palette-config.mjs` 匯出成 JSON，給統計專案的 Python 讀。
 *
 * 為什麼要有這支：統計專案是**要給陌生人 clone 的公開 repo**，它不能依賴一個
 * 別人手上沒有的網站資料夾。所以產生物 commit 進統計專案，而產生它的權力留在
 * 網站這邊——色票的正本只有 `palette-config.mjs` 一份。
 *
 * **Python 端不准自己抄一份色碼。** 抄一份就會漂移，而漂移正是配色閘門存在的理由。
 *
 * 輸出刻意不帶時間戳：色票沒變的話重跑會產生位元相同的檔案，git 上看得出「真的沒變」。
 *
 *   node scripts/export-chart-palette.mjs [輸出路徑]
 *
 * 預設輸出到隔壁的統計專案。換色流程見 CLAUDE.md「換色檢查清單」。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cfg from './palette-config.mjs';

const C = cfg.default ?? cfg;
const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(HERE, '..', '..', '統計專案', '01-旅客消費動向', 'src', 'chart_palette.json');

const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;

/* 只匯出圖表畫得到的東西。閘門的兩個門檻也一起帶過去——Python 端要能自己
   先驗一次，不必等 npm run verify:palette 才發現色碼跑掉。 */
const payload = {
	_來源: 'portfolio-site/scripts/palette-config.mjs（正本）。這個檔案是產生物，不要手改。',
	_重新產生: 'node scripts/export-chart-palette.mjs',
	背景: C.NEUTRAL_RAMP['50'],
	面板底: C.NEUTRAL_RAMP['100'],
	格線: C.NEUTRAL_RAMP['200'],
	次要文字: C.NEUTRAL_RAMP['600'],
	主要文字: C.NEUTRAL_RAMP['900'],
	中性階: C.NEUTRAL_RAMP,
	類別色: C.CATEGORICAL,
	連續色帶: C.SEQUENTIAL,
	閘門: {
		最小像素佔比: C.PNG_MIN_PIXEL_RATIO,
		連線容差: C.PNG_SEGMENT_TOLERANCE,
		白名單: Object.keys(C.PNG_PALETTE),
	},
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(payload, null, '\t') + '\n', 'utf8');

console.log(`圖表色票已匯出　${out}`);
console.log(`　類別色 ${payload.類別色.length} 個、連續色帶 ${payload.連續色帶.length} 節點、白名單 ${payload.閘門.白名單.length} 色`);
