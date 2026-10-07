# 網站文字

這個網站上所有固定的文字都在這裡。只改每段 `<!-- text:… -->` 與 `<!-- /text -->` 之間的正文，存檔後重新建置（推上 GitHub 就會自動建置）網站就會換成新的字。
請保留識別標記與 {變數}（大括號包起來的英文，例如 {title}、{count}，網站會把它換成實際的內容）。文字當作純文字呈現，不執行 HTML。
格式與 AI 專案 07 共用編輯系統的「文字.md」相同。例外：作品文章在 src/content/projects/；首頁 3D 房間的文字在房間自己的「網頁文字.md」；首頁那句提示詞是證物，在 src/prompt.mjs，不在這裡改。

## 全站 · 名字：導覽列最左邊、分頁標題、頁尾都用它
<!-- text:site.name -->
林郁為
<!-- /text -->

## 全站 · 分頁標題的格式（{title} 會換成各頁的名稱）
<!-- text:site.title_format -->
{title} | 林郁為
<!-- /text -->

## 全站 · 給搜尋引擎與分享預覽看的一句話介紹
<!-- text:site.description -->
統計背景，正朝資料科學邁進。
<!-- /text -->

## 頁尾 · 著作權那一行
<!-- text:footer.copyright -->
© 2026 林郁為
<!-- /text -->

## 頁尾 · GitHub 連結文字
<!-- text:footer.github -->
GitHub
<!-- /text -->

## 頁尾 · Email 連結文字
<!-- text:footer.email -->
Email
<!-- /text -->

## 分類 · 統計類作品的分類名（導覽列、作品列表、作品頁上方的小標籤）
<!-- text:category.stats -->
統計分析
<!-- /text -->

## 分類 · AI 類作品的分類名（同上）
<!-- text:category.ai -->
AI 實作
<!-- /text -->

## 404 找不到頁面 · 分頁標題（會套進全站的標題格式）
<!-- text:notfound.title -->
404
<!-- /text -->

## 404 找不到頁面 · 主要說明
<!-- text:notfound.message -->
找不到這個頁面。
<!-- /text -->

## 404 找不到頁面 · 回首頁的連結
<!-- text:notfound.back -->
← 回首頁
<!-- /text -->

## 作品列表 · 分頁標題
<!-- text:projects.title -->
Projects
<!-- /text -->

## 作品頁 · 左上角回作品列表的連結
<!-- text:project.back -->
← Projects
<!-- /text -->

## 作品頁 · 「全部展開」按鈕
<!-- text:project.expand_all -->
全部展開
<!-- /text -->

## 作品頁 · 展開後按鈕變成的字
<!-- text:project.collapse_all -->
全部收合
<!-- /text -->

## 作品頁 · 文章底下的 GitHub 連結
<!-- text:project.link_github -->
GitHub
<!-- /text -->

## 作品頁 · 文章底下的線上展示連結
<!-- text:project.link_demo -->
Demo
<!-- /text -->

## 設計展示櫃 · 目錄頁 · 頁面標題（也用在分頁標題）
<!-- text:design.index.title -->
設計展示櫃
<!-- /text -->

## 設計展示櫃 · 目錄頁 · 左上角返回連結
<!-- text:design.index.back -->
← AI 實作 #1
<!-- /text -->

## 設計展示櫃 · 目錄頁 · 標題下的小字（{count} 會換成項目數）
<!-- text:design.index.count -->
現行 {count} 項設計決定，按維度分類
<!-- /text -->

## 設計展示櫃 · 目錄頁 · 開頭說明
<!-- text:design.index.intro -->
這裡陳列的是「現在」：每個元素長什麼樣、為什麼是這樣。當時怎麼走過來的，在 AI 實作 #1 的時間軸。
<!-- /text -->

## 設計展示櫃 · 分類頁 · 分頁標題（{label} 會換成分類名）
<!-- text:design.cat.title -->
展示櫃・{label}
<!-- /text -->

