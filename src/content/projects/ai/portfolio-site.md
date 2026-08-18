---
title: "個人作品頁"
summary: 闡述關於建造此網站的大略資訊。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
cover: /images/portfolio-site/ai-baseline-2026-08-03.png
---

<!-- 三層對話結構（SPEC-ai-page-layers，2026-08-04 定案；2026-08-08 實作票 01–03）。
     核心命題：AI 給你的是平均值，分界在你知不知道什麼時候不接受它給的東西。
     層一＝主角，擺最前面（憲法第一章）。 -->

<p class="cs-lead">這個網站，就是我的第一個 AI 實作。</p>

<section class="ai-run" data-ai-run>
  <p class="st-ask">如果只是下簡單的提示詞，AI 會給你什麼成品？</p>
  <p class="st-note ai-cost">只要有需求，會打字給 AI 就好。</p>

  <!-- 這一則不是文案，是證物：實驗真正送出的提示詞，一字未改。
       單一來源在 src/prompt.mjs，閘門第 14 類驗這裡與首頁在產物裡逐字一致。 -->
  <div class="ai-msg">
    <p class="ai-msg-text">我想做一個具有設計感的個人作品頁。我是林郁為，這個個人頁面想要放「統計分析」和「AI實作」這兩類的作品，首頁只放一些個人資訊，簡單為主。</p>
    <button type="button" class="home-send" data-ai-send hidden>送出</button>
  </div>

  <!-- 等待劇場（2026-08-08 重做）：不是光一條進度條——「AI 製作中」的三拍狀態字
       輪替，同時一個線框版面自己搭起來（直線＋統一圓角語彙），3 秒後線框讓位給真圖。 -->
  <div class="ai-making" aria-hidden="true">
    <p class="st-note ai-making-label">AI 製作中<span class="ai-stage"><span>——正在分析使用者需求……</span><span>——正在建造中……</span><span>——正在進行視覺微調……</span></span></p>
    <div class="ai-frame">
      <i style="inset:4% 4% auto 4%; height:6%"></i>
      <i style="inset:18% 40% auto 8%; height:14%"></i>
      <i style="inset:38% 55% auto 8%; height:5%"></i>
      <i style="inset:48% 62% auto 8%; height:4%"></i>
      <i style="inset:60% 52% auto 8%; height:28%"></i>
      <i style="inset:60% 8% auto 56%; height:28%"></i>
    </div>
    <div class="ai-progress" data-ai-progress></div>
  </div>

  <!-- 圖＝那份網站的真截圖（2026-08-08 重拍；先前掛錯圖，本人抓到）。
       沒有 JS 時圖直接可見。 -->
  <figure class="ai-shot" data-ai-shot>
    <!-- 刻意不 lazy：圖藏在 display:none 後面等揭曉，lazy 會讓它到揭曉那一刻才開始下載，
         37KB 現抓現等。現在頁面一載入就抓好，3 秒等待結束時它必定就緒。 -->
    <img src="/images/portfolio-site/ai-baseline-2026-08-03.png" alt="只給那一句話時，AI 給的成品" width="760" height="470" />
  </figure>
  <p class="ai-invite" data-ai-invite>
    <button type="button" class="home-send" data-ai-open hidden>可以體驗一下這個網站喔 →</button>
    <noscript><a href="/process/ai-baseline-2026-08-03.html">可以體驗一下這個網站喔 →</a></noscript>
  </p>

  <!-- 滿版體驗（票 02）：原地長大（原型 B）、iframe 隔離、src 延後到展開那一刻。
       嵌入檔是證物（2026-08-03 原樣凍結），不套換色、不得修改。 -->
  <div class="ai-overlay" data-ai-overlay role="dialog" aria-modal="true" aria-label="體驗 AI 給的網站" hidden>
    <div class="ai-overlay-bar">
      <p class="st-note ai-overlay-note">AI 初版展示</p>
      <button type="button" class="home-send" data-ai-exit>退出體驗</button>
    </div>
    <iframe title="AI 產出的網站" data-src="/process/ai-baseline-2026-08-03.html"></iframe>
  </div>
</section>

