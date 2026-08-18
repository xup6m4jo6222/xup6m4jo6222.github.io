/**
 * 背景第 4 層與第 5 層的執行期量測與檢查。跑的是真瀏覽器，
 * 因為**靜態閘門看不到執行期的東西**——這一整支就是那條教訓的執行版。
 *
 *   npm run verify:field                        兩層都真的在畫、第 4 層沒有主色、減光有作用、
 *                                               循環真的在跑、降低動態偏好下位移全關
 *   node scripts/verify/field-runtime.mjs --runtime   重畫與冷啟動的成本：固定開銷與邊際成本
 *                                               分開列，對 11 ms 預算；含探針自我證偽
 *   node …/field-runtime.mjs --shots <目錄>     比對截圖（給人看的）
 *   node …/field-runtime.mjs --lan              手機連區網回報
 *
 * 為什麼需要它：閘門比對的是 `data-*` 屬性，看不到畫布像素。這一輪有兩件事
 * **只有量畫布才知道**——相位是算出來的、沒有任何狀態，所以「循環到底有沒有在跑」
 * 只有量畫布知道；而「第 4 層整層只用中性色」在屬性上驗得到色碼、驗不到畫出來的像素。
 *
 * 所有對照組都靠改屬性產生（`?nodim` `?slowcycle` `?ink=` `?density=` `?drift=` `?kill=1`），
 * 不必為了換一個值重新建置——**這是產物端契約付出來的紅利**。
 *
 * 產物直接從記憶體服務並在回應時注入探針，所以不動 `dist/`，不必寫還原邏輯。
 * **不加 --virtual-time-budget**（RUNBOOK 的坑之二）。
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = 4477;
const PROBE = readFileSync(new URL('probe-field.js', import.meta.url), 'utf8');
/* 票 04 的切換器探針。**與場的探針互斥、不同時注入**——兩支都會 POST 到 /report，
   而 `inbox` 只收得下第一份，同時注入等於擲骰子決定這一輪量到的是哪一件事。 */
const PROBE_EXPAND = readFileSync(new URL('probe-expand.js', import.meta.url), 'utf8');
/* 比對器探針。同一條互斥規矩：一次只注入一支。**統計頁已經不用比對器了**
   （2026-08-04 拆掉全部互動），這一支現在只服務 AI 實作那一頁，那頁下架中。 */
const PROBE_WIPE = readFileSync(new URL('probe-wipe.js', import.meta.url), 'utf8');
/* 統計第一頁三張靜態圖的對帳探針，取代原本的 probe-tost 與 probe-strata。 */
const PROBE_CHARTS = readFileSync(new URL('probe-charts.js', import.meta.url), 'utf8');
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

/** 回報的大小上限。`--lan` 對整個區網開放，沒有上限的話任何人都能把它灌爆。 */
const MAX_REPORT = 4 * 1024 * 1024;

