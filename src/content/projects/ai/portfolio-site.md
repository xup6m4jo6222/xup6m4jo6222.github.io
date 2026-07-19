---
title: "AI 專案 #1 個人作品頁"
summary: 這個網站的構思與方向出自本人，並與 Claude Code 一起討論，最終由它完成實作，並針對初版進行細節優化。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
cover: /images/portfolio-site/current-v6.png
---

<p class="cs-lead">我將「創建個人作品頁」作為第一個正式 AI 專案，下面會簡單呈現網站被建立的過程。</p>
<p class="cs-stats"><span>關鍵決策<b>34</b></span><i>·</i><span>頁面版本<b>3</b></span><i>·</i><span>修改紀錄<b>29</b></span><i>·</i><span>網站實作<b>2</b>天</span><i>·</i><span>本頁實作<b>2</b>天</span></p>
<p class="cs-wipe-invite">可以左右拖曳下方的滑桿，對比最終版（左邊）與初版（右邊）差距。</p>

<figure class="cs-wipe" style="margin:0">
  <img src="/images/portfolio-site/rejected-v1.png" alt="初版首頁，金色點綴與紙紋理" width="760" height="470" />
  <div class="cs-wipe-top">
    <img src="/images/portfolio-site/current-v6.png" alt="現行首頁，第6版視覺" width="760" height="470" />
  </div>
  <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
  <div class="cs-wipe-handle"></div>
  <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">最終版 2026-07-19 第6版</span>
  <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">初版 2026-07-08 第1版</span>
</figure>
<p class="cs-wipe-hint">初版是由 AI 主導生成的頁面，有明顯的 AI 痕跡。</p>

## 專案歷史

<ul class="tl">
  <li class="tl-era">
    <h2>起點</h2>
    <p>先自行構思，再開始與 AI 聊天，逐步完善想法</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">專案定位</div>
    <div class="tl-solo">AI 專案名稱定為「個人作品頁」，目的是證明有正確使用 AI 的實務，來實際解決遇到的問題。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">核心理念</div>
    <div class="tl-solo">決定所有元素的共同理念：<br />一、「易讀」永遠放在最優先。<br />二、保持低調但不失高級感。<br />三、具個人特色。<br />四、不過度的互動設計。<br />五、文字完全由本人主導。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">協作分工</div>
    <div class="tl-solo">由本人負責所有決策與驗收，程式與版面實作則交給 AI。</div>
    <p class="cs-evi"><span>原件</span><span>協作協議 CLAUDE.md（尚未開放，整理中）</span></p>
  </li>

  <li class="tl-era">
    <h2>開始實作</h2>
    <p>討論所有元素的細節</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">視覺主色</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>通用的統計風樣板、以及米色經典配色、和跟隨系統的深淺色</div>
      <div class="cs-side cs-side--me"><em>最終決定</em>用個人特質決定顏色：暮紫作為背景主色，鋼藍作為元素主色</div>
    </div>
    <p class="cs-evi"><a href="/process/why-mist-purple.html">挑選顏色的心路歷程 →</a></p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">動態設計</div>
    <div class="tl-solo"><em>逐項設計</em>元素互動經常被 AI 默默決定，這也會是 AI 感的來源之一，故根據共同理念逐項設計。</div>
    <p class="cs-evi"><span>原件</span><span>動效的設計對話（尚未開放，整理中）</span></p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">決策紀錄</div>
    <div class="tl-solo"><em>AI 即時記錄</em>協作時的每一個決定，AI 都會即時記進決策日誌，包含日期與當時的原話，這一頁的文字內容材料便由此整合而來。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>進行具體呈現的優化</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">呈現方式</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>整頁的文字說明、孤立的卡片元素</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>加入互動時間軸、拖曳比對、動畫呈現</div>
    </div>
    <figure class="cs-wipe cs-wipe--embed" style="margin:0">
      <img src="/images/portfolio-site/page-plain-text.png" alt="被否決的純文字版" width="760" height="470" loading="lazy" />
      <div class="cs-wipe-top">
        <img src="/images/portfolio-site/page-timeline-v6.png" alt="現行時間軸版" width="760" height="470" loading="lazy" />
      </div>
      <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
      <div class="cs-wipe-handle"></div>
      <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">時間軸版 2026-07-19 第6版</span>
      <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">純文字版 2026-07-16 第1版</span>
    </figure>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">文字內容</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 初版</em>AI 自動生成所有內容</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>AI 生成草稿，本人則進行語氣潤飾</div>
    </div>
    <div class="cs-pair">
      <div class="cs-pair-ai"><em>AI 草稿</em>右邊那版其實好看，但那套深底金字加紙紋理，AI 給誰都是這一套。跟我沒關係的東西，再好看也不留。</div>
      <div class="cs-pair-me"><em>潤飾後</em>初版是由 AI 主導生成的頁面，有明顯的 AI 痕跡。</div>
    </div>
    <p class="cs-reason">AI 生成的內容文字會有明顯的 AI 感，讀起來並不「易讀」。</p>
  </li>
</ul>

<p class="cs-stats" style="margin-top:2rem"><span>對照評選<b>4</b>輪</span><i>·</i><span>被評估選項<b>40+</b></span><i>·</i><span>設計對話<b>5</b>篇</span><i>·</i><span>全部對話（尚未開放，整理中）</span></p>
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
      items.forEach((el) => el.classList.add('is-centered'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-centered', entry.isIntersecting);
        }),
      { rootMargin: '-35% 0px -35% 0px' }
    );
    items.forEach((el) => io.observe(el));
  }

  document.addEventListener('astro:page-load', init);
})();
</script>
