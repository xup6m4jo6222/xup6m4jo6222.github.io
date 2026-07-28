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
// 圖表色（判準值）。票 02 已定義成 token，票 07 才套用到 21 張圖上。
// ---------------------------------------------------------------------------
export const CATEGORICAL = ['#6e8eb8', '#dedba3'];
export const SEQUENTIAL = ['#20121d', '#5c4e68', '#9497bf', '#c7eaff'];

/** 票 07 已把 21 張圖依新色票重跑，舊圖表色全數退場。 */
export const PNG_LEGACY = {};

/** 類別色在 protan／deutan／tritan 模擬下的最壞 ΔEok 下限（本站自訂基準，SPEC-design-system）。 */
export const CVD_MIN_DELTA_EOK = 0.185;

/** 連續色帶：L 需單調遞增，且各步距與平均步距的偏差不得超過此值（節點 3 受色域裁切）。 */
export const SEQUENTIAL_STEP_TOLERANCE = 1.0;

// ---------------------------------------------------------------------------
// 色碼白名單
// ---------------------------------------------------------------------------

/** 網站自己的色。中性家族一律取自階（見 RAMP_PALETTE），這裡只剩凍結色與其衍生。 */
export const SITE_PALETTE = {
	'#20131deb': '導覽列半透明底＝背景主色 92%',
	'#2a1829': '背景漸層的黑莓暗暈',
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
	'#9d92c4': '色彩故事頁「藍紫色」（L 68.8 ／ 原 #a48fe6）',
	'#c48988': '色彩故事頁「紅色」（L 68.8 ／ 原 #d97b7b）',
	'#96b6e2': '色彩故事頁「藍色」（L 76.8 ／ 原 #7ea6dd）',
	'#839bc9': '色彩故事頁「深藍」（L 68.8，比上面那個藍暗一階 ／ 原 #6b90da）',
};

/** 判準訂在設計值上，量到的是 8 位元量化後的 hex，故留一個量化容差。 */
export const ILLUSTRATIVE_RULES = {
	minL: 68.8,
	maxL: 76.8,
	maxC: 0.073,
	minContrast: 4.5,
	lTolerance: 0.3,
	cTolerance: 0.001,
};

/** 圖表 PNG 允許出現的端點色。像素若落在任兩個端點的連線上（抗鋸齒／漸層），視為合格。 */
export const PNG_PALETTE = {
	[NEUTRAL_RAMP[50]]: '圖表背景＝中性階 50',
	[NEUTRAL_RAMP[100]]: '圖表面板底＝中性階 100',
	[NEUTRAL_RAMP[200]]: '格線＝中性階 200',
	[NEUTRAL_RAMP[600]]: '次要標註文字＝中性階 600',
	[NEUTRAL_RAMP[900]]: '主要標註文字＝中性階 900',
	...Object.fromEntries(CATEGORICAL.map((c) => [c, '類別色'])),
	...Object.fromEntries(SEQUENTIAL.map((c) => [c, '連續色帶節點'])),
	...PNG_LEGACY,
};

/** PNG 判準：低於此比例的像素視為抗鋸齒雜訊不追究；容差為 sRGB 各通道最大差（4/255 ≈ 1.6%）。 */
export const PNG_MIN_PIXEL_RATIO = 0.0005;
export const PNG_SEGMENT_TOLERANCE = 4;

// ---------------------------------------------------------------------------
// 對比度配對
// 值一律由產物的 `:root` 解析，這裡只宣告「誰疊在誰上面」。
// ---------------------------------------------------------------------------
/**
 * 頁面背景不是單一色，量純底會漏掉最壞的那個：
 *   1. body 疊了兩道 `background-attachment: fixed` 的 radial 漸層（0% stop 不透明）
 *   2. 其上還有一層顆粒材質，`mix-blend-mode: soft-light` ＋ 17% 不透明
 *
 * **顆粒層只影響頁面背景，不影響元件填色。**`body::before` 的 `z-index: -1` 讓它畫在
 * 內容之下、頁面背景之上，所以 `.card`／`.cs-track` 這些有不透明底的表面不吃顆粒。
 * 不要把這句話反過來讀——照反的去「修正」程式碼會讓模型變錯。
 *
 * 兩個端點取材質的**真實極值**（不是分位數）：判準自己寫「對所有狀態都合格」，
 * 那就不能只模中間 98%。值由 `verify-palette.mjs` 直接讀 `public/textures/grain.png`
 * 核對——沒有這道核對，材質哪天被換掉，整個「渲染值」模型就悄悄變回虛構。
 */