let inbox = null;
const server = createServer((req, res) => {
	/* **`new URL` 也會丟。**第二輪修 `decodeURIComponent` 時守衛放在它後面，
	   晚了一行——`GET //`（主機為空）在這裡就丟 `ERR_INVALID_URL`，一個請求
	   打死整個行程，與那一條是同一個 bug。同族還有 `///`、`//@`、`//?x`。 */
	let url;
	try {
		url = new URL(req.url, `http://localhost:${PORT}`);
	} catch {
		res.writeHead(400).end('bad request');
		return;
	}
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
	/* `decodeURIComponent` 對畸形百分號編碼會丟 `URIError`，而這裡是 request handler、
	   沒有人接——**一個 `GET /%` 就能把量測伺服器打死**（第二輪抗辯用原始 socket 實測，
	   行程 code=1，連 `killTree()` 都沒跑，無頭 Chrome 變孤兒）。上一輪重寫的就是這一行，
	   守住了穿越卻沒守住 decode 本身。 */
	let decoded;
	try {
		decoded = decodeURIComponent(url.pathname);
	} catch {
		res.writeHead(400).end('bad path');
		return;
	}
	let file = resolve(DIST, '.' + decoded);
	if (!extname(file)) file = join(file, 'index.html');
	if (file !== DIST && !file.startsWith(DIST + sep)) {
		res.writeHead(403).end('nope');
		return;
	}
	if (!existsSync(file)) {
		res.writeHead(404).end('nope');
		return;
	}
	/* **先讀檔再送標頭。**反過來的話（先前的寫法）`readFileSync` 丟 EISDIR／EACCES
	   時標頭已經送出，那個例外沒有人接、也已經改不成 4xx——行程直接死。
	   實測：dist 裡放一個名為 `a.html` 的**目錄**，`GET /a.html` 就把伺服器打掉。 */
	let body;
	try {
		const probe = url.searchParams.has('expand')
			? PROBE_EXPAND
			: url.searchParams.has('wipe')
				? PROBE_WIPE
				: url.searchParams.has('charts')
					? PROBE_CHARTS
					: PROBE;
		body =
			extname(file) === '.html'
				? // 探針是 classic script、插在 </body> 前，所以它在元件那支 module 之前執行——
					// 對照組要先把屬性改掉才有意義，順序是規格保證的，不是碰運氣。
					readFileSync(file, 'utf8').replace('</body>', `<script>${probe}</script></body>`)
				: readFileSync(file);
	} catch (e) {
		res.writeHead(500).end(`read failed: ${e.code || e.message}`);
		return;
	}
	res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
	res.end(body);
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
/** 還活著的無頭 Chrome。SIGINT 要先收掉它們，設定檔目錄才刪得動。 */
const live = new Set();

/** 這一輪開過的設定檔目錄，收工時一起刪。 */
const profiles = [];
/** 登記一個設定檔目錄並回傳它的完整路徑——組路徑與登記要在同一個地方，
    分開寫就會像 `shots()` 那樣自己組一個、忘了登記，於是永遠掃不到。 */
const trackProfile = (name) => {
	const dir = join(tmpdir(), name);
	profiles.push(dir);
	return dir;
};
const sweepProfiles = () => {
	/* **刪成功了才從清單移除。**先前是 `profiles.splice(0)` 先清空再刪，於是
	   `catch {}` 吞掉的每一次失敗都永遠沒有第二次機會（exit 監聽器拿到空陣列）。
	   而 Chrome 還活著時 `rmSync` 必然 EPERM——SIGINT 那條路又沒有先 killTree，
	   所以每按一次 Ctrl-C 就留下一批。實測 %TEMP% 又累積了 77 個、約 1GB。 */
	for (let i = profiles.length - 1; i >= 0; i--) {
		try {
			rmSync(profiles[i], { recursive: true, force: true, maxRetries: 3 });
			profiles.splice(i, 1);
		} catch {}
	}
};

/* 掛在 exit 上，不是逐個出口各呼叫一次——**預設模式（`npm run verify:field`）
   先前就是漏掉的那一個**，而它是最常跑的一條路。`process.exit()` 會同步跑
   exit 監聽器，`rmSync` 也是同步的，所以這樣就夠。 */
process.on('exit', sweepProfiles);
/* `exit` 在 Ctrl-C 底下不會跑，而 `--lan` 的收工方式**寫在畫面上的就是 Ctrl-C**——
   不接這個訊號的話那條路每次都留下目錄。 */
process.on('SIGINT', async () => {
	// 先把 Chrome 收掉，否則它還握著設定檔目錄、rmSync 必然 EPERM
	await Promise.all([...live].map(killTree));
	sweepProfiles();
	process.exit(130);
});

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
			live.delete(child.pid);
			await killTree(child.pid);
			fn(v);
		};
		const timer = setTimeout(() => finish(reject, new Error(`逾時：${path} 沒有回報`)), ms);
		inbox = (r) => finish(resolve, r);
		const profile = trackProfile(`field-chrome-${process.pid}-${runs++}`);
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
		live.add(child.pid);
		child.on('error', reject);
	});
}

/* 閱讀頁的測試目標＝統計專案第一頁。2026-07-30 統計那四篇封存時，這裡臨時改指向
   AI 專案頁（那時 stats 分類是空的）；票 04 那一頁上線，改回統計閱讀頁。
   兩者的差別不只是網址：這一頁有就地展開區塊與切換器，AI 專案頁沒有。 */
const READING = '/projects/stats/prepay-and-spending/';

const PAGES = [
	['首頁', '/'],
	['閱讀頁', READING],
];

/**
 * 票 04：切換器。規格接縫三第 3 項——「切換器展開後，就地展開區塊的內容確實出現在
 * 可視文字裡」。靜態閘門看不到這件事（它讀的是 CSS 文字，不跑瀏覽器），所以它在這裡。
 *
 * 量四件事，最後一件是這一支自己的體檢：
 *   · 產物 HTML 裡按鈕帶著 `hidden` — 沒有 JS 的讀者看不到一個按不動的按鈕
 *   · 按一下 — 全部打開，而且那段文字真的進到可視文字裡
 *   · 再按一下 — 全部收回，那段文字真的離開可視文字
 *   · `?nowire=1` 把處理器拆掉之後，上面兩件事**必須量不到** — 不會紅的檢查不算檢查
 */
