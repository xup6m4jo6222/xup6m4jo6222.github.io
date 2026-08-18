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
		const report = (extra, resized) =>
			navigator.sendBeacon(
				`http://${location.hostname}:4455/`,
				new Blob([JSON.stringify({
					id: `runtime-${location.pathname}`,
					ua: `執行期檢查 ${location.pathname}`,
					mode: cv ? cv.dataset.motifMode : '無背景設計',
					vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
					points: '-', secs: '-', fpsRecent: '-', fpsAll: '-',
					redraws: extra + (resized ? '（注意：期間畫布尺寸變過）' : ''),
					med: '-', p95: '-', max: '-',
					jank: errors.length, cap: errors.length ? errors.join(' ／ ') : '無例外',
				})], { type: 'text/plain' }),
			);

		if (!cv) { report('這一頁沒有背景設計'); return; }
		const ctx = cv.getContext('2d');
		/* 取樣**固定大小**的一塊，不是整張畫布。
		   第一版拿 `cv.width × cv.height` 整張做指紋，抗辯第四輪實測證明那會假綠：
		   畫布尺寸在任何一次 resize 都會跟著視窗高變（容忍帶內也會），緩衝區一變大小，
		   指紋幾乎必然不同——把 rAF 迴圈弄死之後它照樣報「動畫有在動」。
		   而手機捲動時網址列收合就是常態，等於這支檢查在最需要它的場合失效。
		   改成固定視窗後，只有畫面內容真的變了指紋才會變。 */
		const S = 400;
		const fp = () => {
			const w = Math.min(S, cv.width);
			const h = Math.min(S, cv.height);
			const d = ctx.getImageData(0, 0, w, h).data;
			let s = 0;
			for (let i = 3; i < d.length; i += 4) s += d[i] * ((i * 7919) % 9973);
			return s;
		};
		/** 兩次取樣之間畫布尺寸有沒有變——變了就代表比的不是同一件事，要講出來。 */
		const dims = () => `${cv.width}x${cv.height}`;
		const breathing = cv.dataset.motifMode === 'breathe';
		const a = fp();
		const d0 = dims();
		setTimeout(() => {
			const b = fp();
			const resized = dims() !== d0;
			const blank = b === 0;
			const moved = a !== b;
			report(
				blank
					? '❌ 畫布全空 —— 一幀都沒畫出來'
					: breathing
						? moved ? '✅ 動畫有在動' : '❌ 動畫沒動 —— 常駐迴圈沒啟動'
						: moved ? '⚠ 閱讀頁不該自己動' : '✅ 閱讀頁靜止（正確）',
				resized,
			);
		}, 6000);
	});
})();
