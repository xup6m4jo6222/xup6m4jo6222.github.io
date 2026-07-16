---
title: 這個網站就是我的第一個 AI 專案
summary: 這個網站由我主要構思，並與 Claude Code 一起討論，最終由它完成初版，從初版開始慢慢優化。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
---

<p class="cs-lead">可以左右拖曳一下以下的框框，對比一下初版與最終定案的差距。</p>

<figure class="cs-wipe" style="margin:0">
  <img src="/images/portfolio-site/rejected-v1.png" alt="初版首頁，金色點綴與紙紋理" width="760" height="470" />
  <div class="cs-wipe-top">
    <img src="/images/portfolio-site/current-v2.png" alt="最終版首頁，深色底，無裝飾" width="760" height="470" />
  </div>
  <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
  <div class="cs-wipe-handle"></div>
  <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">最終版</span>
  <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">初版</span>
</figure>
<p class="cs-wipe-hint">原本初版其實已經蠻好看的了，但仍然非常明顯是由 AI 完全主導的設計，我認為設計方面應該由我自行決定，選擇了一個符合我個性及喜好的配色。</p>

## 決策時間軸

<ul class="tl">
  <li class="tl-era">
    <h2>起點</h2>
    <p>網站還不存在的時候</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">專案定位</div>
    <div class="tl-solo"><em>我起的頭</em>考完試後的第一個 AI 專案就做個人作品頁，網站要證明的是我能用 AI 解決問題，而且問對問題。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">設計方向</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="設計方向，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>用統計主題化的通用設計</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>特色要來自 AI 對我的了解</div>
    </div>
    <p class="cs-reason">貼滿統計符號不等於我，那只是貼標籤。</p>
  </li>

  <li class="tl-era">
    <h2>建站</h2>
    <p>視覺與底線在這段定下來</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">視覺方向</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="視覺方向，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>金色點綴、紙紋理、統計圖裝飾</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>全部拿掉，只留墨綠一色，不用太華麗的互動</div>
    </div>
    <p class="cs-reason">因為我的核心重點是「易讀」。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">深淺色</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="深淺色，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>跟著訪客的系統設定自動切換</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>永遠深色</div>
    </div>
    <p class="cs-reason">個人偏好。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">互動功能</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="互動功能，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>三個現成的互動效果，直接可做</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>先寫一份人物側寫，讓 AI 自己詮釋</div>
    </div>
    <p class="cs-reason">設計要留開放性，AI 不是執行清單的工具。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">內容底線</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="內容底線，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 提的</em>沒有真作品就留白，不放假卡片</div>
      <div class="cs-side cs-side--me"><em>我照收</em>這條一個字都沒改</div>
    </div>
    <p class="cs-reason">判準是 AI 的，決定採用的人是我。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">部署流程</div>
    <div class="tl-solo"><em>一次事故換來的</em>改完版在正式網址上什麼都沒看到，追查才發現改動只停在本機。從此多一步，先確認看的是哪個環境，再談部署。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>回頭雕這一頁自己，包含你正在看的這條時間軸</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">決策存檔</div>
    <div class="tl-solo"><em>我起的頭</em>專案裡有一份 DECISIONS.md，在協作時我的每一個決定，AI 就會即時記上，這一頁的材料全部從那裡整合而來的。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">呈現方式</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="呈現方式，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的</em>整頁文字說明</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>要互動、要視覺化，沒人想看一堆字</div>
    </div>
    <p class="cs-reason">驗收標準是高級感、設計感、易讀、跟網站不違和、文字不能有 AI 味。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">文字所有權</div>
    <div class="cs-track" role="button" tabindex="0" aria-label="文字所有權，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的</em>AI 起草，人挑毛病</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>所有字我自己寫，AI 只核對事實</div>
    </div>
    <p class="cs-reason">這一頁的字就是這樣來的。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">這條時間軸</div>
    <div class="tl-solo"><em>最新一次拍板</em>卡片改成時間軸，捲動到中間才完整浮現。你剛剛捲過的每一下，都是這個決定的成品。</div>
  </li>
</ul>

<script>
(() => {
  const wipe = document.querySelector('.cs-wipe');
  if (wipe) {
    const range = wipe.querySelector('input');
    const set = () => wipe.style.setProperty('--pos', range.value + '%');
    range.addEventListener('input', set);
    set();
  }

  document.querySelectorAll('.cs-track').forEach((t) => {
    const flip = () => t.classList.toggle('is-decided');
    t.addEventListener('click', flip);
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      }
    });
  });

  const items = document.querySelectorAll('.tl-item');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
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
})();
</script>