async function expandToggle() {
	console.log('══ 票 04 切換器 ══');
	let bad = 0;

	// 一、沒有 JS 的那一半：直接看產物 HTML，不必開瀏覽器
	const html = readFileSync(join(DIST, ...READING.split('/').filter(Boolean), 'index.html'), 'utf8');
	const btnTag = html.match(/<button[^>]*data-expand-all[^>]*>/)?.[0];
	if (btnTag?.includes('hidden')) {
		console.log('   ✓ 產物 HTML 裡按鈕帶著 hidden：沒有 JS 就沒有按鈕');
	} else {
		console.log(`   ✗ 產物 HTML 裡按鈕沒有 hidden：${btnTag ?? '（連按鈕都找不到）'}`);
		bad++;
	}

	// 二、自我證偽：處理器拆掉之後，按下去不該有任何事發生
	const dead = await run(`${READING}?expand=1&nowire=1`, [], 60000);
	if (dead.ok && !dead.after.sees && !dead.after.open.some(Boolean)) {
		console.log('   ✓ 故意拆掉處理器時，探針回報按下去什麼都沒開——這支檢查會紅');
	} else {
		console.log(`   ✗ 拆掉處理器仍回報有展開（${dead.why ?? JSON.stringify(dead.after)}）——這支檢查證明不了任何事`);
		bad++;
	}

	// 三、真的按
	const r = await run(`${READING}?expand=1`, [], 60000);
	if (!r.ok) {
		console.log(`   ✗ ${r.why}`);
		return bad + 1;
	}
	console.log(`   就地展開區塊 ${r.count} 塊　驗的那句話「${r.needle}…」`);
	const step = (label, got, want, extra = '') => {
		if (got === want) console.log(`   ✓ ${label}${extra}`);
		else {
			console.log(`   ✗ ${label}：拿到 ${got}，應該是 ${want}${extra}`);
			bad++;
		}
	};
	step('腳本跑起來之後按鈕出現', r.shown, true);
	step('起始態：那句話看不到', r.before.sees, false);
	step('按一下：全部打開', r.after.open.every(Boolean), true, `（${r.after.open.filter(Boolean).length}／${r.count} 塊）`);
	step('按一下：那句話出現在可視文字裡', r.after.sees, true);
	step('按一下：按鈕改口', r.after.label, '全部收合', `　aria-pressed=${r.after.pressed}`);
	step('再按一下：全部收回', r.back.open.some(Boolean), false);
	step('再按一下：那句話離開可視文字', r.back.sees, false);
	step('再按一下：按鈕改回來', r.back.label, '全部展開', `　aria-pressed=${r.back.pressed}`);
	return bad;
}

/**
 * 統計第一頁的三張靜態圖。**這一段取代原本的票 06／07／08 三段互動驗證**——
 * 2026-08-04 郁為判定統計頁不要互動（原話：「以統計分析頁來說，我個人覺得整個互動
 * 好像都有點沒必要，直接放對比圖反而還更好」），拖曳、滑桿、膠囊全部拆掉。
 *
 * **拆掉互動不等於拆掉守衛。**那三段裡最有價值的一項從來不是「拖得動嗎」，是
 * 「圖上的幾何與頁面上印的數字講的是同一件事」——那一項全部留著，只是不再需要
 * 先拖一下才量得到。另外多守一件新的事：內文裡不可以再剩下任何拖不動的控制項。
 *
 * 自我證偽在最後一步：把某一列的 `--pt` 改錯，只有那一列會紅（不會紅的檢查不算檢查）。
 */
async function staticCharts() {
	console.log('══ 第一頁的三張靜態圖 ══');
	let bad = 0;
	const step = (label, got, want, extra = '') => {
		if (got === want) console.log(`   ✓ ${label}${extra}`);
		else {
			console.log(`   ✗ ${label}：拿到 ${got}，應該是 ${want}${extra}`);
			bad++;
		}
	};

	// 一、沒有 JS 的那一半：直接看產物 HTML，不必開瀏覽器
	const html = readFileSync(join(DIST, ...READING.split('/').filter(Boolean), 'index.html'), 'utf8');
	step('產物 HTML 裡一個滑桿都沒有', /<input/.test(html), false);
	step('產物 HTML 裡沒有拖曳把手', /cs-wipe-handle/.test(html), false);
	step(
		'兩張對比圖都在產物 HTML 上（477 那張與 1,026 那張）',
		/definition-onsite-only\.png/.test(html) && /definition-in-taiwan-total\.png/.test(html),
		true,
	);
	step('分層模型不可與主模型對照那句話在頁面上', html.includes('換掉控制變數就是換了一個模型'), true);
	step(
		'跨過界線那一列的措辭是報告釘死的那一句',
		html.includes('本研究未能判定其關聯是否具實務意義'),
		true,
	);

	// 二、真的量幾何
	const r = await run(`${READING}?charts=1`, [], 60000);
	if (!r.ok) {
		console.log(`   ✗ ${r.why}`);
		return bad + 1;
	}

	step('內文裡一個互動控制項都不剩', r.leftovers.length, 0, r.leftovers.length ? `　剩下 ${r.leftovers.join('、')}` : '');
	step('兩張對比圖量得到寬度且都是 lazy', r.figs.length === 2 && r.figs.every((f) => f.width > 50 && f.lazy === 'lazy'), true,
		`　各 ${r.figs.map((f) => f.width.toFixed(1)).join(' / ')}px`);

	// 等效檢定：界線落在事前指定的 ±1%，兩列的幾何與判定同意
	step('等效帶的寬度換算回來就是事前指定的正負 1%', Math.abs(r.tost.edge - 1) < 0.05, true,
		`　量到 ±${r.tost.edge.toFixed(3)}%`);
	for (const row of r.tost.rows) {
		const want = row.verdict === '有實質差異' ? 'outside' : row.verdict === '等效' ? 'inside' : 'straddle';
		step(`「${row.name}」圖上的幾何與判定「${row.verdict}」同意`, row.geom, want);
	}

	// 六個市場：全部在零線右邊，且圖與字對得上
	step('六條信賴區間全部畫在零線的右邊', r.mkt.rows.every((g) => g.gap > 0), true,
		`　離零線最近的一條 ${Math.min(...r.mkt.rows.map((g) => g.gap)).toFixed(1)}px（${
			r.mkt.rows[r.mkt.rows.map((g) => g.gap).indexOf(Math.min(...r.mkt.rows.map((g) => g.gap)))].name
		}）`);
	const drift = Math.max(...r.mkt.rows.map((g) => Math.abs(g.implied - g.printed)));
	step('圖上的幾何與列上印的數字同意', drift < 0.05, true, `　最大差 ${drift.toFixed(3)} 個百分點`);

	// 三、自我證偽：把一列的 --pt 改錯，那一列必須紅
	const rigged = await run(`${READING}?charts=1&rigpt=1`, [], 60000);
	if (rigged.ok) {
		const off = rigged.mkt.rows.filter((g) => Math.abs(g.implied - g.printed) > 0.05).length;
		step('故意把一列的資料點畫錯時，對帳這一項會紅——這支檢查證明得了東西', off > 0, true,
			`　量到 ${off} 列對不起來`);
	} else {
		console.log(`   ✗ 自我證偽那一輪跑不起來：${rigged.why}`);
		bad++;
	}

	// 四、窄視窗不把整頁推寬（票 06 在這裡撞過：圖的寬度上限贏過 100% 那條保護）
	const narrow = await run(`${READING}?charts=1`, ['--window-size=500,900'], 60000);
	if (!narrow.ok) {
		console.log(`   ✗ 窄視窗那一輪：${narrow.why}`);
		return bad + 1;
	}
	step('窄視窗（500px）整頁沒有被推寬', narrow.page.scrollWidth <= narrow.page.clientWidth, true,
		`　scrollWidth ${narrow.page.scrollWidth}／clientWidth ${narrow.page.clientWidth}`);
	step('窄視窗下六條照樣全部在零線右邊', narrow.mkt.rows.every((g) => g.gap > 0), true);
	return bad;
}

