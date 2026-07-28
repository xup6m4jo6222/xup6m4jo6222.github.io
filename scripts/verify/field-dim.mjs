/**
 * 票 01：跑真瀏覽器，證明「文字帶減光真的有作用」。
 *
 *   npm run build && node scripts/verify/field-dim.mjs
 *
 * 為什麼要這一支：閘門比對的是 `data-field` 屬性，看不到畫布像素。減光寫在參數裡、
 * 屬性也對，但 `strokeStyle` 的坑會讓它整個不生效，而畫面看起來完全正常——
 * 本人定案的那組參數就是在那個狀態下調的（`DECISIONS.md` #226／#228）。
 *
 * 做法：同一頁跑兩次，對照組用 `?nodim=1` 把 `data-field` 的 `textDim` 改成 0。
 * 兩次的「文字帶核心／帶外」不透明度比必須明顯不同——**這就是票 01 那一條
 * 「拿掉減光與加上減光的畫面必須不同」**。
 *
 * 產物直接從記憶體服務並在回應時注入探針，所以不動 `dist/`，不必寫還原邏輯。
 * **不加 --virtual-time-budget**（RUNBOOK 的坑之二）。
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = 4477;
const PROBE = readFileSync(new URL('probe-field.js', import.meta.url), 'utf8');
const CHROME = [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => p && existsSync(p));
if (!CHROME) {
	console.error('找不到 Chrome');
	process.exit(1);
}

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.json': 'application/json',
	'.txt': 'text/plain',
};

let inbox = null;
const server = createServer((req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	if (url.pathname === '/report') {
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			try {
				inbox?.(JSON.parse(body));
			} catch (e) {
				inbox?.({ ok: false, why: `壞掉的回報：${e.message}` });
			}
			res.end('ok');
		});
		return;
	}
	let file = join(DIST, decodeURIComponent(url.pathname));
	if (!extname(file)) file = join(file, 'index.html');
	if (!existsSync(file)) {
		res.writeHead(404).end('nope');
		return;
	}
	const type = TYPES[extname(file)] || 'application/octet-stream';
	res.writeHead(200, { 'content-type': type });
	if (extname(file) !== '.html') {
		res.end(readFileSync(file));
		return;
	}
	// 探針是 classic script、插在 </body> 前，所以它在元件那支 module 之前執行——
	// 對照組要先把屬性改掉才有意義，順序是規格保證的，不是碰運氣。
	res.end(readFileSync(file, 'utf8').replace('</body>', `<script>${PROBE}</script></body>`));
});

/* `child.kill()` 在 Windows 上只送給那一個 process，Chrome 的子行程會活下來抱著
   設定檔目錄不放；下一次啟動看到鎖就把網址轉給舊的實例、自己立刻結束——於是
   第三次之後永遠等不到回報。整棵砍掉才是對的（第一版就是栽在這裡）。 */
const killTree = (pid) =>
	new Promise((done) => {
		if (process.platform !== 'win32') {
			try {
				process.kill(-pid);
			} catch {}
			done();
			return;
		}
		spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }).on('close', done);
	});

/* 每一次開一個全新的設定檔目錄。共用一個的話，前一次的殘留行程還抱著鎖，
   下一次啟動就會把網址轉給舊實例、自己立刻結束，於是永遠等不到回報。 */
let runs = 0;

/** 開一次無頭 Chrome，等探針回報，回報到了就把它整棵收掉。 */
function run(path, extra = [], ms = 45000) {
	return new Promise((resolve, reject) => {
		const finish = async (fn, v) => {
			clearTimeout(timer);
			await killTree(child.pid);
			fn(v);
		};
		const timer = setTimeout(() => finish(reject, new Error(`逾時：${path} 沒有回報`)), ms);
		inbox = (r) => finish(resolve, r);
		const child = spawn(CHROME, [
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--window-size=1280,720',
			'--force-device-scale-factor=1',
			`--user-data-dir=${join(tmpdir(), `field-chrome-${process.pid}-${runs++}`)}`,
			...extra,
			`http://localhost:${PORT}${path}`,
		]);
		child.on('error', reject);
	});
}

const PAGES = [
	['首頁', '/'],
	['閱讀頁', '/projects/stats/taiwan-tourism/'],
];

/* 票 02 的驗收讀數：不判定合格與否，只把三個數字擺出來讓本人看。
   判定是他的事——這一輪存在的理由就是「不要 AI 自己說看起來還行」。 */
