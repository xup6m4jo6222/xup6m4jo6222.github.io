---
title: 這個網站本身就是第一件作品
summary: 網站由我與 Claude Code 協作完成。我定義問題、退回不合格的方案，每一次拍板都留有紀錄。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
---

<p class="cs-lead">你眼前的網站就是成品。程式碼和版面出自 Claude Code，我負責問對問題，把不合格的方案退回去。下面這個框，左右拖一下。</p>

<figure class="cs-wipe" style="margin:0">
  <img src="/images/portfolio-site/rejected-v1.png" alt="被退回的第一版首頁，金色點綴與紙紋理" width="760" height="470" />
  <div class="cs-wipe-top">
    <img src="/images/portfolio-site/current-v2.png" alt="現行首頁，深色底，無裝飾" width="760" height="470" />
  </div>
  <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
  <div class="cs-wipe-handle"></div>
  <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">現行</span>
  <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">被退回的第一版</span>
</figure>
<p class="cs-wipe-hint">右邊那版其實好看，但那套深底金字加紙紋理，AI 給誰都是這一套。跟我沒關係的東西，再好看也不留。</p>

## 四次拍板

<ul class="cs-toggles">
  <li>
    <div class="cs-toggle-name">視覺方向</div>
    <div class="cs-track" data-flip="0" role="button" tabindex="0" aria-label="視覺方向，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的</em>金色點綴、紙紋理、統計圖裝飾</div>
      <div class="cs-side cs-side--me"><em>我改成</em>全部拿掉，只留一色墨綠給互動元素</div>
    </div>
    <p class="cs-reason">「好看，但跟我本人沒有真正的關聯。」</p>
  </li>
  <li>
    <div class="cs-toggle-name">互動功能</div>
    <div class="cs-track" data-flip="1" role="button" tabindex="0" aria-label="互動功能，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的</em>三個現成的互動效果，直接可做</div>
      <div class="cs-side cs-side--me"><em>我改成</em>先寫一份人物側寫，讓 AI 自己詮釋</div>
    </div>
    <p class="cs-reason">設計要留開放性，AI 不是執行清單的工具。</p>
  </li>
  <li>
    <div class="cs-toggle-name">深淺色</div>
    <div class="cs-track" data-flip="2" role="button" tabindex="0" aria-label="深淺色，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的</em>跟著訪客的系統設定自動切換</div>
      <div class="cs-side cs-side--me"><em>我改成</em>永遠深色</div>
    </div>
    <p class="cs-reason">個人偏好。網站要以我選定的樣子見人。</p>
  </li>
  <li>
    <div class="cs-toggle-name">內容底線</div>
    <div class="cs-track cs-track--kept">
      <div class="cs-side cs-side--ai"><em>AI 提的</em>沒有真作品就留白，不放假卡片</div>
      <div class="cs-side cs-side--me"><em>我照收</em>這條一個字都沒改</div>
    </div>
    <p class="cs-reason">判準是 AI 的，決定採用的人是我。寧缺勿假。</p>
  </li>
</ul>

## 拍板都有存檔

這些內容不靠回憶。專案裡有一份 <code>DECISIONS.md</code>，協作中我每做一次決定，AI 就即時記一行，這一頁的材料全部從那裡來。起因是一次小事故，我改完版之後在正式網址上什麼都沒看到，追查才發現改動只停在本機。從此流程多了一步，先確認看的是哪個環境，再談部署。

<details>
  <summary>驗證方式與已知限制</summary>
  <p>驗收目前是主觀的。我親自刷新正式網址，對照「這是不是屬於我自己的樣子」來判斷。</p>
  <p>對比度、跨瀏覽器測試這類量化指標還沒建立，列為待補。這裡如實記錄。</p>
</details>

<script>
(() => {
  const wipe = document.querySelector('.cs-wipe');
  if (wipe) {
    const range = wipe.querySelector('input');
    const set = () => wipe.style.setProperty('--pos', range.value + '%');
    range.addEventListener('input', set);
    set();
  }
  const tracks = document.querySelectorAll('.cs-track[data-flip]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    tracks.forEach((t) => t.classList.add('is-decided'));
  } else {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          setTimeout(
            () => entry.target.classList.add('is-decided'),
            300 + Number(entry.target.dataset.flip) * 200
          );
        }),
      { threshold: 0.6 }
    );
    tracks.forEach((t) => io.observe(t));
  }
  tracks.forEach((t) => {
    const flip = () => t.classList.toggle('is-decided');
    t.addEventListener('click', flip);
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      }
    });
  });
})();
</script>
