/**
 * 票 06 的驗收證據：署名右側那塊地上，背景到底有多少墨。
 *
 * 這張票要證明的是「那塊留白真的變成背景設計的地」，而那是一個**數字問題**——
 * 改動前後同一塊矩形的合成不透明度差多少。截圖看不出來：線的不透明度與顆粒層的雜訊
 * 同量級，亮度掃描分不出誰是誰（票 04 的實測結論，probe-motif-band.js 也記著同一條）。
 *
 * 四塊矩形，兩張畫布（背景設計與場）各量一次：
 *   名字後面   — `.home-id` 自己的盒子。**必須留在減光之下**，這是煞車一沒鬆動的證據
 *   署名右側   — 名字盒子右緣到卡片右緣、與名字同高的那一條。**這塊要變亮**
 *   縫         — 名字盒底到卡片頂之間那條間距。票 06 已知風險，量出來給本人裁決
 *   卡片後面   — `.home-card` 自己的盒子。同樣**必須留在減光之下**
 *
 * 盒子從版面元素直接量，**不重算文字帶**——文字帶的規則正是這張票要改的東西，
 * 拿它當量測基準的話改前改後量的是兩塊不同的地，數字不可比。
 *
 *   node scripts/verify/dump.mjs index.html scripts/verify/probe-signature-right.js 1280x720 <埠>
 */
addEventListener('load', () => {
	const id = document.querySelector('.home-id');
	const card = document.querySelector('.home-card');
	const out = document.createElement('div');
	out.id = 'probe-out';
	out.style.cssText =
		'position:fixed;top:0;left:0;right:0;z-index:99;background:#000;color:#0f0;font:14px monospace;padding:8px;white-space:pre';
	document.body.appendChild(out);
	if (!id || !card) {
		out.textContent = 'SIGRIGHT 這一頁沒有署名或展示卡';
		return;
	}

	const a = id.getBoundingClientRect();
	const b = card.getBoundingClientRect();
	const regions = {
		名字後面: { x0: a.left, x1: a.right, y0: a.top, y1: a.bottom },
		署名右側: { x0: a.right, x1: b.right, y0: a.top, y1: a.bottom },
		縫: { x0: b.left, x1: b.right, y0: a.bottom, y1: b.top },
		卡片後面: { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom },
	};

	/** 一塊矩形（視窗座標）裡的平均與最大合成不透明度，單位是 0–255。 */
	const measure = (cv, r) => {
		const dpr = cv.width / innerWidth; // 繪製程式的 DPR（有上限，不等於 devicePixelRatio）
		const px0 = Math.max(0, Math.round(r.x0 * dpr));
		const px1 = Math.min(cv.width, Math.round(r.x1 * dpr));
		const py0 = Math.max(0, Math.round(r.y0 * dpr));
		const py1 = Math.min(cv.height, Math.round(r.y1 * dpr));
		if (px1 <= px0 || py1 <= py0) return null;
		const d = cv.getContext('2d').getImageData(px0, py0, px1 - px0, py1 - py0).data;
		let sum = 0;
		let max = 0;
		for (let i = 3; i < d.length; i += 4) {
			sum += d[i];
			if (d[i] > max) max = d[i];
		}
		const n = d.length / 4;
		return { mean: sum / n, max, n };
	};

	const motif = document.querySelector('canvas.motif');
	const field = document.querySelector('canvas.field');
	const M = JSON.parse(motif.dataset.motif);
	const f = (n) => n.toFixed(2);
	const lines = [
		`SIGRIGHT vw=${innerWidth}x${innerHeight} 名字盒=${Math.round(a.left)}–${Math.round(a.right)}` +
			` 卡片盒=${Math.round(b.left)}–${Math.round(b.right)} 縫高=${Math.round(b.top - a.bottom)}px` +
			`　煞車一上限=${f(M.textBandMaxAlpha * 255)}/255`,
	];
	for (const [name, r] of Object.entries(regions)) {
		const cells = [];
		for (const [tag, cv] of [
			['背景設計', motif],
			['場', field],
		]) {
			const s = cv && measure(cv, r);
			cells.push(s ? `${tag} 平均${f(s.mean)} 最大${s.max}` : `${tag} 量不到`);
		}
		lines.push(`${name.padEnd(6, '　')} ${cells.join('　│　')}`);
	}
	out.textContent = lines.join('\n');
});