<section class="ai-run ai-run--slow" data-ai-run data-wait="5000">
  <p class="st-ask">那如果更進一步，給它一份完整的設計理念呢？</p>
  <p class="st-note ai-cost">有需求，而且能先問問自己要些什麼，並有辦法下對指令。</p>

  <!-- 本人 2026-08-08 定稿的展示版，六條一字未改。**括號那句誠實聲明不得刪**——
       實際送出的是完整憲法，這裡是整理過的摘要，讀者有權知道這個差別。
       長相沿用 .ai-msg：這與層一那則提示詞是同一種東西（我交給 AI 的東西），
       同一種東西只有一種長相，那正是門檻一要的融合。 -->
  <div class="ai-msg">
    <div class="ai-creed">
      <p>最重要的問題是：「這個呈現方式，可以讓一個只給我 30 秒的陌生人，在離開前知道我是誰、看見我能做些什麼，並且產生好奇想要再多深入瞭解嗎？」</p>
      <p>再加上六條主要訴求（經整理，並非完整提示詞）：</p>
      <ol>
        <li>一、元素與元素之間融洽，不會有風格衝突。</li>
        <li>二、每個頁面都要有一個主角。</li>
        <li>三、演示勝於敘述：動態呈現最優先，其次是圖片或對應元素，最後才是文字。</li>
        <li>四、每個頁面都應該要讓人勾起好奇心。</li>
        <li>五、易讀永遠最優先（包含視覺呈現和文字敘述）。</li>
        <li>六、個人特色的設計感，能低調就低調。</li>
      </ol>
    </div>
    <button type="button" class="home-send" data-ai-send hidden>送出</button>
  </div>

  <!-- 等待劇場，這一層 5 秒（層一 3 秒）。四拍：前兩秒一句總述交代「為什麼比較久」，
       後三秒沿用層一那三拍——同一台機器在做同一件事，只是這次指令更長。
       線框骨架的登場間隔按 5/3 拉長，否則它 2.3 秒就搭完，剩下 2.7 秒看起來像卡住。 -->
  <div class="ai-making" aria-hidden="true">
    <p class="st-note ai-making-label">AI 製作中<span class="ai-stage"><span>——偵測較複雜指令，需處理更長時間</span><span>——正在分析使用者需求……</span><span>——正在建造中……</span><span>——正在進行視覺微調……</span></span></p>
    <div class="ai-frame">
      <i style="inset:4% 4% auto 4%; height:6%"></i>
      <i style="inset:18% 40% auto 8%; height:14%"></i>
      <i style="inset:38% 55% auto 8%; height:5%"></i>
      <i style="inset:48% 62% auto 8%; height:4%"></i>
      <i style="inset:60% 52% auto 8%; height:28%"></i>
      <i style="inset:60% 8% auto 56%; height:28%"></i>
    </div>
    <div class="ai-progress" data-ai-progress></div>
  </div>

  <!-- 圖＝2026-08-08 本人在乾淨環境親跑的產出真截圖（票 06）。
       污染檢查已過：與層一素材色碼交集為零、共用 CSS 變數名僅 5 個通用命名、無真實專案名。
       **這張拍的是捲動後那一屏，不是首屏**（本人 2026-08-08 指定「直接往下截圖」）。
       理由：那份素材的開場區是 min-height:100svh、只放主角，首屏拍起來幾乎全白，
       讀者會以為圖壞了。往下一屏才看得到卡片與區間鏈句。
       拍法在 .scratch/_shot-wrap.html（無頭 Chrome 拍不到捲動後的畫面，靠同源 iframe 繞）。 -->
  <figure class="ai-shot" data-ai-shot>
    <img src="/images/portfolio-site/ai-constitution-2026-08-08.png" alt="給了設計理念之後，AI 給的成品" width="760" height="470" />
  </figure>
  <p class="ai-invite" data-ai-invite>
    <button type="button" class="home-send" data-ai-open hidden>可以體驗一下這個網站喔 →</button>
    <noscript><a href="/process/ai-constitution-2026-08-08.html">可以體驗一下這個網站喔 →</a></noscript>
  </p>

  <!-- 滿版體驗比照票 02。嵌入檔是證物（2026-08-08 原樣凍結），不套換色、不得修改。 -->
  <div class="ai-overlay" data-ai-overlay role="dialog" aria-modal="true" aria-label="體驗 AI 拿到設計理念後做的網站" hidden>
    <div class="ai-overlay-bar">
      <p class="st-note ai-overlay-note">AI ＋設計理念版</p>
      <button type="button" class="home-send" data-ai-exit>退出體驗</button>
    </div>
    <iframe title="AI 拿到設計理念後產出的網站" data-src="/process/ai-constitution-2026-08-08.html"></iframe>
  </div>
