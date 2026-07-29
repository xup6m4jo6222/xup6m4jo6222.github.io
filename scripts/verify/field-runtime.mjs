/**
 * 背景等高線場的執行期量測與檢查（票 01／02／04）。跑的是真瀏覽器，
 * 因為**靜態閘門看不到執行期的東西**——這一整支就是那條教訓的執行版。
 *
 *   npm run verify:field                        票 01：減光真的有作用、回彈會動、
 *                                               降低動態偏好下位移全關（會判定合格與否）
 *   node scripts/verify/field-runtime.mjs --runtime   票 04：每幀成本／建場成本／
 *                                               文字帶對比，外加探針的自我證偽
 *   node …/field-runtime.mjs --signoff          票 02：擺數字給本人看，不判定
 *   node …/field-runtime.mjs --shots <目錄>     票 02：換參數的比對截圖
 *   node …/field-runtime.mjs --lan              票 04：手機連區網回報
 *
 * 為什麼需要它：閘門比對的是 `data-field` 屬性，看不到畫布像素。減光寫在參數裡、
 * 屬性也對，但 `strokeStyle` 的坑會讓它整個不生效，而畫面看起來完全正常——
 * 本人定案的那組參數就是在那個狀態下調的（`DECISIONS.md` #226／#228）。
 *
 * 所有對照組都靠改 `data-field` 屬性產生（`?nodim` `?ink=` `?ember=` `?kill=1`），
 * 不必為了換一個值重新建置——**這是產物端契約付出來的紅利**。
 *
 * 產物直接從記憶體服務並在回應時注入探針，所以不動 `dist/`，不必寫還原邏輯。
 * **不加 --virtual-time-budget**（RUNBOOK 的坑之二）。
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
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

/** 回報的大小上限。`--lan` 會綁 0.0.0.0，沒有上限的話區網上任何人都能把它灌爆。 */
const MAX_REPORT = 4 * 1024 * 1024;

