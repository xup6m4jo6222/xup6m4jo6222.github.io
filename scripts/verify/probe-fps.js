/**
 * 票 05：幀率與每幀成本實測。
 *
 * **這支必須在真瀏覽器裡跑**（桌機開視窗、手機連區網）。無頭 Chrome 的
 * `--virtual-time-budget` 遇到常駐 rAF 迴圈幾乎不前進（實測 2 秒只給 4 幀），
 * 在那個環境量到的幀率是量測環境的假象，不是這個站的數字（看板 2026-07-28 那條教訓）。
 *
 * 量法：在母題的模組執行**之前**換掉 window.requestAnimationFrame，替每一次回呼計時。
 * 注入點在 </body> 前，是傳統腳本，於解析當下執行；母題是 type=module（延後執行），
 * 所以順序穩定。母題被 fpsCap 擋掉的那些幀成本近 0，只計真的重畫的那些。
 *
 * 讀數三個層次：
 *   畫面更新率  ——「順不順」。60Hz 螢幕上掉到 50 以下就是讀者感覺得到的卡。
 *   母題重畫率  —— 應該貼齊 fpsCap（30）。明顯低於 30 表示畫不完。
 *   每幀成本    ——「還能加多少點」的唯一依據，pointCap 由它反推。
 */
(() => {
	const BUDGET = 11; // 每幀預算（ms）。pointCap 的定義就是「這個預算下擺得下幾個點」
	const raf = window.requestAnimationFrame.bind(window);
	const cost = []; // 母題真的重畫的那些幀，各佔用幾 ms
	const ticks = []; // 每一次畫面更新的時間戳

	window.requestAnimationFrame = (cb) =>
		raf((t) => {
			const a = performance.now();
			cb(t);
			const b = performance.now();
			/* 被 fpsCap 擋掉的幀直接 return（一次比較，量到近 0），那些不是「畫一幀要多久」。
			   門檻要遠低於真正的繪製成本，否則會把便宜的那些幀一起砍掉：
			   第一版用 0.5ms，而桌機中位成本就是 0.80ms——重畫率因此只算到 16.5/秒
			   而不是 fpsCap 的 30，中位成本也被截尾高估。0.15ms 分得開兩者。 */
			if (b - a > 0.15) cost.push(b - a);
		});

	const pct = (arr, p) => {
		if (!arr.length) return NaN;
		const s = [...arr].sort((x, y) => x - y);
		return s[Math.min(s.length - 1, Math.floor(s.length * p))];
	};

	let jank = 0; // 超過 50ms 的長工作次數（讀者感覺得到的頓）
	try {
		new PerformanceObserver((l) => { jank += l.getEntries().length; }).observe({ type: 'longtask', buffered: true });
	} catch { /* 手機瀏覽器可能沒有 longtask，沒有就不報這一項 */ }

	addEventListener('load', () => {
		const cv = document.querySelector('canvas.motif');
		const box = document.createElement('div');
		box.style.cssText =
			'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;' +
			'font:13px/1.5 monospace;padding:10px;white-space:pre-wrap;pointer-events:none';
		document.body.appendChild(box);
		if (!cv) { box.textContent = '這一頁沒有母題（BaseLayout 沒給 motif prop）'; return; }

		const M = JSON.parse(cv.dataset.motif);
		const K = JSON.parse(cv.dataset.motifCraft);
		const mode = cv.dataset.motifMode;
		const main = document.querySelector('main');
		const t0 = performance.now();
		/* 每一次載入自成一筆。第一版拿 UA|mode 當 id，結果是：改了設定重新量時，
		   上一輪沒關掉的瀏覽器還在回報同一個 id，用舊產物的數字蓋掉新的——
		   三次不同密度全回報同一個點數 222，量了等於沒量。 */
		const id = `${navigator.userAgent.slice(0, 40)}|${mode}|${Math.random().toString(36).slice(2, 8)}`;

		/** 這一屏實際擲了幾個點——反推 pointCap 要拿它當基數。 */
		const points = () => {
			const W = innerWidth, H = innerHeight;
			// 取整要跟繪製程式的 countFor 一致（先乘密度再 round），否則會多出半個點
			if (mode === 'breathe') return Math.min(K.pointCap, Math.round(((W * H) / 1000) * M.density.home));
			const tile = main.getBoundingClientRect().width * M.tileHeightColumns;
			return Math.min(K.pointCap, Math.round(((W * tile) / 1000) * M.density.reading));
		};

		/* 閱讀頁沒有常駐迴圈，不捲就沒有成本可量。桌機那組用 ?autoscroll 自動來回捲，
		   量得出來也重跑得出來；手機那組不開這個旗標，由讀者真的用手捲——
		   合成器捲動與程式捲動在手機上不是同一條路，那正是要量的東西。 */
		if (mode === 'reading' && location.search.includes('autoscroll')) {
			let dir = 1;
			setInterval(() => {
				const max = document.documentElement.scrollHeight - innerHeight;
				if (scrollY >= max - 2) dir = -1;
				if (scrollY <= 2) dir = 1;
				scrollBy(0, dir * 24);
			}, 16);
		}

		const tick = (t) => { ticks.push(t); raf(tick); };
		raf(tick);

		setInterval(() => {
			const now = performance.now();
			const secs = (now - t0) / 1000;
			// 最近 5 秒：長時間停留時要看的是「有沒有越跑越慢」，不是開頭那一下
			const recent = ticks.filter((t) => t > now - 5000);
			const fpsRecent = recent.length > 1 ? (recent.length - 1) / ((recent.at(-1) - recent[0]) / 1000) : 0;
			const fpsAll = ticks.length > 1 ? (ticks.length - 1) / ((ticks.at(-1) - ticks[0]) / 1000) : 0;
			const med = pct(cost, 0.5), p95 = pct(cost, 0.95), max = Math.max(0, ...cost);
			const n = points();
			// 由每幀預算反推點數上限：成本與點數大致成正比
			const cap = med ? Math.round((n * BUDGET) / med) : 0;

			// 回報給收集器（同一台主機的 :4455）。讀數同時留在畫面上，兩邊都看得到。
			// sendBeacon 是簡單請求，不會觸發預檢——手機跨來源送得出去。
			try {
				navigator.sendBeacon(
					`http://${location.hostname}:4455/`,
					new Blob([JSON.stringify({
						id, ua: navigator.userAgent.slice(0, 90), mode,
						vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
						points: n, secs: secs.toFixed(0),
						fpsRecent: fpsRecent.toFixed(1), fpsAll: fpsAll.toFixed(1),
						redraws: (cost.length / secs).toFixed(1),
						med: med.toFixed(2), p95: p95.toFixed(2), max: max.toFixed(2),
						jank, cap,
					})], { type: 'text/plain' }),
				);
			} catch { /* 收集器沒開就只看畫面 */ }

			box.textContent =
				`模式 ${mode}　視窗 ${innerWidth}×${innerHeight}　DPR ${devicePixelRatio}（取樣上限 ${K.dprCap}）\n` +
				`目前點數 ${n}　fpsCap ${M.fpsCap}　已跑 ${secs.toFixed(0)} 秒\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
				`畫面更新率　最近5秒 ${fpsRecent.toFixed(1)} fps　全程 ${fpsAll.toFixed(1)} fps\n` +
				`母題重畫率　${(cost.length / secs).toFixed(1)} 次/秒（應貼齊 ${M.fpsCap}）\n` +
				`母題每幀成本　中位 ${med.toFixed(2)} ms　p95 ${p95.toFixed(2)} ms　最大 ${max.toFixed(2)} ms\n` +
				`長工作(>50ms) ${jank} 次\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
				`每幀預算 ${BUDGET}ms 下擺得下 ≈ ${cap} 個點（現行 pointCap ${K.pointCap}）\n` +
				(mode === 'reading' ? '※ 閱讀頁沒有常駐迴圈，請上下捲動幾次再看數字' : '※ 放著幾分鐘，看「最近5秒」有沒有往下掉');
		}, 500);
	});
})();
