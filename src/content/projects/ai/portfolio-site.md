---
title: "AI 專案 #1 個人作品頁"
summary: 這個網站的構思與方向出自本人，並與 Claude Code 一起討論，最終由它完成實作，並針對初版進行細節優化。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
cover: /images/portfolio-site/current-v2.png
---

<p class="cs-lead">這個網站就是一個與 AI 協作的成果，下面可以看到它如何一步步變成現在的樣子。</p>
<p class="cs-stats"><span>關鍵決策<b>19</b></span><i>·</i><span>頁面版本<b>3</b></span><i>·</i><span>修改紀錄<b>26</b></span><i>·</i><span>網站實作<b>2</b>天</span><i>·</i><span>本頁實作<b>2</b>天</span></p>
<p class="cs-wipe-invite">可以左右拖曳下方的對照圖，對比初版與最終定案的差距。</p>

<figure class="cs-wipe" style="margin:0">
  <img src="/images/portfolio-site/rejected-v1.png" alt="初版首頁，金色點綴與紙紋理" width="760" height="470" />
  <div class="cs-wipe-top">
    <img src="/images/portfolio-site/current-v2.png" alt="最終版首頁，深色底，無裝飾" width="760" height="470" />
  </div>
  <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
  <div class="cs-wipe-handle"></div>
  <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">最終版 2026-07-08 第2版</span>
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
    <div class="cs-toggle-name">設計方向</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 一開始根據「統計」給出相關通用設計</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>利用 AI Chat 的記憶功能，貼上記憶總結，來讓此專案的設計更貼合個人個性及喜好</div>
    </div>
    <p class="cs-reason">要呈現的是「個人」，而不是一個華麗但空洞的頁面。</p>
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
    <p class="cs-reason">核心重點是「易讀」。</p>
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
    <div class="tl-solo"><em>一次事故換來的</em>改完版才發現任何改動都只放在本機，因此特別學習網站部署上線的流程，補足了原先不足的弱點。</div>
  </li>

  <li class="tl-era">
    <h2>上線後</h2>
    <p>進行具體呈現的優化</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">決策存檔</div>
    <div class="tl-solo"><em>我起的頭</em>專案裡有一份 DECISIONS.md，在協作時，任何決定會即時讓 AI 記上，這一頁的材料便由此檔案整合而來。</div>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">呈現方式</div>
    <figure class="cs-wipe cs-wipe--embed" style="margin:0">
      <img src="/images/portfolio-site/page-plain-text.png" alt="被否決的純文字版頁面" width="760" height="470" loading="lazy" />
      <div class="cs-wipe-top">
        <img src="/images/portfolio-site/page-visual.png" alt="現行視覺化版頁面" width="760" height="470" loading="lazy" />
      </div>
      <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
      <div class="cs-wipe-handle"></div>
      <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">視覺化版 2026-07-17 第3版</span>
      <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">純文字版 2026-07-16 第1版</span>
    </figure>
    <p class="cs-reason">要有基礎的互動、要有一定的視覺化。核心理念是「易讀」且「具設計感」，沒有人想要只看一大堆的文字。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">文字所有權</div>
    <div class="cs-track">
      <div class="cs-side cs-side--ai"><em>AI 給的意見</em>AI 自動生成所有內容</div>
      <div class="cs-side cs-side--me"><em>我的決定</em>所有的文字都由本人親自撰寫，AI 負責核對事實，這一頁的文字便是這樣來的</div>
    </div>
    <p class="cs-reason">一樣的理念，這是「個人」頁面，且 AI 的文字都有明顯的 AI 感，讀起來並不「易讀」。</p>
  </li>
  <li class="tl-item">
    <div class="cs-toggle-name">這條時間軸</div>
    <figure class="cs-wipe cs-wipe--embed" style="margin:0">
      <img src="/images/portfolio-site/page-cards.png" alt="被否決的純卡片版頁面" width="760" height="470" loading="lazy" />
      <div class="cs-wipe-top">
        <img src="/images/portfolio-site/page-timeline.png" alt="現行時間軸版頁面" width="760" height="470" loading="lazy" />
      </div>
      <input type="range" min="0" max="100" value="55" aria-label="拖曳比對兩個版本" />
      <div class="cs-wipe-handle"></div>
      <span class="cs-wipe-tag cs-wipe-tag--new" style="left:0.6rem;right:auto">時間軸版 2026-07-17 第3版</span>
      <span class="cs-wipe-tag cs-wipe-tag--old" style="right:0.6rem;left:auto">純卡片版 2026-07-16 第2版</span>
    </figure>
    <p class="cs-reason">加入時間軸設計，以及親自設計呈現動畫。你剛剛所有的滑動，都是這個決定的成品。保持「易讀」的理念，這個設計更能讓人理解專案的經過。</p>
  </li>
</ul>

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