/**
 * 執行期成本量測。**這一支會判定合格與否。**
 *
 *   node scripts/verify/field-runtime.mjs --runtime
 *
 * ── 這一輪要量的是什麼，先講清楚 ──────────────────────────────────────
 *
 * **第 4 層在票 02 是靜態的：它沒有常駐迴圈，所以沒有「每幀成本」可以量。**
 * 它唯一的支出是**建場**——版面改變時重擲整面記號再畫一次，一次性的。
 * 把一個一次性的支出寫成「每幀」會讓帳整個讀反（那正是票 04 學到的那件事，
 * 只是方向相反）。所以這裡量的是建場，並且照 `CONTEXT.md`「每幀預算」那條
 * 拆成兩項：
 *
 *   固定開銷　整面操作（清空、量文字帶、建畫布），隨畫布像素數走
 *   邊際成本　每一劃多少錢
 *
 * 拆法是**掃密度**：`?density=0` 那一檔一劃都不擲，量到的就是純固定開銷；
 * 其餘檔位減掉它再除以劃數，就是每一劃。只量一個點位反推不出容量。
 *
 * 對 11 ms 預算：建場落在一幀裡付掉，所以那一幀不能爆掉預算。
 *
 * 外加一件明文要求的事：**探針要能證明自己會紅**。每一次跑都用 `?kill=1`
 * 把場殺掉一次，探針必須回報「沒畫出來」——v9 抓到過一個動畫死透仍報「有在動」
 * 的探針，所以自我證偽不是選配。
 */
