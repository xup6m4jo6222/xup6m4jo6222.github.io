/**
 * 判定「手機捲動時網址列收合會不會讓背景的點整批重擲」。
 * 抗辯第一輪紅隊提出，2026-07-28 真 iPhone 實測確認成立，修正後用同一支複驗。
 *
 * **不能看 canvas 尺寸**：canvas 本來就必須跟著視窗改尺寸才蓋得滿，修正前後都會變。
 * 要看的是**點有沒有被重擲**——而 `buildBreathe()`／`buildReading()` 是繪製程式裡
 * 唯二呼叫 `Math.random()` 的地方（每個點約六次）。所以在背景設計的模組執行**之前**
 * 換掉 `Math.random` 並計數，就能精確分辨「重畫」與「重擲」。
 * 注入點在 </body> 前、是傳統腳本，於解析當下執行；背景設計是 type=module（延後執行）。
 *
 * 判準：載入後計數應該**凍住不動**。捲動時若持續增加，就是每次網址列收合都在重擲。
 * 同時要看 innerHeight 的變動範圍——若它從頭到尾沒變過，代表觸發條件根本沒出現，
 * 那次量測不算通過（測不出來 ≠ 沒問題，這是上一輪本機測試踩到的坑）。
 */
(() => {
	let rolls = 0;
	const realRandom = Math.random;
	Math.random = function () {
		rolls++;
		return realRandom();
	};

	addEventListener('load', () => {
		const cv = document.querySelector('canvas.motif');
		const box = document.createElement('div');
		box.style.cssText =
			'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;' +
			'font:13px/1.6 monospace;padding:10px;white-space:pre-wrap;pointer-events:none';
		document.body.appendChild(box);
		if (!cv) { box.textContent = '這一頁沒有背景設計'; return; }

		let hMin = innerHeight;
		let hMax = innerHeight;
		let settled = 0;   // 載入穩定後的基準計數
		let canvasChanges = 0;
		let shape = `${cv.width}×${cv.height}`;

		// 給首載的擲點與字體交換一點時間，之後的每一次增加都是問題
		setTimeout(() => { settled = rolls; }, 3000);

		setInterval(() => {
			hMin = Math.min(hMin, innerHeight);
			hMax = Math.max(hMax, innerHeight);
			const now = `${cv.width}×${cv.height}`;
			if (now !== shape) { canvasChanges++; shape = now; }

			const extra = settled ? rolls - settled : 0;
			const moved = hMax - hMin;
			const verdict = !settled
				? '（還在等首載穩定，3 秒後開始計）'
				: moved === 0
					? '⚠ 視窗高從頭到尾沒變過 —— 觸發條件沒出現，這次不算數。\n   請用手指慢慢上下捲，讓網址列收起來再展開，重複幾次。'
					: extra === 0
						? `✅ 通過：高度變動過 ${moved}px（網址列有收合），但點一次都沒有重擲。`
						: `❌ 未通過：高度變動 ${moved}px，之後多擲了 ${extra} 次亂數 —— 點正在被重擲。`;

			box.textContent =
				`模式 ${cv.dataset.motifMode}　視窗寬 ${innerWidth}\n` +
				`視窗高走過的範圍　${hMin} – ${hMax}（差 ${moved} px）\n` +
				`canvas 改尺寸 ${canvasChanges} 次（會變是正常的，不是判準）\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
				`基準後多擲的亂數　${extra} 次\n` +
				`━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
				verdict;
		}, 400);
	});
})();
