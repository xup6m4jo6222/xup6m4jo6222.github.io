/**
 * 統計第一頁的三張靜態圖。取代原本的 probe-wipe／probe-tost／probe-strata——
 * 2026-08-04 郁為判定統計頁不要互動（「直接放對比圖反而還更好」），拖曳、滑桿、
 * 膠囊全部拆掉，所以那三支驗行為的探針沒有對象了。**但它們裡面最有價值的那一項
 * 不是行為，是對帳，那一項搬到這裡繼續跑。**
 *
 * 量四件靜態閘門看不到的事——
 *
 *   1. **圖上的幾何與頁面上印的數字講的是同一件事。**數字是文字，位置是 CSS 用
 *      `--sc` 換算的；其中一邊寫錯的話畫面說一套、字說另一套，而那是讀程式與讀
 *      產物都看不出來的。所以量 `getBoundingClientRect`（算完版面之後的實際幾何）
 *      再換算回百分比，與列上印的數字對帳。
 *   2. **六條信賴區間全部畫在零線的右邊**——「方向一致」這句話在畫面上就是這件事。
 *   3. **等效檢定那張圖的幾何與兩個判定同意**：判「有實質差異」的那一列，區間整段
 *      畫在等效帶之外；判「無法斷定」的那一列，區間跨過帶的邊緣。
 *   4. **內文裡一個互動控制項都不剩**（「全部展開」那顆切換器不算，它管的是文字分層，
 *      不是演示）。這一項是拆乾淨了的證據：漏掉一個拖不動的滑桿，讀者會去拖它。
 *
 * `?nowire=1` 對這支沒有意義——它量的全是靜態幾何，沒有任何處理器可以拆。自我證偽
 * 改用 `?rigpt=1`：把第一列的資料點推到一個錯的位置（只動 `--pt`，不動列上印的文字），
 * 對帳那一項就必須紅。不會紅的檢查證明不了任何事。
 */
(() => {
	const send = (r) => navigator.sendBeacon('/report', JSON.stringify(r));
	const rigpt = new URLSearchParams(location.search).has('rigpt');

	setTimeout(() => {
		try {
			const content = document.querySelector('.content');
			if (!content) return send({ ok: false, why: '這一頁沒有內文區' });

			/* 一、兩張對比圖。並排取代了原本的拖曳比對器，所以「兩張都在」就是那一節的全部。 */
			const figs = [...content.querySelectorAll('img.st-fig')].map((img) => ({
				src: img.getAttribute('src'),
				lazy: img.getAttribute('loading'),
				width: img.getBoundingClientRect().width,
			}));

			/* 二、等效檢定。零釘在圖的正中央，界線就是那塊底的兩個邊緣。 */
			const tostFig = content.querySelector('.st-tost');
			let tost = null;
			if (tostFig) {
				tostFig.scrollIntoView({ block: 'center' });
				const box = tostFig.getBoundingClientRect();
				const band = tostFig.querySelector('.st-tost-band').getBoundingClientRect();
				const mid = box.left + box.width / 2;
				const sc = parseFloat(getComputedStyle(tostFig).getPropertyValue('--sc'));
				/* 容差 0.5px 是次像素進位，不是給臨界值的緩衝——兩列離翻面點都遠得多。 */
				const EPS = 0.5;
				tost = {
					width: box.width,
					/* 帶的半寬換算回百分比＝界線在正負幾 %。事前指定的是 ±1%，
					   所以這個數字錯了就代表圖在說謊。 */
					edge: (band.width / 2) * 100 / (box.width * sc),
					rows: [...tostFig.querySelectorAll('.st-tost-row')].map((row) => {
						const b = row.querySelector('.st-tost-ci').getBoundingClientRect();
						const lo = b.left - mid;
						const hi = b.right - mid;
						const d = band.width / 2;
						return {
							name: row.querySelector('.st-tost-head span').textContent,
							verdict: row.querySelector('.st-tost-verdict').textContent,
							geom:
								lo > d + EPS || hi < -d - EPS
									? 'outside'
									: lo >= -d - EPS && hi <= d + EPS
										? 'inside'
										: 'straddle',
						};
					}),
				};
			}

			/* 三、六個市場。零線在最左邊，六條區間全部要落在它的右邊。 */
			const mktFig = content.querySelector('.st-mkt');
			let mkt = null;
			if (mktFig) {
				mktFig.scrollIntoView({ block: 'center' });
				/* 自我證偽：只把第一列的資料點搬走，列上印的文字一個字都不動。 */
				if (rigpt) mktFig.querySelector('.st-mkt-row')?.style.setProperty('--pt', '55');
				const sc = parseFloat(getComputedStyle(mktFig).getPropertyValue('--sc'));
				const zeroBox = mktFig.querySelector('.st-mkt-zero').getBoundingClientRect();
				mkt = {
					width: mktFig.getBoundingClientRect().width,
					sc,
					rows: [...mktFig.querySelectorAll('.st-mkt-row')].map((row) => {
						const track = row.querySelector('.st-mkt-track').getBoundingClientRect();
						const ci = row.querySelector('.st-mkt-ci').getBoundingClientRect();
						const pt = row.querySelector('.st-mkt-pt').getBoundingClientRect();
						return {
							name: row.querySelector('.st-mkt-head span').textContent,
							printed: parseFloat(row.querySelector('.st-mkt-val').textContent.replace(/[+%]/g, '')),
							/* 位置的定義是 `left: (零 + --sc × 值)%`，所以換算回去就是這一行。 */
							implied: ((pt.left + pt.width / 2 - track.left) * 100) / (track.width * sc),
							gap: ci.left - zeroBox.right,
						};
					}),
				};
			}

			/* 四、內文裡不該再有任何演示用的控制項。切換器那顆按鈕排除在外——
			   它是 `[data-expand-all]`，坐在內文之外的頁首，本來就不在 `.content` 裡；
			   這裡再把 `<details>` 的 summary 也排掉（那是原生的展開，不是演示）。 */
			const leftovers = [...content.querySelectorAll('input, button, [role=button], [draggable=true]')].map(
				(el) => `${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''}`,
			);

			const doc = document.documentElement;
			send({
				ok: true,
				figs,
				tost,
				mkt,
				leftovers,
				page: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth },
			});
		} catch (e) {
			send({ ok: false, why: `探針自己丟了例外：${e.message}` });
		}
	}, 400);
})();
