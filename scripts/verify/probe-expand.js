/**
 * 票 04：切換器的行為驗證。三件靜態閘門看不到的事——
 *
 *   1. 按鈕在腳本跑起來之後**才**出現（產物 HTML 裡它帶 `hidden`，那一半由 .mjs 驗）
 *   2. 按一下，就地展開區塊的內容真的出現在**可視文字**裡
 *   3. 再按一下，那段文字真的消失
 *
 * 第 2 點是這一支存在的理由：`details.open = true` 這件事很容易「屬性改了但讀者
 * 看不到」（被某條 CSS 蓋掉、被別的處理器立刻關回去）。`innerText` 只回傳**畫得
 * 出來**的文字，`textContent` 不管有沒有畫，所以拿前者驗看不看得到、後者取素材。
 *
 * `?nowire=1` 把腳本掛上的處理器拆掉，讓探針**證明自己會紅**——與這個資料夾裡
 * 其他探針同一條規矩：不會紅的檢查證明不了任何事。
 */
(() => {
	const send = (r) => navigator.sendBeacon('/report', JSON.stringify(r));
	const nowire = new URLSearchParams(location.search).has('nowire');

	setTimeout(() => {
		try {
			const btn = document.querySelector('[data-expand-all]');
			if (!btn) return send({ ok: false, why: '這一頁沒有切換器' });
			const blocks = [...document.querySelectorAll('.content details')];
			if (!blocks.length) return send({ ok: false, why: '這一頁沒有就地展開區塊' });

			/* 找一句「只有展開之後才看得到」的話：第一塊區塊裡、摘要以外的第一段。
			   取 12 個字就夠獨特，取太長會被換行或空白差異卡到。 */
			const inner = blocks[0].querySelector(':scope > :not(summary)');
			if (!inner) return send({ ok: false, why: '第一塊就地展開區塊裡沒有內容' });
			const needle = inner.textContent.trim().slice(0, 12);

			const sees = () => document.body.innerText.includes(needle);
			if (nowire) btn.onclick = null; // 自我證偽：假裝那支腳本從來沒有把行為掛上去

			const shown = btn.hidden === false;
			const before = { open: blocks.map((d) => d.open), sees: sees() };
			btn.click();
			const after = {
				open: blocks.map((d) => d.open),
				sees: sees(),
				label: btn.textContent.trim(),
				pressed: btn.getAttribute('aria-pressed'),
			};
			btn.click();
			const back = {
				open: blocks.map((d) => d.open),
				sees: sees(),
				label: btn.textContent.trim(),
				pressed: btn.getAttribute('aria-pressed'),
			};
			send({ ok: true, shown, needle, count: blocks.length, before, after, back });
		} catch (e) {
			send({ ok: false, why: `探針自己丟了例外：${e.message}` });
		}
	}, 400);
})();
