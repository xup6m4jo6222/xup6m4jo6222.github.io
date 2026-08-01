/**
 * 每一塊文字的方框與字色，交給 measure-contrast.mjs 去「找那塊背景最亮的像素、算對比」。
 * （那支腳本一直在，但產生它輸入的那一半從來沒有進 repo——票 04 補上。）
 *
 * **它同時負責把文字藏起來**：收完方框與字色之後就地注入透明化樣式，所以**同一次
 * Chrome 執行**既吐得出 JSON（`--dump-dom`）也拍得到純背景（`--screenshot`）。
 * 分兩次跑會踩到對不齊：兩次的 `innerWidth` 不一定相同（實測 dump 模式 1262、
 * 截圖模式 1280），方框就會偏一段。
 *
 *   node scripts/verify/dump.mjs index.html scripts/verify/probe-text-boxes.js 1280x900 4401 "" \
 *     --screenshot=<絕對路徑.png>            ← 由呼叫者自己加旗標；見那支腳本的說明
 *   加 `?nomotif` 連背景設計的畫布一起藏——那是「沒有背景設計」的對照組
 *
 * **座標有一個坑，量之前先看 `vw`／`vh`**：無頭 Chrome 的版面視窗不等於截圖尺寸
 * （實測 `--window-size=1280,900` 給的是版面 1262×804、圖 1280×900）。
 * 上緣錨定的元素（導覽列、`main` 內容）y 對得上，**錨在頁底的頁尾差整整一個
 * 圖高減版面高**（此例 +96）。不修正就會把頁尾的方框放到它上面那片沒有減光的地方，
 * 量出來的對比會假性不及格——票 04 第一次跑就得到 4.22（修正後 5.63）。
 */
addEventListener('load', () => {
	const els = [];
	const seen = new Set();
	for (const el of document.querySelectorAll('body *')) {
		if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
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

	const box = document.createElement('div');
	box.id = 'probe-out';
	box.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
	box.textContent = JSON.stringify({ vw: innerWidth, vh: innerHeight, els });
	document.body.appendChild(box);

	// 就地透明化：留下純背景給同一次執行的截圖
	const st = document.createElement('style');
	st.textContent =
		'body,body *{color:transparent!important;border-color:transparent!important;text-decoration-color:transparent!important}' +
		'[data-reveal]{opacity:1!important;transform:none!important}' +
		(location.search.includes('nomotif') ? 'canvas.motif{display:none!important}' : '');
	document.head.appendChild(st);
});
