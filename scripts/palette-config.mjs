/**
 * 設計系統判準的資料面：白名單、色階、尺度、階梯、例外清單。
 * 判準的推導與理由在 SPEC-design-system.md 與 SPEC-motion-and-shape.md，這裡只放值。
 *
 * 後續票要做的事就是編輯這個檔（換值、清例外），verify-palette.mjs 不用動。
 */

// ---------------------------------------------------------------------------
// 中性色階（10 階）：L 等距 ΔL=8、C 隨 L 線性遞減、H 全階 335
// 兩端為凍結／既有值，其餘取公式值。
// ---------------------------------------------------------------------------
export const NEUTRAL_RAMP = {
	50: '#20131d',
	100: '#342630',
	200: '#483a45',
	300: '#5d505a',
	400: '#736770',
	500: '#8a7f87',
	600: '#a2979f',
	700: '#bab0b7',
	800: '#d2cad0',
	900: '#ebe5eb',
};

/**
 * 每一階的推導參數。色相全階固定 335，故不逐階列。
 * 判準驗的是「列出的 hex 等於這組參數的公式值」，不是「hex 量回來的色相是 335」——
 * 在 C≈.02 的低彩度下，8 位元量化本身就會讓色相飄兩度，量 hex 的色相是錯的測法。
 */
export const RAMP_SPEC = {
	50: { L: 20.8, C: 0.03, anchor: '背景主色凍結值' },
	100: { L: 28.8, C: 0.028 },
	200: { L: 36.8, C: 0.026 },
	300: { L: 44.8, C: 0.023 },
	400: { L: 52.8, C: 0.021 },
	500: { L: 60.8, C: 0.019 },
	600: { L: 68.8, C: 0.017 },
	700: { L: 76.8, C: 0.014 },
	800: { L: 84.8, C: 0.012 },
	900: { L: 92.8, C: 0.01, anchor: '既有內文色' },
};

export const RAMP_RULES = {
	hue: 335,
	deltaL: 8,
	deltaLTolerance: 0.5,
	chromaEnds: [0.03, 0.01], // C 隨 L 線性遞減
	chromaTolerance: 0.0006,
	/** 列出的 hex 與公式值的最大色差（純量化誤差的量級） */
	formulaDeltaEok: 0.004,
	/** 錨點沿用既有字面值，允許稍大但仍在感知門檻之下的偏離 */
	anchorDeltaEok: 0.01,
};

// ---------------------------------------------------------------------------
// 圖表色：本檔為「現況」值，票 07 換成 SPEC 的新配對後同步改這裡。
// ---------------------------------------------------------------------------
export const CATEGORICAL = ['#548bd4', '#c97a48'];
export const SEQUENTIAL = ['#2a1a26', '#3b3f63', '#548bd4', '#9fc2ee'];

/** 類別色在 protan／deutan／tritan 模擬下的最壞 ΔEok 下限（本站自訂基準，SPEC-design-system）。 */
export const CVD_MIN_DELTA_EOK = 0.185;

/** 連續色帶：L 需單調遞增，且各步距與平均步距的偏差不得超過此值（節點 3 受色域裁切）。 */
export const SEQUENTIAL_STEP_TOLERANCE = 1.0;

// ---------------------------------------------------------------------------
// 色碼白名單
// ---------------------------------------------------------------------------

/** 網站自己的色（`global.css` 與 `/process/` 九頁共用的中性家族＋元素主色） */
export const SITE_PALETTE = {
	'#20131d': '背景主色（凍結）／中性階 50',
	'#20131dd9': '導覽列半透明底＝背景主色 85%',
	'#2f1e2b': '卡底（票 06 重新分配層級前的現況）',
	'#33222f': 'hover 底（現況）',
	'#3d2e3a': '邊框（現況）',
	'#56506a': '邊框強（現況，色相 295 偏冷，票 02 拉正）',
	'#a79aa5': 'muted 文字（現況）',
	'#ebe5eb': '內文色／中性階 900',
	'#f2ecf2': 'hover 文字',
	'#2a1829': '背景漸層的黑莓暗暈',
	'#1d1119': '頁面最底層',
	'#191017': 'favicon 底板（2026-07-19 曾因不在清單上而漏掃）',
	'#7998c3': '元素主色（凍結）',
	'#7998c355': '捲軸拉桿＝元素主色 33%',
	'#7998c31a': '背景漸層＝元素主色 10%（建置後由 rgba() 縮寫而來）',
	'#0000': 'transparent 的縮寫（建置產生）',
};