## 設計展示櫃 · 分類頁 · 左上角返回連結
<!-- text:design.cat.back -->
← 展示櫃
<!-- /text -->

## 設計展示櫃 · 分類頁 · 大標題下的小字
<!-- text:design.cat.kicker -->
設計展示櫃
<!-- /text -->

## 設計展示櫃 · 分類頁 · 還在討論的項目顯示的狀態
<!-- text:design.cat.pending -->
這一項正在重新討論，弄好會放回來。
<!-- /text -->

## 設計展示櫃 · 示範 · 標題字示範句
<!-- text:design.demo.display -->
永字八法，筆筆有勢
<!-- /text -->

## 設計展示櫃 · 示範 · 內文字示範句
<!-- text:design.demo.body -->
內文的工作是被長時間閱讀——圓角收筆，不搶不刺。
<!-- /text -->

## 設計展示櫃 · 示範 · 字級階梯：第三階
<!-- text:design.demo.fs3 -->
階三
<!-- /text -->

## 設計展示櫃 · 示範 · 字級階梯：第二階
<!-- text:design.demo.fs2 -->
階二
<!-- /text -->

## 設計展示櫃 · 示範 · 字級階梯：第一階
<!-- text:design.demo.fs1 -->
階一
<!-- /text -->

## 設計展示櫃 · 示範 · 字級階梯：內文
<!-- text:design.demo.fs0 -->
階零（內文）
<!-- /text -->

## 設計展示櫃 · 示範 · 字級階梯：最小一階
<!-- text:design.demo.fsm1 -->
階負一（14px 下限）
<!-- /text -->

## 設計展示櫃 · 示範 · 垂直節奏示範第一句
<!-- text:design.demo.rhythm1 -->
每一行都落在同一組看不見的橫線上。
<!-- /text -->

## 設計展示櫃 · 示範 · 垂直節奏示範第二句
<!-- text:design.demo.rhythm2 -->
換了區塊，還是同一組線。
<!-- /text -->

## 設計展示櫃 · 示範 · 邊框示範：線的說明
<!-- text:design.demo.line -->
線：只做分隔
<!-- /text -->

## 設計展示櫃 · 示範 · 邊框示範：框裡的字
<!-- text:design.demo.frame -->
框
<!-- /text -->

## 設計展示櫃 · 示範 · 邊框示範：框的說明
<!-- text:design.demo.frame_note -->
框：標示區塊
<!-- /text -->

## 設計展示櫃 · 示範 · 時長示範的按鈕
<!-- text:design.demo.race -->
三檔一起跑
<!-- /text -->

## 設計展示櫃 · 示範 · 曲線示範的按鈕
<!-- text:design.demo.play -->
播放一次
<!-- /text -->

## 設計展示櫃 · 示範 · 背景示範窗的說明
<!-- text:design.demo.window -->
這扇窗後面沒有東西——就是活的背景本人：顆粒、暈、飄著的點。
<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「色彩」這一類的名稱
<!-- text:design.color.label -->
色彩
<!-- /text -->

## 設計展示櫃 · 色彩 · 第 1 項的元素名
<!-- text:design.color.1.name -->
背景主色：暮紫
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：決定的值
<!-- text:design.color.1.value -->
#20131d 起的十階中性階
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：推導第 1 條
<!-- text:design.color.1.why1 -->
顏色不是從安全牌挑的，是從個人特質推出來的——完整的選色故事在心路歷程那一頁。
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：推導第 2 條
<!-- text:design.color.1.why2 -->
深底讓內容浮在前面，背景自己不搶話。
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：色塊標籤第 1 個
<!-- text:design.color.1.strip1 -->
暮紫
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：色塊標籤第 2 個
<!-- text:design.color.1.strip2 -->
黑莓暗暈
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：色塊標籤第 3 個
<!-- text:design.color.1.strip3 -->
卡底
<!-- /text -->

## 設計展示櫃 · 色彩 · 背景主色：暮紫：連結文字
<!-- text:design.color.1.link1 -->
當時怎麼選的 →
<!-- /text -->

