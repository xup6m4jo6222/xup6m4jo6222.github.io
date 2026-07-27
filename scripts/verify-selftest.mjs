#!/usr/bin/env node
/**
 * 閘門自己的檢查：把兩種缺陷注入產物副本，確認 verify:palette 真的會紅。
 * 一個永遠通過的檢查跟沒有檢查一樣——這支腳本是那句話的執行版。
 *
 * 對應票 01 的驗收條款「故意塞一個假色碼、以及故意加一個沒有覆蓋的位移動畫，
 * 兩者都可驗證它會紅」。
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as CFG from './palette-config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERIFIER = join(ROOT, 'scripts', 'verify-palette.mjs');

function run(dist) {
	const r = spawnSync(process.execPath, [VERIFIER], {
		env: { ...process.env, VERIFY_DIST: dist },
		encoding: 'utf8',
	});
	return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function withCopy(mutate) {
	const dir = mkdtempSync(join(tmpdir(), 'verify-selftest-'));
	try {
		cpSync(join(ROOT, 'dist'), dir, { recursive: true });
		const cssDir = join(dir, '_astro');
		const cssFile = join(cssDir, readdirSync(cssDir).find((f) => f.endsWith('.css')));
		// 票 01 起有注入到 JS 與 HTML 的案例，所以第二個參數把整個產物目錄交出去
		mutate(cssFile, dir);
		return run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** 在首頁塞一個帶 data-motif 的 canvas——母題上線後產物就長這樣。 */
const injectMotif = (dir, params) =>
	writeFileSync(
		join(dir, 'index.html'),
		readFileSync(join(dir, 'index.html'), 'utf8').replace(
			'</body>',
			`<canvas aria-hidden="true" data-motif='${JSON.stringify(params)}'></canvas></body>`,
		),
	);

/** 把產物裡所有 `data-motif` 屬性拿掉（模擬 canvas 改由 JS 建立、參數沒有進 HTML）。 */
const stripMotifAttrs = (dir) => {
	const walk = (d) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (p.endsWith('.html')) {
				const before = readFileSync(p, 'utf8');
				const after = before.replace(/\sdata-motif(-[\w-]+)?=("[^"]*"|'[^']*')/g, '');
				if (after !== before) writeFileSync(p, after);
			}
		}
	};
	walk(dir);
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
		name: '把決策開關的底換成列表卡的底（元素主色小標掉到 3.61）',
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
		// 檢查 1 原本只掃 CSS 與 inline style。母題的色碼寫在腳本裡，那是一條白名單看不見的路。
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
		// 第七類的 fail-open 防線：母題在跑（有常駐迴圈）就必須找得到它的參數。
		// 沒有這一條，把 canvas 改成由 JS 建立，整個第七類會靜靜地不作用。
		//
		// **票 02 起要先把真的屬性拿掉**：母題已經上線，產物本來就有 data-motif，
		// 只塞一個假迴圈證明不了任何事（實測會綠）。這一條模擬的就是「canvas 改成
		// 由 JS 建立」——迴圈照跑，但伺服器端沒有渲染出參數。
		name: '母題在跑卻沒有把參數渲染進 HTML',
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
	{
		name: '把母題參數改成檔位以外的值',
		expectPass: false,
		mutate: (_f, dir) => injectMotif(dir, { ...CFG.MOTIF, fpsCap: 60 }),
		expect: /fpsCap[\s\S]*母題參數漂離檔位/,
	},
	{
		// 沒有這一條的話，第七類只要「有 data-motif 就紅」也會通過上一條——
		// 那是一個永遠紅的檢查，跟永遠綠一樣沒用。
		name: '母題參數照判準檔寫應該綠',
		expectPass: true,
		mutate: (_f, dir) => injectMotif(dir, CFG.MOTIF),
		expect: null,
	},
];

let failed = 0;
for (const c of cases) {
	const { code, out } = withCopy(c.mutate);
	const passed = code === 0;
	const ok = passed === c.expectPass && (!c.expect || c.expect.test(out));
	console.log(`${ok ? '✓' : '✗'} ${c.name}　（退出碼 ${code}）`);
	if (!ok) {
		failed++;
		console.log(out.split('\n').slice(-25).join('\n'));
	}
}

if (failed) {
	console.log(`\n✗ 閘門自我檢查有 ${failed} 項不符預期`);
	process.exit(1);
}
console.log('\n✓ 閘門自我檢查通過：注入缺陷會紅，未注入會綠');