/** 中性階新增的階（票 02 起會出現在產物裡；先列入白名單，expand 階段兩組並存） */
export const RAMP_PALETTE = Object.fromEntries(
	Object.entries(NEUTRAL_RAMP).map(([step, hex]) => [hex, `中性階 ${step}`]),
);

/**
 * `/process/` 示範元件內的歷史展示色——凍結不遷移（CLAUDE.md 換色協議排除清單）。
 * 這些是「當時對話裡長那樣的元件」的內容，不是本站的色彩。
 */
export const FROZEN_DEMO_PALETTE = {
	'#0d0e10': 'talks-transition 示範元件底',
	'#191018': 'talks-transition 示範元件底（次深）',
	'#26292c': 'talks-transition 示範元件邊框',
	'#24282c': 'talks-motion 示範元件底',
	'#c6c4bd': 'talks-motion 示範元件文字',
	'#ffffff0d': 'talks-cards 示範元件的白色薄層',
	'#fff': 'talks-cards／talks-motion 示範元件',
	'#0009': 'talks-buttons 示範元件陰影',
};

/** 示意色：色相由詞義決定，只約束 L 落在階 600–700 區、C ≤ .073、對背景對比 ≥4.5。 */
export const ILLUSTRATIVE_PALETTE = {
	'#a48fe6': '色彩故事頁「紫」',
	'#d97b7b': '色彩故事頁「紅」',
	'#7ea6dd': '色彩故事頁「藍」',
	'#6b90da': '色彩故事頁「藍紫」',
};

export const ILLUSTRATIVE_RULES = { minL: 68.8, maxL: 76.8, maxC: 0.073, minContrast: 4.5 };

/** 圖表 PNG 允許出現的端點色。像素若落在任兩個端點的連線上（抗鋸齒／漸層），視為合格。 */
export const PNG_PALETTE = {
	'#20131d': '圖表背景＝網站背景主色',
	'#2f1e2b': '圖表面板底',
	'#3d2e3a': '格線',
	'#a79aa5': '次要標註文字',
	'#ebe5eb': '主要標註文字',
	'#1a1016': '淺色熱圖格上的深色數字（現況值，票 07 對映到階）',
	...Object.fromEntries(CATEGORICAL.map((c) => [c, '類別色'])),
	...Object.fromEntries(SEQUENTIAL.map((c) => [c, '連續色帶節點'])),
};

/** PNG 判準：低於此比例的像素視為抗鋸齒雜訊不追究；容差為 sRGB 各通道最大差（4/255 ≈ 1.6%）。 */
export const PNG_MIN_PIXEL_RATIO = 0.0005;
export const PNG_SEGMENT_TOLERANCE = 4;

// ---------------------------------------------------------------------------
// 對比度配對
// 值一律由產物的 `:root` 解析，這裡只宣告「誰疊在誰上面」。
// ---------------------------------------------------------------------------
export const CONTRAST_PAIRS = [
	{ fg: 'var(--color-text)', bg: '#1d1119', where: '內文 on 頁底' },
	{ fg: 'var(--color-text)', bg: '#2a1829', where: '內文 on 背景暗暈' },
	{ fg: 'var(--color-text-muted)', bg: '#1d1119', where: 'muted on 頁底' },
	{ fg: 'var(--color-text-muted)', bg: '#2a1829', where: 'muted on 背景暗暈' },
	{ fg: 'var(--color-accent)', bg: '#1d1119', where: '連結 on 頁底' },
	{ fg: 'var(--color-accent)', bg: '#2a1829', where: '連結 on 背景暗暈' },
	{ fg: 'var(--color-text)', bg: 'var(--color-bg-alt)', where: '卡片標題 on 卡底' },
	{ fg: 'var(--color-text-muted)', bg: 'var(--color-bg-alt)', where: '卡片摘要 on 卡底' },
	{ fg: 'var(--color-accent)', bg: 'var(--color-bg-alt)', where: '角標卡強調 on 卡底' },
	{ fg: '#f2ecf2', bg: '#33222f', where: '角標卡 hover 文字 on hover 底' },
	{ fg: 'var(--color-text)', bg: '#33222f', where: '決策開關 hover 文字 on hover 底' },
	{ fg: 'var(--color-text-muted)', bg: '#33222f', where: 'muted on hover 底' },
	{ fg: 'var(--color-bg)', bg: 'var(--color-accent)', where: '選取文字／按鈕 active（深字反白）' },
	{ fg: 'var(--color-text-muted)', bg: 'var(--color-bg)', where: '導覽列 on 導覽列底' },
	{ fg: 'var(--color-text)', bg: 'var(--color-bg)', where: '導覽列當前頁 on 導覽列底' },
	{
		fg: 'var(--color-border)',
		bg: '#1d1119',
		where: '標籤前的 `#` 與統計列的分隔符（裝飾性字元）',
		decorative: true,
	},
];