## 設計展示櫃 · 色彩 · 第 2 項的元素名
<!-- text:design.color.2.name -->
元素主色：鋼藍
<!-- /text -->

## 設計展示櫃 · 色彩 · 元素主色：鋼藍：決定的值
<!-- text:design.color.2.value -->
#7998c3（凍結）
<!-- /text -->

## 設計展示櫃 · 色彩 · 元素主色：鋼藍：推導第 1 條
<!-- text:design.color.2.why1 -->
主色只走「線」——連結、框線、強調線。鋪成「面」的地方，字一律用內文色，因為量過：主色字疊在主色淡底上對比不到 4.5。
<!-- /text -->

## 設計展示櫃 · 色彩 · 元素主色：鋼藍：色塊標籤第 1 個
<!-- text:design.color.2.strip1 -->
鋼藍
<!-- /text -->

## 設計展示櫃 · 色彩 · 元素主色：鋼藍：色塊標籤第 2 個
<!-- text:design.color.2.strip2 -->
問句紫
<!-- /text -->

## 設計展示櫃 · 色彩 · 第 3 項的元素名
<!-- text:design.color.3.name -->
中性階
<!-- /text -->

## 設計展示櫃 · 色彩 · 中性階：決定的值
<!-- text:design.color.3.value -->
十階，感知等距
<!-- /text -->

## 設計展示櫃 · 色彩 · 中性階：推導第 1 條
<!-- text:design.color.3.why1 -->
十階全帶著背景主色的色相，亮度等距遞增——整個站的層級都由這排階梯講，不需要第二套灰。
<!-- /text -->

## 設計展示櫃 · 色彩 · 第 4 項的元素名
<!-- text:design.color.4.name -->
對比度門檻
<!-- /text -->

## 設計展示櫃 · 色彩 · 對比度門檻：決定的值
<!-- text:design.color.4.value -->
內文 ≥ 4.5、框線 ≥ 3.0
<!-- /text -->

## 設計展示櫃 · 色彩 · 對比度門檻：推導第 1 條
<!-- text:design.color.4.why1 -->
這是唯一可以推翻其他決定的一條。框線的 3.0 是對「所有背景狀態」都要成立——背景有兩道暈，最亮那一帶也得過。
<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「文字」這一類的名稱
<!-- text:design.type.label -->
文字
<!-- /text -->

## 設計展示櫃 · 文字 · 第 1 項的元素名
<!-- text:design.type.1.name -->
標題字：霞鶩文楷
<!-- /text -->

## 設計展示櫃 · 文字 · 標題字：霞鶩文楷：決定的值
<!-- text:design.type.1.value -->
楷書，300／400／700
<!-- /text -->

## 設計展示櫃 · 文字 · 標題字：霞鶩文楷：推導第 1 條
<!-- text:design.type.1.why1 -->
楷書有筆勢與手做感，是本人看過對照卡與真實頁面後選定的。半粗是 700 不是 600——這套字沒有 600，宣告不存在的字重會被瀏覽器靜默換掉。
<!-- /text -->

## 設計展示櫃 · 文字 · 第 2 項的元素名
<!-- text:design.type.2.name -->
內文字：昭源圓體
<!-- /text -->

## 設計展示櫃 · 文字 · 內文字：昭源圓體：決定的值
<!-- text:design.type.2.value -->
400／500 兩檔
<!-- /text -->

## 設計展示櫃 · 文字 · 內文字：昭源圓體：推導第 1 條
<!-- text:design.type.2.why1 -->
圓角收筆，呼應站上「統一圓角」的形狀語彙——字跟版面說同一種話。
<!-- /text -->

## 設計展示櫃 · 文字 · 第 3 項的元素名
<!-- text:design.type.3.name -->
字級階梯
<!-- /text -->

## 設計展示櫃 · 文字 · 字級階梯：決定的值
<!-- text:design.type.3.value -->
九階，兩套等比內插
<!-- /text -->