</section>

<section class="ai-run">
  <p class="st-ask">AI 做出來的成品，常常不是你心中所想的嗎？</p>
  <p class="st-note ai-cost">不管給出多詳細的需求，在設計上有些部分 AI 仍會自行決定。</p>
  <div class="ai-note">
    <p>以顏色選擇來說：AI 通常並不會細問，它腦中已經有些安全牌的配色可做，做出來的成品才會有一股說不出的 AI 味。</p>
    <p class="ai-note-exit">具體所有元素的決定及故事，請看展示櫃——正在整理中，敬請期待。</p>
  </div>
</section>

## 我實際經歷了什麼過程？

<p>先構思「設計憲法」並實際做出初版網站，再透過實際查看來調整細節，慢慢決定所有的元素。</p>

<ul class="tl">
  <li class="tl-era">
    <h2>起點</h2>
    <p>先自行構思，再開始與 AI 聊天，逐步完善想法</p>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">專案定位</div>
    <div class="tl-solo">這件 AI 實作的名稱定為「個人作品頁」，目的是證明有正確使用 AI 的實務，來實際解決遇到的問題。</div>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">核心理念</div>
    <!-- 這五條與層二那六條的關係是**先後，不是重複**（2026-08-08 本人定調）：
         五條是起點的粗胚，憲法是據它長出來的，六條是憲法交給 AI 的那一份。
         末句把讀者指回層二，撞車因此變成一條線。 -->
    <div class="tl-solo">決定所有元素的共同理念：<br />一、「易讀」永遠放在最優先。<br />二、保持低調但不失高級感。<br />三、具個人特色。<br />四、不過度的互動設計。<br />五、文字完全由本人主導。<br />再根據這五條，制定出具體的設計憲法——也就是上面給 AI 的那一份。</div>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">協作分工</div>
    <div class="tl-solo">由本人負責所有決策與驗收，程式與版面實作則交給 AI。</div>
  </li>

  <li class="tl-era">
    <h2>開始實作</h2>
    <p>討論所有元素的細節</p>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">視覺主色</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>通用的統計風樣板、以及米色經典配色、和跟隨系統的深淺色</div>
      <div class="cs-side cs-side--me"><em>最終決定</em>用個人特質決定顏色：暮紫作為背景主色，鋼藍作為元素主色</div>
    </div>
    <p class="cs-evi"><a href="/process/why-mist-purple.html">挑選顏色的心路歷程 →</a></p>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">動態設計</div>
    <div class="tl-solo"><em>逐項設計</em>元素互動經常被 AI 默默決定，這也會是 AI 感的來源之一，故根據共同理念逐項設計。</div>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">決策紀錄</div>
    <div class="tl-solo"><em>AI 即時記錄</em>協作時的每一個決定，AI 都會即時記進決策日誌，包含日期與當時的原話，這一頁的文字內容材料便由此整合而來。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>進行具體呈現的優化</p>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">呈現方式</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>整頁的文字說明、孤立的卡片元素</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>加入互動時間軸、拖曳比對、動畫呈現</div>
    </div>
  </li>
  <li class="tl-item" data-focus-group>
    <div class="cs-toggle-name">文字內容</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>AI 自動生成所有內容</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>AI 生成草稿，本人則進行語氣潤飾</div>
    </div>
    <div class="cs-pair">
      <div class="cs-pair-ai"><em>AI 草稿</em>右邊那版其實好看，但那套深底金字加紙紋理，AI 給誰都是這一套。跟我沒關係的東西，再好看也不留。</div>
      <div class="cs-pair-me"><em>潤飾後</em>初版是由 AI 主導生成的頁面，有明顯的 AI 痕跡。</div>
    </div>
  </li>
