---
title: 這個網站就是我的第一個 AI 專案
summary: 這個網站由我主要構思，並與 Claude Code 一起討論，最終由它完成初版，從初版開始慢慢優化。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
cover: /images/portfolio-site/current-v2.png
---

<p class="cs-lead">可以左右拖曳以下的框框，對比初版與最終定案的差距。</p>

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
    <h2>想法的起點</h2>
    <p>在這個網站還不存在的時候，我擁有了一些想法</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">專案定位</div>
    <div class="tl-solo"><em>我起的頭</em>我決定第一個 AI 專案就是「創建個人 AI 作品頁」，這是為了證明我能夠正確使用 AI，且具有想像力，來解決實際會遇到的任何問題。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">設計方向</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 一開始根據「統計」給出相關通用設計</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>利用 AI Chat 的記憶功能，貼上記憶總結，來讓此專案的設計更貼合個人個性及喜好</div>
    </div>
    <p class="cs-reason">我要呈現的是「個人」，並不是一個花裡胡哨的頁面。</p>
  </li>

  <li class="tl-era">
    <h2>開始實作</h2>
    <p>此時與 AI 討論細節</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">視覺方向</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>金色點綴、紙紋理、統計圖裝飾</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>全部拿掉，只留墨綠一色，不用太華麗的互動</div>
    </div>
    <p class="cs-reason">因為我的核心重點是「易讀」。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">深淺色</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>跟著訪客的系統設定自動切換</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>永遠深色</div>
    </div>
    <p class="cs-reason">個人偏好。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">部署流程</div>
    <div class="tl-solo"><em>一次事故換來的</em>改完版在正式網址上什麼都沒看到，仔細研究才發現改動只放在本機，故特別多學了網站佈署上線的流程，收穫豐富。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>進行具體呈現的優化</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">決策存檔</div>
    <div class="tl-solo"><em>我起的頭</em>專案裡有一份 DECISIONS.md，在協作時我的每一個決定，AI 就會即時記上，這一頁的材料全部從那裡整合而來的。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">呈現方式</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>給了整頁的文字說明</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>要有基礎的互動、要有一定的視覺化</div>
    </div>
    <p class="cs-reason">我的核心理念是「易讀」且「具特色設計感」，相信沒有人想要只看看一大堆的文字。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">文字所有權</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 自動生成所有內容</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>所有的文字都是我自己寫的，AI 只核對事實，這一頁的字就是這樣來</div>
    </div>
    <p class="cs-reason">一樣的理念，我正在做「個人」頁面，且 AI 的文字都有明顯的 AI 感，讀起來並不「易讀」。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">這條時間軸</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 放入孤立的卡片元素</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>加入時間軸設計，以及親自設計呈現動畫。你剛剛所有的滑動，都是這個決定的成品。</div>
    </div>
    <p class="cs-reason">保持「易讀」理念，我認為這個設計會更讓人理解建立專案的經過。</p>
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