## 設計展示櫃 · 文字 · 字級階梯：推導第 1 條
<!-- text:design.type.3.why1 -->
比值來自「主標約為內文五倍、走七階」，手機與桌機各一套再連續內插。最小一階釘死 14px：易讀是硬下限，優先於等比的漂亮。
<!-- /text -->

## 設計展示櫃 · 文字 · 第 4 項的元素名
<!-- text:design.type.4.name -->
行高與行長
<!-- /text -->

## 設計展示櫃 · 文字 · 行高與行長：決定的值
<!-- text:design.type.4.value -->
連續公式＋內文欄 40 字
<!-- /text -->

## 設計展示櫃 · 文字 · 行高與行長：推導第 1 條
<!-- text:design.type.4.why1 -->
行高隨字級連續遞減（大字不需要大行距）；內文欄寬讓一行落在四十個中文字上下，眼睛換行找得到下一行。
<!-- /text -->

## 設計展示櫃 · 文字 · 第 5 項的元素名
<!-- text:design.type.5.name -->
字距
<!-- /text -->

## 設計展示櫃 · 文字 · 字距：決定的值
<!-- text:design.type.5.value -->
三檔：0／0.06em／0.04em
<!-- /text -->

## 設計展示櫃 · 文字 · 字距：推導第 1 條
<!-- text:design.type.5.why1 -->
否決「隨字級遞減」的公式——那是拉丁字的光學修正；中文沒有詞間空格，內文加字距會破壞斷詞。只有大標與短標籤拉開。
<!-- /text -->

## 設計展示櫃 · 文字 · 第 6 項的元素名
<!-- text:design.type.6.name -->
字體載入
<!-- /text -->

## 設計展示櫃 · 文字 · 字體載入：決定的值
<!-- text:design.type.6.value -->
display=fallback
<!-- /text -->

## 設計展示櫃 · 文字 · 字體載入：推導第 1 條
<!-- text:design.type.6.why1 -->
swap 保證先用備援字畫一次再換，中文字面度量不同，換的那一刻整頁重排；fallback 的 100ms 阻擋期低於人眼門檻，把那次重排換掉了。
<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「間距與版面」這一類的名稱
<!-- text:design.spacing.label -->
間距與版面
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 第 1 項的元素名
<!-- text:design.spacing.1.name -->
垂直節奏
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 垂直節奏：決定的值
<!-- text:design.spacing.1.value -->
基線 2.1375rem 的倍數
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 垂直節奏：推導第 1 條
<!-- text:design.spacing.1.why1 -->
版面間距全是內文行高的倍數，不同區塊的文字因此落在同一組看不見的橫線上。
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 第 2 項的元素名
<!-- text:design.spacing.2.name -->
元件內間距
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 元件內間距：決定的值
<!-- text:design.spacing.2.value -->
4／8／12／16px
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 元件內間距：推導第 1 條
<!-- text:design.spacing.2.why1 -->
按鈕、標籤的內距不受節奏約束——最小的節奏階有 17px，硬套會讓元件腫起來。兩組階梯各管各的。
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 第 3 項的元素名
<!-- text:design.spacing.3.name -->
版面寬度
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 版面寬度：決定的值
<!-- text:design.spacing.3.value -->
連續流動 768–908px
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 版面寬度：推導第 1 條
<!-- text:design.spacing.3.why1 -->
容器只負責兩側留白，行長由內文欄自己管——原本在特定螢幕寬跳三段，改成連續之後行長才真的被 40 字那條規則管住。
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 第 4 項的元素名
<!-- text:design.spacing.4.name -->
版面欄
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 版面欄：決定的值
<!-- text:design.spacing.4.value -->
單欄
<!-- /text -->