export const GRAIN = { alpha: 0.17, low: 27, high: 224, texture: 'public/textures/grain.png' };

const surface = (spec, label) => [
	{ bg: spec, label },
	{ bg: `grain:${GRAIN.low}/${spec}`, label: `${label}＋顆粒暗處` },
	{ bg: `grain:${GRAIN.high}/${spec}`, label: `${label}＋顆粒亮處` },
];

export const PAGE_SURFACES = [
	...surface('var(--color-bg)', '頁底'),
	...surface('var(--color-bloom-dark)', '黑莓暗暈'),
	...surface('bloom:var(--color-accent)@0.1/var(--color-bg)', '藍暈峰值'),
];

/** 疊在頁底上的東西：九種背景狀態全部量，回報時只印最壞的那一個。 */
const onPage = (fg, what, min) => ({ fg, bgs: PAGE_SURFACES, where: `${what} on 頁底（含漸層與顆粒）`, min });

export const CONTRAST_PAIRS = [
	onPage('var(--color-text)', '內文'),
	onPage('var(--color-text-muted)', 'muted'),
	/**
	 * 元素主色當文字色的**允許清單**。疊在頁底九種狀態都 ≥4.5 只證明「看得見」，
	 * 不證明「該用在這裡」——所以這一組帶 `fgOn`，認領的是清單上的選擇器，
	 * 不是「主色可以當文字色」這張通行證（見 verify-palette.mjs 的認領邏輯）。
	 *
	 * **清單即規則**（票 02 收斂完成）。落點只有兩類：
	 *   1. 內文連結靜止態——`a`
	 *   2. 靜止態已在中性階頂端（n-900）的互動元素，其 hover 態——五處
	 * 外加一處非連結但屬互動控制的把手字符（`.cs-wipe-handle:after`，圓形把手上的 ↔，
	 * 靜止態就是主色、與它自己的框同色）。共 **7 條**，`src/` 裡不在其上而把主色
	 * 當文字色的一律紅。
	 *
	 * 票原文寫「收斂到八個」，這裡是七條——差在推導表把內文連結寫成一列兩個選擇器
	 * （`a` ／ `.content a`），但 `.content a` 只設點狀底線、沒有自己的 `color`，
	 * 所以進不了這份清單（列進來會因為「文字色必須是 fg」那道斷言直接紅）。
	 * 九處改動逐條核對過，一處不多一處不少。
	 *
	 * 退場的九條見 SPEC-accent-text-semantics。`/process/` 七頁的 41 處由 SPEC 明文豁免，
	 * 閘門的 `siteRules` 本來就不含那幾頁。
	 *
	 * **列進來是雙向的**：`fgOn` 同時啟用「這條規則的文字色必須是 fg」那道斷言，
	 * 所以清單只能列真的在用主色的選擇器，多列一條會直接讓閘門紅。
	 */
	{
		...onPage('var(--color-accent)', '連結'),
		fgOn: [
			'a',
			'.site-nav .nav-brand:hover',
			'.home-cta a:hover',
			'.home-links a:hover',
			'.links a:hover',
			// 單冒號不是筆誤：閘門讀的是壓縮後的產物，壓縮器把 `::after` 正規化成 `:after`。
			// 照原始碼寫 `::after` 會對不上、閘門立刻紅（fail-closed，不會靜靜放行）。
			'.cs-wipe-handle:after',
			'.st-table a:hover',
		],
	},

	/**
	 * 以下這幾組的合格與否**取決於它疊在哪個表面上**，所以兩端都要釘到真的選擇器：
	 * `fgOn` 說「這幾條規則的文字色必須是 fg」，`bgOn` 說「這個選擇器的底必須是 bg」。
	 * 沒有這兩個欄位的話，配對只是一張願望清單——把 `.card p` 改回 muted（在 n-200 上
	 * 只有 3.79）或把 `.cs-track` 的底換成列表卡的底（AI 側 muted 從 5.09 掉到 3.79），
	 * 閘門都照樣綠。這兩個突變都實測過。
	 */
	{ fg: 'var(--color-text)', bg: 'var(--color-bg-card)', where: '卡片標題 on 列表卡底', bgOn: '.card' },
	{ fg: 'var(--n-700)', bg: 'var(--color-bg-card)', where: '卡片摘要 on 列表卡底', fgOn: ['.card p'], bgOn: '.card' },

	{ fg: 'var(--color-text)', bg: 'var(--color-bg-alt)', where: '面板內文', bgOn: '.tl-solo' },
	/**
	 * 票 02 前，`.cs-track` 的底色守衛掛在「面板上的元素主色小標」那組配對上。
	 * 那組的兩條 `fgOn`（`.tl-solo em`、`.cs-track .cs-side--me em`）在票 02 都退了主色，
	 * 配對隨之消失——**背景守衛必須在同一次改動裡接手到這裡**，否則 `.cs-track` 的底
	 * 會變成沒有任何檢查在看（把它換成列表卡的底，AI 側 muted 會從 5.09 掉到 3.79）。
	 */
	{
		fg: 'var(--color-text-muted)',
		bg: 'var(--color-bg-alt)',
		where: '比對器 AI 側（原本靠 opacity 降權）',
		fgOn: ['.cs-track .cs-side--ai'],
		bgOn: '.cs-track',
	},

	{
		fg: 'var(--color-bg)',
		bg: 'var(--color-accent)',
		where: '選取文字／按鈕 active（深字反白）',
		// 這個顏色只有疊在元素主色上才合法——不列 fgOn 的話，誰在別處寫
		// color: var(--color-bg) 都會被這一組放行，而那是 1.00 的隱形字。
		fgOn: ['::selection', '.home-cta a:active', '.links a:active'],
	},

	/**
	 * 非文字對比（WCAG 1.4.11，門檻 3.0）。
	 * 「卡片浮起來」有一部分是靠外框承擔的，那條線就必須自己合格。
	 * n-400 在藍暈峰值上只有 2.91，框取 n-500 就是這一條逼出來的。
	 *
	 * **只驗外側。**外側是把元件與周圍分開的那條邊，「這是一個獨立區塊」的資訊在那裡；
	 * 內側是元件自己的框與自己的填色之間，不承載辨識資訊（n-500 疊在卡底 n-200 上是
	 * 2.78——要讓內側也過 3.0 得用 n-600，那是 muted 文字的亮度，1px 的線用不到）。
	 */
	onPage('var(--color-border-strong)', '閉合外框（外側）', 3),
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
export const LAYOUT_MULTIPLES = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6];
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

