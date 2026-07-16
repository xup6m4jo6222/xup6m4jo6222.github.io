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

## 專案中有以下較重要的決定

<ul class="cs-toggles">
  <li>
    <div class="cs-toggle-name">視覺方向</div>
    <div class="cs-track" data-flip="0" role="button" tabindex="0" aria-label="視覺方向，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>金色點綴、紙紋理、統計圖裝飾</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>全部拿掉，只留墨綠一色，不用太華麗的互動</div>
    </div>
    <p class="cs-reason">因為我的核心重點是「易讀」。</p>
  </li>
  <li>
    <div class="cs-toggle-name">深淺色</div>
    <div class="cs-track" data-flip="1" role="button" tabindex="0" aria-label="深淺色，點擊切換兩個方案">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>跟著訪客的系統設定自動切換</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>永遠深色</div>
    </div>
    <p class="cs-reason">個人偏好。</p>
  </li>
</ul>

## 實際歷程都有被記錄

專案裡有一份 <code>DECISIONS.md</code>，在協作時我的每一個決定，AI 就會即時記上，這一頁的材料全部從那裡整合而來的。

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
