/**
 * 第 4 層與第 5 層的執行期探針。回答四個靜態閘門答不出來的問題：
 *
 *   1. 兩層**真的在畫**嗎？（畫布上有沒有非零像素——不靠 `console.log`，只看像素）
 *   2. 文字帶減光**真的有作用**嗎？
 *   3. **主色有沒有溜進第 4 層**？（兩層都是點之後，顏色是它們唯一分得開的通道，
 *      而閘門只看得到屬性、看不到畫出來的像素）
 *   4. **循環真的在跑嗎**？（隔四分之一圈再取一次，兩層的畫面都要明顯變過）
 *
 * 第 2 題是這一支的老本行：等高線時代 `strokeStyle` 的坑讓減光「寫了但沒生效」，
 * 而畫面看起來完全正常。第 4 題是 2026-08-05 換上兩層同步呼吸之後新的——
 * **相位是算出來的、沒有任何狀態，所以「它到底有沒有在動」只有量畫布才知道。**
 *
 * 對照組一律靠改 `data-field` 屬性產生（`?nodim` `?ink=` `?density=` `?drift=` `?kill=1`），
 * 不必為了換一個值重新建置——**這是產物端契約付出來的紅利**。
 *
 * `?runtime=1` 量成本（見下）。**不要加 --virtual-time-budget**。
 */