/**
 * 紅線③ — 常駐動態的峰值速度上限（px/s）。
 * 紅線①②量的是過場（單一動作多顯眼、使用者等多久），量不到「一直在」的東西。
 * 推導在 SPEC-motion-and-shape.md「第三條紅線」。
 *
 * 量法：**參數的解析上界**（Σ 振幅ᵢ × 2π頻率ᵢ 的向量和），不是目測、不是實測幀。
 * 這樣它才是一條會報錯的線——值一漂，算出來的上界就過線。
 */
export const STANDING_MOTION_PEAK_SPEED = 30;

/** 速度配額怎麼分給呼吸與漂移，是**技法**（見下方 MOTIF_CRAFT），不是判準。 */

// ---------------------------------------------------------------------------
// 母題（視覺第 9 版）
// 每一個讀者感覺得到的參數，候選集／篩選依據／為什麼不是其他候選都在
// SPEC-background-and-homepage.md「母題參數的判準與檔位」。這裡只放值。
// ---------------------------------------------------------------------------
export const MOTIF = {
	/** 幀率上限。跳幀只跑得出「更新率 ÷ 整數」，30 在 60Hz／120Hz 上都整除。 */
	fpsCap: 30,

	/** 呼吸：一次完整的散→聚→散（秒）。20–30s 檔，取現值。 */
	breathPeriod: 26,
	/** 三個分量的週期比與權重比同為 φ²（黃金比平方）——最難被通約，故最難被看成迴圈。 */
	breathRatio: 2.618,
	breathWeights: [0.6545, 0.25, 0.0955],

	/** 聚散幅度兩檔（px，散開位置到聚攏位置的行程）。比值 2.5×，遠超辨識門檻。 */
	travel: { normal: 120, outlier: 48 },

	/** 每點各自的三組漂移。振幅與頻率成反比，故三組對峰值速度的貢獻相等。 */
	driftAmplitude: [8, 3.06, 1.17],
	driftFrequency: [0.046, 0.1204, 0.3153],

	/** 離群值比例＝常態分布 2σ 外。統計上有定義的「離群」，不是隨手的比例。 */
	outlierRatio: 0.0455,
	/**
	 * 離群值往上跑的比例。往上（冒險成功）：往下（冒險失敗）＝ 3：1，
	 * 2026-07-27 本人裁定（原話「偶爾**也**會冒險失敗」——失敗是較少的那邊）。
	 * 這是判準不是技法，所以放這裡而不是留在繪製程式碼裡的一個 0.75。
	 */
	outlierUpRatio: 0.75,

	/** 趨勢線：終點斜率是起點的幾倍（→ 指數 k = ln 5）。 */
	trendSlopeRatio: 5,
	/** 線寬單一值＝全站唯一的線寬。實度全部由不透明度承擔，不重複講兩次。 */
	trendLineWidth: 1,
	/** 離散度沿母題走向線性遞減，端點比。點的分布與線的實度共用這一個函式。 */
	spreadEnds: [1.15, 0.3],

	/**
	 * 漸層跟著確定性走：最散亂的一端最灰、最收斂的一端最亮。
	 * 亮端封頂在中性階 700——背景不得逼近內文亮度（理念一：字要是最亮的東西）。
	 * 三個端點放這裡而不是只寫在 SPEC 裡：寫在散文裡的話，票 02／03 把亮端改成階 800 閘門也不會紅。
	 */
	gradient: [NEUTRAL_RAMP[400], '#7998c3', NEUTRAL_RAMP[700]],

	/** 景深三層（遠→近）。半徑等比 1.6、不透明度等比 1.75，端點比沿用現值。 */
	depthRadius: [3.6, 2.24, 1.4],
	depthAlpha: [0.3, 0.53, 0.92],

	/** 點密度（每千平方像素幾個點），不是絕對數量——不同裝置上密度要一樣。 */
	density: { home: 0.25, reading: 0.08 },

	/** 文字可能出現的區域內，母題合成後的不透明度上限＝既有藍暈峰值，不新增最壞值。 */
	textBandMaxAlpha: 0.1,

	/** 閱讀頁：磚高＝欄寬的幾倍（綁 --max-width，不留魔術數字）。 */
	tileHeightColumns: 2,
	/** 閱讀頁：正文欄那一帶的點保留比例；淨空半徑＝欄寬的一半。 */
	readingKeepRatio: 1 / 3,
};

