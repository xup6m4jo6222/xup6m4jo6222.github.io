/**
 * 每一塊文字的方框與字色，交給 measure-contrast.mjs 去「找那塊背景最亮的像素、算對比」。
 * （那支腳本一直在，但產生它輸入的那一半從來沒有進 repo——票 04 補上。）
 *
 * **它同時負責把文字藏起來**：收完方框與字色之後就地注入透明化樣式，所以**同一次
 * Chrome 執行**既吐得出 JSON（`--dump-dom`）也拍得到純背景（`--screenshot`）。
 *
 *   node scripts/verify/dump.mjs index.html scripts/verify/probe-text-boxes.js 1280x900 4401 "" \
 *     --screenshot=<絕對路徑.png>            ← 由呼叫者自己加旗標；見那支腳本的說明
 *   加 `?nomotif` 連背景設計的畫布一起藏——那是「沒有背景設計」的對照組
 *   加 `?nofield` 藏第 4 層——那是「沒有第 4 層」的對照組
 *
 * ── 座標的坑：無頭 Chrome 有兩個視窗，不是一個（票 02 量出根因）─────────────
 *
 * `--window-size=1280,900` 之下：
 *
 *   `--dump-dom` 吐出來的那一刻，版面視窗是　1262×804（`innerWidth`／`innerHeight`）
 *   真正拍下去的那一幀，版面視窗是　　　　　 1280×900（＝ `--window-size`）
 *
 * 實測方法與結果（尺規探針）：在版面座標 `left:100px top:400px` 釘一塊
 * `position:fixed` 的色塊，它落在圖的 x100–149 y400–419（**左上角 1:1，沒有縮放**）；
 * 在四個邊釘色帶，它們落在圖的**四個邊**——所以拍那一幀時 `position:fixed` 的參考框
 * 是 1280×900。**畫面在被拍之前重新排了一次版，而 `--dump-dom` 早在那之前就吐完了**
 * （等多久都沒用：`--virtual-time-budget` 是虛擬時間，那一次重排是真實時間的事）。
 *
 * 後果：錨在視窗底部的東西（100vh 版面下的頁尾）在圖裡整整低了 96px，`main` 置中
 * 所以連內容的 y 也差幾十 px。拿 dump 的方框去對那張圖，量到的是**別的地方**——
 * 票 04 因此得到 4.22（手動加 96 之後 5.63），票 02 第一次跑得到 1.37。
 *
 * **修法：方框與截圖分兩次跑，兩次的「版面視窗」對齊到同一個尺寸。**
 * 版面視窗 ＝ `--window-size` 減掉一組固定差值（此機 18／96，來源是捲軸與視窗外框），
 * 所以：
 *
 *   量方框　`--window-size = 目標 + 差值`　→ dump 當下的版面視窗就是目標尺寸
 *   拍截圖　`--window-size = 目標`　　　　→ 拍那一幀的版面視窗就是目標尺寸
 *
 * 差值不要寫死——它是這台機器與這版 Chrome 的性質。`measure-field-ink.mjs` 先跑一次
 * 校準（拿 `vw`／`vh` 回推）再據此下兩次旗標，並且**用 `vw`／`vh` 與 PNG 的寬高
 * 逐項核對**：對不上就整輪作廢，不印警告了事。
 */
(() => {
	/** 收一次方框。視窗每變一次就重收，最後一次留在 DOM 裡。 */
	const record = () => {
		const els = [];
		const seen = new Set();
		for (const el of document.querySelectorAll('body *')) {
			if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
			if (el.id === 'probe-out') continue;
			// 只要自己直接帶文字的元素，不要祖先（祖先的方框會把整片背景都算進去）
			const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
			if (!own) continue;
			const r = el.getBoundingClientRect();
			if (!r.width || !r.height) continue;
			const cs = getComputedStyle(el);
			const key = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
			if (seen.has(key)) continue;
			seen.add(key);
			els.push({
				tag: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`,
				x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
				color: cs.color,
			});
		}
		let box = document.getElementById('probe-out');
		if (!box) {
			box = document.createElement('div');
			box.id = 'probe-out';
			box.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
			document.body.appendChild(box);
		}
		box.textContent = JSON.stringify({ vw: innerWidth, vh: innerHeight, els });
	};

	addEventListener('load', () => {
		record();

		// 就地透明化：留下純背景給同一次執行的截圖
		const st = document.createElement('style');
		st.textContent =
			'body,body *{color:transparent!important;border-color:transparent!important;text-decoration-color:transparent!important}' +
			'[data-reveal]{opacity:1!important;transform:none!important}' +
			(location.search.includes('nomotif') ? 'canvas.motif{display:none!important}' : '') +
			/* `?nofield` 把第 4 層藏起來——那是「沒有第 4 層」的對照組。
			   背景敘事輪票 02 加的：第 4 層的強度要拿「有它／沒有它」兩張純背景去比，
			   與 `?nomotif` 對背景設計是同一件事。 */
			(location.search.includes('nofield') ? 'canvas.field{display:none!important}' : '');
		document.head.appendChild(st);
	});
})();
