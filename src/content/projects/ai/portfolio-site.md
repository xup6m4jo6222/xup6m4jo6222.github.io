---
title: "AI 專案 #1 個人作品頁"
summary: 這個網站的構思與方向出自本人，並與 Claude Code 一起討論，最終由它完成實作，並針對初版進行細節優化。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
cover: /images/portfolio-site/current-v3.png
---

<p class="cs-lead">這個網站就是一個與 AI 協作的成果，下面可以看到它如何一步步變成現在的樣子。</p>
<p class="cs-stats"><span>關鍵決策<b>22</b></span><i>·</i><span>頁面版本<b>3</b></span><i>·</i><span>修改紀錄<b>23</b></span><i>·</i><span>網站實作<b>2</b>天</span><i>·</i><span>本頁實作<b>2</b>天</span></p>
<p class="cs-wipe-invite">可以左右拖曳下方的對照圖，對比初版與最終定案的差距。</p>

<figure class="cs-wipe" style="margin:0">
  <img src="/images/portfolio-site/rejected-v1.png" alt="初版首頁，金色點綴與紙紋理" width="760" height="470" />
  <div class="cs-wipe-top">
    <img src="/images/portfolio-site/current-v3.png" alt="現行首頁，鈍紫藤視覺" width="760" height="470" />
  </div>
  <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
  <div class="cs-wipe-handle"></div>
  <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">最終版 2026-07-17 第3版</span>
  <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">初版 2026-07-08 第1版</span>
</figure>
<p class="cs-wipe-hint">初版其實已經不差了，但仍可以一眼看穿這是 AI 主導的設計。設計本該由本人決定，故最後選擇符合自己個性的配色。</p>

## 專案歷史

<ul class="tl">
  <li class="tl-era">
    <h2>想法的起點</h2>
    <p>在網站還不存在時，已經先有一些想法了</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">專案定位</div>
    <div class="tl-solo"><em>我起的頭</em>第一個 AI 專案定為「創建個人作品頁」，而目的是為了證明有能力正確使用 AI、發揮想像力，解決實際遇到的問題。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">協作分工</div>
    <div class="tl-solo"><em>我起的頭</em>由本人負責所有決策與驗收，程式與版面實作則交給 AI。</div>
    <p class="cs-evi"><span>原件</span><a href="https://github.com/xup6m4jo6222/xup6m4jo6222.github.io/blob/main/CLAUDE.md">協作協議 CLAUDE.md →</a></p>
  </li>

  <li class="tl-era">
    <h2>開始實作</h2>
    <p>此時與 AI 討論細節</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">視覺設計</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>通用的統計風樣板、以及米色經典配色、和跟隨系統的深淺色</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>用個人側寫決定方向、將頁面固定為深色，最終選定鈍紫藤作為最終統一配色</div>
    </div>
    <p class="cs-reason">核心是「易讀」，帶著「個人」色彩的頁面。</p>
    <p class="cs-reason">鈍紫藤是被灰調壓低的紫，有主張但不出聲。個人網站上幾乎沒有人用這個顏色，剛好，這個頁面本來就沒打算跟誰相像。</p>
    <p class="cs-evi"><span>原件</span><a href="/process/colors-palette.html">色彩評選：6 系 18 階，逐格比較後裁決 →</a></p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">動態設計</div>
    <div class="tl-solo"><em>逐項裁決</em>一個好的元素互動絕對是必要的，這也是最容易被 AI 默默決定的一層，也會是 AI 感的來源之一。</div>
    <p class="cs-reason">選擇的核心理念是「易讀」＋「低調」，且不過度設計。</p>
    <p class="cs-evi"><span>原件</span><a href="/process/">動效評選：四輪 27 個決策點 →</a></p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">決策存檔</div>
    <div class="tl-solo"><em>我起的頭</em>協作時的每一個決定，AI 都會即時記進決策日誌，包含日期與當時的原話，這一頁的文字內容材料便由此整合而來。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>進行具體呈現的優化</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">呈現方式</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>整頁的文字說明、孤立的卡片元素</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>加入互動時間軸、以及拖曳比對、且親自決定呈現動畫</div>
    </div>
    <figure class="cs-wipe cs-wipe--embed" style="margin:0">
      <img src="/images/portfolio-site/page-plain-text.png" alt="被否決的純文字版" width="760" height="470" loading="lazy" />
      <div class="cs-wipe-top">
        <img src="/images/portfolio-site/page-timeline-v3.png" alt="現行時間軸版" width="760" height="470" loading="lazy" />
      </div>
      <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
      <div class="cs-wipe-handle"></div>
      <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">時間軸版 2026-07-17 第3版</span>
      <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">純文字版 2026-07-16 第1版</span>
    </figure>
    <p class="cs-reason">核心理念仍是「易讀」，你剛剛所有看到的動畫效果便是成品。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">文字所有權</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 自動生成所有內容</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>所有的文字都由本人親自撰寫，AI 負責核對事實，這一頁的文字便是這樣來的</div>
    </div>
    <div class="cs-pair">
      <div class="cs-pair-ai"><em>同一句話　—　AI 的草稿</em>右邊那版其實好看，但那套深底金字加紙紋理，AI 給誰都是這一套。跟我沒關係的東西，再好看也不留。</div>
      <div class="cs-pair-me"><em>本人重寫後（現行版本）</em>初版其實已經不差了，但仍可以一眼看穿這是 AI 主導的設計。設計本該由本人決定，故最後選擇符合自己個性的配色。</div>
    </div>
    <p class="cs-reason">站上每句對外文字都走過同一道工序：AI 先出草稿，本人逐段重寫，AI 只回頭核對錯字與事實。</p>
    <p class="cs-reason">一樣的理念，這是「個人」頁面，且 AI 的文字都有明顯的 AI 感，讀起來並不「易讀」。</p>
  </li>
</ul>

<p class="cs-stats" style="margin-top:2rem"><span>對照評選<b>4</b>輪</span><i>·</i><span>被評估選項<b>40+</b></span><i>·</i><span>過程原件<b>7</b>件</span><i>·</i><a href="/process/">全部原件</a></p>
<p class="cs-raw"><span class="cs-rawchip">過程原件・未修飾</span>原件包含 AI 當時的選項與建議。</p>

<script>
(() => {
  function init() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasIO = 'IntersectionObserver' in window;

    document.querySelectorAll('.cs-wipe').forEach((wipe) => {
      const range = wipe.querySelector('input');
      if (!range) return;
      const set = () => wipe.style.setProperty('--pos', range.value + '%');
      range.addEventListener('input', set);
      set();
    });

    // 比對器把手第一次進入視野時，示範擺動一次
    if (!reduce && hasIO) {
      const demoIo = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('demo-handle');
              demoIo.unobserve(entry.target);
            }
          }),
        { threshold: 0.5 }
      );
      document.querySelectorAll('.cs-wipe').forEach((wipe) => demoIo.observe(wipe));
    }

    const items = document.querySelectorAll('.tl-item');
    if (reduce || !hasIO) {
      items.forEach((el) => {
        el.classList.add('is-centered');
        const track = el.querySelector('.cs-track');
        if (track) track.classList.add('is-decided');
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-centered', entry.isIntersecting);
          if (entry.isIntersecting) {
            const track = entry.target.querySelector('.cs-track');
            if (track && !track.dataset.done) {
              track.dataset.done = '1';
              setTimeout(() => track.classList.add('is-decided'), 220);
            }
          }
        }),
      { rootMargin: '-35% 0px -35% 0px' }
    );
    items.forEach((el) => io.observe(el));
  }

  document.addEventListener('astro:page-load', init);
})();
</script>
