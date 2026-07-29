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
	const signoff = q.has('signoff');
	const runtime = q.has('runtime');
	/**
	 * `?kill=1` — **讓場整個不畫**，用來證明這支探針自己會紅（票 04）。
	 * 拿掉 `data-field`，元件讀不到參數就直接 return，畫布會是全空的。
	 * 這是「驗證工具自己會假綠」那條教訓的執行版：v9 抓到過一個動畫死透仍報
	 * 「有在動」的探針，所以每一次跑都要順手證明一次自己不是那種。
	 */
	const killed = q.has('kill');
	/**
	 * `?nomotif=1` — 把母題殺掉，只留場。
	 *
	 * 建場成本原本量不出來：改版面那條路上母題也在重建（三張整面離屏遮罩＋遠景層），
	 * 實測 72–178ms，而場的份額落在雜訊裡（量到 −1.0 到 +4.5ms 都有）。
	 * **兩個量級差太多的東西相減，得到的是雜訊不是差額**——要拿到場自己的數字，
	 * 就得讓它單獨走一次那條路。
	 */
	if (q.has('nomotif')) document.querySelector('canvas.motif')?.removeAttribute('data-motif');
	/* 參數要在拿掉屬性**之前**先留一份：探針自己還要用它（回位時間、餘燼週期），
	   不留的話這支會在被殺掉的那一輪自己丟例外，那就變成「探針壞了」而不是「場沒畫」。 */
	let savedField = document.querySelector('canvas.field')?.dataset.field;
	if (killed) document.querySelector('canvas.field')?.removeAttribute('data-field');

	/* 票 02 的每幀成本：在元件的模組執行**之前**換掉 requestAnimationFrame，替每一次
	   回呼計時。這支是 classic script、解析當下就執行，元件是 module、延後執行，
	   所以順序是規格保證的。被 fpsCap 擋掉的那些幀成本近 0，門檻 0.15ms 把它們分開
	   （票 05 的教訓：門檻設 0.5ms 會把便宜的真幀一起砍掉，中位數因此被高估）。 */
	const costs = [];
	const ticks = [];
	if (signoff || runtime) {
		const raf0 = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) =>
			raf0((t) => {
				ticks.push(t);
				const a = performance.now();
				cb(t);
				const b = performance.now();
				if (b - a > 0.15) costs.push(b - a);
			});
	}

	/* 對照組：在元件讀屬性之前改參數。這支是 classic script、在解析中就執行，
	   元件是 module、延後到解析完才跑——順序是規格保證的，不是碰運氣。
	   `?nodim=1` 關掉減光（票 01 的 fail-then-pass 對照組）；
	   `?ink=` `?dim=` 直接換值（票 02 的比對截圖）。改屬性就等於改參數，
	   不必為了看另一組值而重新建置——這是產物端契約付出來的紅利。 */
	const KNOBS = { ink: 'ink', dim: 'textDim', crack: 'crack', ember: 'ember' };
	const cv0 = document.querySelector('canvas.field');
	if (cv0 && !killed && (nodim || Object.keys(KNOBS).some((k) => q.has(k)))) {
		const p = JSON.parse(cv0.dataset.field);
		if (nodim) p.textDim = 0;
		for (const [k, key] of Object.entries(KNOBS)) if (q.has(k)) p[key] = +q.get(k);
		cv0.dataset.field = JSON.stringify(p);
		savedField = cv0.dataset.field;
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
		// 被 `?kill=1` 拿掉屬性的那一輪，讀的是先前留下來的那一份
		const P = JSON.parse(cv.dataset.field || savedField);
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

		if (runtime) {
			/* ── 票 04：把「每幀」與「一次性」分開量 ────────────────────────
			   每幀成本量的是貼圖＋餘燼；**建場**是另一件事，只在視窗寬或文字帶
			   變動時付一次。兩者混在一個 max 裡看起來像「有時候會爆 68ms」，
			   拆開之後才講得清楚「常態 0.4ms，換一次版面付一次 X ms」。

			   建場的觸發用的是**外部可觀察的路徑**：改 main 的寬度 → 文字帶變了 →
			   簽章變了 → 元件重建。這正是字體換上來時真的會走的那條路，
			   不是為了量測另開的後門。 */
			/* **首次建場也是一幀**，而它就落在載入後的頭幾秒裡。不把它丟掉的話，
			   它會混進「每幀成本」的樣本：閱讀頁 1902 寬那一輪的 p95 因此變成 18ms，
			   而常態其實是 0.2ms——一個一次性的成本被讀成「二十分之一的幀會爆」。
			   丟掉前兩秒，再開始取樣；建場另外量。 */
			await wait(2000);
			costs.length = 0;
			ticks.length = 0;
			await wait(6000);
			const steady = costs.length;
			const steadyTicks = ticks.slice();

			/* 每一次都要確認「場**真的重建了**」，不能只看有沒有一幀變貴。
			   若簽章其實沒變、元件根本沒進 build()，量到的就是同一條路上別人的成本，
			   而那個數字看起來一樣合理——這是「驗證工具自己會假綠」的另一個入口。
			   判法：文字帶跟著 main 的寬度走，重建過畫面就一定不一樣。 */
			/* 取**整張畫布**，不是左上角一塊。第一版只取 600×400，而 1902 寬的視窗裡
			   正文欄從 x≈600 才開始——文字帶動了，那一塊卻沒變，於是五次裡有兩次被
			   判成「沒重建」。那是取樣窗的錯，不是元件的錯。 */
			const fp = () => {
				const d = g.getImageData(0, 0, cv.width, cv.height).data;
				let s = 0;
				for (let i = 3; i < d.length; i += 4) s += d[i];
				return s;
			};
			const builds = [];
			let rebuilt = 0;
			const original = main.style.maxWidth;
			for (let i = 0; i < 5; i++) {
				const mark = costs.length;
				const before = fp();
				main.style.maxWidth = `${560 + i * 60}px`;
				await nextFrames(6); // ResizeObserver → rAF → resize() → build()
				if (fp() !== before) rebuilt++;
				const window_ = costs.slice(mark);
				if (window_.length) builds.push(Math.max(...window_));
			}
			main.style.maxWidth = original;
			await nextFrames(6);

			const pctl = (arr, p) => {
				if (!arr.length) return null;
				const s = [...arr].sort((a, b) => a - b);
				return s[Math.min(s.length - 1, Math.floor(s.length * p))];
			};
			const perFrame = costs.slice(0, steady);
			report.cost = {
				med: pctl(perFrame, 0.5),
				p95: pctl(perFrame, 0.95),
				max: perFrame.length ? Math.max(...perFrame) : null,
				n: perFrame.length,
			};
			report.build = {
				med: pctl(builds, 0.5),
				max: builds.length ? Math.max(...builds) : null,
				n: builds.length,
				rebuilt, // 五次強迫改版面裡，畫面真的變了幾次
			};
			// 幀率也只看常態那一段：五次強迫重建每次 100ms 以上，混進去會把平均拉垮
			report.fps = steadyTicks.length / ((steadyTicks[steadyTicks.length - 1] - steadyTicks[0]) / 1000);
			send(report);
			return;
		}

		if (signoff) {
			/* ── 票 02 的三個數字 ────────────────────────────────────────
			   每幀成本：讓它跑滿一段時間再取中位與 p95。
			   文字帶最壞對比：把場的每一個像素壓到背景主色上，取合成後**最亮**的那一顆，
			   對內文色算對比。**沒有計入兩道亮光與顆粒**——與原型的量法一致，
			   所以這個數字跟本人當初看到的 14.17 是可比的。 */
			await wait(8000);
			const pctl = (arr, p) => {
				if (!arr.length) return NaN;
				const s = [...arr].sort((a, b) => a - b);
				return s[Math.min(s.length - 1, Math.floor(s.length * p))];
			};
			const cs = getComputedStyle(document.body);
			const parse = (v) => {
				const m = v.trim().match(/^#([0-9a-f]{6})$/i);
				if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
				const n = v.match(/\d+/g);
				return n ? n.slice(0, 3).map(Number) : null;
			};
			const base = parse(cs.getPropertyValue('--color-bg')) || parse(cs.backgroundColor);
			const text = parse(cs.getPropertyValue('--color-text')) || parse(cs.color);
			const lum = (c) => {
				const f = (v) => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
				return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
			};
			const px0 = Math.max(0, Math.round(box.left * dpr));
			const px1 = Math.min(cv.width, Math.round(box.right * dpr));
			const py0 = Math.max(0, Math.round(y0 * dpr));
			const py1 = Math.min(cv.height, Math.round(y1 * dpr));
			const d = g.getImageData(px0, py0, px1 - px0, py1 - py0).data;
			let best = -1;
			let worstPx = null;
			let peakA = 0;
			for (let i = 0; i < d.length; i += 4) {
				const a = d[i + 3] / 255;
				if (!a) continue;
				if (a > peakA) peakA = a;
				const c = [0, 1, 2].map((k) => Math.round(d[i + k] * a + base[k] * (1 - a)));
				const L = lum(c);
				if (L > best) {
					best = L;
					worstPx = c;
				}
			}
			const l1 = Math.max(lum(text), best);
			const l2 = Math.min(lum(text), best);
			report.cost = {
				med: pctl(costs, 0.5),
				p95: pctl(costs, 0.95),
				max: Math.max(...costs),
				n: costs.length,
				// 超過 5ms 的幀有幾個。建場是一次性的，貼圖不是——分得開「一次性」與「每幀」
				over5: costs.filter((c) => c > 5).length,
			};
			report.fps = ticks.length / ((ticks[ticks.length - 1] - ticks[0]) / 1000);
			report.redraws = costs.length / ((ticks[ticks.length - 1] - ticks[0]) / 1000);
			report.peakAlpha = peakA;
			report.worstPx = worstPx;
			report.contrast = worstPx ? (l1 + 0.05) / (l2 + 0.05) : null;
			send(report);
			return;
		}

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

		/* **要先量一次「什麼都不做」的底噪**。餘燼在降低動態偏好下照樣呼吸（那是規格
		   要的），所以同一段時間裡畫面本來就會變一點；不扣掉這一份，就會把餘燼的
		   不透明度變化讀成「位移沒關掉」。裂縫比例從 0.09 改成 0.30、餘燼真的出現
		   之後，這支就是這樣假紅的一次。 */
		const window12 = () => {
			const b = snap();
			let m = 0;
			return (async () => {
				for (let i = 0; i < 12; i++) {
					await nextFrames(1);
					m = Math.max(m, diff(snap(), b));
				}
				return m;
			})();
		};
		const noise = await window12(); // 不捲動，只有餘燼在動
		const p = window12();
		dispatchEvent(new Event('scroll'));
		const shift = await p;

		await wait(P.shockMs + 400); // 回位之後才量餘燼，免得把回彈算進去
		const rest = snap();
		await wait(4000);
		report.noise = noise;
		report.shift = shift;
		report.ember = diff(snap(), rest);
		send(report);
	});
})();