/**
 * 母題的內部常數——**技法，不替它們編故事**（票 00 驗收明文要求）。
 * 它們的存在理由只有一個：讓有故事的元素看起來成立、或讓它跑得涼。
 */
export const MOTIF_CRAFT = {
	spriteSize: 64, // 預繪柔邊光點的貼圖邊長
	trendSegments: 64, // 趨勢線的繪製分段數
	dprCap: 2, // 裝置像素比取樣上限
	pointCap: 520, // 點數上限＝1920×1080 在首頁密度下的點數
	speedBudget: { breath: 20, drift: 7 }, // 紅線③ 的配額分配（每軸），比例無故事

	/**
	 * 構圖常數（票 02 補上）。母題畫在畫面的哪個位置、化開曲線長什麼樣——
	 * 同樣**登記為技法，不替它們編故事**。它們放這裡而不是繪製程式裡的理由只有一個：
	 * SPEC 寫著「繪製程式碼裡不得再寫值」，那句話沒有替技法開後門。
	 * 產物端由 canvas 的 `data-motif-craft` 屬性帶出去，與 `data-motif` 同一條路。
	 */
	layout: {
		xInset: 0.02, // 點與線左右各內縮視窗寬的幾成
		trendBand: [0.82, 0.42], // 趨勢線起（左）訖（右）高度，佔視窗高
		/**
		 * 離散度 1.0 對應的散開半幅，佔視窗高。
		 * 0.9 是滿足均勻判準的最小檔（0.8 不過、0.9 過，2026-07-28 逐格量測）。
		 * 判準：任何一塊 375×375、文字帶沒蓋過一半的方格，在呼吸中點那一幀至少要有
		 * 4 個可見元素（合成後不透明度 ≥ 0.08）。量測工具在 verify/uniform.mjs。
		 * 舊值 0.3 實測會在左上角留出整片空格（最少 0 個元素），那正是判準要擋的。
		 */
		scatterHeight: 0.9,
		outlierOffset: [1.5, 2.5], // 離群值的散開倍數區間（一般點是 0–1）
		trendAlpha: 0.62, // 趨勢線最實處的不透明度
		trendTail: 0.09, // 右端收尾長度，佔 u
		spriteMid: [0.35, 0.55], // 柔邊光點中段的位置與不透明度
		/**
		 * 每個點的呼吸時間偏移範圍，佔一個呼吸週期的幾分之幾。
		 * SPEC 要的是「錯開」不是「打散」：**整團仍然要一起散→聚→散**，
		 * 錯開只是為了不像一個東西在脈動。上界因此是算得出來的——
		 * 偏移均勻分布時，整團振幅會被 sinc(πτ/P) 衰減，取 1/8 保住 97%；
		 * 原本寫成「最長分量的週期」（2.618 個週期）只剩 11%，等於沒有整團的呼吸。
		 */
		breathDesync: 0.125,
		fadeCenter: [0.6, 0.72], // 徑向遮罩重心（不在畫面正中）
		fadeStops: [0, 0.22, 0.94], // 化開曲線。外緣不收到全黑，否則跑到頂端的離群值會整個消失
		textBandFeather: 0.25, // 文字帶邊緣的化開寬度＝欄寬的幾倍
		/**
		 * 構圖高度的容忍幅度：視窗高變動超過這個比例，才算「版面真的變了」。
		 * 手機瀏覽器的視窗高**本來就是不穩定的**——捲動時網址列收合會讓 innerHeight
		 * 變動數十 px（本站實測同一台 iPhone 上 684 與 744，約 8%）。拿即時視窗高當
		 * 構圖基準，讀者每次上下滑都會看到背景動一次。0.2 分得開「網址列」與
		 * 「真的換了裝置或轉向」，而後者必然連視窗寬也一起變、另有守衛。
		 */
		heightTolerance: 0.2,
	},
};

