// 開場線稿：一筆一筆描出來（筆順圖由 make-intro-order.py 算出：遠的先、近的後，段內沿著線長出去）
// 普通腳本、不等 three.js：頁面一出現就開始畫。畫完 window.__introDrawn 會 resolve，主程式才開始上色。
(function () {
  let doneFn; window.__introDrawn = new Promise(r => { doneFn = r; });
  const box = document.getElementById('loading'), img = box && box.querySelector('.ld-lines');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let returning = false; try { returning = localStorage.getItem('v30-entry') === 'room'; } catch {}
  const DRAW = returning ? 1.8 : 3.4;   // 秒；來過的人畫快一點
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
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
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
    const t0 = performance.now(); let signaled = false;
    (function draw(now) {
      const T = Math.min(1.06, (now - t0) / 1000 / DRAW * 1.06);
      gl.uniform1f(uT, T); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (T >= 1.0 && !signaled) { signaled = true; doneFn(); }
      if (T < 1.06 && !document.body.classList.contains('loaded')) requestAnimationFrame(draw);
    })(t0);
  }).catch(() => { cv.remove(); img.style.visibility = ''; doneFn(); });
})();
