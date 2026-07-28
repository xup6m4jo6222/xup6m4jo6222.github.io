addEventListener('load', () => {
	const cv = document.querySelector('canvas.motif');
	const ctx = cv.getContext('2d');
	const main = document.querySelector('main');
	const sig = () => { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let s = 0;
		for (let i = 3; i < d.length; i += 4) s += d[i] * (i % 7919); return s; };
	let prev = sig();
	const log = [];
	let n = 0;
	const tick = setInterval(() => {
		n++;
		const s = sig();
		if (s !== prev) log.push(`${n * 100}ms cv=${cv.width}x${cv.height} col=${Math.round(main.getBoundingClientRect().width)} doc=${document.documentElement.scrollHeight}`);
		prev = s;
		if (n >= 20) {
			clearInterval(tick);
			const box = document.createElement('div');
			box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99;background:#000;color:#0f0;font:15px monospace;padding:8px;white-space:pre';
			box.textContent = `mode=${cv.dataset.motifMode} 2s 內畫面變了 ${log.length} 次\n` + log.slice(0, 4).join('\n');
			document.body.appendChild(box);
		}
	}, 100);
});
