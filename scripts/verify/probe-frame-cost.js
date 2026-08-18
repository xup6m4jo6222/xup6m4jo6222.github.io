/**
 * 票 07：每幀成本的**固定開銷／邊際成本**拆解，外加建場成本，真機用。
 *
 * `probe-fps.js` 量的是「這一台現在每幀多少 ms」——一個點位。一個點位反推不出容量：
 * 成本 = 固定開銷 + 每個點的邊際成本 × 點數，只量一個點就把兩者混成一坨，
 * 拿它去除預算算出來的「還擺得下多少」必錯（票 07「量什麼」第一條）。
 * 這一支在**同一次載入**裡把點數掃過三檔（×1／×0.5／×0）＋餘燼掃過兩檔，直接把兩項分開。
 *
 * **必須在真瀏覽器裡跑，而且要低階或舊裝置。** 無頭 Chrome 的 `--virtual-time-budget`
 * 遇到常駐 rAF 迴圈幾乎不前進（實測 2 秒只給 4 幀），量到的是量測環境的假象
 * （看板 2026-07-28 那條教訓）。憲法門檻三那句「受害最重的是低階與舊裝置」也是同一個意思。
 *
 * ── 三件量測上的事，寫在這裡免得日後被「簡化」掉 ──────────────────────────
 *
 * ① **成本按動畫幀分組加總，不是按 rAF 回呼。** 場與背景設計各自登記一個回呼，
 *    同一幀會進來兩次；分開記的話中位數會變成「兩支程式各自的一半」，讀起來每幀便宜一倍。
 *    rAF 給同一幀的所有回呼同一個時戳，拿它分組。
 *
 * ② **換設定不重新載入頁面，改成換掉 canvas 元素再發一次 `astro:page-load`。**
 *    兩支繪製程式都用「這個 canvas 是不是我啟動過的那一個」判斷要不要重跑
 *    （ClientRouter 換頁時就是這樣走的），所以換掉元素＝一次乾淨的冷啟動，
 *    而值一律從 `data-motif`／`data-field` 讀——在複本上改屬性就等於改判準值。
 *    走重新載入的話四檔要載四次，手機上量到一半跳頁最容易被中斷。
 *
 * ③ **建場成本擺在最後，而且要扣對照組。** 建場是一次性支出（改版面時付一次），
 *    混進每幀成本的最大值會被讀成「有時候會爆」（票 07「量什麼」第二條）。
 *    但 `astro:page-load` 上還掛著版面自己的三個 init，所以先量「什麼都不換就發事件」
 *    當對照，減掉它才是建場本身。
 */