(() => {
	const errors = [];
	addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
	addEventListener('unhandledrejection', (e) => errors.push(`未處理的 rejection: ${e.reason}`));

	const q = new URLSearchParams(location.search);
	const nodim = q.has('nodim');
	const runtime = q.has('runtime');
	/**
	 * `?kill=1` — **讓場整個不畫**，用來證明這支探針自己會紅。
	 * 拿掉 `data-field`，元件讀不到參數就直接 return，畫布會是全空的。
	 * 這是「驗證工具自己會假綠」那條教訓的執行版：v9 抓到過一個動畫死透仍報
	 * 「有在動」的探針，所以每一次跑都要順手證明一次自己不是那種。
	 */
	const killed = q.has('kill');
	/**
	 * `?nomotif=1` — 把背景設計殺掉，只留第 4 層。
	 * 量建場成本時要用：改版面那條路上背景設計也在重建（三張整面離屏遮罩＋遠景層），
	 * 實測 72–178ms，而第 4 層的份額落在雜訊裡。**兩個量級差太多的東西相減，
	 * 得到的是雜訊不是差額**——要拿到它自己的數字，就得讓它單獨走一次那條路。
	 */
	if (q.has('nomotif')) document.querySelector('canvas.motif')?.removeAttribute('data-motif');
	/* 參數要在拿掉屬性**之前**先留一份：探針自己還要用它（強度、密度），
	   不留的話這支會在被殺掉的那一輪自己丟例外，那就變成「探針壞了」而不是「場沒畫」。 */
	let savedField = document.querySelector('canvas.field')?.dataset.field;
	if (killed) document.querySelector('canvas.field')?.removeAttribute('data-field');

	/* 成本：在元件的模組執行**之前**換掉 requestAnimationFrame，替每一次回呼計時。
	   這支是 classic script、解析當下就執行，元件是 module、延後執行，所以順序是規格保證的。
	   **第 4 層在票 02 是靜態的**——它沒有常駐迴圈，唯一會進 rAF 的是版面改變那條路
	   （`onResize` → rAF → resize() → 重擲＋重畫）。所以這裡收到的就是**建場成本**。 */
	const costs = [];
	if (runtime) {
		const raf0 = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) =>
			raf0((t) => {
				const a = performance.now();
				cb(t);
				const b = performance.now();
				if (b - a > 0.15) costs.push(b - a);
			});
	}

	/* `?slowcycle=1` — **循環的對照組**：把週期拉到極長，循環幾乎不動，畫面上剩下的
	   變化就只有兩層各自的漂移。沒有這個對照組的話「第 5 層有沒有在循環」量不出來——
	   它自己的漂移在七秒半裡本來就會讓畫面差很多，拿那個當底噪，訊號永遠淹得掉。
	   改屬性就等於改參數，這是產物端契約付出來的紅利（同 `?nodim`）。 */
	const mv0 = document.querySelector('canvas.motif');
	/** **對照組動手腳之前的真實週期。** 取樣的節奏一律照它算，理由見下面那段。 */
	let realPeriod = null;
	if (mv0 && mv0.dataset.cycle) {
		realPeriod = JSON.parse(mv0.dataset.cycle).period;
		if (q.has('slowcycle')) {
			const c = JSON.parse(mv0.dataset.cycle);
			c.period = 100000;
			mv0.dataset.cycle = JSON.stringify(c);
		}
	}

	/* 對照組：在元件讀屬性之前改參數。順序同上，是規格保證的不是碰運氣。 */
	const cv0 = document.querySelector('canvas.field');
	const KNOBS = { ink: 'ink', dim: 'textDim', density: 'density', drift: 'drift' };
	if (cv0 && !killed && (nodim || Object.keys(KNOBS).some((k) => q.has(k)))) {
		const p = JSON.parse(cv0.dataset.field);
		if (nodim) p.textDim = 0;
		for (const [k, key] of Object.entries(KNOBS)) if (q.has(k)) p[key] = +q.get(k);
		cv0.dataset.field = JSON.stringify(p);
		savedField = cv0.dataset.field;
	}

	/* sendBeacon 有大約 64KB 的上限，送 PNG 那幾輪一定超過。
	   大的走 fetch（那些輪不需要 beacon 的「頁面關掉也送得出去」保證）。 */
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
		await wait(1200); // 讓字體交換落定、版面重擲完
		const cv = document.querySelector('canvas.field');
		const main = document.querySelector('main');
		if (!cv || !main) {
			send({ ok: false, why: '這一頁沒有第 4 層', errors });
			return;
		}
		// 被 `?kill=1` 拿掉屬性的那一輪，讀的是先前留下來的那一份
		const P = JSON.parse(cv.dataset.field || savedField);
		const K = JSON.parse(cv.dataset.fieldCraft);
		const F = K.textBandFeather;
		const dpr = cv.width / innerWidth;
		const g = cv.getContext('2d');

		/* 文字帶的取法與元件一致：每個內容區子元素各一塊，不取聯集；
		   main 只有一個子元素時它是版面包裝盒（首頁的 section.home），往下一層再取。
		   「核心／帶外」那一組讀數取**面積最大的那一塊**：它是這一頁正文的所在。 */
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

		/**
		 * 一塊矩形（視窗座標）的讀數。
		 *   mean   平均不透明度
		 *   hit    有畫到的像素數——**「它真的在畫」就是這個數字**
		 *   accent 帶元素主色的像素數（藍明顯高於紅）。這一層整層中性色，**必須是 0**
		 *   max    最高不透明度
		 */
		const region = (x0, x1, y0, y1) => {
			const px0 = Math.max(0, Math.round(x0 * dpr));
			const px1 = Math.min(cv.width, Math.round(x1 * dpr));
			const py0 = Math.max(0, Math.round(y0 * dpr));
			const py1 = Math.min(cv.height, Math.round(y1 * dpr));
			if (px1 <= px0 || py1 <= py0) return { mean: 0, hit: 0, accent: 0, max: 0 };
			const d = g.getImageData(px0, py0, px1 - px0, py1 - py0).data;
			let sum = 0;
			let hit = 0;
			let accent = 0;
			let max = 0;
			for (let i = 0; i < d.length; i += 4) {
				const a = d[i + 3];
				sum += a;
				if (!a) continue;
				hit++;
				if (a > max) max = a;
				// 中性階是 R≈G≈B；元素主色的藍明顯高於紅
				if (d[i + 2] > d[i] + 20) accent++;
			}
			return { mean: sum / (d.length / 4) / 255, hit, accent, max: max / 255 };
		};

		const y0 = Math.max(0, box.top);
		const y1 = Math.min(innerHeight, box.bottom);
		const core = region(box.left + F, box.right - F, y0, y1); // 減光滿檔的那一帶
		const out = region(0, box.left - F, y0, y1); // 帶外，完全不減光
		const whole = region(0, innerWidth, 0, innerHeight);

		/** 這個尺寸下**應該**擲出幾顆。拿它跟成本一起送回去，才算得出每一顆的邊際成本。 */
		const fieldH = innerHeight * (1 + K.heightTolerance);
		const marks = Math.min(K.markCap, Math.round((P.density * innerWidth * fieldH) / 1000));

		const report = {
			ok: true,
			nodim,
			page: location.pathname,
			ink: P.ink,
			textDim: P.textDim,
			density: P.density,
			marks,
			vw: innerWidth,
			vh: innerHeight,
			dpr,
			band: `${Math.round(box.left)}–${Math.round(box.right)} × ${Math.round(y0)}–${Math.round(y1)}（共 ${boxes.length} 塊，此為最大塊）`,
			core: core.mean,
			out: out.mean,
			ratio: out.mean ? core.mean / out.mean : null,
			painted: whole.hit,
			accent: whole.accent,
			maxAlpha: whole.max,
			errors,
		};

		/* ── 循環真的在跑嗎 ────────────────────────────────────────────────
		   兩層畫在各自的畫布上，所以「兩層都動了」這件事量得到。取樣點隔**四分之一圈**
		   （相位走得最快的那一段），兩層的逐像素差都要明顯高於各自的底噪。

		   **底噪要先量**：不動的那一段畫面本來就會因為抗鋸齒有微小差異，不扣掉的話
		   「有沒有在動」會永遠是「有」。這是等高線那一輪學到的同一件事。 */
		const mv = document.querySelector('canvas.motif');
		const snap = (c) => (c && c.width ? new Uint8Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) : null);
		const diff = (a, b) => {
			if (!a || !b || a.length !== b.length) return null;
			let s = 0;
			for (let i = 3; i < a.length; i += 4) s += Math.abs(a[i] - b[i]);
			return s;
		};
		/**
		 * **聚攏程度**：取畫面中間一條窄直帶，算那一帶裡有墨像素的**垂直散佈**（標準差）。
		 *
		 * 為什麼不是「畫面差多少」——那個量法**會飽和**：一顆點只要移動超過自己的大小，
		 * 舊位置全空、新位置全滿，差值就到頂了，所以「移 10px」與「移 240px」量起來一樣。
		 * 實測就是這樣騙過去的：循環的變化 178755、只有漂移的對照組 126444，比 1.41，
		 * 看起來像「循環幾乎沒作用」，而其實是尺規本身讀不出差別。
		 *
		 * 垂直散佈不會飽和：**散開時那一帶的點鋪滿整個高度，聚攏時它們擠在曲線經過的
		 * 那一小段**——這正是「排出一條趨勢」在畫面上的定義，量的就是那件事本身。
		 */
		const spreadOf = (c) => {
			if (!c || !c.width) return null;
			/* **橫跨全寬取五條，各自算完再平均**——不是只取中間一條。
			   只取一條的話樣本太少：這一層現在只有一百多顆點，一條窄帶裡十幾顆，
			   標準差在那個樣本數下本身就會跳（實測同一組參數量到 49%、32%、8% 都有）。
			   **量的仍然是「同一個 x 附近的垂直散佈」**——那才是「排出趨勢」的定義；
			   直接把整面的 y 拿去算會把曲線本身的高低差也算進去，聚攏反而看起來更散。 */
			const STRIPS = 5;
			const w = Math.max(1, Math.round(c.width / STRIPS));
			const g2 = c.getContext('2d');
			let acc = 0;
			let used = 0;
			for (let k = 0; k < STRIPS; k++) {
				const d = g2.getImageData(k * w, 0, Math.min(w, c.width - k * w), c.height).data;
				let sw = 0;
				let sy = 0;
				let syy = 0;
				for (let i = 0; i < d.length; i += 4) {
					const a = d[i + 3];
					if (!a) continue;
					const y = Math.floor(i / 4 / w);
					sw += a;
					sy += a * y;
					syy += a * y * y;
				}
				if (sw < 255) continue; // 這一條太少墨，算出來的標準差沒有意義
				const m = sy / sw;
				acc += Math.sqrt(Math.max(0, syy / sw - m * m)) / c.height;
				used++;
			}
			return used ? acc / used : null;
		};

		/* **閱讀頁沒有第 5 層了**（2026-08-05 本人拿掉）。沒有它就沒有週期可讀，
		   那一頁要判的只有「第 4 層在不在飄」，取樣間隔退回一個寫死的秒數。 */
		const CY = mv && mv.dataset.cycle ? JSON.parse(mv.dataset.cycle) : null;
		/* **第 5 層 2026-08-05 起只有一種模式**（閱讀頁那一份整層退場），所以「有沒有循環」
		   等於「這一頁有沒有第 5 層」。先前是讀 `data-motif-mode`，那個屬性隨模式一起刪了，
		   留著會讓首頁被判成「沒有循環的那一頁」——實測就是這樣紅過一次。 */
		const breathing = !!mv;
		/* **只有真的要判循環的那幾輪才對相位。** 對相位一次最多空等一整圈（30 秒），
		   而一輪要載六個頁面——`?nodim` 那一輪根本不看循環（判定只讀 `on` 與 `slow`
		   兩組），卻照樣付了那 30 秒。跳掉它，整支快三分之一。 */
		if (!killed && !nodim) {
			/* **等到循環的兩個端點再取樣，不要在任意兩點之間比。**
			   相位是從頁面時鐘算出來的，所以「載入完 1.2 秒」落在一圈的哪裡是碰運氣——
			   實測同一組參數量到 64%、22%、13% 都有，而 13% 那次只是剛好從接近聚攏的
			   地方起跳。這裡自己算出下一個「最散」的時刻，等到那裡取第一張，
			   再等半圈取第二張。**兩張分別是這一圈的兩個極端**，判準因此不再靠運氣。 */
			/* **節奏一律照「真實週期」算，不是照畫面上生效的那個。** 對照組把週期改成
			   100000 秒，照它自己算的話「等到下一個最散」要等一天多——實測整支逾時。
			   而且兩組的時間長度必須一樣才可比：對照組要回答的是「同樣這段時間裡，
			   沒有循環的話畫面會變多少」。 */
			const per = realPeriod ?? 30;
			const hold = CY ? CY.hold : 0;
			const phaseAt = (t) => {
				const raw = (1 - Math.cos((2 * Math.PI * t) / per)) / 2;
				return hold <= 0 ? raw : Math.pow(raw, 1 - hold * 0.75);
			};
			if (CY) {
				/* 等到**下一個端點**（最散或最聚都行），不是硬等到「最散」那一個——
				   端點每半圈就有一個，所以最壞等半圈而不是一整圈。兩張取樣仍然分別落在
				   一圈的兩個極端，判準的意義不變，但整支省掉一半的空等。 */
				const nowSec = performance.now() / 1000;
				const half = per / 2;
				await wait((half - (nowSec % half)) * 1000);
			}
			const f0 = snap(cv);
			const m0 = snap(mv);
			const spread0 = spreadOf(mv);
			const p0 = phaseAt(performance.now() / 1000);
			await nextFrames(3); // 底噪：三幀之內相位幾乎沒動
			const fNoise = diff(snap(cv), f0);
			const mNoise = diff(snap(mv), m0);
			const gap = CY ? (per / 2) * 1000 : 7500;
			await wait(gap);
			report.cycle = {
				breathing,
				hasMotif: !!mv,
				slow: q.has('slowcycle'),
				seconds: gap / 1000,
				period: CY?.period ?? null,
				realPeriod,
				phase0: p0,
				phase1: phaseAt(performance.now() / 1000),
				fieldMoved: diff(snap(cv), f0),
				motifMoved: diff(snap(mv), m0),
				fieldNoise: fNoise,
				motifNoise: mNoise,
				spread0,
				spread1: spreadOf(mv),
				reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
			};
		}

		if (runtime) {
			/* ── 兩筆帳要分開量 ──────────────────────────────────────────────
			   第 4 層沒有常駐迴圈，所以**沒有每幀成本可以量**。它的支出有兩筆，
			   花的時機與頻率完全不同：

			     重畫　文字帶一變就付一次（字體換上來就是一次），**票 03 把浮現接到捲動
			     　　　之後它會變成逐幀的**——所以它才是要對 11 ms 預算的那個數字
			     重擲　只在視窗尺寸變時付，一次性

			   觸發重畫用的是**外部可觀察的路徑**：改 main 的寬度 → 文字帶變了 → 重畫。
			   這正是字體換上來時真的會走的那條路，不是為了量測另開的後門。
			   每一次都要確認「**真的重畫了**」，不能只看有沒有一幀變貴：若元件根本沒動，
			   量到的是同一條路上別人的成本，而那個數字看起來一樣合理。判法是畫面指紋，
			   取**整張畫布**（只取左上角一塊的話，寬視窗裡正文欄還沒開始，那一塊不會變）。 */
			await wait(1500);
			costs.length = 0;
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
				/* 寬度綁 **main 自己現在的寬**，而且**只能往小改**：寫死的像素值在手機上
				   比視窗還寬，`main` 一動也不動（那會量到一幀普通的貼圖並報成建場成本）；
				   桌機那頭 `main` 有 `--max-width` 夾著，比它大的值一樣不會讓盒子動。 */
				main.style.maxWidth = `${Math.round(w0 * (0.9 - i * 0.1))}px`;
				await nextFrames(6); // ResizeObserver → rAF → resize() → 重擲
				const changed = fp() !== before;
				if (changed) rebuilt++;
				const window_ = costs.slice(mark);
				// **沒重畫的那幾次不進樣本**，否則量到的是普通幀被當成建場
				if (changed && window_.length) builds.push(Math.max(...window_));
			}
			main.style.maxWidth = original;
			await nextFrames(6);

			const pctl = (arr, p) => {
				if (!arr.length) return null;
				const s = [...arr].sort((a, b) => a - b);
				return s[Math.min(s.length - 1, Math.floor(s.length * p))];
			};
			report.redraw = {
				med: pctl(builds, 0.5),
				max: builds.length ? Math.max(...builds) : null,
				n: builds.length,
				rebuilt, // 強迫改版面時，畫面真的變了幾次
				tries: 5, // 試了幾次——rebuilt 少於這個就代表沒觸發到，量到的不算數
			};

			/* ── 冷啟動（重擲＋重畫）──────────────────────────────────────
			   重擲只在視窗尺寸變時發生，而視窗尺寸從頁面裡動不了。**換掉 canvas 元素再發
			   一次 `astro:page-load` 就是一次乾淨的冷啟動**——元件用「這個 canvas 是不是我
			   啟動過的那一個」判斷要不要重跑（ClientRouter 換頁時走的就是這條），
			   而值一律從屬性讀，複本上的屬性就是複本的參數。
			   `start()` 在派送當下**同步**跑完，所以直接夾時間就量得到，不必等 rAF。 */
			const cold = [];
			for (let i = 0; i < 5; i++) {
				const el = document.querySelector('canvas.field');
				const clone = el.cloneNode(true);
				el.replaceWith(clone);
				const a = performance.now();
				document.dispatchEvent(new Event('astro:page-load'));
				cold.push(performance.now() - a);
				await nextFrames(2);
			}
			report.cold = { med: pctl(cold, 0.5), max: Math.max(...cold), n: cold.length };
		}

		send(report);
	});
})();
