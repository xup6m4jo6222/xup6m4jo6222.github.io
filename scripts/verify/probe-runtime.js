/**
 * 跑真瀏覽器，回答兩個所有靜態檢查都答不出來的問題：
 *   1. 有沒有未捕捉的 JavaScript 例外？
 *   2. 首頁的呼吸動畫**真的在動**嗎？
 *
 * 為什麼需要這一支（2026-07-28 抗辯第三輪的教訓）：
 * 一次改動把 `let builtH = 0;` 刪了卻留下 `builtH = H;`。inline script 是 ES module、
 * 一律嚴格模式，賦值給未宣告的識別字會丟 ReferenceError，於是 `resize()` 中途炸掉、
 * `start()` 也跟著中斷——常駐動畫從來沒啟動過，`teardown` 永遠是 null（換頁時監聽器
 * 只累加不釋放）。
 *
 * **而閘門七類、自我檢查 16 例、均勻判準全都是綠的。** 均勻判準之所以沒抓到，是因為
 * 字體換上來時 ResizeObserver 又叫了一次 `resize()`，那一次剛好不走會爆的分支，
 * 把畫面補畫出來了——意外自癒，不是沒壞。靜態檢查看不到執行期的東西。
 *
 * 動不動的判法：隔一段時間各取一次畫面指紋。呼吸週期 26 秒、幀率上限 30，
 * 相隔數秒的兩幀必然不同；完全相同就是根本沒動。
 * **不要加 --virtual-time-budget**，它遇到常駐 rAF 迴圈幾乎不前進。
 */
(() => {
	const errors = [];
	addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
	addEventListener('unhandledrejection', (e) => errors.push(`未處理的 rejection: ${e.reason}`));

	addEventListener('load', () => {
		const cv = document.querySelector('canvas.motif');
		const report = (extra) =>
			navigator.sendBeacon(
				`http://${location.hostname}:4455/`,
				new Blob([JSON.stringify({
					id: `runtime-${location.pathname}`,
					ua: `執行期檢查 ${location.pathname}`,
					mode: cv ? cv.dataset.motifMode : '無母題',
					vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
					points: '-', secs: '-', fpsRecent: '-', fpsAll: '-',
					redraws: extra,
					med: '-', p95: '-', max: '-',
					jank: errors.length, cap: errors.length ? errors.join(' ／ ') : '無例外',
				})], { type: 'text/plain' }),
			);

		if (!cv) { report('這一頁沒有母題'); return; }
		const ctx = cv.getContext('2d');
		const fp = () => {
			const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
			let s = 0;
			for (let i = 3; i < d.length; i += 4) s += d[i] * ((i * 7919) % 9973);
			return s;
		};
		const breathing = cv.dataset.motifMode === 'breathe';
		const a = fp();
		setTimeout(() => {
			const b = fp();
			const blank = b === 0;
			const moved = a !== b;
			report(
				blank
					? '❌ 畫布全空 —— 一幀都沒畫出來'
					: breathing
						? moved ? '✅ 動畫有在動' : '❌ 動畫沒動 —— 常駐迴圈沒啟動'
						: moved ? '⚠ 閱讀頁不該自己動' : '✅ 閱讀頁靜止（正確）',
			);
		}, 6000);
	});
})();
