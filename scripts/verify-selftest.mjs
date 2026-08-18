#!/usr/bin/env node
/**
 * 閘門自己的檢查：把兩種缺陷注入產物副本，確認 verify:palette 真的會紅。
 * 一個永遠通過的檢查跟沒有檢查一樣——這支腳本是那句話的執行版。
 *
 * 對應票 01 的驗收條款「故意塞一個假色碼、以及故意加一個沒有覆蓋的位移動畫，
 * 兩者都可驗證它會紅」。
 */
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as CFG from './palette-config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERIFIER = join(ROOT, 'scripts', 'verify-palette.mjs');

/**
 * 跑一次閘門。
 *
 * **一定要給逾時**：沒有逾時的話，閘門若在某個案例上卡死，這支就永遠不會回來——
 * CI 上表現為那個步驟一直轉，而日誌要等整步結束才拿得到，等於什麼線索都沒有。
 * 2026-07-28 就踩到：同一步驟在 v8 只花 24 秒，第 9 版推上去之後跑了 26 分鐘還沒完，
 * 只能把整輪取消掉。**會紅的閘門好過會卡住的閘門。**
 *
 * maxBuffer 也要放大：預設 1MB，閘門輸出一多就被截斷並設成錯誤，看起來像閘門失敗。
 */
const CASE_TIMEOUT_MS = 120_000;
function run(dist, env = {}) {
	const r = spawnSync(process.execPath, [VERIFIER], {
		env: { ...process.env, VERIFY_DIST: dist, ...env },
		encoding: 'utf8',
		timeout: CASE_TIMEOUT_MS,
		maxBuffer: 32 * 1024 * 1024,
	});
	if (r.error && r.error.code === 'ETIMEDOUT')
		return { code: null, out: `閘門逾時：超過 ${CASE_TIMEOUT_MS / 1000} 秒沒有結束`, timedOut: true };
	return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function withCopy(mutate, env) {
	const dir = mkdtempSync(join(tmpdir(), 'verify-selftest-'));
	try {
		cpSync(join(ROOT, 'dist'), dir, { recursive: true });
		const cssDir = join(dir, '_astro');
		const cssFile = join(cssDir, readdirSync(cssDir).find((f) => f.endsWith('.css')));
		// 票 01 起有注入到 JS 與 HTML 的案例，所以第二個參數把整個產物目錄交出去
		mutate(cssFile, dir);
		return run(dir, env);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * 案例的 `entries` 欄位（元素主色份量票 03）：注入**允許清單的條目**，不只是產物。
 * 「條目宣稱襯線但產物沒宣告字體」這種缺陷本質上在判準檔那一側，光改 CSS 造不出來。
 *
 * 為什麼走環境變數而不是改判準檔再還原（`probe.mjs` 那種做法）：判準檔是正本，
 * 中途中斷就留下一個被污染的正本，代價與收穫不成比例。
 *
 * **這個鉤子只可能讓閘門更紅。**注入的條目只進辨識通道檢查的輸入，不進 `claimedSelectors`
 * 也不進 `fgOn`——所以它放行不了任何一個主色文字，最壞情況是讓建置失敗。這一點與
 * `VERIFY_DIST` 不同（那個換掉的是被讀的產物），拿它當繞路工具是沒有意義的。
 *
 * 連帶的誠實邊界：`fgOn` 是判準檔載入時就用 `.map()` 算完的，所以注入的條目**不會**出現
 * 在認領清單裡。真實情況下有人加一條會同時進兩邊；這裡刻意只進一邊，好讓案例紅的原因
 * **只有一個**——否則會先被「判準說 sel 的文字色是 fg，產物找不到這條規則」那道斷言咬掉，
 * 就測不到通道檢查本身了。
 */
const channelEnv = (entries) => (entries ? { VERIFY_CHANNEL_EXTRA: JSON.stringify(entries) } : undefined);

/** 在首頁塞一個帶 data-motif 的 canvas——背景設計上線後產物就長這樣。 */
const injectMotif = (dir, params) =>
	writeFileSync(
		join(dir, 'index.html'),
		readFileSync(join(dir, 'index.html'), 'utf8').replace(
			'</body>',
			`<canvas aria-hidden="true" data-motif='${JSON.stringify(params)}'></canvas></body>`,
		),
	);

/** 在首頁塞一個帶 data-field-craft 的 canvas（票 05 抗辯後補：技法也要驗）。 */
const injectCraft = (dir, craft) =>
	writeFileSync(
		join(dir, 'index.html'),
		readFileSync(join(dir, 'index.html'), 'utf8').replace(
			'</body>',
			`<canvas aria-hidden="true" data-field-craft='${JSON.stringify(craft)}'></canvas></body>`,
		),
	);

/** 在首頁塞一個帶 data-field 的 canvas——場上線後產物就長這樣（票 03）。 */
const injectField = (dir, params) =>
	writeFileSync(
		join(dir, 'index.html'),
		readFileSync(join(dir, 'index.html'), 'utf8').replace(
			'</body>',
			`<canvas aria-hidden="true" data-field='${JSON.stringify(params)}'></canvas></body>`,
		),
	);

/**
 * 把產物裡所有 `data-motif` 或 `data-field` 屬性拿掉
 * （模擬 canvas 改由 JS 建立、參數沒有進 HTML）。
 */
const stripAttrs = (dir, name) => {
	const re = new RegExp(`\\s${name}(-[\\w-]+)?=("[^"]*"|'[^']*')`, 'g');
	const walk = (d) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (p.endsWith('.html')) {
				const before = readFileSync(p, 'utf8');
				const after = before.replace(re, '');
				if (after !== before) writeFileSync(p, after);
			}
		}
	};
	walk(dir);
};
const stripMotifAttrs = (dir) => stripAttrs(dir, 'data-motif');

/** 改 `/process/` 裡任一頁的產物——用來證明凍結存檔真的被豁免掉。 */
const editProcessPage = (dir, mutate) => {
	const p = join(dir, 'process', 'talks-buttons.html');
	writeFileSync(p, mutate(readFileSync(p, 'utf8')));
};

/** 改 AI 實作內頁的產物。找檔案而不是寫死路徑——日後多一頁，這裡不必跟著改。

    **那一類一頁都沒有的時候要回報，不能丟例外、也不能靜靜跳過。**2026-08-04 那一頁
    改副檔名成 `.md.draft` 下架之後，`readdirSync` 直接撞上 ENOENT，整支自我檢查死在
    那裡——而它報出來的樣子是一個 Node 堆疊，看起來像自我檢查本身壞了。判準跟著頁面
    在不在走，與 field-runtime 那條比對器回歸同一個道理。 */
const editAiPage = (dir, mutate) => {
	const base = join(dir, 'projects', 'ai');
	const slug = existsSync(base)
		? readdirSync(base, { withFileTypes: true }).find((e) => e.isDirectory())
		: null;
	if (!slug) return false;
	const p = join(base, slug.name, 'index.html');
	writeFileSync(p, mutate(readFileSync(p, 'utf8')));
	return true;
};

/** 改任意一個專案閱讀頁的產物。與 `editAiPage` 分開寫，是因為有些注入要的是
    「有聚焦組的那種頁」，有些只要「任何一頁」——後者用這一支。

    **不寫死是哪一頁。** 原本寫死 `projects/stats/prepay-and-spending`，2026-08-12
    那篇下架之後這裡撞上 ENOENT，整支自我檢查死在一個 Node 堆疊上——跟 2026-08-04
    `editAiPage` 踩的是同一個坑，當時只修了 AI 那一支。改成掃出第一個找得到的閱讀頁，
    兩類都空的時候回 `false` 讓呼叫端跳過並回報，不丟例外也不靜靜當成過了。 */
const findProjectPage = (dir) => {
	const base = join(dir, 'projects');
	if (!existsSync(base)) return null;
	for (const cat of readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())) {
		const slug = readdirSync(join(base, cat.name), { withFileTypes: true }).find((e) =>
			e.isDirectory(),
		);
		if (slug) return join(base, cat.name, slug.name, 'index.html');
	}
	return null;
};

