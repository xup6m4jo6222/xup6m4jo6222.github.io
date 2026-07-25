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