async function signoff() {
	const { FIELD, FIELD_CRAFT } = await import(
		new URL('../palette-config.mjs', import.meta.url).href
	);
	const peak = FIELD.shockAmp * FIELD_CRAFT.shockOmega[0];
	console.log('\n══ 票 02 驗收讀數 ══');
	console.log(
		`回彈峰值速度　${peak.toFixed(0)} px/s ／ 紅線③ 30　` +
			`（${FIELD.shockAmp}px × ${FIELD_CRAFT.shockOmega[0]} rad/s，參數的解析上界，不是目測）`,
	);
	console.log(`回位時間　　　${FIELD.shockMs} ms ／ 動效紅線① 350（上限就是紅線）`);
	for (const [name, path] of PAGES) {
		const r = await run(`${path}?signoff=1`, [], 60000);
		if (!r.ok) {
			console.log(`\n── ${name}　✗ ${r.why}`);
			continue;
		}
		const c = r.cost;
		console.log(`\n── ${name}　${r.vw}×${r.vh} DPR ${r.dpr}`);
		console.log(
			`   每幀成本　　中位 ${c.med.toFixed(2)} ms　p95 ${c.p95.toFixed(2)} ms　最大 ${c.max.toFixed(2)} ms ／ 預算 11 ms（取樣 ${c.n} 幀）`,
		);
		console.log(`   超過 5ms 的幀 ${c.over5} 個——建場是一次性的，貼圖不是，這個數字分得開兩者`);
		console.log(`   畫面更新率　${r.fps.toFixed(1)} fps　場真的重畫 ${r.redraws.toFixed(1)} 次/秒（上限 ${FIELD_CRAFT.fpsCap}）`);
		console.log(
			`   文字帶最壞對比　${r.contrast ? r.contrast.toFixed(2) : '—'} ／ 門檻 4.5　` +
				`（最亮的一顆 rgb(${r.worstPx}）、場在帶內的峰值不透明度 ${r.peakAlpha.toFixed(4)}）`,
		);
		console.log('   　　　　　　　※ 未計入兩道亮光與顆粒，量法與原型一致，所以與當初的 14.17 可比');
	}
}

/**
 * 票 02 的比對截圖。參數靠 `?ink=` `?dim=` 從屬性換掉，不必為了看另一組值重新建置。
 *   node scripts/verify/field-dim.mjs --shots <輸出目錄>
 */
async function shots(dir) {
	const shot = (path, name, size = '1440,900') =>
		new Promise((done) => {
			const c = spawn(CHROME, [
				'--headless=new',
				'--disable-gpu',
				'--hide-scrollbars',
				`--window-size=${size}`,
				'--force-device-scale-factor=1',
				`--user-data-dir=${join(tmpdir(), `field-shot-${process.pid}-${runs++}`)}`,
				`--screenshot=${join(dir, name)}`,
				`http://localhost:${PORT}${path}`,
			]);
			c.on('close', done);
		});
	const read = '/projects/stats/taiwan-tourism/';
	// 第一題：線的強度。現行 0.040 對上原型上「明顯較有存在感」的 0.070
	await shot('/', 'q1-home-ink-040.png');
	await shot('/?ink=0.07', 'q1-home-ink-070.png');
	// 第二題：文字帶減光。現行 0.75 對上完全不減光——差別就是減光在做的事
	await shot(read, 'q2-read-dim-075.png');
	await shot(`${read}?dim=0`, 'q2-read-dim-000.png');
	// 閱讀頁的線強度也要看一次（正文欄兩側是他讀字時眼角會掃到的地方）
	await shot(read, 'q1-read-ink-040.png');
	await shot(`${read}?ink=0.07`, 'q1-read-ink-070.png');
	/* 第三題：裂縫比例。現行 0.09 在 1280×720 上只斷 0.9%、餘燼 0 顆。
	   線強度一律拉到 0.07 才看得出斷口在哪——這幾張問的是**斷口的密度**，
	   不是線的強度，兩件事混在一張圖裡他分不出自己在答哪一題。 */
	for (const c of ['0.09', '0.20', '0.30']) {
		await shot(`/?ink=0.07&crack=${c}`, `q3-home-crack-${c.replace('.', '')}.png`);
	}
	console.log(`截圖產在 ${dir}`);
}