</ul>

<!-- 收尾（2026-08-08 本人定稿）：一句話、不在時間軸上。展示櫃入口暫封，等文字整理完再開。 -->
<div class="ai-close">
  <p>現在你正在看的網頁，就這樣被建好了！</p>
</div>

<script is:inline>
  /* 層一與層二的深度（票 01＋02＋06）。IIFE：ClientRouter 換頁會重跑，頂層宣告會撞名。
     兩層共用這一支：**差別只有有沒有送出鈕**——層一有，跑完整的送出→等待→揭曉；
     層二沒有，圖一開始就在，只接體驗入口。所以下面所有跟等待劇場有關的東西都關在
     `if (send)` 裡面，體驗入口那段兩層都跑。 */
  (() => {
    function initAiRun() {
      document.querySelectorAll('[data-ai-run]').forEach((run) => {
      if (run.dataset.wired) return;
      run.dataset.wired = '1';
      const send = run.querySelector('[data-ai-send]');
      const openBtn = run.querySelector('[data-ai-open]');
      const overlay = run.querySelector('[data-ai-overlay]');
      const exitBtn = run.querySelector('[data-ai-exit]');
      const shot = run.querySelector('[data-ai-shot]');
      const iframe = overlay.querySelector('iframe');
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* JS 到了才把按鈕放出來（沒 JS：圖直接可見、noscript 連結可點，讀者不損失內容）。 */
      openBtn.hidden = false;

      if (send) {
        send.hidden = false;
        /* is-staged 只有層一加：它是「圖先藏起來等按」的開關，層二的圖不該被藏。 */
        run.classList.add('is-staged');

        /* 送出 → 等待（進度條預設 3 秒，層二用 data-wait 拉到 5 秒；
           降低動態一律縮短為 1 秒，規格明文可縮短）→ 圖揭曉。 */
        const WAIT = still ? 1000 : Number(run.dataset.wait) || 3000;
        run.style.setProperty('--wait', WAIT + 'ms');
        send.addEventListener('click', () => {
          if (run.classList.contains('is-waiting') || run.classList.contains('is-shown')) return;
          run.classList.add('is-waiting');
          setTimeout(() => {
            run.classList.remove('is-waiting');
            run.classList.add('is-shown');
          }, WAIT);
        });
      }

      /* 展開＝原地長大（原型 B）。起點用 getBoundingClientRect() 現算，
         起點與終點不得同幀設定，否則瀏覽器不過場（原型驗過）。 */
      const setBox = (r) => {
        overlay.style.top = r.top + 'px';
        overlay.style.left = r.left + 'px';
        overlay.style.width = r.width + 'px';
        overlay.style.height = r.height + 'px';
      };
      const openUp = () => {
        if (!iframe.src) iframe.src = iframe.dataset.src; /* src 延後到這一刻（票 02） */
        overlay.hidden = false;
        if (still) {
          overlay.classList.add('is-full');
          exitBtn.focus();
          return;
        }
        setBox(shot.getBoundingClientRect());
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            overlay.classList.add('is-full');
            exitBtn.focus();
          }),
        );
      };
      const closeDown = () => {
        if (still) {
          overlay.classList.remove('is-full');
          overlay.hidden = true;
          openBtn.focus();
          return;
        }
        setBox(shot.getBoundingClientRect());
        overlay.classList.remove('is-full');
        /* 收回原位後才藏起來；時長與 CSS 的 --dur-lg 同步 */
        setTimeout(() => {
          overlay.hidden = true;
          openBtn.focus();
        }, 350);
      };
      openBtn.addEventListener('click', openUp);
      exitBtn.addEventListener('click', closeDown);
      /* 每層各自一個 keydown，各管各的 overlay。dataset.wired 擋住重跑，不會累積。 */
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) closeDown();
      });
      });
    }

    document.addEventListener('astro:page-load', initAiRun);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAiRun, { once: true });
    } else {
      initAiRun();
    }
  })();
</script>