const editAnyProjectPage = (dir, mutate) => {
	const p = findProjectPage(dir);
	if (!p) return false;
	writeFileSync(p, mutate(readFileSync(p, 'utf8')));
	return true;
};

const cases = [
	{
		name: '未經注入的產物副本應該綠',
		expectPass: true,
		mutate: () => {},
		expect: null,
	},
	{
		name: '偷加一個不在白名單上的色碼',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-color{color:#c97a48}\n`),
		expect: /#c97a48/,
	},
	{
		name: '加一個沒有補降低動態偏好覆蓋的位移動畫',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-motion{transition:transform .3s ease}\n`),
		expect: /reduced-motion[\s\S]*\.fake-motion/,
	},
	{
		name: '加一個經由 @keyframes 位移、沒有覆蓋的動畫',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(
				f,
				`${readFileSync(f, 'utf8')}\n@keyframes fake-slide{from{transform:translateX(20px)}to{transform:none}}\n.fake-kf{animation:fake-slide .3s}\n`,
			),
		expect: /reduced-motion[\s\S]*\.fake-kf/,
	},
	{
		// 聚焦組票 01：糊化把非焦點文字的對比壓到 1.66，調數值救不回來（要 0.60 才達標，
		// 那已經幾乎不糊了）。所以糊化的規則必須配一個增加對比的逃生口，少了就紅。
		name: '加一個沒有補增加對比逃生口的糊化',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-blur{filter:blur(2px)}\n`),
		expect: /contrast-escape[\s\S]*\.fake-blur/,
	},
	{
		// 對比度那一類原本只驗「判準宣告的配對」，驗不到「產物實際把哪個顏色當文字用」。
		// 這一條就是那個漏洞的迴歸測試：把某條規則的文字色換成沒人管的階，必須紅。
		name: '把某條規則的文字色換成沒有配對在管的階',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-text{color:var(--n-300)}\n`),
		expect: /未認領的文字色 #5d505a/,
	},
	{
		// 只驗過非文字 3.0 的顏色（外框用的 n-500），不得因此被登記成合法的文字色。
		name: '拿只驗過 3.0 的外框色當文字用',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-body{color:var(--n-500)}\n`),
		expect: /未認領的文字色 #8a7f87/,
	},
	{
		// 「深字反白」那組把頁底色驗過了，但那個顏色只有疊在元素主色上才合法。
		// 早期版本讓它變成無條件認領，於是任何地方寫 color: var(--color-bg) 都能過——
		// 那是 1.00 的隱形字。
		name: '在別處拿頁底色當文字（隱形字）',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-invisible{color:var(--color-bg)}\n`),
		expect: /未認領的文字色 #20131d/,
	},
	{
		// 配對兩端要釘到真的選擇器，否則只是願望清單。
		name: '把卡片摘要的字色改回 muted（在 n-200 卡底上只有 3.79）',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, readFileSync(f, 'utf8').replace(/(\.card p\{[^}]*?)var\(--n-700\)/, '$1var(--color-text-muted)')),
		expect: /\.card p 的文字色/,
	},
	{
		name: '把決策開關的底換成列表卡的底（AI 側 muted 掉到 3.79）',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, readFileSync(f, 'utf8').replace(/(\.cs-track\{[^}]*?)var\(--color-bg-alt\)/, '$1var(--color-bg-card)')),
		expect: /\.cs-track 的底色/,
	},
	{
		name: '把 :root 的 muted 調暗到過不了 4.5',
		expectPass: false,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace('--color-text-muted:var(--n-600)', '--color-text-muted:var(--n-400)')),
		expect: /contrast[\s\S]*muted/,
	},

	// ── 票 01 新增的三種繞路（都是實際查出來的洞，不是想像的）──────────────
	{
		// 檢查 1 原本只掃 CSS 與 inline style。背景設計的色碼寫在腳本裡，那是一條白名單看不見的路。
		name: '把白名單外的色碼藏在腳本裡',
		expectPass: false,
		mutate: (_f, dir) =>
			writeFileSync(join(dir, '_astro', 'fake-motif.js'), "const ACCENT='#c97a48';export default ACCENT;\n"),
		expect: /fake-motif\.js/,
	},
	{
		// 檢查 6 看的是 CSS 的動態宣告。JS 驅動的逐幀動態沒有 CSS animation 可以被它掃到。
		name: '加一個沒有降低動態偏好分支的常駐逐幀動態',
		expectPass: false,
		mutate: (_f, dir) =>
			writeFileSync(
				join(dir, '_astro', 'fake-loop.js'),
				'function loop(now){draw(now);requestAnimationFrame(loop);}requestAnimationFrame(loop);\n',
			),
		expect: /fake-loop\.js[\s\S]*loop/,
	},
	{
		// **產物是壓縮過的。**手寫的 `function loop(){}` 抓得到不代表 Vite 吐出來的
		// `let a=0,loop=n=>{…}` 也抓得到——第一版實測就是漏這一種。
		name: '常駐迴圈寫成壓縮後的逗號串宣告，一樣要抓到',
		expectPass: false,
		mutate: (_f, dir) =>
			writeFileSync(
				join(dir, '_astro', 'fake-min.js'),
				'let t=0,l=n=>{t=n;requestAnimationFrame(l)};requestAnimationFrame(l);\n',
			),
		expect: /fake-min\.js/,
	},
	{
		// 第七類的 fail-open 防線：背景設計在跑（有常駐迴圈）就必須找得到它的參數。
		// 沒有這一條，把 canvas 改成由 JS 建立，整個第七類會靜靜地不作用。
		//
		// **票 02 起要先把真的屬性拿掉**：背景設計已經上線，產物本來就有 data-motif，
		// 只塞一個假迴圈證明不了任何事（實測會綠）。這一條模擬的就是「canvas 改成
		// 由 JS 建立」——迴圈照跑，但伺服器端沒有渲染出參數。
		name: '背景設計在跑卻沒有把參數渲染進 HTML',
		expectPass: false,
		mutate: (_f, dir) => {
			stripMotifAttrs(dir);
			writeFileSync(
				join(dir, '_astro', 'fake-motif-loop.js'),
				"const still=matchMedia('(prefers-reduced-motion: reduce)');function loop(n){draw(n);requestAnimationFrame(loop);}if(!still.matches)requestAnimationFrame(loop);\n",
			);
		},
		expect: /找不到任何 data-motif/,
	},

	// ── 票 03：聚焦組標記的孤兒檢查 ────────────────────────────────────────
	{
		// 真正會發生的退步：日後在 AI 頁加一張時間軸卡、忘了帶標記屬性。
		// 那張卡會永遠停在 opacity 0.18（實測對比 1.66），而且**安靜**——
		// 頁面看起來是有效果的，只有那一張永遠不亮。
		name: 'AI 頁有一張時間軸卡忘了標記',
		expectPass: false,
		needsAiPage: true,
		mutate: (_f, dir) => editAiPage(dir, (h) => h.replace(' data-focus-group', '')),
		expect: /focus-orphan[\s\S]*tl-item/,
	},
	{
		// 上一條認的是 tl-item，所以「新增一個不是時間軸形狀的 AI 頁」會從它底下空過。
		// 這一條把卡片的 class 一起拿掉，模擬那種頁：沒有 tl-item、也沒有任何一組。
		name: 'AI 頁整頁一組都沒有（不是時間軸形狀）',
		expectPass: false,
		needsAiPage: true,
		mutate: (_f, dir) =>
			editAiPage(dir, (h) => h.replace(/ data-focus-group/g, '').replace(/\btl-item\b/g, 'tl-plain')),
		expect: /focus-orphan[\s\S]*聚焦組/,
	},

	// ── 元素主色票 01：主色當文字色不再無條件放行 ──────────────────────────
	{
		// 元素主色那組配對的背景是頁面表面，早期版本因此把它**無條件**登記為合法文字色，
		// 於是主色對任何選擇器都成了通行證：這條純虛構的規則實測八類全過、退出碼 0。
		// 補洞後配對只認領 fgOn 上的選擇器，清單外的主色文字就會被第二類抓住。
		name: '拿元素主色當文字色，但選擇器不在允許清單上',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.rogue-not-in-any-whitelist{color:#7998c3}\n`),
		expect: /未認領的文字色 #7998c3[\s\S]*rogue-not-in-any-whitelist/,
	},
	{
		// 上一條擋得住單獨一條規則，擋不住**搭便車**：認領原本是整條規則放行，
		// 所以 `.rogue,a{…}` 會被同群組的 `a` 順帶帶過（實測退出碼 0）。
		// 允許清單是主色唯一的守門人，這個形狀不擋等於清單有一道側門。
		name: '主色文字搭清單上的選擇器便車（同一條規則裡分組）',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.rogue-piggyback,a{color:#7998c3}\n`),
		expect: /未認領的文字色 #7998c3[\s\S]*rogue-piggyback/,
	},

	{
		name: '把背景設計參數改成檔位以外的值',
		expectPass: false,
		mutate: (_f, dir) => injectMotif(dir, { ...CFG.MOTIF, fpsCap: 60 }),
		expect: /fpsCap[\s\S]*背景設計參數漂離檔位/,
	},
	{
		// 沒有這一條的話，第七類只要「有 data-motif 就紅」也會通過上一條——
		// 那是一個永遠紅的檢查，跟永遠綠一樣沒用。
		name: '背景設計參數照判準檔寫應該綠',
		expectPass: true,
		mutate: (_f, dir) => injectMotif(dir, CFG.MOTIF),
		expect: null,
	},

	/* ── 紅線④（循環動態的峰值速度）─────────────────────────────────────
	   2026-08-05 本人拍板新增。這條線只在紅線③（30）與餘光運動捕捉門檻（94）之間
	   有意義，所以三個案例夾的是**那兩端**，不是那個值本身。
	   值從環境變數注入，作法沿用 `VERIFY_CHANNEL_EXTRA` 那個既有的鉤子——判準檔是正本，
	   中途中斷會留下一個被污染的正本，代價與收穫不成比例。 */
	{
		// 越過餘光門檻＝它不再擋任何東西。這是「保住當下的量」最容易滑過頭的方向。
		name: '把循環動態的紅線調到餘光門檻之上',
		expectPass: false,
		env: { VERIFY_CYCLIC_PEAK: '120' },
		mutate: () => {},
		expect: /紅線④[\s\S]*餘光運動捕捉門檻/,
	},
	{
		// 掉回紅線③ 以下＝多這一條沒有意義，那就該直接用紅線③。
		name: '把循環動態的紅線調到常駐動態的紅線以下',
		expectPass: false,
		env: { VERIFY_CYCLIC_PEAK: '25' },
		mutate: () => {},
		expect: /紅線④[\s\S]*沒有另立一條的意義/,
	},
	{
		// 防「永遠紅的檢查」：出貨值必須綠。
		name: '循環動態的紅線照判準檔寫應該綠',
		expectPass: true,
		env: { VERIFY_CYCLIC_PEAK: String(CFG.CYCLIC_MOTION_PEAK_SPEED) },
		mutate: () => {},
		expect: null,
	},

	// ── 第 4 層（小點各自飄）：第九類 ────────────────────────────────────
	// 2026-08-05 整組換過：淘汰語彙退場（短劃／殘影／輪次／分桶那一批案例連同它們守的
	// 條款一起刪掉），現在守的是「顏色是兩層唯一還分得開的通道」與幾個退化值。
	{
		// 與第七類同型：值飄出檔位就紅。`#c97a48` 那次事故的機制是「精確數值在對話裡
		// 被摘要成模糊描述」，這一條是它在第 4 層的迴歸測試。
		name: '把第 4 層的參數改成檔位以外的值',
		expectPass: false,
		mutate: (_f, dir) => injectField(dir, { ...CFG.FIELD, density: 1.2 }),
		expect: /density[\s\S]*場的參數漂離檔位/,
	},
	{
		// fail-open 防線：場在跑（有常駐迴圈）就必須找得到它的參數。
		name: '場在跑卻沒有把參數渲染進 HTML',
		expectPass: false,
		mutate: (_f, dir) => stripAttrs(dir, 'data-field'),
		expect: /找不到任何 data-field/,
	},
	{
		// 防「永遠紅的檢查」。
		name: '第 4 層的參數照判準檔寫應該綠',
		expectPass: true,
		mutate: (_f, dir) => injectField(dir, CFG.FIELD),
		expect: null,
	},
	{
		name: '把第 4 層的技法常數改成判準檔以外的值',
		expectPass: false,
		mutate: (_f, dir) => injectCraft(dir, { ...CFG.FIELD_CRAFT, markCap: 999 }),
		expect: /markCap[\s\S]*場的技法參數漂離檔位/,
	},
	{
		name: '第 4 層的技法照判準檔寫應該綠',
		expectPass: true,
		mutate: (_f, dir) => injectCraft(dir, CFG.FIELD_CRAFT),
		expect: null,
	},
	{
		/* 契約的 fail-open 防線是**存在性**不是**全稱性**：只要任一頁有屬性就不進那個分支。
		   第二輪抗辯實測：只拿掉 `projects/index.html` 的兩個屬性（那一頁的場等於整個
		   不畫），閘門照樣印「✓ 十三類檢查全部通過」。 */
		name: '只有一頁漏掉場的屬性（其餘頁都在）',
		expectPass: false,
		mutate: (_f, dir) => {
			const p = join(dir, 'projects', 'index.html');
			writeFileSync(
				p,
				readFileSync(p, 'utf8').replace(/\sdata-field(-craft)?=("[^"]*"|'[^']*')/g, ''),
			);
		},
		expect: /缺 data-field/,
	},
	{
		/* **兩層都是點之後，顏色是它們唯一還分得開的通道。** 這個突變是實測會發生的
		   那一種——原型六檔記號裡有三檔是主色版，而「把顏色加回去」看起來永遠像一個
		   無害又好看的改動。 */
		name: '把第 4 層的點改成元素主色',
		expectPass: false,
		mutate: (_f, dir) => injectField(dir, { ...CFG.FIELD, mark: '#7998c3' }),
		expect: /mark（顏色通道）[\s\S]*唯一還分得開的通道/,
	},
	{
		// 飄動頻率是紅線③ 上界的來源：0 會讓整面凍住，而畫面看起來像一張靜態圖、
		// 其餘每一條照樣綠。
		name: '把第 4 層的飄動頻率設成 0（整面凍住）',
		expectPass: false,
		mutate: (_f, dir) => injectCraft(dir, { ...CFG.FIELD_CRAFT, driftFreq: [0, 0.032] }),
		expect: /driftFreq（退化值）[\s\S]*整面凍住/,
	},
	{
		// 強度 0 等於這一層整個不存在，而屬性、覆蓋、其餘每一條都照樣綠。
		name: '把第 4 層的強度設成 0（等於這一層不存在）',
		expectPass: false,
		mutate: (_f, dir) => injectField(dir, { ...CFG.FIELD, ink: 0 }),
		expect: /ink（退化值）[\s\S]*等於這一層整個不存在/,
	},

	// ── 第十類（陰影允許清單，2026-08-11 由「零個」改制）───────────────
	{
		// 「深度用顏色表達，不用光影」。色碼刻意用階上的顏色，這樣紅的只會是陰影那一類。
		name: '偷加一個 box-shadow',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-shadow{box-shadow:0 2px 8px #20131d}\n`),
		expect: /shadow[\s\S]*fake-shadow/,
	},
	{
		// **改制之後才存在的邊界一**：inset 不是免死金牌。清單管的是「哪個選擇器」，
		// 不是「哪種陰影」——否則只要寫 inset 就能到處長，允許清單等於沒有。
		name: '在清單外的選擇器加 inset 陰影',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-inset{box-shadow:inset 0 2px 6px #20131d}\n`),
		expect: /shadow[\s\S]*fake-inset/,
	},
	{
		// **改制之後才存在的邊界二**：清單上的落點也只能用 inset。外投陰影是在模擬
		// 光源與物理空間，那正是 #200 排除的東西——這條守住了，推翻 #200 才是
		// 「開一個窄口」而不是「把門拆了」。
		name: '在清單上的落點改成外投陰影',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.home-send:active{box-shadow:0 2px 8px #20131d}\n`),
		expect: /shadow[\s\S]*只允許 inset/,
	},
	{
		// `filter: drop-shadow()` 是同一件事換一個屬性講。只認 box-shadow／text-shadow
		// 的話，這條路是敞開的。
		name: '偷加一個 filter: drop-shadow',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-drop{filter:drop-shadow(0 2px 8px #20131d)}\n`),
		expect: /shadow[\s\S]*fake-drop/,
	},
	{
		// **豁免要被證明過**。`/process/` 本來就有兩個陰影（talks-buttons 的 inset 與
		// 一條 transition），閘門今天是綠的；再往那裡加一個也必須照樣綠，
		// 否則「凍結存檔除外」只是寫在註解裡的願望。
		name: '在 /process/ 加陰影不會誤報',
		expectPass: true,
		mutate: (_f, dir) =>
			editProcessPage(dir, (h) => h.replace('</head>', '<style>.demo-x{box-shadow:0 2px 8px #0009}</style></head>')),
		expect: null,
	},

	// ── 背景場票 03：第十一類（z 層級白名單）───────────────────────────
	{
		// 白名單三個位置：−1 背景層、10 導覽列、20 導覽進度條。任何新元件都能在自己的
		// `<style>` 裡加第四個——那正是第 9 版原型加出 0／1／5 的路徑。
		name: '偷加一個白名單外的 z-index',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.fake-z{position:fixed;z-index:5}\n`),
		expect: /zindex[\s\S]*fake-z/,
	},
	{
		// 元件自己的 `<style>` 會被編進獨立的 CSS 或內聯進 HTML，掃不到 HTML 內聯
		// `<style>` 的話這條路是敞開的（`Motif.astro` 的 z-index 就是這樣來的）。
		name: 'z-index 藏在 HTML 內聯的 style 區塊裡',
		expectPass: false,
		mutate: (_f, dir) =>
			writeFileSync(
				join(dir, 'index.html'),
				readFileSync(join(dir, 'index.html'), 'utf8').replace(
					'</head>',
					'<style>.fake-z-inline{position:fixed;z-index:999}</style></head>',
				),
			),
		expect: /zindex[\s\S]*fake-z-inline/,
	},

	// ── 元素主色份量票 03：第十二類（辨識通道）──────────────────────────
	{
		// 判準：「主色可以當文字色，但只在那個字的認得出來不靠顏色的時候。」
		// 清單上的 `a` 宣稱的通道是底線，而底線宣告在 `.content a` 上——把那條規則清空，
		// 等於清單還在說「有底線」，產物卻已經沒有了。**這是清單與現實脫節的真實形狀**：
		// 沒有人會蓄意刪它，但重構 `.content` 那一段時很容易順手帶走。
		name: '清單條目宣稱的通道在產物裡消失了（底線被拿掉）',
		expectPass: false,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace(/\.content a\{[^}]*\}/, '.content a{}')),
		expect: /channel[\s\S]*底線[\s\S]*\.content a/,
	},
	{
		// 票要求的第二例：條目宣稱襯線，產物裡那個選擇器根本沒宣告字體。
		// `.fake-serif-label` 不存在於產物，所以「找不到宣告」與「沒宣告」在這裡是同一件事。
		name: '條目宣稱襯線，產物裡那個選擇器沒宣告字體',
		expectPass: false,
		mutate: () => {},
		entries: [
			{ sel: '.fake-serif-label:hover', channel: 'serif', on: '.fake-serif-label', why: '自我檢查用的假條目' },
		],
		expect: /channel[\s\S]*fake-serif-label:hover[\s\S]*襯線/,
	},
	{
		// 票要求的第三例：宣稱「狀態改變」，但那是一條靜止態選擇器。
		// 擋的是「把 state 當成萬用免死金牌」——它只對 hover／focus／active 這種
		// 真的會變的選擇器成立，靜止態的字沒有「變了」這回事可以當辨識。
		name: '條目宣稱狀態改變，但那是一條靜止態選擇器',
		expectPass: false,
		mutate: () => {},
		entries: [{ sel: '.fake-static-label', channel: 'state', on: '.fake-static-label', why: '自我檢查用的假條目' }],
		expect: /channel[\s\S]*fake-static-label[\s\S]*靜止態/,
	},
	{
		// 與背景設計那一條同型：沒有這一條的話，「只要有 VERIFY_CHANNEL_EXTRA 就紅」也會通過
		// 上面三條——那是一個永遠紅的檢查，跟永遠綠一樣沒用。這一條的假條目樣樣齊備：
		// 通道是襯線、指向產物裡真的宣告了 `font-family` 的 `.site-nav .nav-brand`。
		name: '假條目的通道在產物裡真的成立時應該綠',
		expectPass: true,
		mutate: () => {},
		entries: [
			{
				sel: '.site-nav .nav-brand:hover',
				channel: 'serif',
				on: '.site-nav .nav-brand',
				why: '自我檢查用：這條的字體是真的宣告了的',
			},
		],
		expect: null,
	},
	{
		// **只比對「有沒有宣告這個屬性」會放行這一條**：`.st-table a` 的產物是
		// `text-decoration:none`，那是明講不要底線。現有七條沒有一條走到這個分支，
		// 沒有這個案例的話，那段程式碼等於從來沒被驗證過。
		name: '宣稱底線，但那個選擇器寫的是 text-decoration: none',
		expectPass: false,
		mutate: () => {},
		entries: [{ sel: '.st-table a:hover', channel: 'underline', on: '.st-table a', why: '自我檢查用的假條目' }],
		expect: /channel[\s\S]*st-table a:hover[\s\S]*明講不要底線/,
	},
	{
		// 判準寫的是**字重 ≥500**，不是「有宣告 font-weight」。`.home-tagline` 產物是 400——
		// 門檻若沒真的比大小，這一類對字重就是一個永遠通過的檢查。
		name: '宣稱字重，但那個選擇器的字重不到 500',
		expectPass: false,
		mutate: () => {},
		entries: [{ sel: '.home-tagline:hover', channel: 'weight', on: '.home-tagline', why: '自我檢查用的假條目' }],
		expect: /channel[\s\S]*home-tagline:hover[\s\S]*不到 500/,
	},

	// ── 署名標籤票 03：第二個強調色 ──────────────────────────────────────
	{
		// 新增一個強調色最容易犯的錯是**讓它變成一張到處通行的通行證**——主色在補洞之前
		// 正是那樣（純虛構的 `.rogue{color:#7998c3}` 實測八類全過、退出碼 0）。
		// 問句那組配對帶 `fgOn`，所以清單外拿新色當文字色必須紅。這一條是那件事的迴歸測試。
		name: '拿問句的強調色當文字色，但選擇器不在允許清單上',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.rogue-ask{color:#c8b7ea}\n`),
		expect: /未認領的文字色 #c8b7ea[\s\S]*rogue-ask/,
	},
	{
		// `size`（字級）這條通道**票 03 之前沒有任何條目在用**，所以第十二類處理它的那段
		// 程式碼從來沒被驗證過。問句那一條的辨識全靠它：字級一旦不再宣告在問句自己身上，
		// 清單說的理由就與產物脫節，而那正是「顏色扛了辨識」的開始。
		name: '條目宣稱字級，產物裡那個選擇器沒宣告字級',
		expectPass: false,
		mutate: () => {},
		entries: [{ sel: '.fake-ask', channel: 'size', on: '.fake-ask', why: '自我檢查用的假條目' }],
		expect: /channel[\s\S]*fake-ask[\s\S]*字級/,
	},

	// ── 元素主色份量票 05：「面」的三個表面 ──────────────────────────────
	{
		// **面與字同色會互相抵銷**：7% 主色淡底上，主色字九態最壞只有 4.33（票 05 實測），過不了 4.5。
		// 這是這一輪最晚才發現的一件事（實作前算對比才撞出來），也最容易重犯——
		// 「它是標籤，標籤拿主色」這個順手推理會直接把人帶到這裡。
		// 期待的訊息刻意指定成**那組配對自己的斷言**：`.st-table thead th` 本來就不在允許
		// 清單上，所以第二類也會紅，但那條擋的是「誰可以用主色」，不是「面上不能有主色」。
		name: '把主色的字放到鋪了主色淡底的面上',
		expectPass: false,
		mutate: (f) => writeFileSync(f, `${readFileSync(f, 'utf8')}\n.st-table thead th{color:#7998c3}\n`),
		expect: /統計表頭[\s\S]*判準說 \.st-table thead th 的文字色是 #ebe5eb/,
	},
	{
		// 淡底是半透明的，宣告值與渲染值不是同一個東西，所以那道守衛比的是**宣告了哪個色**。
		// 這一條證明它含 alpha：把 7%（`#7998c312`）換成 33%（`--color-accent-fade`），
		// 不透明的部分完全一樣、只有 alpha 變了，必須照樣紅。
		name: '把面的淡底從 7% 換成 33%（只有 alpha 變）',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(f, `${readFileSync(f, 'utf8')}\n.cs-track .cs-side--me{background:var(--color-accent-fade)}\n`),
		expect: /比對器本人側[\s\S]*宣告的底是 #7998c312[\s\S]*產物是 #7998c355/,
	},
	{
		// 列聯表內容側的淡底是**漸層**（2026-07-29 本人要「渲染的感覺，不是直接一塊」），
		// 所以宣告值是一串色停。**只檢查「有沒有出現過那個色」會放行這一條**：峰值偷偷
		// 加濃成 33%，7% 那一停還在，字面上看起來沒問題——而峰值正是對比模型假設的最壞
		// 情況，這一列的餘裕又是全站最小的（4.56）。
		name: '漸層淡底偷偷多一個更濃的色停',
		expectPass: false,
		mutate: (f) =>
			writeFileSync(
				f,
				`${readFileSync(f, 'utf8')}\n.dmr td{background:linear-gradient(to right,#7998c355,#7998c312,transparent)}\n`,
			),
		expect: /列聯表內容側[\s\S]*不該出現的色停：#7998c355/,
	},

	// ── 背景敘事票 01：顆粒的濃度 ────────────────────────────────────────
	{
		/* **這一條同時證明兩件事**（訊息各出一條，所以兩段程式碼都真的跑到了）：
		   ①產物的濃度與判準檔分家會紅——分家本身安靜得可怕，畫面上跑一個濃度、
		   對比模型算另一個濃度，整支腳本量到的數字會變成虛構而沒有任何東西報錯；
		   ②`0.17` 低於下限 `0.34` 會紅——那正是這個站出貨了很久的值，
		   顆粒的起伏比它所在那塊背景自己的起伏還小（比值 0.91），等於被淹沒。

		   只改濃度那一個數字、不動整條規則，是為了讓紅的原因只有一件事。 */
		name: '把顆粒的濃度改回 0.17（與判準檔分家，而且低於下限）',
		expectPass: false,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace('mix-blend-mode:soft-light;opacity:.5', 'mix-blend-mode:soft-light;opacity:.17')),
		expect: /濃度分家[\s\S]*產物的顆粒不透明度是 0\.17[\s\S]*低於下限 0\.34/,
	},
	{
		/* 防「永遠紅的檢查」：出貨值 0.5 必須綠。上面那一條若是靠「只要看到顆粒
		   的 opacity 就紅」通過的，這一條會抓到。 */
		name: '顆粒濃度照判準檔的 0.5 應該綠',
		expectPass: true,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace('mix-blend-mode:soft-light;opacity:.5', 'mix-blend-mode:soft-light;opacity:0.500')),
		expect: null,
	},
	{
		/* **上限那一段也要被跑到**，否則它跟沒寫一樣。0.6 在下限之上、在上限 0.54 之外，
		   所以只會踩到上限那一條（分家那一條也會響，這裡只斷言上限的訊息）。
		   它擋的是真實的退步：有人覺得「再濃一點更好看」，而破的線在列聯表那一格上，
		   看起來與顆粒毫無關係。 */
		name: '把顆粒濃度調到上限之外（0.6）',
		expectPass: false,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace('mix-blend-mode:soft-light;opacity:.5', 'mix-blend-mode:soft-light;opacity:.6')),
		expect: /高於上限 0\.54/,
	},
	{
		/* fail-closed 那一道：顆粒層若被改名或搬走，上面幾道會靜靜地不作用，
		   而對比模型照樣拿判準檔的濃度在算——沒有這一條，那是一個看不見的洞。 */
		name: '顆粒層的 opacity 整個消失（檢查必須 fail-closed）',
		expectPass: false,
		mutate: (f) => writeFileSync(f, readFileSync(f, 'utf8').replace('mix-blend-mode:soft-light;opacity:.5', 'mix-blend-mode:soft-light')),
		expect: /找不到顆粒層的不透明度宣告/,
	},

	// ── 署名標籤與框票 02：分類顯示名的單一來源 ────────────────────────────
	{
		/* 分類名收成一份定義之後，還是有一條回頭路：有人在某一頁把舊名手寫回去。
		   注入產物而不是原始碼，是因為閘門只看得到產物——那正是它的守備範圍，
		   也正是這條檢查上線前實際紅過的樣子（那時舊名還寫在 frontmatter 標題裡）。 */
		name: '把退役的分類名寫回產物（同一個分類兩個顯示名）',
		expectPass: false,
		needsProjectPage: true,
		mutate: (f, dir) =>
			editAnyProjectPage(dir, (h) =>
				h.replace('</h1>', '</h1><p class="category-label">AI 專案 #1</p>'),
			),
		expect: /category-name[\s\S]*AI 專案/,
	},
];

/* 有些注入要的是「AI 實作那一類至少有一頁」。那一頁 2026-08-04 下架之後這些案例沒有
   對象，**要印出來說這一輪沒驗到，不能靜靜當成過了**——一個沒跑的檢查印成 ✓，
   等於把「守衛在看著」這件事講成謊話。 */
const HAS_AI_PAGE = existsSync(join(ROOT, 'dist', 'projects', 'ai'));

/* 同樣的道理，但門檻更低：只要「任何一類至少有一頁」。兩類同時空掉才會跳過。 */
const HAS_PROJECT_PAGE = findProjectPage(join(ROOT, 'dist')) !== null;

let failed = 0;
let skipped = 0;
for (const c of cases) {
	if (c.needsAiPage && !HAS_AI_PAGE) {
		console.log(`· ${c.name}　（AI 實作那一類目前一頁都沒有，這一輪無對象）`);
		skipped++;
		continue;
	}
	if (c.needsProjectPage && !HAS_PROJECT_PAGE) {
		console.log(`· ${c.name}　（專案閱讀頁一頁都沒有，這一輪無對象）`);
		skipped++;
		continue;
	}
	// **開跑前就先印**。跑完才印的話，卡住的那一個案例不會留下任何痕跡——
	// CI 的日誌要等整個步驟結束才拿得到，於是「卡在哪裡」變成無從得知。
	process.stdout.write(`… ${c.name}\n`);
	const t0 = Date.now();
	const { code, out, timedOut } = withCopy(c.mutate, { ...channelEnv(c.entries), ...c.env });
	const secs = ((Date.now() - t0) / 1000).toFixed(1);
	const passed = code === 0;
	const ok = !timedOut && passed === c.expectPass && (!c.expect || c.expect.test(out));
	console.log(`${ok ? '✓' : '✗'} ${c.name}　（退出碼 ${code}，${secs}s）`);
	if (!ok) {
		failed++;
		console.log(out.split('\n').slice(-25).join('\n'));
	}
}

if (failed) {
	console.log(`\n✗ 閘門自我檢查有 ${failed} 項不符預期`);
	process.exit(1);
}
console.log(
	`\n✓ 閘門自我檢查通過：注入缺陷會紅，未注入會綠${skipped ? `（另有 ${skipped} 項無對象未驗，見上）` : ''}`,
);