## 設計展示櫃 · 間距與版面 · 版面欄：推導第 1 條
<!-- text:design.spacing.4.why1 -->
內容單欄到底，右側整片留給背景設計——留白是背景的地，不是浪費。
<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「形狀與邊界」這一類的名稱
<!-- text:design.shape.label -->
形狀與邊界
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 第 1 項的元素名
<!-- text:design.shape.1.name -->
圓角
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 圓角：決定的值
<!-- text:design.shape.1.value -->
唯一值 0.55rem
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 圓角：推導第 1 條
<!-- text:design.shape.1.why1 -->
容器圓角全站一個值；差一成以內的舊值全部併入——在圓角上那就是同一個值。功能特例只有捲軸與焦點框。
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 第 2 項的元素名
<!-- text:design.shape.2.name -->
邊框
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 邊框：決定的值
<!-- text:design.shape.2.value -->
線 n-300／框 n-500
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 邊框：推導第 1 條
<!-- text:design.shape.2.why1 -->
「線」只做分隔；「框」要標示一個區塊或控制項，所以對所有背景狀態都得 ≥3.0——n-500 是量出來的，不是挑的。
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 第 3 項的元素名
<!-- text:design.shape.3.name -->
陰影
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 陰影：決定的值
<!-- text:design.shape.3.value -->
只有按下去那一個
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 陰影：推導第 1 條
<!-- text:design.shape.3.why1 -->
層級一律由色階與對比承擔，不靠模糊與偏移。唯一的例外是按鈕按下的內壓——色階講得出「亮起來」，講不出「壓進去」。
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 陰影：推導第 2 條
<!-- text:design.shape.3.why2 -->
例外只有一條，而且只允許內陰影：外投陰影是在模擬光源與物理空間，那是站上沒有的一套規則。閘門守著這兩條，清單外一律紅。
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 第 4 項的元素名
<!-- text:design.shape.4.name -->
圖示
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 圖示：決定的值
<!-- text:design.shape.4.value -->
0 個（刻意）
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 圖示：推導第 1 條
<!-- text:design.shape.4.why1 -->
要講的事文字直接講。圖示自帶一套要學的符號語言，跟中文內文擺在一起是第二種字。
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · 第 5 項的元素名
<!-- text:design.shape.5.name -->
z 層級
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · z 層級：決定的值
<!-- text:design.shape.5.value -->
白名單五個位置
<!-- /text -->

## 設計展示櫃 · 形狀與邊界 · z 層級：推導第 1 條
<!-- text:design.shape.5.why1 -->
內容永遠待在常規流，只有背景、導覽、進度與全螢幕體驗可以離開——每個位置都要講得出它為什麼不能待在常規流，閘門守著。
<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「動效」這一類的名稱
<!-- text:design.motion.label -->
動效
<!-- /text -->

## 設計展示櫃 · 動效 · 第 1 項的元素名
<!-- text:design.motion.1.name -->
時長
<!-- /text -->

## 設計展示櫃 · 動效 · 時長：決定的值
<!-- text:design.motion.1.value -->
三檔：0.35／0.25／0.15s
<!-- /text -->

## 設計展示櫃 · 動效 · 時長：推導第 1 條
<!-- text:design.motion.1.why1 -->
兩條紅線：單一動作 ≤0.35 秒、等待總和 ≤1 秒。0.15 是硬下限——再短人眼感知為瞬間，色變會變成硬切。
<!-- /text -->

## 設計展示櫃 · 動效 · 第 2 項的元素名
<!-- text:design.motion.2.name -->
曲線
<!-- /text -->

## 設計展示櫃 · 動效 · 曲線：決定的值
<!-- text:design.motion.2.value -->
全站唯一一條（強減速）
<!-- /text -->

## 設計展示櫃 · 動效 · 曲線：推導第 1 條
<!-- text:design.motion.2.why1 -->
站上只有一種動作類型——回應狀態改變的過場——所以只需要一條曲線。不得有超越量：「捏下去不變形」，被推了會彈的物理感不屬於這個站。
<!-- /text -->

## 設計展示櫃 · 動效 · 第 3 項的元素名
<!-- text:design.motion.3.name -->
常駐動態速度
<!-- /text -->

