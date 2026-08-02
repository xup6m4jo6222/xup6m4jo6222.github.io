/**
 * 把文字帶現在切出來的每一塊列出來（標籤、左右、上下）——票 06 的診斷用。
 * 規則與 Motif.astro 的 contentBoxes() 同源：每個內容區子元素各一塊，
 * main 只有一個子元素時往下一層。
 *
 *   node scripts/verify/dump.mjs <頁面> scripts/verify/probe-box-list.js 1280x720 <埠>
 */
addEventListener('load', () => {
	const main = document.querySelector('main');
	let els = Array.from(main.children);
	while (els.length === 1 && els[0].children.length) els = Array.from(els[0].children);
	const tag = (el) =>
		`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`;
	const lines = [`BOXES main=${JSON.stringify(main.getBoundingClientRect().toJSON())}`];
	for (const el of els) {
		const r = el.getBoundingClientRect();
		lines.push(
			`${tag(el).padEnd(20)} 左${Math.round(r.left)} 右${Math.round(r.right)}` +
				` 上${Math.round(r.top)} 下${Math.round(r.bottom)}` +
				`　寬${Math.round(r.width)} 高${Math.round(r.height)}`,
		);
	}
	const box = document.createElement('div');
	box.id = 'probe-out';
	box.style.cssText = 'position:fixed;left:-9999px';
	box.textContent = lines.join(' ｜ ');
	document.body.appendChild(box);
});