server.listen(PORT, async () => {
	const shotsAt = process.argv.indexOf('--shots');
	if (shotsAt >= 0) {
		await shots(process.argv[shotsAt + 1]);
		server.close();
		process.exit(0);
	}
	if (process.argv.includes('--signoff')) {
		await signoff();
		server.close();
		process.exit(0);
	}
	let bad = 0;
	const pct = (v) => (v == null ? '—' : v.toFixed(4));
	for (const [name, path] of PAGES) {
		const on = await run(path);
		const off = await run(`${path}?nodim=1`);
		console.log(`\n── ${name}　${path}`);
		for (const r of [on, off]) {
			if (!r.ok) {
				console.log(`   ✗ ${r.why}`);
				bad++;
				continue;
			}
			const tag = r.nodim ? '對照組 textDim=0' : `減光 textDim=${r.textDim}`;
			console.log(
				`   ${tag.padEnd(22)} 文字帶 ${r.band}　核心 ${pct(r.core)}　帶外 ${pct(r.out)}　比 ${pct(r.ratio)}`,
			);
			if (r.errors.length) {
				console.log(`   ✗ 未捕捉的例外：${r.errors.join(' ／ ')}`);
				bad++;
			}
			if (!r.painted) {
				console.log('   ✗ 整張畫布沒有任何非零像素——場根本沒畫出來');
				bad++;
			}
		}
		if (!on.ok || !off.ok) continue;

		// 一、對照組必須「幾乎沒有減光」——不然這個對照組本身就是壞的
		if (!(off.ratio > 0.9)) {
			console.log(`   ✗ 對照組的核心／帶外比 ${pct(off.ratio)} 不到 0.9，關掉減光後仍有落差，量法有問題`);
			bad++;
		}
		// 二、開了減光必須明顯低於對照組。這一條紅就是 strokeStyle 那個 bug 回來了
		if (!(on.ratio < off.ratio * 0.7)) {
			console.log(
				`   ✗ 減光沒有作用：開 ${pct(on.ratio)} vs 關 ${pct(off.ratio)}——兩張畫面實質相同`,
			);
			bad++;
		} else {
			console.log(
				`   ✓ 減光有作用：核心／帶外 ${pct(on.ratio)}（關掉是 ${pct(off.ratio)}），兩張畫面確實不同`,
			);
		}
		// 次級線與餘燼是畫面上唯二的元素主色，兩者都只長在裂縫上——有主色像素就有裂縫
		if (!on.accent) {
			console.log('   ✗ 畫布上找不到元素主色的像素——次級線與餘燼都沒長出來，等於裂縫沒被找到');
			bad++;
		} else {
			console.log(`   ✓ 元素主色像素 ${on.accent} 個（次級線＋餘燼，兩者只長在裂縫上）`);
		}
		if (on.accent < 200) {
			console.log('   ⚠ 主色像素只有這麼幾個——次級線是個位數。強度由裂縫比例決定，留給票 02');
		}
	}

	/* 動態的三件事只跟元件有關、與頁型無關（場沒有模式參數），所以只在首頁跑一次。
	   量的是外部可觀察的畫面差，不是內部狀態。 */
	console.log('\n── 動態（首頁）');
	for (const [name, flags] of [
		['常態', []],
		['降低動態偏好', ['--force-prefers-reduced-motion']],
	]) {
		const r = await run('/?motion=1', flags);
		if (!r.ok) {
			console.log(`   ✗ ${name}：${r.why}`);
			bad++;
			continue;
		}
		console.log(`   ${name}　偏好讀到 reduce＝${r.reduced}　捲動後畫面差 ${r.shift}　靜置後畫面差 ${r.ember}`);
		const want = flags.length > 0;
		if (r.reduced !== want) {
			console.log(`   ✗ ${name}：瀏覽器沒有照旗標回報偏好，這一輪的結論不算數`);
			bad++;
			continue;
		}
		if (want) {
			// 可及性是硬下限：空間位移必須全關
			if (r.shift !== 0) {
				console.log(`   ✗ 降低動態偏好下捲動仍讓畫面位移（差 ${r.shift}），空間位移沒關掉`);
				bad++;
			} else {
				console.log('   ✓ 降低動態偏好下位移全關');
			}
		} else if (!r.shift) {
			console.log('   ✗ 捲動沒有讓畫面動——回彈沒接上');
			bad++;
		} else {
			console.log('   ✓ 捲動回彈會動');
		}
		/* 餘燼**只回報不判定**。它是不是在燒完全由參數決定，而參數要到票 02 才定版：
		   現行值（裂縫 0.09／餘燼 0.13）在 1280×720 上算出來是 0 顆，所以這裡量到 0
		   是參數的結果不是機制壞掉。機制本身另有證據——它與位移分開判斷（位移吃
		   `still.matches`，餘燼不吃），而位移那一條上面已經驗過了。 */
		if (!r.ember) {
			console.log('   ⚠ 靜置四秒畫面完全沒變：現行參數下餘燼是 0 顆，這一項留給票 02 定版');
		}
	}

	server.close();
	console.log(
		bad
			? `\n✗ ${bad} 項不合格`
			: '\n✓ 場有畫出來、減光真的有作用、回彈會動且在降低動態偏好下全關（⚠ 的兩項是參數強度，票 02 定版）',
	);
	process.exit(bad ? 1 : 0);
});
