/**
 * 背景設計的墨量與文字帶減光的量測（票 04 的驗收證據，不進 CI）。
 *
 * 三組數字，都直接讀 canvas 的 alpha——**不從截圖亮度推**：光點的合成 alpha 與顆粒層
 * 的雜訊同量級，亮度掃描分不出來（2026-07-30 實測結論）。
 *
 *   有墨    ：alpha 非零的像素佔全畫布幾成、那些像素的平均不透明度
 *             （診斷「看起來像一片純色」時量到的 1.69% ／ 13% 就是這兩個數字）
 *   帶內核心：文字帶往內縮一個化開寬度之後那塊，合成 alpha 的平均與最大
 *             **煞車一的判準：最大值不得超過 textBandMaxAlpha**（＝ destination-out
 *             用 1−上限 去背之後的數學上限）
 *   帶外    ：離文字帶一個化開寬度以外，合成 alpha 的平均與最大——加墨要亮在這裡
 *
 * 文字帶的盒子在這裡**故意重算一次**，規則與 Motif.astro 的 contentBoxes() 同源但各寫
 * 各的（理由同 probe-uniform.js：量測工具照抄被量的程式，兩邊會一起錯、一起看不見）。
 *
 * 配 `--force-prefers-reduced-motion` 跑，拿到的是確定性的呼吸中點幀。
 */
addEventListener('load', () => {
	const cv = document.querySelector('canvas.motif');
	const main = document.querySelector('main');
	const M = JSON.parse(cv.dataset.motif);
	const K = JSON.parse(cv.dataset.motifCraft);
	const W = innerWidth;
	const dpr = cv.width / W; // 繪製程式的 DPR（有上限，不等於 devicePixelRatio）
	const breathing = cv.dataset.motifMode !== 'reading';
	const col = main.getBoundingClientRect().width;
	const fw = col * K.layout.textBandFeather;

	// ── 文字帶（視窗座標，獨立重算） ──────────────────────────────────────
	const boxes = [];
	let inner = null;
	for (const el of main.children) {
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height) continue;
		inner = inner
			? { left: Math.min(inner.left, r.left), right: Math.max(inner.right, r.right),
				top: Math.min(inner.top, r.top), bottom: Math.max(inner.bottom, r.bottom) }
			: { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
	}
	if (inner) boxes.push(inner);
	const foot = document.querySelector('footer');
	if (foot) {
		const r = foot.getBoundingClientRect();
		const c = main.getBoundingClientRect();
		if (r.width && r.height) boxes.push({ left: c.left, right: c.left + c.width, top: r.top, bottom: r.bottom });
	}

	/**
	 * 在盒子裡嗎（pad 為負＝把盒子往外放）。垂直方向只有首頁要收（閱讀頁的欄貫穿整頁）。
	 *
	 * **帶內取盒子本身、不往內縮**：遮罩的化開整段長在盒子**外面**——ramp 從 `a−fw`
	 * 的 0 升到 `a` 的 1，盒內全程是滿的。所以「字後面」就是盒子本身，
	 * 而 `−fw` 放大出來的那一圈是化開帶，兩邊都不算。
	 */
	const hit = (b, x, y, pad) =>
		x >= b.left - pad && x <= b.right + pad && (!breathing || (y >= b.top - pad && y <= b.bottom + pad));

	// ── 掃全畫布 ─────────────────────────────────────────────────────────
	const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
	const acc = { core: [0, 0, 0], out: [0, 0, 0] }; // [像素數, alpha 總和, alpha 最大]
	const VISIBLE = 0.08 * 255; // 均勻判準的「可見」門檻，兩支探針同一個數
	let inkPx = 0;
	let inkSum = 0;
	let seenPx = 0;
	for (let p = 0; p < cv.width * cv.height; p++) {
		const a = d[p * 4 + 3];
		if (a) { inkPx++; inkSum += a; }
		if (a >= VISIBLE) seenPx++;
		const px = (p % cv.width) / dpr;
		const py = ((p - (p % cv.width)) / cv.width) / dpr;
		let core = false;
		let near = false;
		for (const b of boxes) {
			if (hit(b, px, py, 0)) core = true;
			if (hit(b, px, py, fw)) near = true;
		}
		const bin = core ? acc.core : near ? null : acc.out;
		if (!bin) continue;
		bin[0]++;
		bin[1] += a;
		if (a > bin[2]) bin[2] = a;
	}

	const all = cv.width * cv.height;
	const f = (n) => n.toFixed(1);
	const stat = (b) => (b[0] ? `平均${f(b[1] / b[0])} 最大${b[2]} (${b[0]}px)` : '無像素');
	const cap = M.textBandMaxAlpha * 255;
	const line =
		`BAND mode=${cv.dataset.motifMode} vw=${W}x${innerHeight} dpr=${dpr} 欄寬=${Math.round(col)} 化開=${Math.round(fw)}\n` +
		`有墨像素=${((inkPx / all) * 100).toFixed(2)}% 其平均不透明度=${((inkSum / Math.max(1, inkPx)) / 255 * 100).toFixed(1)}%` +
		` 看得見的像素(≥0.08)=${((seenPx / all) * 100).toFixed(2)}%\n` +
		`帶內核心 ${stat(acc.core)}\n` +
		`帶外　　 ${stat(acc.out)}\n` +
		`煞車一上限=${f(cap)}/255（textBandMaxAlpha ${M.textBandMaxAlpha}）` +
		` 判準=${acc.core[0] === 0 || acc.core[2] <= Math.ceil(cap) ? 'PASS' : 'FAIL'}`;

	const box = document.createElement('div');
	box.id = 'probe-out';
	box.style.cssText =
		'position:fixed;top:0;left:0;right:0;z-index:99;background:#000;color:#0f0;font:14px monospace;padding:8px;white-space:pre';
	box.textContent = line;
	document.body.appendChild(box);
});