export const CONTRAST_MIN = 4.5;

// ---------------------------------------------------------------------------
// 排版尺度（九階，clamp 兩端）
// 手機 375px：base 1.0rem、r=1.1808；桌機 1440px：base 1.125rem、r=1.2585。
// 階 −1 的手機值釘死 0.875rem（14px 硬下限優先於等比）。
// ---------------------------------------------------------------------------
export const TYPE_SCALE = [
	{ step: -1, mobile: 0.875, desktop: 0.894, lineHeight: 2.02 },
	{ step: 0, mobile: 1.0, desktop: 1.125, lineHeight: 1.9 },
	{ step: 1, mobile: 1.181, desktop: 1.416, lineHeight: 1.78 },
	{ step: 2, mobile: 1.394, desktop: 1.782, lineHeight: 1.66 },
	{ step: 3, mobile: 1.646, desktop: 2.242, lineHeight: 1.54 },
	{ step: 4, mobile: 1.944, desktop: 2.822, lineHeight: 1.42 },
	{ step: 5, mobile: 2.295, desktop: 3.552, lineHeight: 1.3 },
	{ step: 6, mobile: 2.71, desktop: 4.47, lineHeight: 1.18 },
	{ step: 7, mobile: 3.2, desktop: 5.625, lineHeight: 1.06 },
];

/** 字重：Sans 只載 400/500，Serif 只載 400/600。 */
export const ALLOWED_FONT_WEIGHTS = ['400', '500', '600', 'normal', 'bold', 'inherit'];

/** 字距三檔：內文 0、襯線大標 .06em、短標籤 .04em。 */
export const ALLOWED_LETTER_SPACING = ['0', '0em', 'normal', '0.06em', '0.04em'];

// ---------------------------------------------------------------------------
// 間距兩組階梯
// 版面間距基線＝內文行高 1.9 × 1.125rem = 2.1375rem；元件內間距自成小階梯。
// ---------------------------------------------------------------------------
export const RHYTHM_BASE_REM = 2.1375;
export const LAYOUT_MULTIPLES = [0.5, 0.75, 1, 1.5, 2, 3, 4];
export const COMPONENT_SPACING_PX = [4, 8, 12, 16];

export const SPACING_PROPERTIES = [
	'margin',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'margin-block',
	'margin-inline',
	'padding',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'padding-block',
	'padding-inline',
	'gap',
	'row-gap',
	'column-gap',
];

// ---------------------------------------------------------------------------
// 動效
// ---------------------------------------------------------------------------
export const DURATION_TIERS = ['0.35s', '0.25s', '0.15s'];
export const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

// ---------------------------------------------------------------------------
// 例外清單
// 現況的既有違規列在這裡，由後續票逐條清空。**不得用放寬判準的方式換綠燈。**
// 第 6 類（降低動態偏好覆蓋）不得有例外——可及性是硬下限。
// ---------------------------------------------------------------------------
const group = (keys, reason, clearedBy) => keys.map((key) => ({ key, reason, clearedBy }));