## 設計展示櫃 · 動效 · 常駐動態速度：決定的值
<!-- text:design.motion.3.value -->
≤30px/s（循環另有上限）
<!-- /text -->

## 設計展示櫃 · 動效 · 常駐動態速度：推導第 1 條
<!-- text:design.motion.3.why1 -->
背景一直在動的東西有速度預算，超過會進入餘光的運動捕捉範圍、跟閱讀搶注意力。閘門用解析上界驗，不是目測。
<!-- /text -->

## 設計展示櫃 · 動效 · 第 4 項的元素名
<!-- text:design.motion.4.name -->
降低動態偏好
<!-- /text -->

## 設計展示櫃 · 動效 · 降低動態偏好：決定的值
<!-- text:design.motion.4.value -->
位移全關、內容都在
<!-- /text -->

## 設計展示櫃 · 動效 · 降低動態偏好：推導第 1 條
<!-- text:design.motion.4.why1 -->
這個偏好要關的是空間位移，不是把畫面清空——點還在、圖還在，只是不動。可及性是硬下限，例外清單裡永遠不會有它。
<!-- /text -->

## 設計展示櫃 · 動效 · 第 5 項的元素名
<!-- text:design.motion.5.name -->
動效種類
<!-- /text -->

## 設計展示櫃 · 動效 · 動效種類：決定的值
<!-- text:design.motion.5.value -->

<!-- /text -->

## 設計展示櫃 · 分類名稱 · 「材質與背景」這一類的名稱
<!-- text:design.texture.label -->
材質與背景
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 第 1 項的元素名
<!-- text:design.texture.1.name -->
顆粒
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 顆粒：決定的值
<!-- text:design.texture.1.value -->
soft-light 50%，刻意靜止
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 顆粒：推導第 1 條
<!-- text:design.texture.1.why1 -->
整頁蒙一層細顆粒，粗糙材質是站上少數承載故事的質感。它刻意不動：一加動畫就會被瀏覽器切到獨立圖層，混色失效，整頁洗灰——實測踩過。
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 第 2 項的元素名
<!-- text:design.texture.2.name -->
兩道暈
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 兩道暈：決定的值
<!-- text:design.texture.2.value -->
鋼藍 10%＋黑莓，會呼吸
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 兩道暈：推導第 1 條
<!-- text:design.texture.2.why1 -->
右上一道主色藍暈、左下一道黑莓暗暈，成對構成背景的重心；呼吸的亮端就是原本的靜態值，所有對比數字不受影響。
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 第 3 項的元素名
<!-- text:design.texture.3.name -->
背景設計
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 背景設計：決定的值
<!-- text:design.texture.3.value -->
兩層點場，30 秒一次聚攏
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 背景設計：推導第 1 條
<!-- text:design.texture.3.why1 -->
中性的小點各自飄是「底下」，主色的點每三十秒從散亂聚成一條往上的指數趨勢——不畫線，點自己排出來。這是統計背景的人才會做的背景。
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 背景設計：連結文字
<!-- text:design.texture.3.link1 -->
活的就在首頁 →
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 第 4 項的元素名
<!-- text:design.texture.4.name -->
圖表樣式
<!-- /text -->

## 設計展示櫃 · 材質與背景 · 圖表樣式：決定的值
<!-- text:design.texture.4.value -->

<!-- /text -->

## 設計展示櫃 · 理念標籤 · 推導前面的小標籤「個人特色」
<!-- text:idea.personal -->
個人特色
<!-- /text -->

## 設計展示櫃 · 理念標籤 · 推導前面的小標籤「低調」
<!-- text:idea.lowkey -->
低調
<!-- /text -->

## 設計展示櫃 · 理念標籤 · 推導前面的小標籤「易讀」
<!-- text:idea.readable -->
易讀
<!-- /text -->

## 設計展示櫃 · 理念標籤 · 推導前面的小標籤「不過度互動」
<!-- text:idea.restrained -->
不過度互動
<!-- /text -->

<!-- layout -->
{}
<!-- /layout -->
