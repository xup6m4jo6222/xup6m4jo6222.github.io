---
title: 這個網站本身：與 AI 協作的建站過程
summary: 網站既是容器也是第一個 AI 專案。我定義問題、否決不合格的方案，程式碼與視覺由 AI 實作，全程留有決策紀錄。
category: ai
tags: [AI 協作, Claude Code, Astro, 決策紀錄]
links:
  github: https://github.com/xup6m4jo6222/xup6m4jo6222.github.io
date: 2026-07-16
---

<p class="cs-lead">你眼前的網站就是成品。我不寫前端，版面與程式碼由 Claude Code 產出；我的工作是問對問題、設下判準，然後把不合格的方案退回去。下面是退回去的那一次。</p>

<div class="cs-compare">
  <figure class="cs-panel">
    <img src="/images/portfolio-site/rejected-v1.png" alt="第一版首頁：暖金色點綴、方格紙紋理、散點趨勢線裝飾" width="1280" height="470" loading="lazy" />
    <figcaption>第一版，已否決</figcaption>
  </figure>
  <figure class="cs-panel cs-panel--kept">
    <img src="/images/portfolio-site/current-v2.png" alt="現行首頁：無紋理無裝飾，深色底配墨綠互動色" width="1280" height="470" loading="lazy" />
    <figcaption>改版後，現行</figcaption>
  </figure>
</div>
<p class="cs-compare-note">左邊那版好看，但那是 AI 對誰都會給的高級感：深色底、暖金點綴、紙紋理、統計圖示裝飾。跟我本人沒有關聯，所以整版退回。</p>

## 我拍板了什麼

<ul class="cs-cards">
  <li class="cs-card">
    <div class="cs-card-head"><span class="cs-chip cs-chip--veto">否決</span><h3>整版視覺退回重做</h3></div>
    <dl>
      <dt>AI 給的</dt><dd>暖金色點綴、方格紙紋理、散點迴歸線裝飾、大量等寬字體</dd>
      <dt>我要的</dt><dd>拿掉所有裝飾，留一個低調的墨綠色，只給連結和 hover 用</dd>
      <dt>理由</dt><dd class="cs-quote">「好看，但跟我本人沒有真正的關聯。」</dd>
    </dl>
  </li>
  <li class="cs-card">
    <div class="cs-card-head"><span class="cs-chip cs-chip--veto">否決</span><h3>不照 AI 的功能清單做</h3></div>
    <dl>
      <dt>AI 給的</dt><dd>三個現成的互動設計：捲動畫出迴歸線、卡片先答後揭、資料溯源 hover</dd>
      <dt>我要的</dt><dd>先寫一份不含實作建議的人物側寫，讓下一輪協作自行詮釋</dd>
      <dt>理由</dt><dd class="cs-quote">保留設計的開放性，不把 AI 當成執行清單的工具。</dd>
    </dl>
  </li>
  <li class="cs-card">
    <div class="cs-card-head"><span class="cs-chip">拍板</span><h3>網站永遠是深色</h3></div>
    <dl>
      <dt>AI 給的</dt><dd>跟著訪客的系統設定自動切換深淺色</dd>
      <dt>我要的</dt><dd>不管訪客設定，固定顯示深色</dd>
      <dt>理由</dt><dd class="cs-quote">個人偏好。網站要以我選定的樣子見人。</dd>
    </dl>
  </li>
  <li class="cs-card">
    <div class="cs-card-head"><span class="cs-chip">拍板</span><h3>內容寧缺勿假</h3></div>
    <dl>
      <dt>判準</dt><dd>作品用「看得見思考過程」篩選；分類頁沒有真實內容就留白，不放施工中或假卡片</dd>
      <dt>註記</dt><dd class="cs-quote">這條判準由 AI 提出、我認可採用，不是我原創的框架。</dd>
    </dl>
  </li>
</ul>

## 這次協作留下的制度

第一次改版後，我在正式網址上看不到變更，追查發現改動只停在本機。從那之後，協作流程多了一步：先確認在看哪個環境，再決定何時部署。這個教訓後來變成制度——專案內建了決策紀錄協議，我在協作中做出的每一次拍板、否決、修正，AI 都會即時寫進 repo 的 <code>DECISIONS.md</code>。這一頁的材料就是從那裡來的，不靠事後回憶。

<details>
  <summary>驗證方式與已知限制</summary>
  <p>目前的驗收是主觀的：親自刷新正式網址，對照「這是不是屬於我自己的樣子」判斷。</p>
  <p>對比度、跨瀏覽器測試這類量化指標尚未建立，列為待補項。這裡如實記錄，不假裝有。</p>
</details>