export const EXCEPTIONS = {
	contrast: group(
		['#3d2e3a on #1d1119'],
		'標籤前的 `#` 與統計列的 `·` 分隔符，皆為裝飾性字元。是否納入 4.5 判準待本人裁決；票 06 重新分配邊框階後複驗。',
		'票 06',
	),

	opacity: group(
		['.cs-track .cs-side--ai'],
		'宣告 #a79aa5（對卡底 5.82）加 opacity .65，實際渲染 #7d6f7a 對比 3.30——`opacity` 表達文字層級的判準違規。',
		'票 06',
	),

	// 現況的語義色沒有一個落在中性階上（階本身尚未建立）。
	offramp: [
		...group(
			['#2f1e2b', '#33222f', '#3d2e3a', '#56506a', '#a79aa5', '#f2ecf2'],
			'現況語義色，中性階建立後改為指向階值。',
			'票 02',
		),
		...group(
			['#2a1829', '#1d1119'],
			'背景漸層的暗暈與頁面底層，兩者都不在階上；對映哪一階或列為永久例外由票 02 決定。',
			'票 02',
		),
		...group(['#191017'], 'favicon 底板，2026-07-19 盤點時曾因不在換色協議清單上而漏掃。', '票 03'),
	],

	// 連續色帶的現況節點步距為 14／25／17，正是判準要修掉的假邊界。
	ramp: group(['band 0', 'band 1', 'band 2'], '現況熱圖色帶 L 步距不等距（14／25／17），造成假分界。', '票 07'),

	illustrative: group(
		['#a48fe6', '#d97b7b', '#7ea6dd', '#6b90da'],
		'色彩故事頁的四個示意色彩度超過 .073 上限、部分 L 不在 600–700 區。',
		'票 03',
	),

	// 現況 29 個間距值。
	spacing: group(
		[
			'間距 48.0px', '間距 24.0px', '間距 72.0px', '間距 128.0px', '間距 224.0px', '間距 17.6px',
			'間距 2.4px', '間距 8.8px', '間距 64.0px', '間距 40.0px', '間距 36.0px', '間距 6.4px',
			'間距 20.0px', '間距 -20.0px', '間距 9.6px', '間距 12.8px', '間距 22.4px', '間距 7.2px',
			'間距 11.2px', '間距 14.4px', '間距 0.8px', '間距 13.6px', '間距 10.4px', '間距 38.4px',
			'間距 -6.4px', '間距 19.2px', '間距 4.8px', '間距 3.2px', '間距 32.0px',
		],
		'現況 29 個間距值，尚未收斂到版面節奏與元件內兩組階梯。',
		'票 05',
	),

	// 現況 20 個字級值＋兩個斷點的 html font-size＋首頁 clamp、4 個字距值、46 條缺 line-height 的規則。
	typography: [
		...group(
			[
				'字級 .75rem', '字級 .78rem', '字級 .8rem', '字級 .82rem', '字級 .85rem', '字級 .86rem',
				'字級 .88rem', '字級 .9rem', '字級 .92rem', '字級 .94rem', '字級 .95rem', '字級 1.02rem',
				'字級 1.05rem', '字級 1.08rem', '字級 1.1rem', '字級 1.15rem', '字級 1.2rem', '字級 1.45rem',
				'字級 1.6rem', '字級 1.9rem', '字級 clamp(3.2rem,10vw,5.5rem)', '字級 17.5px', '字級 19px',
			],
			'現況 20 個字級值（其中十個擠在 0.78–0.95rem）＋首頁 v7 的原型 clamp ＋ 1440／1920 斷點的 html font-size。',
			'票 04',
		),
		...group(
			['字距 .01em', '字距 .02em', '字距 .05em', '字距 .08em'],
			'現況字距六個值，判準收成三檔（0／.06em／.04em）。',
			'票 04',
		),
		...group(
			[
				'缺 line-height：html', '缺 line-height：footer', '缺 line-height：main>h1',
				'缺 line-height：.site-nav a', '缺 line-height：.site-nav .nav-brand', '缺 line-height：.nav-progress',
				'缺 line-height：.hero p', '缺 line-height：.entry-links a', '缺 line-height：.intro',
				'缺 line-height：.category h2', '缺 line-height：.card h3', '缺 line-height：.card p',
				'缺 line-height：.back-link', '缺 line-height：.category-label', '缺 line-height：.tags li',
				'缺 line-height：.links a', '缺 line-height：.cs-lead', '缺 line-height：.cs-stats',
				'缺 line-height：.cs-stats b', '缺 line-height：.cs-wipe-invite', '缺 line-height：.cs-wipe-handle:after',
				'缺 line-height：.cs-wipe-tag', '缺 line-height：.cs-wipe-hint', '缺 line-height：.cs-toggle-name',
				'缺 line-height：.cs-side', '缺 line-height：.cs-side em', '缺 line-height：.cs-reason',
				'缺 line-height：.cs-evi', '缺 line-height：.cs-pair em', '缺 line-height：.cs-raw',
				'缺 line-height：.cs-rawchip', '缺 line-height：.content details summary', '缺 line-height：.content details p',
				'缺 line-height：.content h2', '缺 line-height：.tl-era h2', '缺 line-height：.tl-era p',
				'缺 line-height：.tl-solo', '缺 line-height：.tl-solo em', '缺 line-height：.st-table',
				'缺 line-height：.st-table thead th', '缺 line-height：.st-note', '缺 line-height：.st-sub',
			],
			'設了 font-size 卻沒設 line-height 的規則——`main > h1` 現況即因此吃到 body 的 1.65。',
			'票 04',
		),
	],
};