async function runtime() {
	const { FIELD } = await import(new URL('../palette-config.mjs', import.meta.url).href);
	const BUDGET = 11;
	/** 密度的檔位一律相對出貨值算，**不要在這裡寫死 3.85**——判準檔一改這支就分家了。 */
	const BASE_DENSITY = FIELD.density;
	let bad = 0;
	const ms = (v) => (v == null ? '—' : `${v.toFixed(2)} ms`);

	// ── 先證明這支探針會紅 ───────────────────────────────────────────────
	console.log('══ 探針的自我證偽 ══');
	const dead = await run('/?kill=1', [], 90000);
	if (dead.ok && dead.painted === 0) {
		console.log('   ✓ 故意讓場不畫（拿掉 data-field）時，探針回報畫布 0 個非零像素');
	} else {
		console.log(`   ✗ 故意讓場不畫，探針卻回報 painted=${dead.painted}——這支探針證明不了任何事`);
		bad++;
	}

	console.log('\n══ 建場成本（固定開銷／邊際成本分開列）══');
	for (const [name, path] of PAGES) {
		/* 兩個尺寸：固定開銷是整面操作，它隨畫布像素數變動，只量一個尺寸看不出
		   那件事是不是真的。 */
		for (const size of ['1280,720', '1920,1080']) {
			const flags = [`--window-size=${size}`];
			/* **要 `?nomotif=1`。**改版面那條路上背景設計也在重建（三張整面離屏遮罩＋
			   遠景層，實測 72–178ms），第 4 層的份額會整個落在雜訊裡——兩個量級差太多的
			   東西相減得到的是雜訊不是差額。所以讓它單獨走一次那條路。 */
			/* 三個密度檔位，**沒有一檔是 0**：密度 0 時畫布是空的，而「有沒有真的重擲」
			   是靠畫面指紋變了沒有在判——空畫布的指紋永遠一樣，那一檔會被自己的
			   守衛判成「沒觸發到」，於是固定開銷永遠量不到（第一版就是這樣）。
			   改成三個非零檔位做最小平方擬合，**固定開銷是截距**，不是某一檔的讀數。 */
			const runs = [];
			for (const d of [1, 0.5, 0.25]) {
				const r = await run(`${path}?runtime=1&nomotif=1&density=${(d * BASE_DENSITY).toFixed(4)}`, flags, 150000);
				runs.push({ d, r });
			}
			const [full] = runs.map((x) => x.r);
			if (!runs.every((x) => x.r.ok)) {
				console.log(`\n── ${name}　${size}　✗ ${runs.find((x) => !x.r.ok).r.why}`);
				bad++;
				continue;
			}
			console.log(`\n── ${name}　${full.vw}×${full.vh} DPR ${full.dpr}　畫布 ${((full.vw * full.vh * full.dpr * full.dpr) / 1e6).toFixed(2)} Mpx`);
			/* `builds` 只收「畫面真的變了」那幾次，所以要拿 rebuilt 對 tries 比，
			   不能拿它對 builds.length 比——後者永遠相等，等於這道檢查失效。 */
			for (const { d, r } of runs) {
				if (!r.ok) continue;
				console.log(
					`   密度 ×${String(d).padEnd(4)}（${String(r.marks).padStart(5)} 劃）　` +
						`重畫 中位 ${ms(r.redraw.med)}　最大 ${ms(r.redraw.max)}　｜　` +
						`冷啟動（重擲＋重畫）中位 ${ms(r.cold.med)}　最大 ${ms(r.cold.max)}` +
						`（${r.redraw.tries} 次改版面裡 ${r.redraw.rebuilt} 次畫面真的變了）`,
				);
				if (r.redraw.rebuilt !== r.redraw.tries) {
					console.log(`   ✗ 有 ${r.redraw.tries - r.redraw.rebuilt} 次沒觸發到重畫——那幾次不算數`);
					bad++;
				}
			}
			// 最小平方擬合 成本 = 固定開銷 + 每劃 × 劃數
			const fit = (pick) => {
				const xs = runs.map((x) => x.r.marks);
				const ys = runs.map(pick);
				const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
				const my = ys.reduce((a, b) => a + b, 0) / ys.length;
				const per =
					xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
				return { per, fixed: my - per * mx };
			};
			const rd = fit((x) => x.r.redraw.med);
			const cd = fit((x) => x.r.cold.med);
			console.log(`   ├ 重畫　　固定開銷 ${ms(rd.fixed)}　每一劃 ${(rd.per * 1000).toFixed(3)} µs`);
			console.log(`   └ 冷啟動　固定開銷 ${ms(cd.fixed)}　每一劃 ${(cd.per * 1000).toFixed(3)} µs`);
			console.log(
				`   出貨值（密度 ${full.density}／${full.marks} 劃）　重畫 ${ms(full.redraw.med)} ／ 預算 ${BUDGET} ms　` +
					`｜　冷啟動 ${ms(full.cold.med)}（一次性：載入與改視窗尺寸時各付一次）`,
			);
			console.log(`   繪製真的發生　畫布非零像素 ${full.painted} 個`);

			/* **對預算的只有重畫。**冷啟動是一次性支出（載入、改視窗尺寸），把它拿去比
			   每幀預算是類別錯誤——`CONTEXT.md`「預先建場」那一條講的正是這件事，
			   只是方向相反：那時是怕一次性支出被讀成「有時候會爆」。
			   重畫這個數字是**票 03 要的那一個**：浮現接到捲動之後，它會變成逐幀的。 */
			if (!(full.redraw.max <= BUDGET)) {
				console.log(`   ✗ 重畫最大 ${ms(full.redraw.max)} 超過 ${BUDGET} ms 預算——那一幀會掉`);
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
	}

	console.log(
		bad ? `\n✗ ${bad} 項不合格` : '\n✓ 重畫在預算內、繪製真的發生，且探針證明過自己會紅',
	);
	console.log('※ 手機那一組要另外跑：node scripts/verify/field-runtime.mjs --lan');
	return bad;
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
		console.log(`  閱讀頁  http://${ip}:${PORT}${READING}?runtime=1`);
	}
	console.log('\n收工按 Ctrl-C。等回報中……\n');
	const ms = (v) => (v == null ? '—' : `${v.toFixed(2)} ms`);
	inbox = (r) => {
		if (!r.ok) {
			console.log(`✗ ${r.why}`);
			return;
		}
		console.log(`── ${r.page}　${r.vw}×${r.vh} DPR ${r.dpr}　密度 ${r.density}／${r.marks} 劃`);
		/* **沒重擲就不印建場成本。**手機第一次跑就是這樣騙到我的：五個強迫寬度
		   全都比 402px 的視窗還寬，`main` 一動也不動、根本沒重擲，而「那段時間的
		   最大成本」照樣給出一個看起來很合理的 1.00ms。 */
		if (r.redraw?.rebuilt) {
			console.log(
				`   重畫 中位 ${ms(r.redraw.med)}　最大 ${ms(r.redraw.max)} ／ 預算 11 ms` +
					`（${r.redraw.tries} 次改版面裡 ${r.redraw.rebuilt} 次真的重畫）`,
			);
			if (r.cold) console.log(`   冷啟動（重擲＋重畫）中位 ${ms(r.cold.med)}　最大 ${ms(r.cold.max)}　一次性`);
		} else if (r.redraw) {
			console.log('   重畫 —（強迫改版面沒有觸發重畫，這一輪量不到，不編一個數字給你）');
		}
		console.log(
			`   畫布非零像素 ${r.painted}　最高不透明度 ${r.maxAlpha?.toFixed(3)}　主色像素 ${r.accent}（必須是 0）` +
				`　未捕捉例外 ${r.errors.length || '無'}\n`,
		);
	};
}

/**
 * 給人看的比對截圖。參數靠 `?reveal=` `?ink=` `?dim=` 從屬性換掉，
 * 不必為了看另一組值重新建置。
 *
 *   node scripts/verify/field-runtime.mjs --shots <輸出目錄>
 *
 * 兩題：**兩態長什麼樣**（出貨的表面態 vs 全開態），以及**強度該取哪一檔**。
 * 強度那一題只擺可用區間內的三檔（`FIELD_INK_RANGE`）——擺區間外的檔位是在問一個
 * 已經被實測否決的問題，看的人會挑到一個不能出貨的答案。
 */
async function shots(dir) {
	const { FIELD_INK_RANGE } = await import(new URL('../palette-config.mjs', import.meta.url).href);
	/* **要絕對路徑。**`--screenshot` 是相對於 Chrome 自己的工作目錄解析的，不是這支的——
	   傳相對路徑時它會安靜地把圖寫到別的地方，而這支照樣印「截圖產在 …」。實測過一次：
	   目錄裡一張圖都沒有，訊息卻是成功的。 */
	dir = resolve(dir);
	const shot = (path, name, size = '1440,900') =>
		new Promise((done, fail) => {
			const out = join(dir, name);
			const c = spawn(CHROME, [
				'--headless=new',
				'--disable-gpu',
				'--hide-scrollbars',
				`--window-size=${size}`,
				'--force-device-scale-factor=1',
				`--user-data-dir=${trackProfile(`field-shot-${process.pid}-${runs++}`)}`,
				`--screenshot=${out}`,
				`http://localhost:${PORT}${path}`,
			]);
			c.on('close', () => (existsSync(out) ? done() : fail(new Error(`沒有產出 ${out}`))));
		});
	const read = READING;
	const { min, max } = FIELD_INK_RANGE;
	const mid = Math.round(((min + max) / 2) * 100) / 100;

	// 第一題：兩態。表面態是出貨的樣子，全開態是票 03 接上捲動之後捲到底的樣子
	await shot('/', 'q1-home-surface.png');
	await shot('/?reveal=1', 'q1-home-full.png');
	await shot(read, 'q1-read-surface.png');
	await shot(`${read}?reveal=1`, 'q1-read-full.png');

	// 第二題：強度三檔，可用區間的下緣／中間／上緣。**全開態**，因為那是最壞的一態
	for (const v of [min, mid, max]) {
		await shot(`/?reveal=1&ink=${v}`, `q2-home-ink-${String(v).replace('.', '')}.png`);
	}

	// 第三題：文字帶減光在做什麼——現行對上完全不減光
	await shot(`${read}?reveal=1`, 'q3-read-dim-on.png');
	await shot(`${read}?reveal=1&dim=0`, 'q3-read-dim-off.png');
	console.log(`截圖產在 ${dir}`);
}

/* listen 的回呼裡丟例外的話，server 會留在綁定狀態、行程掛住，而下一次跑會變成
   EADDRINUSE——**這次真的踩到了**（刪 --signoff 時連帶砍掉三個函式，ReferenceError
   之後 4477 一直被佔著）。包起來，讓它印得出原因並且真的收掉。 */
const dispatch = async () => {
	/* `--pulse` 與 `--shockfilm` 隨回彈一起退場（背景敘事輪票 02）：那兩支拍的是
	   「捲動觸發整場位移」的節奏與逐格，而那條敘事已經丟回題庫。 */
	if (process.argv.includes('--lan')) {
		lan();
		return; // 不結束，等手機回報
	}
	const shotsAt = process.argv.indexOf('--shots');
	if (shotsAt >= 0) {
		// `--shots` 放在最後一個參數時 dir 是 undefined，join 會丟 TypeError，
		// 而這裡是 listen 的回呼、沒有 catch —— 結果是 server 不關、行程掛住
		const dir = process.argv[shotsAt + 1];
		if (!dir || !existsSync(dir)) {
			console.error(`用法：--shots <輸出目錄>${dir ? `（找不到 ${dir}）` : ''}`);
			server.close();
			process.exit(2);
		}
		await shots(dir);
		server.close();
		process.exit(0);
	}
	if (process.argv.includes('--runtime')) {
		const bad = await runtime();
		server.close();
		process.exit(bad ? 1 : 0);
	}
	let bad = await expandToggle();
	bad += await staticCharts();
	const pct = (v) => (v == null ? '—' : v.toFixed(4));
	for (const [name, path] of PAGES) {
		const on = await run(path, [], 90000);
		const off = await run(`${path}?nodim=1`, [], 90000);
		/* 循環的對照組：週期拉到極長，畫面上剩下的變化只有兩層各自的漂移。
		   沒有它的話「第 5 層有沒有在循環」量不出來——漂移在七秒半裡本來就讓畫面差很多。 */
		const slow = await run(`${path}?slowcycle=1`, [], 90000);
		console.log(`\n── ${name}　${path}`);
		for (const r of [on, off]) {
			if (!r.ok) {
				console.log(`   ✗ ${r.why}`);
				bad++;
				continue;
			}
			const tag = r.nodim ? '對照組 textDim=0' : `減光 textDim=${r.textDim}`;
			console.log(
				`   ${tag.padEnd(20)} 文字帶 ${r.band}　核心 ${pct(r.core)}　帶外 ${pct(r.out)}　比 ${pct(r.ratio)}`,
			);
			if (r.errors.length) {
				console.log(`   ✗ 未捕捉的例外：${r.errors.join(' ／ ')}`);
				bad++;
			}
			// 一、**它真的在畫**——從外部看畫布有沒有非零像素，不靠 console.log
			if (!r.painted) {
				console.log('   ✗ 整張畫布沒有任何非零像素——第 4 層根本沒畫出來');
				bad++;
			}
			/* 二、**主色不得溜進第 4 層**。2026-08-05 本人把這一層也改成點之後，
			   第 4 層與第 5 層的「形狀」通道就沒有了，**顏色是它們唯一還分得開的東西**。
			   閘門只驗得到屬性上的色碼，驗不到畫出來的像素——這一條是那件事的執行期守衛。 */
			if (r.accent) {
				console.log(
					`   ✗ 第 4 層的畫布上有 ${r.accent} 個元素主色的像素——` +
						'兩層都是點之後，顏色是它們唯一還分得開的通道，主色必須整個留給第 5 層',
				);
				bad++;
			}
		}
		if (!on.ok || !off.ok) continue;
		console.log(`   ✓ 它真的在畫（非零像素 ${on.painted} 個）　✓ 整層中性色（主色像素 0 個）`);

		/* 三、減光有沒有作用。**比的是同一塊地在兩組參數下的差別**，不是同一張圖裡
		   核心與帶外的比——這一層現在只有幾百顆點，一塊地裡剛好多幾顆少幾顆的雜訊，
		   在稀疏的層上會大到把那個比值推到 0.63（實測），而它其實完全正常。
		   拿「開減光的核心」對「關減光的核心」比就沒有這個問題：同一塊地、同一組點。 */
		const want = 1 - on.textDim;
		const got = off.core ? on.core / off.core : null;
		/* **對照組核心趨近零＝這一頁沒有受測對象，不是缺陷**（2026-08-08 密度砍半後撞到）：
		   密度 0.14 下首頁署名帶（約 444×61px）的期望點數只有 1.9 顆，固定種子下可以
		   一顆都沒有，0÷0 驗不出任何事。這時跳過而不是紅——機制本身由其他頁驗
		   （閱讀頁的帶大得多，點永遠夠）。門檻取 3×10⁻⁵：比任何一顆真點的貢獻都小。 */
		if (off.core < 0.00003) {
			console.log(
				`   … 減光無對象未驗：對照組核心 ${pct(off.core)}（帶內沒有點可減），機制由閱讀頁驗`,
			);
		} else if (!(got != null && got < want + 0.25)) {
			console.log(
				`   ✗ 減光沒有作用：開了減光的核心是關掉的 ${pct(got)} 倍，判準檔說該是 ${want.toFixed(2)} 上下`,
			);
			bad++;
		} else {
			console.log(
				`   ✓ 減光有作用：核心 ${pct(on.core)} vs 關掉 ${pct(off.core)}（比 ${pct(got)}，判準檔 ${want.toFixed(2)}）`,
			);
		}

		/* 五、**循環真的在跑。**相位是算出來的、沒有任何狀態，所以「它到底有沒有在動」
		   只有量畫布才知道——判的是「隔四分之一圈之後的變化明顯高於底噪」，
		   而**底噪要先量**（抗鋸齒本來就會讓兩張圖有微小差異，不扣掉的話答案永遠是「有」）。 */
		const c = on.cycle;
		if (!c) {
			console.log('   ✗ 沒有量到動態——這一頁沒有第 5 層，或它沒有帶 data-cycle');
			bad++;
		} else if (!c.hasMotif) {
			/* 閱讀頁 2026-08-05 起**沒有第 5 層**（本人：「我只要不隨滾動移動的那層就好」）。
			   那一頁要判的只剩「第 4 層在不在飄」——而它非判不可：那一層是那一頁**唯一**
			   還在動的東西，掉了的話畫面看起來就只是一張很淡的靜態底。 */
			console.log(`   飄動　隔 ${c.seconds}s 取樣　第 4 層 ${c.fieldMoved}（底噪 ${c.fieldNoise}）　這一頁沒有第 5 層`);
			if (!(c.fieldMoved > Math.max(4 * c.fieldNoise, 500))) {
				console.log(
					`   ✗ 第 4 層沒有在飄——變化 ${c.fieldMoved}、底噪 ${c.fieldNoise}（門檻 ${Math.max(4 * c.fieldNoise, 500)}）`,
				);
				bad++;
			} else {
				console.log('   ✓ 第 4 層真的在飄');
			}
		/* 「沒有第 5 層」與「有第 5 層但沒有循環」2026-08-05 之後是同一件事——
		   那一層只剩一種模式，有它就有循環。所以這裡只有兩條路，不是三條。 */
		} else if (!slow.ok || !slow.cycle) {
			console.log('   ✗ 循環的對照組沒有回報，這一輪的循環結論不算數');
			bad++;
		} else {
			/* 判的是「**把週期拉長之後，第 5 層的變化明顯掉下來**」。
			   第 4 層不參與循環（它只是一直在飄），所以它在兩組之間本來就該差不多——
			   那正好是這個對照組沒有壞掉的證據，一起印出來。 */
			/* 判的是**聚攏程度真的變了**——中間那條窄帶的垂直散佈，散開時大、聚攏時小。
			   不用「畫面差多少」：那個量法會飽和（點移動超過自己的大小就到頂），
			   移 10px 與移 240px 量起來一樣，實測比只有 1.41 而其實循環跑得好好的。 */
			const d0 = c.spread0;
			const d1 = c.spread1;
			const change = d0 != null && d1 != null ? Math.abs(d1 - d0) / d0 : null;
			const sd0 = slow.cycle.spread0;
			const sd1 = slow.cycle.spread1;
			const slowChange = sd0 != null && sd1 != null ? Math.abs(sd1 - sd0) / sd0 : null;
			console.log(
				`   循環　一圈 ${c.period}s，隔 ${c.seconds}s 取樣　縱切五條的垂直散佈 ` +
					`${pct(d0)} → ${pct(d1)}（變了 ${change == null ? '—' : (change * 100).toFixed(0) + '%'}）　` +
					`對照組（週期拉到極長）${pct(sd0)} → ${pct(sd1)}（${slowChange == null ? '—' : (slowChange * 100).toFixed(0) + '%'}）`,
			);
			console.log(
				`   　　　第 4 層變化 ${c.fieldMoved}　對照組 ${slow.cycle.fieldMoved}` +
					'（第 4 層不參與循環，兩組本來就該差不多）',
			);
			if (!(c.fieldMoved > Math.max(4 * c.fieldNoise, 500))) {
				console.log(
					`   ✗ 第 4 層沒有在飄——變化 ${c.fieldMoved}、底噪 ${c.fieldNoise}（門檻 ${Math.max(4 * c.fieldNoise, 500)}）`,
				);
				bad++;
			}
			if (!(change != null && change > 0.15 && (slowChange == null || change > slowChange * 3))) {
				console.log(
					'   ✗ 第 5 層的循環沒有在跑：縱切五條的垂直散佈幾乎沒變，' +
						'或者把週期拉到極長之後它照樣變——前者是循環沒接上，後者是量到的其實是漂移',
				);
				bad++;
			} else {
				console.log('   ✓ 兩層都真的在動，而且第 5 層的聚攏確實來自循環');
			}
		}
	}

	/* 降低動態偏好：**空間位移必須全關**，但點還是要在（那個偏好要關的是位移，
	   不是把畫面清空）。這一條是可及性的硬下限，不吃任何例外。 */
	console.log('\n── 降低動態偏好（首頁）');
	const rm = await run('/', ['--force-prefers-reduced-motion'], 90000);
	if (!rm.ok) {
		console.log(`   ✗ ${rm.why}`);
		bad++;
	} else if (!rm.cycle?.reduced) {
		console.log('   ✗ 瀏覽器沒有照旗標回報偏好，這一輪的結論不算數');
		bad++;
	} else if (!rm.painted) {
		console.log('   ✗ 開了降低動態偏好之後整張畫布是空的——那個偏好要關的是位移，不是把點清掉');
		bad++;
	} else {
		const moved = rm.cycle.fieldMoved > Math.max(4 * rm.cycle.fieldNoise, 500);
		console.log(
			`   非零像素 ${rm.painted}　第 4 層變化 ${rm.cycle.fieldMoved}（底噪 ${rm.cycle.fieldNoise}）`,
		);
		if (moved) {
			console.log('   ✗ 降低動態偏好下第 4 層仍在位移——可及性是硬下限');
			bad++;
		} else {
			console.log('   ✓ 位移全關，點還在');
		}
	}

	server.close();
	console.log(
		bad
			? `\n✗ ${bad} 項不合格`
			: '\n✓ 兩層都真的在畫、第 4 層整層中性色、減光有作用、循環真的在跑，且降低動態偏好下位移全關',
	);
	process.exit(bad ? 1 : 0);
};

/* **預設一定要綁 localhost。**`host` 傳 `undefined` 時 Node 綁的是 `::`（雙堆疊全介面），
   所以先前「只有 --lan 才對區網開放」是錯的——每一次 `npm run verify:field` 都對區網開著。
   第二輪抗辯實測 `listen(0, undefined)` 回 `{"address":"::"}`。 */
server.on('error', (e) => {
	console.error(
		e.code === 'EADDRINUSE'
			? `✗ 埠 ${PORT} 已經有人在聽——另一個 field-runtime 還在跑？`
			: `✗ 伺服器錯誤：${e.message}`,
	);
	process.exit(1);
});

server.listen(PORT, process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1', () => {
	dispatch().catch((e) => {
		console.error(`
✗ ${e.message}`);
		server.close();
		process.exit(1);
	});
});
