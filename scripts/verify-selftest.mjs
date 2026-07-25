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
		mutate(cssFile);
		return run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

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
