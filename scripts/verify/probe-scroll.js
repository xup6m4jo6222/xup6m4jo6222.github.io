addEventListener('load', () => {
	const cv = document.querySelector('canvas.motif');
	const ctx = cv.getContext('2d');
	const rows = () => { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; const r = new Float64Array(cv.height);
		for (let y = 0; y < cv.height; y++) { let s = 0; for (let x = 0; x < cv.width; x++) s += d[(y * cv.width + x) * 4 + 3]; r[y] = s; }
		return r; };
	const SHIFT = 400;
	const scale = cv.width / innerWidth;
	const before = rows();
	scrollTo(0, SHIFT);
	setTimeout(() => {
		const after = rows();
		const off = Math.round(SHIFT * scale);
		let follow = 0, pinned = 0, total = 0;
		for (let y = 0; y + off < before.length; y++) {
			follow += Math.abs(after[y] - before[y + off]);
			pinned += Math.abs(after[y] - before[y]);
			total += before[y + off];
		}
		scrollTo(0, 0);
		const box = document.createElement('div');
		box.style.cssText = 'position:fixed;top:0;left:0;z-index:99;background:#000;color:#0f0;font:16px monospace;padding:8px';
		box.textContent = `捲 ${SHIFT}px 後：跟著捲的誤差 ${(follow / total).toFixed(3)}／釘在視窗的誤差 ${(pinned / total).toFixed(3)}`;
		document.body.appendChild(box);
	}, 800);
});
