/**
 * 文字帶——「哪裡算文字」與「邊緣怎麼遞減」的**單一來源**。
 *
 * 為什麼要有這一份（2026-08-04 拍板）：這件事原本每一層背景各寫一份，兩份的數字對不起來
 * （點那層化開 192 px、場那層 40 px 而且垂直方向直接切斷）。第 4 層正在整層重做，
 * 不抽出來就會出現第三份。本人的要求是「不管在什麼背景下，都不應該有硬邊，
 * 而是要比較順暢的那種遞減」——那句話要成立，規則就不能長在某一層裡面。
 *
 * **共用的是規則，不是畫法。** 每一層自己決定怎麼畫（點那層預先烤一張遮罩、
 * 線那層逐段乘係數）與壓多暗（那由煞車一在各層自己的亮度上算），因為那兩件事
 * 各層的成本結構不同。這裡只回答兩個問題：哪裡算文字、邊緣怎麼遞減。
 */

export type Box = { top: number; bottom: number; left: number; right: number };

/**
 * 文字可能出現的區域，**文件座標**（已加上捲動位移）。
 *
 * **內容區的每個子元素各算一塊，不取聯集**（票 06）。聯集只認最外緣：展示卡是全寬的，
 * 聯集矩形就跟著全寬，於是署名右側那塊刻意收窄出來的留白也落在文字帶內、一起被壓暗——
 * 「那塊地留給背景設計」在機制上不會發生，調任何參數都救不了。
 *
 * **`main` 只有一個子元素時它是版面包裝盒不是內容**（首頁的 `section.home`），要往下一層再取。
 * 只把聯集拿掉、不剝這層殼的話量到的還是同一塊全寬矩形，畫面不會變。
 *
 * **頁尾要各算一塊**：它在 `main` 外面、底又是透明的，第一次實測就是一顆點落在
 * 「© 2026」後面，muted 掉到 4.70——只差 0.2 就違規。導覽列不必：它自己有 92% 的底。
 * 頁尾橫跨整頁寬但字只在欄裡，所以取欄寬，否則整條底邊都被壓暗。
 *
 * 已知代價（票 06 明列並接受）：塊與塊之間的間距脫離減光，背景會從縫裡透出來。
 */
export function contentBoxes(main: HTMLElement, colWidth: number): Box[] {
	let els = Array.from(main.children);
	while (els.length === 1 && els[0].children.length) els = Array.from(els[0].children);
	const boxes: Box[] = [];
	for (const el of els) {
		const r = el.getBoundingClientRect();
		if (r.width && r.height)
			boxes.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
	}
	const foot = document.querySelector('footer');
	if (foot) {
		const r = foot.getBoundingClientRect();
		if (r.width && r.height) {
			const half = colWidth / 2;
			const cx = main.getBoundingClientRect().left + half;
			boxes.push({ top: r.top, bottom: r.bottom, left: cx - half, right: cx + half });
		}
	}
	return boxes.map((b) => ({ ...b, top: b.top + scrollY, bottom: b.bottom + scrollY }));
}

/**
 * 邊緣的遞減曲線。`t` 0 是帶外（不減光）、1 是帶內（減滿）。
 *
 * 這是 smootherstep：**值、斜率、曲率三個都連續**。規則只要求前兩個，這裡多給一個是有原因的——
 * 亮度斜坡上會被看成一條線的位置，是二階導數跳掉的地方（側抑制對 ∇² 反應，也就是馬赫帶）。
 * smoothstep（3t²−2t³）在兩端的二階導數是跳的，smootherstep 不是。多出來的代價只有
 * 中段斜率變成直線的 1.875 倍，而中段本來就是最不容易被看出界線的地方。
 *
 * **不要換回直線。** 直線的值是連續的，但兩端各有一個轉折——那正是 2026-08-02
 * 本人說的「一個明確的交界點」剩下的那一半。
 */
export const falloff = (t: number) => {
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	return u * u * u * (u * (u * 6 - 15) + 10);
};

/**
 * 把 `falloff` 攤成 canvas 線性漸層吃得下的節點（節點之間是直線內插）。
 *
 * 節數不是隨便取的：漸層在節點之間是直的，所以節數決定「用幾段直線去逼近那條曲線」。
 * 24 段時每個節點的斜率變化只有最大斜率的一成上下，遠低於判準的六成；
 * 而真正要擋的（直線斜坡的轉折 100%、硬邊無限大）差了一個量級。
 */
export const FEATHER_STEPS = 24;

/** 化開段上的取樣點：`[0..1] 的位置, 該處的減光比例]`。 */
export function featherStops(steps = FEATHER_STEPS): Array<[number, number]> {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		return [t, falloff(t)] as [number, number];
	});
}
