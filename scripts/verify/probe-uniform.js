/**
 * 母題均勻判準的量測（2026-07-28 grilling 定案，看板「母題的均勻判準」那節）。
 *
 * 判準：畫面上任何一塊 375×375 的方格，只要文字帶沒有蓋過它一半以上，
 * 在呼吸中點那一幀，至少要有 4 個可見元素（點與線都算）。
 * 可見 ＝ 合成後不透明度 ≥ 0.08（蓋得過顆粒層自身的亮度起伏 ΔL 3.73）。
 *
 * 呼吸中點那一幀怎麼取：降低動態偏好下繪製程式走 breath(0)、且沒有漂移——
 * 而 breath(0) 恰好是中點（三個正弦在 t=0 全為 0，權重和為 1 故回傳 0.5）。
 * 所以這支探針要配 `--force-prefers-reduced-motion` 跑，拿到的是**確定性的中點幀**，
 * 不必跟常駐 rAF 迴圈搶時間（無頭 Chrome 的虛擬時間對常駐迴圈幾乎不前進，見看板）。
 *
 * 文字帶的盒子在這裡**故意重算一次**，不從繪製程式取。量測工具照著被量的程式抄，
 * 兩邊一起錯就一起看不見；獨立重算才驗得出東西。規則與 Motif.astro 的 contentBoxes()
 * 同源（main 各子元素的聯集＋頁尾取欄寬），但這裡是各寫各的。
 */
addEventListener('load', () => {
	const CELL = 375; // 判準指定的方格邊長（CSS px）
	const STEP = 125; // 滑動步長：「任何一塊」不是只有對齊網格的那幾塊
	const NEED = 4; // 每格至少幾個可見元素
	const VISIBLE = 0.08; // 可見門檻（合成後不透明度）
	const HALF = 0.5; // 文字帶蓋過這個比例以上就豁免

	const cv = document.querySelector('canvas.motif');
	const ctx = cv.getContext('2d');
	const main = document.querySelector('main');
	const W = innerWidth;
	const H = innerHeight;
	const dpr = cv.width / W; // 繪製程式的 DPR（有上限，不等於 devicePixelRatio）

	// ── 1. 門檻化：合成後不透明度 ≥ 0.08 的像素 ───────────────────────────
	const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
	const cw = cv.width;
	const ch = cv.height;
	const on = new Uint8Array(cw * ch);
	const cut = VISIBLE * 255;
	for (let i = 0; i < cw * ch; i++) on[i] = data[i * 4 + 3] >= cut ? 1 : 0;

	// ── 2. 連通元件：一顆點是一個元素，趨勢線是一個橫跨多格的元素 ──────────
	// 四鄰接、明確堆疊（遞迴會在趨勢線那種長元件上爆堆疊）。
	const seen = new Uint8Array(cw * ch);
	const comps = []; // 每個元件的邊界盒（CSS px）
	const stack = [];
	for (let s = 0; s < cw * ch; s++) {
		if (!on[s] || seen[s]) continue;
		seen[s] = 1;
		stack.push(s);
		let x0 = cw, x1 = -1, y0 = ch, y1 = -1;
		while (stack.length) {
			const p = stack.pop();
			const x = p % cw;
			const y = (p - x) / cw;
			if (x < x0) x0 = x;
			if (x > x1) x1 = x;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
			if (x > 0 && on[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
			if (x < cw - 1 && on[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
			if (y > 0 && on[p - cw] && !seen[p - cw]) { seen[p - cw] = 1; stack.push(p - cw); }
			if (y < ch - 1 && on[p + cw] && !seen[p + cw]) { seen[p + cw] = 1; stack.push(p + cw); }
		}
		comps.push({ x0: x0 / dpr, x1: x1 / dpr, y0: y0 / dpr, y1: y1 / dpr });
	}

	// ── 3. 文字帶（視窗座標，獨立重算） ──────────────────────────────────
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
		const col = main.getBoundingClientRect();
		if (r.width && r.height)
			boxes.push({ left: col.left, right: col.left + col.width, top: r.top, bottom: r.bottom });
	}

	const overlap = (a, b) =>
		Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
		Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

	// ── 4. 每一塊 375×375 的滑動視窗 ─────────────────────────────────────
	const cells = [];
	for (let top = 0; top + CELL <= H + 1; top += STEP) {
		for (let left = 0; left + CELL <= W + 1; left += STEP) {
			const cell = { left, top, right: left + CELL, bottom: top + CELL };
			// 文字帶蓋過一半以上就豁免（多塊取聯集的上界，兩塊重疊會高估覆蓋率，
			// 高估等於多豁免——所以這裡對判準是寬鬆的一側，不會假性通過）
			let covered = 0;
			for (const b of boxes) covered += overlap(cell, b);
			if (covered / (CELL * CELL) > HALF) continue;
			let n = 0;
			for (const c of comps)
				if (c.x1 >= cell.left && c.x0 <= cell.right && c.y1 >= cell.top && c.y0 <= cell.bottom) n++;
			cells.push({ left, top, n });
		}
	}

	const bad = cells.filter((c) => c.n < NEED);
	const worst = cells.reduce((a, c) => (c.n < a.n ? c : a), { n: Infinity });
	// 診斷：判準用的是「可見元素」，而看板推導 19% 時用的是「點數期望」。
	// 兩者差多少要量出來，不能推論——擲了幾顆、其中幾顆合成後還看得見。
	const M = JSON.parse(cv.dataset.motif);
	const col = main.getBoundingClientRect().width;
	const tile = col * M.tileHeightColumns;
	const thrown =
		cv.dataset.motifMode === 'reading'
			? Math.round((W * tile) / 1000) * M.density.reading * (H / tile) // 視窗內那一段
			: Math.min(JSON.parse(cv.dataset.motifCraft).pointCap, Math.round((W * H) / 1000) * M.density.home);

	const line =
		`UNIFORM mode=${cv.dataset.motifMode} vw=${W}x${H} col=${Math.round(col)} ` +
		`擲點≈${Math.round(thrown)} 元素=${comps.length} ` +
		`受測格=${cells.length} 不及格=${bad.length} 最少=${worst.n === Infinity ? '-' : worst.n} ` +
		`最少格=(${worst.left ?? '-'},${worst.top ?? '-'}) 判準=${bad.length === 0 ? 'PASS' : 'FAIL'}` +
		` 不及格格=${bad.map((c) => `(${c.left},${c.top}):${c.n}`).join(' ') || '無'}`;

	const box = document.createElement('div');
	box.id = 'uniform-out';
	box.style.cssText =
		'position:fixed;top:0;left:0;right:0;z-index:99;background:#000;color:#0f0;font:14px monospace;padding:8px;white-space:pre';
	box.textContent = line;
	document.body.appendChild(box);
});
