/**
 * 把背景的墨量放大幾倍拍下來——**給人看形狀用的，不是拿來讀數字的**。
 *
 * 為什麼需要它：出貨的背景只有 1.66% 的像素有墨、那些像素平均只有 6% 的不透明度，
 * 所以「文字帶的形狀是不是真的改了」在原尺寸截圖裡幾乎看不見。數字那條路走探針
 * （probe-signature-right.js），這一支負責回答另一個問題：**縫透出來好不好看**。
 *
 * 兩張畫布（場與背景設計）的不透明度各乘一個倍率，合成到一張不透明的圖上覆蓋整頁，
 * 文字一併藏起來。**是快照不是即時**——場有常駐迴圈，直接改畫布像素下一幀就被蓋掉。
 *
 *   node scripts/verify/dump.mjs index.html scripts/verify/probe-band-view.js 1280x720 <埠> "?amp=10" \
 *     --screenshot=<絕對路徑.png>
 */
addEventListener('load', () => {
	setTimeout(() => {
		const q = new URLSearchParams(location.search);
		const amp = Number(q.get('amp')) || 8;
		/* `?only=field` 只畫場。**場是決定性的**（種子固定，同一個視窗尺寸永遠畫出同一張），
		   背景設計的點則是每次載入重擲——要做改前改後的對照圖就得用場，否則兩張圖的差
		   有一半是亂數造成的，看圖的人分不出哪一半是改動造成的。 */
		const only = q.get('only');
		const out = document.createElement('canvas');
		const w = (out.width = innerWidth);
		const h = (out.height = innerHeight);
		out.style.cssText = `position:fixed;inset:0;width:100%;height:100%;z-index:999`;
		const g = out.getContext('2d');
		g.fillStyle = getComputedStyle(document.body).backgroundColor;
		g.fillRect(0, 0, w, h);

		for (const sel of ['canvas.field', 'canvas.motif']) {
			if (only && !sel.endsWith(only)) continue;
			const cv = document.querySelector(sel);
			if (!cv) continue;
			const src = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
			const d = src.data;
			for (let i = 3; i < d.length; i += 4) d[i] = Math.min(255, d[i] * amp);
			const tmp = document.createElement('canvas');
			tmp.width = cv.width;
			tmp.height = cv.height;
			tmp.getContext('2d').putImageData(src, 0, 0);
			g.drawImage(tmp, 0, 0, w, h);
		}

		document.body.appendChild(out);
		const box = document.createElement('div');
		box.id = 'probe-out';
		box.style.cssText = 'position:fixed;left:-9999px';
		box.textContent = `BANDVIEW amp=${amp} only=${only || '兩張都畫'} vw=${w}x${h}`;
		document.body.appendChild(box);
	}, 1500); // 讓字體交換落定、版面定位，文字帶才是最終形狀
});