let inbox = null;
const server = createServer((req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	if (url.pathname === '/report') {
		let body = '';
		req.on('data', (c) => {
			body += c;
			if (body.length > MAX_REPORT) {
				res.writeHead(413).end('too big');
				req.destroy();
			}
		});
		req.on('end', () => {
			if (res.writableEnded) return;
			try {
				inbox?.(JSON.parse(body));
			} catch (e) {
				inbox?.({ ok: false, why: `壞掉的回報：${e.message}` });
			}
			res.end('ok');
		});
		return;
	}
	/* ── 路徑必須真的落在 dist 裡 ────────────────────────────────────────
	   **不能只靠 URL 正規化。**WHATWG 的解析器會吃掉 `..` 與 `%2e%2e`，但**不動 `%5c`**；
	   `decodeURIComponent` 之後那個 `%5c` 變成 `\`，而 win32 的 `path.join` 把 `\` 當分隔符。
	   實測（2026-07-29 抗辯，真的跑出 HTTP 200）：
	     /a/%5c..%5c..%5cDECISIONS.md            → repo 根的私人決策紀錄
	     /a/(%5c..)×8%5cWindows/win.ini          → C:\ 絕對可達
	   而 `--lan` 是綁 0.0.0.0 的（手機量測的標準流程），等於同一個 wifi 上任何裝置都能
	   讀走這台機器上使用者讀得到的任何檔案。**唯一正確的守法是解析完之後檢查它在不在
	   dist 底下**，不是去黑名單哪些字元——黑名單永遠少一個。 */
	let file = resolve(DIST, '.' + decodeURIComponent(url.pathname));
	if (!extname(file)) file = join(file, 'index.html');
	if (file !== DIST && !file.startsWith(DIST + sep)) {
		res.writeHead(403).end('nope');
		return;
	}
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

/** 這一輪開過的設定檔目錄，收工時一起刪。 */
const profiles = [];
const sweepProfiles = () => {
	for (const p of profiles.splice(0)) {
		try {
			rmSync(p, { recursive: true, force: true, maxRetries: 3 });
		} catch {}
	}
};

/** 開一次無頭 Chrome，等探針回報，回報到了就把它整棵收掉。 */
function run(path, extra = [], ms = 45000) {
	return new Promise((resolve, reject) => {
		/* `settled` 不只是禮貌。逾時分支原本沒清掉 `inbox`，所以被殺掉的 Chrome 若有一個
		   在途的 sendBeacon 在 reject 之後才抵達，會**第二次**進 finish，對**同一個 pid**
		   再跑一次 `taskkill /T /F`——而那個 pid 早就結束、Windows 的 pid 會重用，
		   `/T` 會把新主人的整棵行程樹強殺。機率低，但後果是靜默誤殺使用者的其他程式。 */
		let settled = false;
		const finish = async (fn, v) => {
			if (settled) return;
			settled = true;
			inbox = null;
			clearTimeout(timer);
			await killTree(child.pid);
			fn(v);
		};
		const timer = setTimeout(() => finish(reject, new Error(`逾時：${path} 沒有回報`)), ms);
		inbox = (r) => finish(resolve, r);
		const profile = join(tmpdir(), `field-chrome-${process.pid}-${runs++}`);
		profiles.push(profile);
		const child = spawn(CHROME, [
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--window-size=1280,720',
			'--force-device-scale-factor=1',
			`--user-data-dir=${profile}`,
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

/**
 * 票 04：執行期量測。**這一支會判定合格與否**（與票 02 的 `--signoff` 不同，
 * 那一支是擺數字給人看）。
 *
 *   node scripts/verify/field-runtime.mjs --runtime
 *
 * 量三件事，而且每一件都拆到「講得清楚」為止：
 *   每幀成本 — 拆成**固定開銷**（清空＋整面貼圖，隨畫布像素數變動）與
 *              **邊際成本**（餘燼）。對照組用 `?ember=0`，靠產物端契約換值，
 *              不必為了量一個數字重新建置。
 *   建場成本 — **一次性**，只在視窗寬或文字帶變動時付。混在每幀成本的 max 裡
 *              看起來像「有時候會爆」，拆開才講得清楚。
 *   文字帶最壞對比 — 對 4.5。
 *
 * 外加一件這張票明文要求的事：**探針要能證明自己會紅**。每一次跑都用 `?kill=1`
 * 把場殺掉一次，探針必須回報「沒畫出來」——v9 抓到過一個動畫死透仍報「有在動」
 * 的探針，所以自我證偽不是選配。
 */
async function runtime() {
	const { FIELD, FIELD_CRAFT } = await import(
		new URL('../palette-config.mjs', import.meta.url).href
	);
	const BUDGET = 11;
	let bad = 0;
	const ms = (v) => (v == null ? '—' : `${v.toFixed(2)} ms`);

	// ── 先證明這支探針會紅 ───────────────────────────────────────────────
	console.log('══ 探針的自我證偽 ══');
	const dead = await run('/?runtime=1&kill=1', [], 90000);
	if (dead.ok && dead.painted === 0) {
		console.log('   ✓ 故意讓場不畫（拿掉 data-field）時，探針回報畫布 0 個非零像素');
	} else {
		console.log(`   ✗ 故意讓場不畫，探針卻回報 painted=${dead.painted}——這支探針證明不了任何事`);
		bad++;
	}

	console.log('\n══ 票 04 執行期讀數 ══');
	for (const [name, path] of PAGES) {
		// 1280×720 與 1920×1080 兩個尺寸：固定開銷是整面貼圖，它隨畫布像素數變動，
		// 只量一個尺寸看不出那件事是不是真的
		for (const size of ['1280,720', '1920,1080']) {
			const flags = [`--window-size=${size}`];
			const full = await run(`${path}?runtime=1`, flags, 150000);
			const bare = await run(`${path}?runtime=1&ember=0`, flags, 150000);
			/* 現行只有 6 顆餘燼，成本落在計時器解析度（0.1ms）以下——量到的差是雜訊，
			   有時候還是負的。要看得到斜率就得把餘燼開到滿載：`?ember=0.9` 讓幾乎每個
			   裂縫都長餘燼（約 236 顆）。**這才是「還擺得下多少東西」問得到答案的量法**，
			   只量現行值只會得到「量不到」。 */
			const loaded = await run(`${path}?runtime=1&ember=0.9`, flags, 150000);
			/* 建場成本要**單獨量**，不能用「有場」減「沒場」：改版面那條路上母題也在
			   重建（三張整面離屏遮罩＋遠景層，實測 72–178ms），兩個量級差太多的東西
			   相減得到的是雜訊——第一版量到 −1.0 到 +4.5ms 都有。`?nomotif=1` 把母題
			   拿掉，讓場單獨走一次那條路。 */
			const alone = await run(`${path}?runtime=1&nomotif=1`, flags, 150000);
			const without = await run(`${path}?runtime=1&kill=1`, flags, 150000);
			if (!full.ok || !bare.ok) {
				console.log(`\n── ${name}　${size}　✗ ${full.why || bare.why}`);
				bad++;
				continue;
			}
			const fixed = bare.cost.med;
			const marginal = full.cost.med - fixed;
			console.log(`\n── ${name}　${full.vw}×${full.vh} DPR ${full.dpr}　畫面更新率 ${full.fps.toFixed(1)} fps`);
			console.log(
				`   每幀成本　　中位 ${ms(full.cost.med)}　p95 ${ms(full.cost.p95)}　最大 ${ms(full.cost.max)} ／ 預算 ${BUDGET} ms（有量到的 ${full.cost.n} 幀）`,
			);
			if (full.silentFrames != null) {
				console.log(`   　其中 ${(full.silentFrames * 100).toFixed(0)}% 的幀量到 0（計時器解析度以下）`);
			}
			/* 差額小於計時器解析度時**只給上界，不給數字**。0.1ms 的量化下，
			   兩個 0.4ms 相減可以是 −0.1 也可以是 +0.1——把那個當成「每顆 −0.85µs」
			   印出來，是在假裝量到了沒量到的東西。 */
			const RES = 0.15;
			/* 負的差額一律當「量不到」。多畫東西不可能變便宜——印出「每顆 −0.85µs」
			   是在假裝量到了沒量到的東西，而那正是這張票要防的那種數字。 */
			const tiny = (v) => v < RES;
			const delta = (v, what) => (tiny(v) ? `≲ ${RES} ms（${what}）` : ms(v));
			console.log(`   ├ 固定開銷（清空＋整面貼圖）　中位 ${ms(fixed)}　＝ 餘燼 0 顆時的成本`);
			console.log(`   └ 邊際成本（餘燼）　　　　　　現行 6 顆 ${delta(marginal, '在 0.1ms 計時解析度以下')}`);
			if (loaded.ok) {
				const d = loaded.cost.med - fixed;
				console.log(
					`   　　　　　　　　　　　　　　滿載約 236 顆 ${delta(d, '連滿載都量不到')}` +
						(tiny(d) ? `　→ 每顆 ≲ ${((RES / 236) * 1000).toFixed(2)} µs` : `　→ 每顆約 ${((d / 236) * 1000).toFixed(2)} µs`),
				);
			}
			console.log(
				`   建場成本（一次性，改版面時付）　場單獨跑 中位 ${ms(alone.ok ? alone.build.med : null)}　最大 ${ms(alone.ok ? alone.build.max : null)}`,
			);
			if (without.ok && without.build.med != null) {
				console.log(
					`   　　同一條路上母題佔 ${ms(without.build.med)}（三張整面離屏遮罩＋遠景層）——場不是這條路的瓶頸`,
				);
			}
			/* `builds` 現在只收「真的重建了」那幾次，所以要拿 rebuilt 對 tries 比，
			   不能拿它對 builds.length 比——後者永遠相等，等於這道檢查失效。 */
			for (const [tag, r] of [['場單獨', alone], ['完整', full]]) {
				if (r.ok && r.build.rebuilt !== r.build.tries) {
					console.log(
						`   ✗ ${tag}那一輪 ${r.build.tries} 次改版面裡只有 ${r.build.rebuilt} 次畫面真的變了——沒觸發到的那幾次不算數`,
					);
					bad++;
				}
			}
			console.log(`   繪製真的發生　畫布非零像素 ${full.painted} 個`);

			if (!(full.cost.med <= BUDGET)) {
				console.log(`   ✗ 每幀成本中位 ${ms(full.cost.med)} 超過 ${BUDGET} ms 預算`);
				bad++;
			}
			if (!(full.cost.p95 <= BUDGET)) {
				console.log(`   ✗ 每幀成本 p95 ${ms(full.cost.p95)} 超過 ${BUDGET} ms 預算`);
				bad++;
			}
			if (!full.painted) {
				console.log('   ✗ 畫布上沒有任何非零像素——場根本沒畫出來');
				bad++;
			}
			if (full.errors.length) {
				console.log(`   ✗ 未捕捉的例外：${full.errors.join(' ／ ')}`);
				bad++;
			}
		}

		// 文字帶最壞對比走 signoff 那條路（量法與原型一致，數字可比）
		const c = await run(`${path}?signoff=1`, ['--window-size=1280,720'], 90000);
		if (c.ok && c.contrast != null) {
			const ok = c.contrast >= 4.5;
			console.log(`   文字帶最壞對比　${c.contrast.toFixed(2)} ／ 門檻 4.5　${ok ? '✓' : '✗'}`);
			if (!ok) bad++;
		} else {
			console.log('   ✗ 文字帶最壞對比量不到');
			bad++;
		}
	}

	console.log(
		`\n回彈峰值速度 ${(FIELD.shockAmp * FIELD_CRAFT.shockOmega[0]).toFixed(0)} px/s ／ 紅線③ 30　` +
			`回位時間 ${FIELD.shockMs} ms ／ 動效紅線① 350`,
	);
	console.log(
		bad ? `\n✗ ${bad} 項不合格` : '\n✓ 每幀成本在預算內、繪製真的發生、文字帶對比守住，且探針證明過自己會紅',
	);
	console.log('※ 手機那一組要另外跑：node scripts/verify/field-runtime.mjs --lan');
	return bad;
}

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

/**
 * 票 04：手機那一組。開在 0.0.0.0，印出區網網址，收到回報就印出來。
 *
 * 為什麼手機不能用無頭代跑（RUNBOOK 的坑之三）：Windows 無頭視窗寬有約 500px 下限，
 * 指定 375 會被鉗成 500，而且無頭是軟體算圖、沒有真裝置的 GPU 與散熱限制。
 * **手機端一律以瀏覽器內量測為準。**
 */
function lan() {
	const ips = Object.values(networkInterfaces())
		.flat()
		.filter((i) => i && i.family === 'IPv4' && !i.internal)
		.map((i) => i.address);
	console.log('手機連同一個 wifi，開下面任一個網址（開著別動，約 20 秒後會自己回報）：\n');
	for (const ip of ips) {
		console.log(`  首頁    http://${ip}:${PORT}/?runtime=1`);
		console.log(`  閱讀頁  http://${ip}:${PORT}/projects/stats/taiwan-tourism/?runtime=1`);
	}
	console.log('\n收工按 Ctrl-C。等回報中……\n');
	const ms = (v) => (v == null ? '—' : `${v.toFixed(2)} ms`);
	inbox = (r) => {
		if (!r.ok) {
			console.log(`✗ ${r.why}`);
			return;
		}
		console.log(`── ${r.page}　${r.vw}×${r.vh} DPR ${r.dpr}　畫面更新率 ${r.fps?.toFixed(1)} fps`);
		if (r.cost) {
			console.log(
				`   每幀成本 中位 ${ms(r.cost.med)}　p95 ${ms(r.cost.p95)}　最大 ${ms(r.cost.max)} ／ 預算 11 ms（有量到的 ${r.cost.n} 幀）`,
			);
			/* iOS Safari 把 performance.now() 量化到 1ms，所以每一筆不是 0 就是 1。
			   「中位 1.00ms」只講得出「有量到的那些幀」——**量不到的比例才是真實量級**。 */
			if (r.silentFrames != null) {
				console.log(
					`   　其中 ${(r.silentFrames * 100).toFixed(0)}% 的幀量到 0（計時器解析度以下）→ 真實每幀成本遠低於中位那個數`,
				);
			}
		}
		/* **沒重建就不印建場成本。**手機第一次跑就是這樣騙到我的：五個強迫寬度
		   全都比 402px 的視窗還寬，`main` 一動也不動、根本沒重建，而「那段時間的
		   最大成本」照樣給出一個看起來很合理的 1.00ms。 */
		if (r.build?.rebuilt) {
			console.log(`   建場成本 中位 ${ms(r.build.med)}　最大 ${ms(r.build.max)}（五次改版面裡 ${r.build.rebuilt} 次真的重建）`);
		} else if (r.build) {
			console.log('   建場成本 —（強迫改版面沒有觸發重建，這一輪量不到，不編一個數字給你）');
		}
		if (r.contrast != null) {
			console.log(`   文字帶最壞對比 ${r.contrast.toFixed(2)} ／ 門檻 4.5　${r.contrast >= 4.5 ? '✓' : '✗'}`);
		}
		console.log(`   畫布非零像素 ${r.painted}　未捕捉例外 ${r.errors.length || '無'}\n`);
	};
}

/**
 * 票 05 抗辯：回彈的逐格對比。
 *
 *   node scripts/verify/field-runtime.mjs --shockfilm <輸出目錄> [標籤]
 *
 * 拍的是**畫面與靜止態的差**（放大 20 倍），不是畫面本身——4px 的位移在
 * 0.040 強度的線上，靜態截圖裡看不見。亮起來的地方就是場移動過的地方。
 */
async function shockfilm(dir, label = 'now') {
	const r = await run('/?shockfilm=1', ['--window-size=1280,720'], 120000);
	if (!r.ok || !r.frames) {
		console.log(`✗ ${r.why || '沒有拿到逐格'}`);
		return 1;
	}
	for (const [i, f] of r.frames.entries()) {
		const name = `shock-${label}-${String(i + 1).padStart(2, '0')}-${f.phase === '捲動中' ? 'during' : 'after'}-${f.at}ms.png`;
		writeFileSync(join(dir, name), Buffer.from(f.png.split(',')[1], 'base64'));
		console.log(`   ${f.phase} ${String(f.at).padStart(4)}ms → ${name}`);
	}
	return 0;
}

server.listen(PORT, process.argv.includes('--lan') ? '0.0.0.0' : undefined, async () => {
	const filmAt = process.argv.indexOf('--shockfilm');
	if (filmAt >= 0) {
		const dir = process.argv[filmAt + 1];
		if (!dir) {
			console.error('用法：--shockfilm <輸出目錄> [標籤]');
			server.close();
			process.exit(2);
		}
		const bad = await shockfilm(dir, process.argv[filmAt + 2]);
		sweepProfiles();
		server.close();
		process.exit(bad);
	}
	if (process.argv.includes('--lan')) {
		lan();
		return; // 不結束，等手機回報
	}
	const shotsAt = process.argv.indexOf('--shots');
	if (shotsAt >= 0) {
		// `--shots` 放在最後一個參數時 dir 是 undefined，join 會丟 TypeError，
		// 而這裡是 listen 的回呼、沒有 catch —— 結果是 server 不關、行程掛住
		const dir = process.argv[shotsAt + 1];
		if (!dir) {
			console.error('用法：--shots <輸出目錄>');
			server.close();
			process.exit(2);
		}
		await shots(dir);
		sweepProfiles();
		server.close();
		process.exit(0);
	}
	if (process.argv.includes('--runtime')) {
		const bad = await runtime();
		sweepProfiles();
		server.close();
		process.exit(bad ? 1 : 0);
	}
	if (process.argv.includes('--signoff')) {
		await signoff();
		sweepProfiles();
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
		/* 200 這個下限是票 02 定出來的：裂縫比例 0.09 時主色像素只有 58 個（次級線 3 條、
		   餘燼 0 顆），0.30 時是 1500 上下。低於 200 就代表裂縫又被調回「看不見」的區間。 */
		if (on.accent < 200) {
			console.log('   ✗ 主色像素少於 200——次級線掉回個位數，裂縫比例被調回看不見的區間');
			bad++;
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
		console.log(
			`   ${name}　偏好讀到 reduce＝${r.reduced}　底噪（不捲動）${r.noise}　單次捲動後 ${r.shift}　持續捲動中 ${r.sustained}　靜置十秒內最大 ${r.ember}`,
		);
		const want = flags.length > 0;
		if (r.reduced !== want) {
			console.log(`   ✗ ${name}：瀏覽器沒有照旗標回報偏好，這一輪的結論不算數`);
			bad++;
			continue;
		}
		/* 判的是**捲動有沒有讓畫面多動**，不是「畫面有沒有變」。餘燼在降低動態偏好下
		   照樣呼吸（規格要的），所以底噪本來就不是 0；拿絕對值判會把餘燼讀成位移。 */
		const moved = r.shift > Math.max(4 * r.noise, 200);
		if (want) {
			// 可及性是硬下限：空間位移必須全關
			if (moved) {
				console.log(`   ✗ 降低動態偏好下捲動仍讓畫面多動（${r.shift} 對底噪 ${r.noise}），位移沒關掉`);
				bad++;
			} else {
				console.log(`   ✓ 降低動態偏好下位移全關（捲動後 ${r.shift} 與底噪 ${r.noise} 同一個量級）`);
			}
		} else if (!moved) {
			console.log(`   ✗ 捲動沒有讓畫面多動（${r.shift} 對底噪 ${r.noise}）——回彈沒接上`);
			bad++;
		} else {
			console.log(`   ✓ 捲動回彈會動（${r.shift}，底噪只有 ${r.noise}）`);
		}
		/* **一段連續捲動只准晃一次。**這一條是 2026-07-29 抗辯的產物：先前的探針
		   只送一次合成 scroll，所以「每一幀 scroll 都把幅度重設回滿格」這條路
		   從來沒被觀察到，而它讓動效紅線①（單一動作 ≤350ms）在真實捲動下不成立。
		   判的是「持續捲動中的畫面差有沒有回到底噪量級」，不是絕對值——餘燼一直在燒。 */
		if (r.sustained != null) {
			const stillMoving = r.sustained > Math.max(4 * r.noise, 200);
			if (stillMoving) {
				console.log(
					`   ✗ 持續捲動期間畫面仍在大幅變動（${r.sustained} 對底噪 ${r.noise}）——回彈被每一幀的 scroll 重新觸發，變成「捲多久晃多久」`,
				);
				bad++;
			} else {
				console.log(`   ✓ 一段連續捲動只晃一次（持續捲動中 ${r.sustained} 已回到底噪 ${r.noise} 的量級）`);
			}
		}
		// 餘燼只在不透明度上動，兩種偏好下都必須還在燒
		if (!r.ember) {
			console.log('   ✗ 靜置十秒畫面完全沒變——餘燼沒在燒');
			bad++;
		} else {
			console.log(`   ✓ 餘燼在燒（靜置十秒內畫面差最大 ${r.ember}）`);
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
