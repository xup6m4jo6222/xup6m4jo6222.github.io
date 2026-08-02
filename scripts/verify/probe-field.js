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
 * `?motion=1` 另外跑一段動態序列，`?runtime=1` 量成本與建場（見下）。**不要加 --virtual-time-budget**
 * （遇到常駐 rAF 迴圈幾乎不前進，會量到空畫面）。
 */
(() => {
	const errors = [];
	addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
	addEventListener('unhandledrejection', (e) => errors.push(`未處理的 rejection: ${e.reason}`));

	const q = new URLSearchParams(location.search);
	const nodim = q.has('nodim');
	const motion = q.has('motion');
	const runtime = q.has('runtime');
	/**
	 * `?kill=1` — **讓場整個不畫**，用來證明這支探針自己會紅（票 04）。
	 * 拿掉 `data-field`，元件讀不到參數就直接 return，畫布會是全空的。
	 * 這是「驗證工具自己會假綠」那條教訓的執行版：v9 抓到過一個動畫死透仍報
	 * 「有在動」的探針，所以每一次跑都要順手證明一次自己不是那種。
	 */
	const killed = q.has('kill');
	/**
	 * `?nomotif=1` — 把背景設計殺掉，只留場。
	 *
	 * 建場成本原本量不出來：改版面那條路上背景設計也在重建（三張整面離屏遮罩＋遠景層），
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
	if (runtime) {
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
	const cv0 = document.querySelector('canvas.field');

	/** `data-field-craft` 的旋鈕。`rearm` 是回彈的冷卻時間，票 05 要拿它出比對圖。 */
	if (cv0 && q.has('rearm')) {
		/* **必須擋非有限值。**`JSON.stringify` 把 Infinity 與 NaN 都寫成 `null`，
		   而元件的 `now - shockT < null` 恆為 false → 每一幀都觸發回彈，冷卻機制
		   整個反轉成「完全沒有冷卻」。抗辯第三輪實測 `?rearm=Infinity` 拍出來是
		   整整 12 秒的滿版高原，而工具印的是「冷卻 Infinityms → 晃了 1 次」——
		   冷卻最長、晃最少，結論完全相反。 */
		const v = +q.get('rearm');
		if (Number.isFinite(v) && v > 0) {
			const k = JSON.parse(cv0.dataset.fieldCraft);
			k.shockRearmMs = v;
			cv0.dataset.fieldCraft = JSON.stringify(k);
		}
	}

	const KNOBS = { ink: 'ink', dim: 'textDim', crack: 'crack', ember: 'ember' };
	if (cv0 && !killed && (nodim || Object.keys(KNOBS).some((k) => q.has(k)))) {
		const p = JSON.parse(cv0.dataset.field);
		if (nodim) p.textDim = 0;
		for (const [k, key] of Object.entries(KNOBS)) if (q.has(k)) p[key] = +q.get(k);
		cv0.dataset.field = JSON.stringify(p);
		savedField = cv0.dataset.field;
	}

	/* sendBeacon 有大約 64KB 的上限，逐格對比那一輪要送七張 PNG，一定超過。
	   大的走 fetch（那一輪不需要 beacon 的「頁面關掉也送得出去」保證）。 */
	const send = (r) => {
		const url = `http://${location.hostname}:4477/report`;
		const body = JSON.stringify(r);
		if (body.length > 50000) return fetch(url, { method: 'POST', body });
		return navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
	};
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

		/* 文字帶的取法與元件一致：票 06 起**每個內容區子元素各一塊，不取聯集**；
		   main 只有一個子元素時它是版面包裝盒（首頁的 section.home），往下一層再取。

		   「核心／帶外」那一組讀數取**面積最大的那一塊**：它是這一頁正文的所在，
		   而聯集時代量的也是同一片地，所以那兩個數字前後仍然可比。
		   最壞對比則要掃過**每一塊**——字不是只長在最大的那一塊上。 */
		let els = Array.from(main.children);
		while (els.length === 1 && els[0].children.length) els = Array.from(els[0].children);
		const boxes = [];
		for (const el of els) {
			const r = el.getBoundingClientRect();
			if (!r.width || !r.height) continue;
			boxes.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
		}
		if (!boxes.length) {
			send({ ok: false, why: 'main 裡沒有量得到的子元素', errors });
			return;
		}
		const area = (b) => (b.right - b.left) * (b.bottom - b.top);
		const box = boxes.reduce((a, b) => (area(b) > area(a) ? b : a));

		/** 一塊矩形（視窗座標）裡的平均不透明度、非零像素數、帶元素主色的像素數。 */
		const region = (x0, x1, y0, y1) => {
			const px0 = Math.max(0, Math.round(x0 * dpr));
			const px1 = Math.min(cv.width, Math.round(x1 * dpr));
			const py0 = Math.max(0, Math.round(y0 * dpr));
			const py1 = Math.min(cv.height, Math.round(y1 * dpr));
			if (px1 <= px0 || py1 <= py0) return { mean: 0, hit: 0, accent: 0 };
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
			return { mean: sum / (d.length / 4) / 255, hit, accent };
		};

		const y0 = Math.max(0, box.top);
		const y1 = Math.min(innerHeight, box.bottom);
		const core = region(box.left + F, box.right - F, y0, y1); // 減光滿檔的那一帶
		const out = region(0, box.left - F, y0, y1); // 帶外，完全不減光
		const whole = region(0, innerWidth, 0, innerHeight);

		const report = {
			ok: true,
			nodim,
			reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
			page: location.pathname,
			textDim: P.textDim,
			vw: innerWidth,
			vh: innerHeight,
			dpr,
			band: `${Math.round(box.left)}–${Math.round(box.right)} × ${Math.round(y0)}–${Math.round(y1)}（共 ${boxes.length} 塊，此為最大塊）`,
			core: core.mean,
			out: out.mean,
			ratio: out.mean ? core.mean / out.mean : null,
			painted: whole.hit,
			accent: whole.accent,
			errors,
		};

		/**
		 * 文字帶最壞對比：把場的每一個像素壓到背景主色上，取合成後**最亮**的那一顆，
		 * 對內文色算對比。**沒有計入兩道亮光與顆粒**——與原型的量法一致，所以這個
		 * 數字跟本人當初看到的 14.17 是可比的。
		 *
		 * 票 02 與票 04 兩條路都要它（手機那一組也要有對比，不能只有桌機有），
		 * 所以抽成一支——抄兩份的話，哪天量法改了只會改到一邊。
		 */
		const worstContrast = () => {
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
				const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
				return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
			};
			let best = -1;
			let worstPx = null;
			// **每一塊都要掃**：票 06 之後文字帶是好幾塊，只掃最大的那塊會漏掉署名後面的字
			for (const b of boxes) {
				const px0 = Math.max(0, Math.round(b.left * dpr));
				const px1 = Math.min(cv.width, Math.round(b.right * dpr));
				const py0 = Math.max(0, Math.round(Math.max(0, b.top) * dpr));
				const py1 = Math.min(cv.height, Math.round(Math.min(innerHeight, b.bottom) * dpr));
				if (px1 <= px0 || py1 <= py0) continue;
				const d = g.getImageData(px0, py0, px1 - px0, py1 - py0).data;
				for (let i = 0; i < d.length; i += 4) {
					const a = d[i + 3] / 255;
					if (!a) continue;
					const c = [0, 1, 2].map((k) => Math.round(d[i + k] * a + base[k] * (1 - a)));
					const L = lum(c);
					if (L > best) {
						best = L;
						worstPx = c;
					}
				}
			}
			if (!worstPx) return {};
			const l1 = Math.max(lum(text), best);
			const l2 = Math.min(lum(text), best);
			return { contrast: (l1 + 0.05) / (l2 + 0.05), worstPx };
		};

		if (q.has('shockfilm')) {
			/* ── 回彈的逐格對比（票 05 抗辯）────────────────────────────────
			   問題：回彈幅度只有 4px、線又只有 0.040 的強度，**在靜態截圖裡看不見**。
			   所以拍的不是畫面，是**畫面與靜止態的差**——場移動過的地方會亮起來，
			   沒動的地方是黑的。放大 20 倍才看得出來。

			   時間軸刻意跨過「捲動中」與「停止捲動之後」：現行版本在整段捲動期間
			   都是滿幅（每一幀 scroll 事件都把幅度重設成 1），單次觸發的版本
			   應該在 350ms 之內就衰減到黑。 */
			const W = Math.min(cv.width, 900);
			const H = Math.min(cv.height, 500);
			const rest = g.getImageData(0, 0, W, H).data;
			const out = document.createElement('canvas');
			out.width = W;
			out.height = H;
			const og = out.getContext('2d');
			const shot = () => {
				const now = g.getImageData(0, 0, W, H);
				const d = now.data;
				for (let i = 0; i < d.length; i += 4) {
					const v = Math.min(255, Math.abs(d[i + 3] - rest[i + 3]) * 20);
					d[i] = d[i + 1] = d[i + 2] = v;
					d[i + 3] = 255;
				}
				og.putImageData(now, 0, 0);
				return out.toDataURL('image/png');
			};

			// 每幀送一次 scroll，模擬真實的滾輪／慣性捲動
			let scrolling = true;
			const pump = () => {
				if (!scrolling) return;
				dispatchEvent(new Event('scroll'));
				requestAnimationFrame(pump);
			};
			const frames = [];
			const t0 = performance.now();
			pump();
			for (const at of [150, 500, 1000, 1800]) {
				while (performance.now() - t0 < at) await nextFrames(1);
				frames.push({ at, phase: '捲動中', png: shot() });
			}
			scrolling = false;
			const tStop = performance.now();
			for (const after of [120, 400, 900]) {
				while (performance.now() - tStop < after) await nextFrames(1);
				frames.push({ at: after, phase: '停止捲動後', png: shot() });
			}
			report.frames = frames;
			send(report);
			return;
		}

		if (q.has('pulse')) {
			/* ── 回彈的節奏時間軸（票 05）────────────────────────────────
			   三個候選的**振幅完全一樣，只有節奏不同**，所以逐格截圖看不出差別——
			   要看的是「12 秒連續捲動裡，它在哪些時刻動了」。
			   量法：每 100ms 取一次「與靜止態的差」，畫成一條時間軸。
			   高的地方＝場在動，平的地方＝靜止。 */
			const SW = Math.min(cv.width, 600);
			const SH = Math.min(cv.height, 400);
			const rest = new Uint8Array(g.getImageData(0, 0, SW, SH).data);
			const level = () => {
				const d = g.getImageData(0, 0, SW, SH).data;
				let acc = 0;
				for (let i = 3; i < d.length; i += 4) acc += Math.abs(d[i] - rest[i]);
				return acc;
			};

			let pumping = true;
			const pump = () => {
				if (!pumping) return;
				dispatchEvent(new Event('scroll'));
				requestAnimationFrame(pump);
			};
			const series = [];
			const t0 = performance.now();
			pump();
			while (performance.now() - t0 < 12000) {
				await wait(100);
				series.push(level());
			}
			pumping = false;

			// 畫成時間軸：寬 = 12 秒，高 = 差的量，峰值正規化
			const W2 = 960;
			const H2 = 150;
			const out = document.createElement('canvas');
			out.width = W2;
			out.height = H2;
			const og = out.getContext('2d');
			og.fillStyle = '#20131d';
			og.fillRect(0, 0, W2, H2);
			const peak = Math.max(...series, 1);
			og.fillStyle = '#7998c3';
			series.forEach((v, i) => {
				const h = Math.max(1, Math.round((v / peak) * (H2 - 20)));
				og.fillRect(Math.round((i / series.length) * W2), H2 - h, Math.ceil(W2 / series.length), h);
			});
			// 每秒一格刻度
			og.fillStyle = '#736770';
			for (let sec = 1; sec < 12; sec++) og.fillRect(Math.round((sec / 12) * W2), H2 - 6, 1, 6);

			// 峰值超過底噪的次數 = 回彈了幾次（相鄰的高點算同一次）
			const floor = peak * 0.15;
			let hits = 0;
			for (let i = 0; i < series.length; i++) {
				if (series[i] > floor && (i === 0 || series[i - 1] <= floor)) hits++;
			}
			report.pulse = { hits, rearm: K.shockRearmMs, png: out.toDataURL('image/png') };
			send(report);
			return;
		}

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
			const w0 = main.getBoundingClientRect().width;
			for (let i = 0; i < 5; i++) {
				const mark = costs.length;
				const before = fp();
				/* 寬度要綁 **main 自己現在的寬**，而且**只能往小改**。
				   寫死 560–800px 在手機上全部比 402 的視窗還寬，`main` 一動也不動
				   （實測回報「建場 1.00ms」，那其實只是一幀普通的貼圖）；
				   改成視窗比例又會在桌機上踩到另一半——`main` 有 `--max-width` 夾著
				   （約 716–908px），比它大的值一樣不會讓盒子動。往小改則兩邊都成立。 */
				main.style.maxWidth = `${Math.round(w0 * (0.9 - i * 0.1))}px`;
				await nextFrames(6); // ResizeObserver → rAF → resize() → build()
				const changed = fp() !== before;
				if (changed) rebuilt++;
				// **沒重建的那幾次不進樣本**，否則量到的是普通幀被當成建場
				const window_ = costs.slice(mark);
				if (changed && window_.length) builds.push(Math.max(...window_));
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
				rebuilt, // 強迫改版面時，畫面真的變了幾次
				tries: 5, // 試了幾次——rebuilt 少於這個就代表沒觸發到，量到的不算數
			};
			// 幀率也只看常態那一段：五次強迫重建每次 100ms 以上，混進去會把平均拉垮
			report.fps = steadyTicks.length / ((steadyTicks[steadyTicks.length - 1] - steadyTicks[0]) / 1000);
			/* 常態那一段有幾成的幀根本量不到成本。**手機必看這一項**：iOS Safari 把
			   performance.now() 量化到 1ms，所以每一筆不是 0 就是 1——「中位 1.00ms」
			   講的是「有量到的那些幀」，不是全部的幀。量不到的比例才講得出真實量級。 */
			report.silentFrames = steadyTicks.length ? 1 - steady / steadyTicks.length : null;
			Object.assign(report, worstContrast());
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
		await wait(P.shockMs + 400);

		/* **持續捲動要量的是節奏，不是「有沒有在動」。**
		   先前這裡只判「持續捲動中的畫面差有沒有回到底噪」，那守得住「捲多久晃多久」，
		   **守不住反過來那一端**——第一版的修法（冷卻從上一次 scroll 事件算）會讓
		   常見的滾輪節奏永遠不武裝，整段閱讀只晃一次，而那一條檢查照樣是綠的。
		   現在數的是「六秒連續捲動裡回彈了幾次」，兩端都夾得住。 */
		/* **視窗起點要對齊冷卻的相位。**先前這裡直接開始，而前面剛送過一次 scroll
		   又等了 `shockMs + 400`，進入視窗時冷卻已經走掉約 1 秒——第一次回彈落在
		   t≈1700ms 而不是 0，六秒只裝得下 2 次，而期望值算的是 3 次。
		   ±1 的容差因此被吃光（官方跑出來就是「晃了 2 次／期望 3 次」，低側零餘裕）。
		   先把冷卻等滿，再開始 pump 與取樣，第一次回彈就會落在 t≈0。 */
		await wait(K.shockRearmMs + 200);
		const rest = snap();
		let pumping = true;
		const pump = () => {
			if (!pumping) return;
			dispatchEvent(new Event('scroll'));
			requestAnimationFrame(pump);
		};
		const RHYTHM_MS = K.rhythmWindowMs;
		const series = [];
		const tPump = performance.now();
		pump();
		while (performance.now() - tPump < RHYTHM_MS) {
			await wait(100);
			series.push(diff(snap(), rest));
		}
		pumping = false;
		/* 門檻不能只用「峰值的幾成」——**純雜訊的峰值就是雜訊本身**，那樣數出來
		   永遠有「幾次」。降低動態偏好那一輪實測就被自己的計數器判成晃了 1 次，
		   而那條路上 `kick()` 進門就 return、根本沒有位移。
		   改成先看這串數列有沒有結構：峰值要明顯高過中位數，才算得上有回彈。 */
		const sorted = [...series].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)] || 0;
		const peak = Math.max(...series, 1);
		let hits = 0;
		if (peak > Math.max(4 * median, 200)) {
			const floor = Math.max(peak * 0.15, 2 * median);
			for (let i = 0; i < series.length; i++) {
				if (series[i] > floor && (i === 0 || series[i - 1] <= floor)) hits++;
			}
		}
		/* `hits = 0` 有兩種完全相反的成因：真的沒動（peak 與 median 都很小），
		   或**一直在動**（peak≈median，結構守衛不成立）。只回報 hits 的話，
		   「一直晃」會被印成「幾乎不出現，敘事不可觀察」——紅得對、理由相反。
		   把 `moving` 一起送回去，判定那邊才分得出來。 */
		report.rhythm = {
			hits,
			window: RHYTHM_MS,
			rearm: K.shockRearmMs,
			peak,
			median,
			moving: median > Math.max(200, 4 * noise),
		};

		await wait(P.shockMs + K.shockRearmMs + 400); // 回位＋重新武裝都過去了，才量餘燼

		/* 餘燼要**跨過週期的一大段**才量得到。只有 6 顆，而且不透明度是
		   `底 + k^6 × 峰`——`k^6` 讓它大部分時間貼在底值附近，只有短暫一段會亮。
		   30 秒的週期裡取 4 秒的兩端，很容易兩端都落在暗處而量到 0（實測就發生過，
		   而且**先前那次量到 33 是運氣好**，不是機制穩）。改成十秒內每秒取一張，
		   取對第一張的最大差——只要期間有任何一顆亮過就抓得到。 */
		/* 而且要取**整張畫布**，不能用上面那塊左上角 600×400：只有 6 顆餘燼、散在整面，
		   那一角很可能一顆都沒有——實測常態那一輪就一直量到 0，而畫面上餘燼確實在燒。
		   位移那幾輪可以用小塊（整場一起動，取哪裡都看得到），餘燼不行。
		   一秒一張、只取十張，整張畫布的成本付得起。 */
		const fullSnap = () => new Uint8Array(g.getImageData(0, 0, cv.width, cv.height).data);
		const first = fullSnap();
		let ember = 0;
		for (let i = 0; i < 10; i++) {
			await wait(1000);
			ember = Math.max(ember, diff(fullSnap(), first));
		}
		report.noise = noise;
		report.shift = shift;
		report.ember = ember;
		send(report);
	});
})();
