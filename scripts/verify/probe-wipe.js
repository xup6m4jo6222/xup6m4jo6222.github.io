/**
 * 票 06：演示一（方向反轉）的行為驗證。兩件靜態閘門看不到的事——
 *
 *   1. 起始態真的**只看得到本研究採用的那一張**（沒有 JS 的讀者看到的就是這一張）
 *   2. 把滑桿拖到底，採用的那一張真的**整張退場**，畫面換成被換掉的定義那一張
 *
 * 量法用 `elementsFromPoint`：問瀏覽器「這個點上疊著哪些元素」。`clip-path` 裁掉的
 * 地方連命中測試都不會命中，所以答案是**算完版面之後的實際幾何**，不是我寫進去的
 * 那個變數。第一版就是栽在這裡——直接讀 `clip-path` 的計算值，Chrome 原封不動回
 * `calc(100% - var(...))`，字串永遠一樣，三個狀態全部量到 0，看起來還全綠。
 *
 * 取三個橫向取樣點：左、中、右。整張蓋著時三點全中，整張退場時三點全不中。
 *
 * `?nowire=1` 把腳本掛上的處理器拆掉，讓探針**證明自己會紅**——與這個資料夾裡
 * 其他探針同一條規矩：不會紅的檢查證明不了任何事。
 */
(() => {
	const send = (r) => navigator.sendBeacon('/report', JSON.stringify(r));
	const nowire = new URLSearchParams(location.search).has('nowire');

	setTimeout(() => {
		try {
			const wipe = document.querySelector('.content .cs-wipe');
			if (!wipe) return send({ ok: false, why: '這一頁沒有拖曳比對器' });
			const top = wipe.querySelector('.cs-wipe-top');
			const range = wipe.querySelector('input[type=range]');
			if (!top || !range) return send({ ok: false, why: '比對器缺了上層或滑桿' });

			// 命中測試只認視窗座標，圖在第一屏以外，先捲到畫面中央
			wipe.scrollIntoView({ block: 'center' });
			const box = wipe.getBoundingClientRect();
			if (box.width < 50 || box.bottom < 0 || box.top > innerHeight) {
				return send({ ok: false, why: `比對器不在視窗裡，命中測試量不到（${JSON.stringify(box)}）` });
			}
			const y = box.top + box.height / 2;
			// 上層在這三個橫向位置上有沒有真的被畫出來
			const covers = () =>
				[0.1, 0.5, 0.9].map((f) =>
					document.elementsFromPoint(box.left + box.width * f, y).includes(top),
				);
			const state = () => ({
				value: range.value,
				covers: covers(),
				clip: getComputedStyle(top).clipPath,
			});

			const drag = (v) => {
				range.value = String(v);
				range.dispatchEvent(new Event('input', { bubbles: true }));
			};

			if (nowire) range.oninput = null; // 自我證偽：假裝那支腳本從來沒有把行為掛上去

			const start = state();
			drag(0);
			const dragged = state();
			drag(100);
			const back = state();

			send({ ok: true, width: box.width, start, dragged, back });
		} catch (e) {
			send({ ok: false, why: `探針自己丟了例外：${e.message}` });
		}
	}, 400);
})();
