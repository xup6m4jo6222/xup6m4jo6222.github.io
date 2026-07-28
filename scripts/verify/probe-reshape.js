/**
 * 抗辯第一輪紅隊提的一條，本機清不掉，只能在真手機上判：
 * **捲動時網址列收合會不會讓背景的點整批重擲？**
 *
 * 繪製程式用 `${W}×${H}@${DPR}／${col}` 當「畫布有沒有真的變」的簽章（Motif.astro:327），
 * `H` 是原始 `innerHeight`、沒有容差。手機瀏覽器捲動時網址列收合會讓 innerHeight
 * 真的變動數十 px，一變就 reshape，reshape 就重跑 buildBreathe/buildReading——
 * 那兩支裡面有 Math.random()，等於讀者在讀到一半時看到背景整片換掉。
 * 那正是那段程式的註解說要防的症狀，只是來源不是 ResizeObserver 而是真的 resize 事件。
 *
 * 無頭環境驗不了：實測無頭 Chrome 不把 resize 送進 iframe，canvas 尺寸不變，
 * 等於那條路徑根本沒被走到（測不出來 ≠ 沒問題）。
 *
 * 判法：直接監看 canvas 的實際尺寸與畫面內容有沒有在捲動當下改變。
 */
(() => {
	const raf = window.requestAnimationFrame.bind(window);
	addEventListener('load', () => {
		const cv = document.querySelector('canvas.motif');
		const box = document.createElement('div');
		box.style.cssText =
			'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;' +
			'font:13px/1.5 monospace;padding:10px;white-space:pre-wrap;pointer-events:none';
		document.body.appendChild(box);
		if (!cv) { box.textContent = '這一頁沒有母題'; return; }

		const ctx = cv.getContext('2d');
		/** 只取一條橫線的 alpha 做指紋——整張 getImageData 每次都做會自己造成卡頓。 */
		const fingerprint = () => {
			const y = Math.floor(cv.height / 3);
			const d = ctx.getImageData(0, y, cv.width, 1).data;
			let s = 0;
			for (let i = 3; i < d.length; i += 4) s += d[i] * ((i * 7919) % 9973);
			return s;
		};

		let hMin = innerHeight, hMax = innerHeight;
		let shape = `${cv.width}x${cv.height}`;
		let reshapes = 0;      // canvas 尺寸真的變了幾次
		let rethrows = 0;      // 尺寸沒變、但畫面內容整批不同（＝點被重擲）
		let print = '';
		let last = fingerprint();
		let scrolled = 0;
		addEventListener('scroll', () => { scrolled++; }, { passive: true });

		setInterval(() => {
			hMin = Math.min(hMin, innerHeight);
			hMax = Math.max(hMax, innerHeight);
			const now = `${cv.width}x${cv.height}`;
			if (now !== shape) { reshapes++; shape = now; print = now; last = fingerprint(); return; }
			const f = fingerprint();
			// 閱讀頁本來就會因為捲動而改變那一條線的內容，所以只在「沒有捲動」時比
			if (scrolled === 0 && f !== last) rethrows++;
			scrolled = 0;
			last = f;

			box.textContent =
				`模式 ${cv.dataset.motifMode}　視窗寬 ${innerWidth}\n` +
				`innerHeight 走過的範圍　${hMin} – ${hMax}　（差 ${hMax - hMin} px）\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━\n` +
				`canvas 尺寸改變次數　${reshapes}　${print}\n` +
				`靜置時畫面自己變動　${rethrows} 次\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━\n` +
				(hMax - hMin > 0
					? `⚠ 高度有變動 ${hMax - hMin}px（網址列）。若上面「canvas 尺寸改變次數」> 0，\n` +
					  `　 表示每次收合都在重擲點——那就是紅隊說的那個缺陷。`
					: `目前高度還沒變過。請用手指慢慢上下捲幾次，讓網址列收起來再展開。`);
		}, 400);
	});
})();
