/**
 * 票 01：在真瀏覽器裡回答四個靜態閘門答不出來的問題。
 *
 *   1. 場**真的畫出來了嗎**？（畫布上有沒有非零像素）
 *   2. 文字帶減光**真的有作用嗎**？
 *   3. 次級線與餘燼**真的長出來了嗎**？（兩者只長在裂縫上，有它們就有裂縫）
 *   4. 捲動回彈**真的會動、而且在降低動態偏好下真的停**嗎？
 *
 * 第二題是這一支存在的理由。`strokeStyle` 在 path 中途改對 `stroke()` 無效——
 * 整層線會套用最後一段的透明度，於是減光「寫了但沒生效」，而**畫面看起來完全正常**。
 * 本人定案的那組參數就是在這個 bug 還在的時候調的。閘門只比對屬性、看不到像素，
 * 所以這件事只有真的量畫布才知道。
 *
 * 量法：拿文字帶**核心**（左右各收掉一個化開寬度，那一帶減光是滿的）與帶**外**
 * （左緣再往外一個化開寬度）兩塊的平均不透明度相比。減光有效 → 核心明顯低於帶外。
 * 對照組由 `?nodim=1` 產生：把 `data-field` 的 `textDim` 改成 0 再讓元件讀。
 * 屬性是產物端契約，改屬性就等於改參數——**這正是契約付出來的紅利**。
 *
 * `?motion=1` 另外跑一段動態序列（見下）。**不要加 --virtual-time-budget**
 * （遇到常駐 rAF 迴圈幾乎不前進，會量到空畫面）。
 */
(() => {
	const errors = [];
	addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
	addEventListener('unhandledrejection', (e) => errors.push(`未處理的 rejection: ${e.reason}`));

	const q = new URLSearchParams(location.search);
	const nodim = q.has('nodim');
	const motion = q.has('motion');

	// 對照組：在元件讀屬性之前把減光關掉。這支是 classic script、在解析中就執行，
	// 元件是 module、延後到解析完才跑——順序是規格保證的，不是碰運氣。
	if (nodim) {
		const cv = document.querySelector('canvas.field');
		if (cv) {
			const p = JSON.parse(cv.dataset.field);
			p.textDim = 0;
			cv.dataset.field = JSON.stringify(p);
		}
	}

	const send = (r) =>
		navigator.sendBeacon(
			`http://${location.hostname}:4477/report`,
			new Blob([JSON.stringify(r)], { type: 'text/plain' }),
		);
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const nextFrames = (n) =>
		new Promise((r) => {
			const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
			requestAnimationFrame(step);
		});

	addEventListener('load', async () => {
		await wait(1200); // 讓字體交換落定、餘燼跑幾幀
		const cv = document.querySelector('canvas.field');
		const main = document.querySelector('main');
		if (!cv || !main) {
			send({ ok: false, why: '這一頁沒有場', errors });
			return;
		}
		const P = JSON.parse(cv.dataset.field);
		const K = JSON.parse(cv.dataset.fieldCraft);
		const F = K.textBandFeather;
		const dpr = cv.width / innerWidth;
		const g = cv.getContext('2d');

		// 文字帶的取法與元件一致：main 的子元素聯集，不是 main 自己的盒子
		let box = null;
		for (const el of main.children) {
			const r = el.getBoundingClientRect();
			if (!r.width || !r.height) continue;
			box = box
				? {
						top: Math.min(box.top, r.top),
						bottom: Math.max(box.bottom, r.bottom),
						left: Math.min(box.left, r.left),
						right: Math.max(box.right, r.right),
					}
				: { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
		}
		if (!box) {
			send({ ok: false, why: 'main 裡沒有量得到的子元素', errors });
			return;
		}

		/** 一塊矩形（視窗座標）裡的平均不透明度、非零像素數、帶元素主色的像素數。 */
		const region = (x0, x1, y0, y1) => {
			const px0 = Math.max(0, Math.round(x0 * dpr));
			const px1 = Math.min(cv.width, Math.round(x1 * dpr));
			const py0 = Math.max(0, Math.round(y0 * dpr));
			const py1 = Math.min(cv.height, Math.round(y1 * dpr));
			if (px1 <= px0 || py1 <= py0) return { mean: 0, hit: 0, accent: 0, n: 0 };
			const d = g.getImageData(px0, py0, px1 - px0, py1 - py0).data;
			let sum = 0;
			let hit = 0;
			let accent = 0;
			for (let i = 0; i < d.length; i += 4) {
				const a = d[i + 3];
				sum += a;
				if (!a) continue;
				hit++;
				// 等高線是中性階（R≈G≈B），次級線與餘燼是元素主色（B 明顯高於 R）
				if (d[i + 2] > d[i] + 20) accent++;
			}
			return { mean: sum / (d.length / 4) / 255, hit, accent, n: d.length / 4 };
		};

		const y0 = Math.max(0, box.top);
		const y1 = Math.min(innerHeight, box.bottom);
		const core = region(box.left + F, box.right - F, y0, y1); // 減光滿檔的那一帶
		const out = region(0, box.left - F, y0, y1); // 帶外，完全不減光
		const whole = region(0, innerWidth, 0, innerHeight);

		const report = {
			ok: true,
			nodim,
			motion,
			reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
			page: location.pathname,
			textDim: P.textDim,
			vw: innerWidth,
			vh: innerHeight,
			dpr,
			band: `${Math.round(box.left)}–${Math.round(box.right)} × ${Math.round(y0)}–${Math.round(y1)}`,
			core: core.mean,
			out: out.mean,
			ratio: out.mean ? core.mean / out.mean : null,
			painted: whole.hit,
			accent: whole.accent,
			errors,
		};

		if (!motion) {
			send(report);
			return;
		}

		/* ── 動態序列 ────────────────────────────────────────────────────
		   全部從外部觀察畫布，不看內部狀態：
		     回彈 — 送一次捲動，接下來幾百毫秒內取樣，看畫面有沒有跟基準不一樣
		     餘燼 — 靜置幾秒後再取一張，只有餘燼會變，所以有差就是餘燼在燒
		   降低動態偏好下前者必須是 0、後者必須仍然大於 0。 */
		const SW = Math.min(cv.width, 600);
		const SH = Math.min(cv.height, 400);
		/* 取整塊的**逐像素差**，不是總和。總和對平移幾乎不變（場是均勻的），
		   拿它當指紋會把「整場位移了 4px」判成「什麼都沒發生」。 */
		const snap = () => new Uint8Array(g.getImageData(0, 0, SW, SH).data);
		/** 回傳的是**差的總量**（0–255 為單位）不是平均：場很淡，平均會被四捨五入成 0。 */
		const diff = (a, b) => {
			let s = 0;
			for (let i = 3; i < a.length; i += 4) s += Math.abs(a[i] - b[i]);
			return s;
		};

		const base = snap();
		dispatchEvent(new Event('scroll'));
		let shift = 0;
		for (let i = 0; i < 12; i++) {
			await nextFrames(1);
			shift = Math.max(shift, diff(snap(), base));
		}
		await wait(P.shockMs + 400); // 回位之後才量餘燼，免得把回彈算進去
		const rest = snap();
		await wait(4000);
		report.shift = shift;
		report.ember = diff(snap(), rest);
		send(report);
	});
})();