// ---------------------------------------------------------------------------
// 例外清單
// 現況的既有違規列在這裡，由後續票逐條清空。**不得用放寬判準的方式換綠燈。**
// 第 6 類（降低動態偏好覆蓋）不得有例外——可及性是硬下限。
// ---------------------------------------------------------------------------
const group = (keys, reason, clearedBy) => keys.map((key) => ({ key, reason, clearedBy }));

export const EXCEPTIONS = {
	// 票 06 已清空：裝飾性字元改用 n-500（對背景 4.66），不再靠邊框階。
	contrast: [],

	// 票 06 已清空：.cs-side--ai 的 opacity 退場，降權改由色階承擔。
	opacity: [],

	offramp: [
		...group(
			['#2a1829'],
			'背景漸層左下的黑莓暗暈。刻意不上階：它與右上那道元素主色 10% 的藍暈成對，是背景主色的組成而非承載層級的表面，上了階會被連帶提亮、暈就沒了。',
			'永久（書面理由）',
		),
	],

	// 票 07 已清空：21 張圖依新類別色與新色帶重跑。
	pnglegacy: [],

	// 票 03 已清空：四個示意色依判準重算（色相保留詞義，L 落在 600–700 區、C ≤ .073）。
	illustrative: [],

	// 票 05 已清空：29 個值收斂到版面節奏（基線 2.1375rem 的倍數）與元件內 4/8/12/16px。
	spacing: [],

	// 票 04 已清空：九階 clamp 落地、字距收成三檔、每一條設了字級的規則都有行高。
	typography: [],
};