(() => {
	const BUDGET = 11; // 每幀預算（ms）。pointCap 的定義就是「這個預算下擺得下幾個點」
	const WARM_MS = 5000; // 首載擲點與字體交換都在這段裡，丟掉
	const STEP_MS = 12000; // 每一檔量多久（30fps 下約 360 幀，夠算 p95）
	const BUILDS = 21; // 建場各量幾次（一次約十幾 ms，量多一點 p95 才有意義）

	/** 四檔。點掃三檔給擬合，餘燼掃兩檔給「每顆餘燼多少錢」，末檔是純固定開銷。 */
	const STEPS = [
		{ name: '出貨值', pts: 1, ember: 1 },
		{ name: '點減半', pts: 0.5, ember: 1 },
		{ name: '無點', pts: 0, ember: 1 },
		{ name: '無點無餘燼', pts: 0, ember: 0 },
	];

	// ── ① 每一次動畫幀的總成本 ──────────────────────────────────────────
	const raf = window.requestAnimationFrame.bind(window);
	let sink = []; // 目前這一檔的收集桶
	let frameT = -1;
	let frameCost = 0;
	let frameArcs = 0;
	let maxArcs = 0; // 一幀裡畫過最多幾顆餘燼＝這一檔的餘燼數
	let drew = 0; // 這一幀有哪幾張畫布真的重畫（位元遮罩：1 場、2 背景設計）
	let needDrew = 3; // 要收哪種幀，載入後依模式與降低動態偏好決定

	/* 哪些幀算數，**不能用成本大小判斷**。`probe-fps.js` 用「> 0.15ms」把被 fpsCap
	   擋掉的幀濾掉，那在這一支會出事：拆帳要量「無點無餘燼」那一檔，而它整幀就只有
	   清空與幾張整面貼圖——桌機上真的低於 0.15ms，於是那一檔收到 0 幀，固定開銷量不到。
	   （第一次跑就是這樣，四檔的最後一檔顯示「已收 0 幀」。）
	   改用結構判斷：兩支 draw() 開頭都是 `clearRect` 整面，那就是「這一幀真的重畫了」的信號。 */
	const clearRect = CanvasRenderingContext2D.prototype.clearRect;
	CanvasRenderingContext2D.prototype.clearRect = function (...args) {
		const c = this.canvas.classList;
		if (c.contains('field')) drew |= 1;
		else if (c.contains('motif')) drew |= 2;
		return clearRect.apply(this, args);
	};

	/* ③ 重建幀要**踢出每幀成本**，不然一次性支出會坐在最大值上，被讀成「有時候會爆」。
	   認法：兩支程式只有在重建時才開新畫布（場的預繪圖、背景設計的遠景層與文字帶遮罩），
	   常態的每一幀一張都不開。所以「這一幀有沒有 createElement('canvas')」就是重建的信號。 */
	let frameBuilt = false;
	let peak = 0; // 重建幀的最高成本（量改版面的重建時用）
	const createElement = Document.prototype.createElement;
	Document.prototype.createElement = function (tag, ...rest) {
		if (String(tag).toLowerCase() === 'canvas') frameBuilt = true;
		return createElement.call(this, tag, ...rest);
	};

	const closeFrame = () => {
		if (frameBuilt) {
			if (frameCost > peak) peak = frameCost;
		} else if (drew === needDrew) {
			// 要的是「整站畫一幀多少錢」，所以該重畫的都畫了才算一幀
			sink.push(frameCost);
			if (frameArcs > maxArcs) maxArcs = frameArcs;
		}
		frameCost = 0;
		frameArcs = 0;
		drew = 0;
		frameBuilt = false;
	};
	window.requestAnimationFrame = (cb) =>
		raf((t) => {
			if (t !== frameT) {
				closeFrame();
				frameT = t;
			}
			const a = performance.now();
			cb(t);
			frameCost += performance.now() - a;
		});

	/* 餘燼是全站唯一用 `arc()` 的地方（場的 draw），數它就是數餘燼——
	   繪製程式沒有把數量露出來，而「每顆餘燼多少錢」要有分母。 */
	const arc = CanvasRenderingContext2D.prototype.arc;
	CanvasRenderingContext2D.prototype.arc = function (...args) {
		frameArcs++;
		return arc.apply(this, args);
	};

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const pct = (a, p) => {
		if (!a.length) return NaN;
		const s = [...a].sort((x, y) => x - y);
		return s[Math.min(s.length - 1, Math.floor(s.length * p))];
	};
	/** 這一檔進行中分頁有沒有被切走。切走了那一檔不算數（見量測迴圈）。 */
	let hiddenSeen = false;
	addEventListener('visibilitychange', () => {
		if (document.hidden) hiddenSeen = true;
	});

	const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
	const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
	const f4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : '—');

	/* 量測時鐘的解析度。**Safari 把 `performance.now()` 夾成 1 ms**（Spectre 之後的
	   時間戳粗化），而這個站每幀只花零點幾毫秒——中位數與 p95 因此全被夾成 0 或 1，
	   拆不出固定開銷（第一輪 iPhone 實測：四檔的中位數是 1／0／0／0）。
	   平均在這種時鐘下仍然是無偏的：每一次量測落在整數格的哪一邊由起始相位決定，
	   相位均勻時 E[夾過的差] ＝ 真值。所以粗時鐘上要看平均，細時鐘上兩個都看。 */
	const clockRes = (() => {
		let min = Infinity;
		let last = performance.now();
		for (let i = 0; i < 200000; i++) {
			const t = performance.now();
			if (t > last) min = Math.min(min, t - last);
			last = t;
		}
		return Number.isFinite(min) ? min : NaN;
	})();

	addEventListener('load', async () => {
		const box = document.createElement('div');
		box.style.cssText =
			'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;' +
			'font:13px/1.5 monospace;padding:10px;white-space:pre-wrap;pointer-events:none';
		document.body.appendChild(box);
		/* 讀數同時往收集器送一份。**每一檔結束就送一次**，不是只在最後送：
		   手機那一輪如果中途被電話、鎖屏、切 app 打斷，只在最後送等於整輪白量。 */
		const id = `${navigator.userAgent.slice(0, 40)}|${location.pathname}`;
		const say = (s) => {
			box.textContent = s;
		};
		const beacon = () => {
			try {
				navigator.sendBeacon(
					`http://${location.hostname}:4455/`,
					new Blob([JSON.stringify({ id, text: box.textContent })], { type: 'text/plain' }),
				);
			} catch {
				/* 收集器沒開就只看畫面 */
			}
		};

		const main = document.querySelector('main');
		const cv0 = document.querySelector('canvas.motif');
		const fv0 = document.querySelector('canvas.field');
		if (!cv0 || !fv0 || !main) {
			say('這一頁沒有場或背景設計（BaseLayout 沒給 motif prop）——換首頁量。');
			return;
		}

		// 出貨值的原件。四檔都從這裡複製再改，不要拿改過的那份再改一次。
		const BASE = {
			motif: cv0.dataset.motif,
			field: fv0.dataset.field,
		};
		const M0 = JSON.parse(BASE.motif);
		const K = JSON.parse(cv0.dataset.motifCraft);
		const mode = cv0.dataset.motifMode;
		const DPR = Math.min(devicePixelRatio || 1, K.dprCap);
		/* 背景設計只有首頁、而且沒開降低動態偏好時才跑常駐迴圈；其餘情況只有場在跑，
		   要求兩張都重畫會一幀都收不到。條件寫在這裡，報告裡也印出來。 */
		const motifLoops = mode === 'breathe' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
		needDrew = motifLoops ? 3 : 1;

		if (!innerWidth || !innerHeight || document.hidden) {
			say(
				'這個分頁是隱藏的（視窗 0×0 或在背景），繪製程式整條會早退，量不到東西。\n' +
					'請在看得見的視窗裡開這一頁，不要用無頭或背景分頁。',
			);
			return;
		}

		/** 這一檔實際擲了幾個點。取整要跟繪製程式的 `countFor` 一致（先乘密度再 round）。 */
		const pointsFor = (scale) => {
			const W = innerWidth;
			if (mode === 'breathe')
				return Math.min(K.pointCap, Math.round(((W * innerHeight) / 1000) * M0.density.home * scale));
			const tile = main.getBoundingClientRect().width * M0.tileHeightColumns;
			return Math.min(K.pointCap, Math.round(((W * tile) / 1000) * M0.density.reading * scale));
		};

		/** 換掉一個 canvas（帶著改過的判準值），回傳「要不要在這次事件裡重啟它」。 */
		const swap = (sel, mutate) => {
			const el = document.querySelector(sel);
			if (!el) return;
			const fresh = el.cloneNode(false); // 屬性照抄，畫布內容不必抄（本來就會重畫）
			mutate(fresh);
			el.replaceWith(fresh);
		};
		const setMotif = (el, scale) => {
			const M = JSON.parse(BASE.motif);
			M.density = { home: M0.density.home * scale, reading: M0.density.reading * scale };
			el.dataset.motif = JSON.stringify(M);
		};
		const setField = (el, scale) => {
			const P = JSON.parse(BASE.field);
			P.ember *= scale; // 門檻值：0 就一顆餘燼都挑不上
			el.dataset.field = JSON.stringify(P);
		};

		// ── 四檔 ────────────────────────────────────────────────────────
		sink = [];
		say('暖機中（首載擲點與字體交換不算數）……');
		await sleep(WARM_MS);

		const rows = [];
		for (let i = 0; i < STEPS.length; i++) {
			const s = STEPS[i];
			/* 分頁一旦看不見，兩支繪製程式整條早退、rAF 在 Chrome 裡直接不前進——
			   那一檔會靜靜地收到 0 幀（第一輪桌機的第四檔就是這樣，而固定開銷正好只有
			   那一檔量得到）。所以要盯著可見性，被切走就整檔重來，不是回報一個空的。 */
			let tries = 0;
			let row = null;
			while (!row && tries++ < 3) {
				while (document.hidden) await sleep(500); // 切回來再開始
				swap('canvas.motif', (el) => setMotif(el, s.pts));
				swap('canvas.field', (el) => setField(el, s.ember));
				document.dispatchEvent(new Event('astro:page-load'));
				await sleep(1000); // 重建那一下不算進這一檔
				sink = [];
				maxArcs = 0;
				hiddenSeen = false;
				const t0 = performance.now();
				while (performance.now() - t0 < STEP_MS && !hiddenSeen) {
					await sleep(500);
					say(
						`第 ${i + 1}/${STEPS.length} 檔　${s.name}${tries > 1 ? `（第 ${tries} 次，前一次被切走）` : ''}\n` +
							`點 ${pointsFor(s.pts)}　餘燼 ${maxArcs}\n` +
							`已收 ${sink.length} 幀　平均 ${f2(avg(sink))} ms\n\n` +
							`剩下約 ${Math.round((STEP_MS - (performance.now() - t0)) / 1000) + (STEPS.length - 1 - i) * 13} 秒。\n` +
							`**這一頁要一直留在畫面上**——切走或鎖屏這一檔就要重來。`,
					);
				}
				if (!hiddenSeen && sink.length) {
					row = {
						name: s.name,
						points: pointsFor(s.pts),
						embers: maxArcs,
						n: sink.length,
						mean: avg(sink),
						med: pct(sink, 0.5),
						p95: pct(sink, 0.95),
						max: Math.max(0, ...sink),
					};
				}
			}
			rows.push(row || { name: s.name, points: pointsFor(s.pts), embers: maxArcs, n: 0 });
			beacon();
		}

		// ── 拆帳 ────────────────────────────────────────────────────────
		const [ship, half, noPts, bare] = rows;
		/* 同一套拆法對中位數與平均各做一次。粗時鐘（Safari 的 1 ms）上中位數會夾成 0/1、
		   拆出來一片 0，平均才有解析度；細時鐘上兩條應該接近，接近本身就是這組數字的體檢。 */
		const split = (key) => {
			// 每個點：對「餘燼開著」的三檔做最小二乘。三個點才看得出線性成不成立。
			const fit = [ship, half, noPts].filter((r) => Number.isFinite(r[key]));
			let perPoint = NaN;
			if (fit.length >= 2) {
				const nBar = avg(fit.map((r) => r.points));
				const cBar = avg(fit.map((r) => r[key]));
				const den = fit.reduce((s, r) => s + (r.points - nBar) ** 2, 0);
				perPoint = den ? fit.reduce((s, r) => s + (r.points - nBar) * (r[key] - cBar), 0) / den : NaN;
			}
			const perEmber = noPts.embers ? (noPts[key] - bare[key]) / noPts.embers : NaN;
			const fixed = bare[key]; // 整面操作：清空、貼預繪圖、上色、化開、文字帶遮罩
			// 預算扣掉固定開銷與餘燼之後，剩下的錢能買幾個點
			const room = BUDGET - fixed - (Number.isFinite(perEmber) ? perEmber * ship.embers : 0);
			return { perPoint, perEmber, fixed, cap: perPoint > 0 ? Math.round(room / perPoint) : NaN };
		};
		const byMean = split('mean');
		const byMed = split('med');
		const mpx = (innerWidth * DPR * innerHeight * DPR) / 1e6;

		// ── ③ 一次性支出（最後才量，而且扣對照組） ──────────────────────
		say('四檔量完，正在量一次性支出（冷啟動與重建）……');
		const dispatchMs = () => {
			const a = performance.now();
			document.dispatchEvent(new Event('astro:page-load'));
			return performance.now() - a;
		};
		const times = (k, fn) => {
			const out = [];
			for (let i = 0; i < k; i++) out.push(fn());
			return out;
		};
		// 對照：什麼都不換就發事件——兩支繪製程式都會早退，量到的是版面那三個 init
		const control = pct(times(BUILDS, dispatchMs), 0.5);
		const fieldCold = times(BUILDS, () => {
			swap('canvas.field', (el) => setField(el, 1));
			return dispatchMs() - control;
		});
		const motifCold = times(BUILDS, () => {
			swap('canvas.motif', (el) => setMotif(el, 1));
			return dispatchMs() - control;
		});

		/* 冷啟動 ≠ 重建。場的噪聲表（兩張 65536 格）建在 `start()` 裡，改版面時**不會**再付；
		   改版面付的是 `build()`（掃等高線）＋背景設計的重擲、遠景層、文字帶遮罩。
		   要量後者就得真的動一次版面：把內容欄寬挪 2px，文字帶的簽章就變了，兩支都會重建。
		   重建走的是 rAF 節流那條路，所以量法是「盯住這段期間單一幀的最高成本」。 */
		say('正在量改版面的重建成本……');
		const reflow = [];
		for (let i = 0; i < BUILDS; i++) {
			peak = 0;
			main.style.maxWidth = i % 2 ? 'calc(100% - 2px)' : '';
			await sleep(400); // ResizeObserver → rAF → resize() → build() 都落在這段裡
			if (peak) reflow.push(peak);
		}
		main.style.maxWidth = '';

		// ── 報告 ────────────────────────────────────────────────────────
		const line = '━'.repeat(30);
		const text =
			`每幀成本拆帳　${mode}　${innerWidth}×${innerHeight}　DPR ${DPR}（畫布 ${f2(mpx)} Mpx）\n` +
			`${navigator.userAgent.slice(0, 80)}\n` +
			`量測時鐘解析度 ${f4(clockRes)} ms` +
			(clockRes >= 0.5 ? '　⚠ 粗時鐘：中位數與 p95 被夾成整數，拆帳看平均那一行\n' : '\n') +
			(motifLoops ? '' : '⚠ 背景設計沒有跑常駐迴圈（不是首頁，或開了降低動態偏好）——下面只有場的成本\n') +
			`${line}\n` +
			rows
				.map(
					(r) =>
						`${r.name.padEnd(6, '　')}點 ${String(r.points).padStart(4)}　餘燼 ${String(r.embers).padStart(3)}　` +
						`平均 ${f4(r.mean)}　中位 ${f2(r.med)}　p95 ${f2(r.p95)}　最大 ${f2(r.max)}　(${r.n} 幀)`,
				)
				.join('\n') +
			`\n${line}\n` +
			`固定開銷（整面操作）　平均 ${f4(byMean.fixed)} ms（${f2(byMean.fixed / mpx)} ms/Mpx）　中位 ${f2(byMed.fixed)} ms\n` +
			`每個擲出的點　平均 ${f4(byMean.perPoint)} ms　中位 ${f4(byMed.perPoint)} ms\n` +
			`　（三層景深裡最遠那層烤進預繪圖、每幀不重畫，所以每個點看起來便宜三分之一）\n` +
			`每顆餘燼　平均 ${f4(byMean.perEmber)} ms　中位 ${f4(byMed.perEmber)} ms\n` +
			`出貨值　平均 ${f4(ship.mean)}　中位 ${f2(ship.med)}　p95 ${f2(ship.p95)} ms　（預算 ${BUDGET} ms）\n` +
			`→ ${BUDGET} ms 預算下擺得下 ≈ ${byMean.cap} 個點（依中位數 ${byMed.cap}；現行 pointCap ${K.pointCap}）\n` +
			/* 對帳：拆出來的三項加回去要等於出貨值那一檔真的量到的平均。
			   兩者差很多就代表「成本＝固定＋每點×點數」這個線性模型在這台機器上不成立，
			   那時候上面那個「擺得下幾個點」也就不能用——這一行是它自己的紅綠燈。 */
			`對帳　${f4(byMean.fixed)} ＋ ${f4(byMean.perPoint)}×${ship.points} ＋ ${f4(byMean.perEmber)}×${ship.embers}` +
			` ＝ ${f4(byMean.fixed + byMean.perPoint * ship.points + byMean.perEmber * ship.embers)} ms` +
			`　vs 出貨值實測 ${f4(ship.mean)} ms\n` +
			`${line}\n` +
			`一次性支出（每頁付一次或改版面付一次，**不在上面那些數字裡**）\n` +
			`　冷啟動　場 中位 ${f2(pct(fieldCold, 0.5))} p95 ${f2(pct(fieldCold, 0.95))} ms　` +
			`背景設計 中位 ${f2(pct(motifCold, 0.5))} p95 ${f2(pct(motifCold, 0.95))} ms\n` +
			`　　（場的冷啟動含兩張 65536 格的噪聲表，那是每頁付一次、改版面不再付的）\n` +
			`　改版面重建（兩支一起）　中位 ${f2(pct(reflow, 0.5))} ms　p95 ${f2(pct(reflow, 0.95))} ms　(${reflow.length} 次)\n` +
			`　　（對照：什麼都不換就發一次 astro:page-load ＝ ${f2(control)} ms）\n` +
			`${line}\n` +
			`量完了，可以關掉。`;

		say(text);
		beacon();
	});
})();
