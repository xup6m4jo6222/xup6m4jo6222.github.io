// 開場線稿：一筆一筆描出來（筆順圖由 make-intro-order.py 算出：遠的先、近的後，段內沿著線長出去）
// 普通腳本、不等 three.js：頁面一出現就開始畫。畫完 window.__introDrawn 會 resolve，主程式才開始上色。
(function () {
  let doneFn; window.__introDrawn = new Promise(r => { doneFn = r; });
  const box = document.getElementById('loading'), img = box && box.querySelector('.ld-lines');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let returning = false; try { returning = localStorage.getItem('v30-entry') === 'room'; } catch {}
  const DRAW = returning ? 1.8 : 3.4;   // 秒；來過的人畫快一點。房間先下載好就加速畫完（window.__ldHurry），不讓線稿拖住上色
  const cv = document.createElement('canvas'); cv.className = 'ld-draw'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, alpha: false });
  if (!box || !img || !gl || reduce) { doneFn(); return; }   // 不支援或要求減少動態：直接顯示整張線稿
  img.style.visibility = 'hidden'; img.after(cv);
  const vs = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = `precision mediump float; varying vec2 v; uniform sampler2D L, O; uniform float T; uniform vec4 C;
    void main(){
      vec2 uv = vec2(C.x + v.x * C.y, C.z + (1.0 - v.y) * C.w);
      vec3 bg = vec3(29.0, 17.0, 25.0) / 255.0;
      vec3 l = texture2D(L, uv).rgb; float o = texture2D(O, uv).r * 255.0;
      float on = step(0.5, o), t = (o - 1.0) / 254.0;
      float rev = clamp((T - t) / 0.025, 0.0, 1.0) * on;
      float lw = clamp((dot(l, vec3(0.333)) - 0.086) / 0.79, 0.0, 1.0);
      float glow = exp(-pow((T - t) / 0.01, 2.0)) * on * lw * lw;
      gl_FragColor = vec4(bg + (l - bg) * rev + vec3(0.59, 0.69, 0.92) * glow * 0.5, 1.0);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); img.style.visibility = ''; doneFn(); return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit, im, nearest) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    const f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  // 先照網頁開頭預先下載的那份拿（一開始就走兩家同時抓，會接不上預先下載、同一張圖抓兩三次）；
  // 2.5 秒還沒到就是主網址卡住了，改向第二家 CDN 要一份（線稿圖到不了，線稿就畫不完、上色也開始不了）
  const img2 = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // 正式網站：網頁開頭已經用 __hfetch 開始抓（兩家同時、先到先用），拿同一份
  const load = src => window.__cdn ? window.__hfetch(src).then(b => img2(URL.createObjectURL(b))) : new Promise((res, rej) => {
    let done = false; const ok = i => { if (!done) { done = true; res(i); } };
    img2(src).then(ok, () => {});
    setTimeout(() => { if (!done && window.__hfetch && window.__srcs.length > 1) window.__hfetch(src, 2500, 1).then(b => img2(URL.createObjectURL(b))).then(ok, rej); }, 2500);
  });
  const uT = gl.getUniformLocation(pr, 'T'), uC = gl.getUniformLocation(pr, 'C');
  let iw = 1600, ih = 873;
  function fit() {   // 與 .loading img 的 object-fit: cover、object-position: 53% 50% 相同的裁切
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); gl.viewport(0, 0, cv.width, cv.height);
    const ia = iw / ih, ca = w / h;
    if (ca > ia) { const f = ia / ca; gl.uniform4f(uC, 0, 1, 0.5 * (1 - f), f); } else { const f = ca / ia; gl.uniform4f(uC, 0.53 * (1 - f), f, 0, 1); }
  }
  Promise.all([load(img.getAttribute('src')), load('intro-order.png')]).then(([li, oi]) => {
    iw = li.naturalWidth; ih = li.naturalHeight;
    gl.uniform1i(gl.getUniformLocation(pr, 'L'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'O'), 1);
    tex(0, li, false); tex(1, oi, true);
    fit(); addEventListener('resize', fit);
    let last = performance.now(), T = 0, signaled = false;
    (function draw(now) {
      // 線稿是遮住「房間還在準備」的過場：房間好了（__ldHurry）剩下的線四倍速畫完，馬上接上色
      // 照實際經過的時間推進（以前每格最多算 0.1 秒，電腦忙著載程式時線稿會越畫越慢）
      T = Math.min(1.06, T + Math.min(0.5, (now - last) / 1000) / DRAW * 1.06 * (window.__ldHurry ? 4 : 1)); last = now;
      gl.uniform1f(uT, T); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (T >= 1.0 && !signaled) { signaled = true; doneFn(); performance.mark('ld:drawn'); }
      if (T < 1.06 && !document.body.classList.contains('loaded')) requestAnimationFrame(draw);
    })(last);
  }).catch(() => { cv.remove(); img.style.visibility = ''; doneFn(); });
})();

// 載入進度（郁為 10/9：要很明顯告訴對方正在載入）：一開頁就動，不等三維程式庫。
// 下載占 90%：照發布時算好的必要檔案清單（window.__ldFiles，檔名→位元組），看已經下載完的檔案加起來多少；
// 上色占 7%（主程式給 window.__ldColor），最後準備房間那一下到 97–99%（window.__ldTarget）。沒有清單（本機預覽）就照時間慢慢爬
(function () {
  const el = document.getElementById('loading'), pct = el && el.querySelector('.ld-pct');
  if (!el) return;
  const files = window.__ldFiles, total = files ? Object.values(files).reduce((a, b) => a + b, 0) : 0;
  const t0 = performance.now(); let shown = 0, dl = 0, lastScan = 0;
  function scan() {
    let got = 0; const seen = {};
    for (const e of performance.getEntriesByType('resource')) {
      const m = /\/room\/([^?#]+)/.exec(e.name); if (!m) continue;
      const k = m[1].startsWith('intro-color-') ? 'intro-color-' : m[1];
      if (files[k] && !seen[k]) { seen[k] = 1; got += files[k]; }
    }
    // 背景執行緒抓的檔案不會出現在網頁的下載紀錄裡：照 __hfetch 回報的完成清單補上
    for (const f in window.__hdone || {}) { const k = f.startsWith('intro-color-') ? 'intro-color-' : f; if (files[k] && !seen[k]) { seen[k] = 1; got += files[k]; } }
    return got / total;
  }
  (function tick(now) {
    if (total && now - lastScan > 150) { dl = scan(); lastScan = now; }
    const base = total ? 0.9 * dl : 0.12 * (1 - Math.exp(-(now - t0) / 2500));
    const target = Math.max(base + 0.07 * (window.__ldColor || 0), window.__ldTarget || 0);
    shown += (target - shown) * 0.1;
    const done = el.classList.contains('colored');
    el.style.setProperty('--q', done ? '1' : shown.toFixed(4));
    const txt = (done ? 100 : Math.min(99, Math.floor(shown * 100))) + '%';
    if (pct && pct.textContent !== txt) pct.textContent = txt;
    if (!done) requestAnimationFrame(tick);
  })(t0);
})();
