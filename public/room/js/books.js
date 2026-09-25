// 網頁即時畫的書：依作品自動產生，書脊燙金書名，能拿出、翻開、翻頁。
// 書本自身座標（閱讀框）：X 由書脊指向書口、Y 朝上、Z 朝讀者（封面）。原點＝書脊中線。
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const PALETTE = {
  // 書布色（sRGB）：從暮紫、鋼藍延伸，外加象牙與炭色，燙金色只有兩種
  cloth: ['#2b3a57', '#3b2438', '#4a6185', '#553f63', '#1f2a3d', '#6b4a5e', '#d6cdbd', '#2a2530', '#3d5170', '#5a3346'],
  foilGold: '#c9a867', foilPale: '#e4dccb',
};

function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rand(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }
const isCJK = s => /[㐀-鿿豈-﫿]/.test(s);
const lum = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };

export class BookKit {
  constructor() {
    const L = new THREE.TextureLoader();
    const rep = (t, r) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(r, r); t.anisotropy = 8; return t; };
    this.linenNormal = rep(L.load('tex/linen-normal.webp'), 3);
    this.linenDetail = L.load('tex/linen-detail.webp');
    this.paper = L.load('tex/paper.webp'); this.paper.colorSpace = THREE.SRGBColorSpace;
    this.linenImg = new Image(); this.linenImg.src = 'tex/linen-detail.webp';
    this.paperImg = new Image(); this.paperImg.src = 'tex/paper.webp';
    this.edgeTex = this.makeEdgeTexture();
  }
  // 字型最多等 ms 毫秒（中文字型從 Google 下載可能要好幾秒，不能讓開場乾等）；回傳 true 表示字型都到了
  async ready(ms = 1200) {
    const all = Promise.all([this.linenImg.decode().catch(() => {}), this.paperImg.decode().catch(() => {}),
      document.fonts.load('700 40px "LXGW WenKai TC"'), document.fonts.load('400 40px "LXGW WenKai TC"'),
      document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('400 30px "Chiron GoRound TC"')].map(p => Promise.resolve(p).catch(() => {})));
    this.fontsDone = all.then(() => true);
    return Promise.race([this.fontsDone, new Promise(r => setTimeout(() => r(false), ms))]);
  }
  makeEdgeTexture() {
    // 書口：細密的紙頁層次
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const x = c.getContext('2d'); const r = rand(7);
    x.fillStyle = '#e9e0cc'; x.fillRect(0, 0, 64, 512);
    for (let i = 0; i < 512; i += 2) { const v = 205 + r() * 40; x.fillStyle = `rgb(${v},${v - 8},${v - 26})`; x.fillRect(0, i, 64, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  clothFill(x, w, h, color) {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    if (this.linenImg.complete && this.linenImg.naturalWidth) {
      x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.9;
      const s = 512; for (let yy = 0; yy < h; yy += s) for (let xx = 0; xx < w; xx += s) x.drawImage(this.linenImg, xx, yy, s, s);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      // 布色被乘暗了，補回一點
      x.globalCompositeOperation = 'screen'; x.fillStyle = color; x.globalAlpha = 0.35; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    }
  }
  // 書脊：顏色圖＋燙金遮罩（金屬度／粗糙度）
  spineTextures(title, color, foil, tRatio, draft = false) {
    const W = 192, H = Math.round(W * tRatio);
    const [c, x] = this.canvas(W, H); const [m, mx] = this.canvas(W, H);
    this.clothFill(x, W, H, color);
    mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    const draw = (fn) => { fn(x, foil); fn(mx, '#fff'); };
    draw((g, col) => { g.fillStyle = col; g.fillRect(W * 0.12, H * 0.055, W * 0.76, 3); g.fillRect(W * 0.12, H * 0.07, W * 0.76, 1.5);
      g.fillRect(W * 0.12, H * 0.93, W * 0.76, 3); g.fillRect(W * 0.12, H * 0.915, W * 0.76, 1.5); });
    if (draft) { x.fillStyle = '#7998c3'; x.fillRect(0, H * 0.84, W, H * 0.035); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, H * 0.84, W, 2); }
    if (isCJK(title)) {
      const chars = [...title.replace(/\s/g, '')];
      const avail = H * (draft ? 0.66 : 0.74); let size = Math.min(W * 0.52, avail / Math.max(chars.length, 1) * 0.92);
      draw((g, col) => { g.fillStyle = col; g.font = `700 ${size}px "LXGW WenKai TC"`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const step = size * 1.08, y0 = (draft ? H * 0.46 : H / 2) - (chars.length - 1) * step / 2;
        chars.forEach((ch, i) => { if (/[「」『』（）()—…，、。：:]/.test(ch)) { g.save(); g.translate(W / 2, y0 + i * step); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); } else g.fillText(ch, W / 2, y0 + i * step); }); });
    } else {
      let size = W * 0.42;
      draw((g, col) => { g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI / 2); g.fillStyle = col; g.font = `600 ${size}px "Cormorant Garamond"`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        let s = size; while (g.measureText(title).width > H * 0.76 && s > 10) { s *= 0.94; g.font = `600 ${s}px "Cormorant Garamond"`; }
        g.fillText(title, 0, 2); g.restore(); });
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const mt = new THREE.CanvasTexture(m); return [t, mt];
  }
  coverTextures(title, sub, color, foil) {
    const W = 1024, H = 1400; const [c, x] = this.canvas(W, H); const [m, mx] = this.canvas(W, H);
    this.clothFill(x, W, H, color); mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    const draw = (fn) => { fn(x, foil); fn(mx, '#fff'); };
    draw((g, col) => {
      g.strokeStyle = col; g.lineWidth = 5; g.strokeRect(70, 70, W - 140, H - 140); g.lineWidth = 2; g.strokeRect(92, 92, W - 184, H - 184);
      g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = isCJK(title) ? 96 : 104; g.font = `700 ${size}px ${isCJK(title) ? '"LXGW WenKai TC"' : '"Cormorant Garamond"'}`;
      const lines = wrap(g, title, W - 300);
      lines.forEach((ln, i) => g.fillText(ln, W / 2, H * 0.42 + (i - (lines.length - 1) / 2) * size * 1.3));
      if (sub) { g.font = `500 40px "Chiron GoRound TC"`; g.fillText(sub, W / 2, H * 0.72); }
      g.beginPath(); g.arc(W / 2, H * 0.84, 16, 0, TAU); g.lineWidth = 3; g.stroke();
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return [t, new THREE.CanvasTexture(m)];
  }
  pageTexture(kind, data) {
    const W = 1024, H = 1400; const [c, x] = this.canvas(W, H);
    if (this.paperImg.complete && this.paperImg.naturalWidth) x.drawImage(this.paperImg, 0, 0, W, H); else { x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H); }
    // 泛黃的邊
    const gr = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,80,30,0.18)');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // 靠書脊的陰影
    const sg = kind === 'right' ? x.createLinearGradient(0, 0, 140, 0) : x.createLinearGradient(W, 0, W - 140, 0);
    sg.addColorStop(0, 'rgba(60,35,20,0.28)'); sg.addColorStop(1, 'rgba(60,35,20,0)'); x.fillStyle = sg; x.fillRect(0, 0, W, H);
    // 版面：與網站同一套字（標題霞鶩文楷、內文昭源圓體），墨色偏暖、留白寬
    const INK = '#2a1f25', SOFT = '#76656d', GOLD = '#9c7a48';
    const spaced = (text, cx, y, gap) => {   // 手動字距（canvas 的 letterSpacing 支援不一）
      const chars = [...text]; const ws = chars.map(ch => x.measureText(ch).width); const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
      let xx = cx - total / 2; x.textAlign = 'left'; chars.forEach((ch, i) => { x.fillText(ch, xx, y); xx += ws[i] + gap; }); x.textAlign = 'center';
    };
    x.textBaseline = 'alphabetic';
    if (kind === 'title') {
      x.textAlign = 'center';
      x.font = '500 30px "Chiron GoRound TC"'; x.fillStyle = SOFT; spaced(data.category || '', W / 2, 330, 10);
      x.fillStyle = GOLD; x.fillRect(W / 2 - 18, 372, 36, 2);
      x.fillStyle = INK;
      let size = 84; x.font = `700 ${size}px "LXGW WenKai TC"`;
      let lines = wrap(x, data.title || '', W - 300);
      while (lines.length > 3 && size > 56) { size -= 6; x.font = `700 ${size}px "LXGW WenKai TC"`; lines = wrap(x, data.title || '', W - 300); }
      const top = 560 - (lines.length - 1) * size * 0.66;
      lines.forEach((ln, i) => x.fillText(ln, W / 2, top + i * size * 1.32));
      const after = top + (lines.length - 1) * size * 1.32;
      x.fillStyle = GOLD; x.fillRect(W / 2 - 70, after + 70, 140, 2);
      x.font = '400 32px "Chiron GoRound TC"'; x.fillStyle = SOFT; spaced(data.date || '', W / 2, after + 140, 4);
      x.font = 'italic 400 30px "Cormorant Garamond"'; x.fillStyle = '#a3928f'; x.fillText('i', W / 2, H - 110);
    } else if (kind === 'right') {
      const L = 160, R = W - 140, lh = 86;
      x.font = '500 28px "Chiron GoRound TC"'; x.fillStyle = GOLD; x.textAlign = 'left'; x.fillText('摘要', L, 260);
      x.fillRect(L, 282, 44, 2);
      x.font = '400 48px "Chiron GoRound TC"'; x.fillStyle = INK;
      const lines = wrap(x, data.body || '', R - L);
      lines.slice(0, 13).forEach((ln, i) => x.fillText(ln, L, 380 + i * lh));
      if (data.note) {
        const y0 = 380 + (Math.min(lines.length, 13) + 0.9) * lh;
        x.fillStyle = 'rgba(121,152,195,0.9)'; x.fillRect(L, y0 - 34, 4, 44);
        x.font = '400 32px "Chiron GoRound TC"'; x.fillStyle = SOFT;
        wrap(x, data.note, R - L - 30).forEach((ln, i) => x.fillText(ln, L + 26, y0 + i * 54));
      }
      x.font = 'italic 400 30px "Cormorant Garamond"'; x.fillStyle = '#a3928f'; x.textAlign = 'center'; x.fillText('ii', W / 2, H - 110);
    } else {
      x.font = 'italic 400 30px "Cormorant Garamond"'; x.fillStyle = '#b3a3a0'; x.textAlign = 'center'; x.fillText('·', W / 2, H - 110);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  cloth(color, map, metalMap) {
    return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: 0.82, metalness: 0, normalMap: this.linenNormal,
      normalScale: new THREE.Vector2(0.55, 0.55), sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).multiplyScalar(0.8),
      ...(metalMap ? { metalnessMap: metalMap, roughnessMap: null } : {}) });
  }
}

function wrap(g, text, maxW) {
  const out = []; let line = '';
  const tokens = isCJK(text) ? [...text] : text.split(/(\s+)/);
  for (const tk of tokens) {
    const test = line + tk;
    if (g.measureText(test).width > maxW && line) { out.push(line.trim()); line = tk.trimStart(); } else line = test;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

// 書脊曲面：由封底到封面的一段外凸圓弧（位於 x ≤ 0）
function spineGeometry(t, h, bulge) {
  const seg = 16, pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + Math.PI * i / seg;   // -90°（封底）→ +90°（封面）
    const z = Math.sin(a) * t / 2, xx = -Math.cos(a) * bulge;
    for (let j = 0; j <= 1; j++) { pos.push(xx, (j - 0.5) * h, z); uv.push(i / seg, j); }   // 從書外看封底在左、封面在右（V30–V33 寫反，字是鏡像的）
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export class Book extends THREE.Group {
  constructor(kit, spec) {
    super();
    this.spec = spec; this.kit = kit;
    const r = rand(hash(spec.key));
    const t = spec.t ?? (0.026 + r() * 0.022), h = spec.h ?? (0.215 + r() * 0.045), w = spec.w ?? (0.15 + r() * 0.035);
    const b = 0.0028, oh = 0.003;
    Object.assign(this, { t, h, w, b, oh });
    const color = spec.color, foil = spec.foil;
    const [spT, spM] = kit.spineTextures(spec.title, color, foil, (h + 2 * oh) / (t + 0.004), !!spec.draft);
    const [cvT, cvM] = kit.coverTextures(spec.title, spec.coverSub, color, foil);
    const plain = kit.cloth(color, null); plain.color.set(color); plain.map = kit.linenDetail; plain.map.colorSpace = THREE.NoColorSpace;
    const spineMat = new THREE.MeshPhysicalMaterial({ map: spT, metalnessMap: spM, metalness: 1, roughness: 0.62, normalMap: kit.linenNormal, normalScale: new THREE.Vector2(0.45, 0.45), sheen: 0.25, sheenRoughness: 0.7 });
    spineMat.onBeforeCompile = foilShader;
    const coverMat = new THREE.MeshPhysicalMaterial({ map: cvT, metalnessMap: cvM, metalness: 1, roughness: 0.62, normalMap: kit.linenNormal, normalScale: new THREE.Vector2(0.45, 0.45), sheen: 0.25, sheenRoughness: 0.7 });
    coverMat.onBeforeCompile = foilShader;
    const edge = new THREE.MeshStandardMaterial({ map: kit.edgeTex, roughness: 0.9 });
    const paperPlain = new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.92 });
    this.mats = { plain, spineMat, coverMat, edge, paperPlain };
    const stackT = (t - 2 * b) / 2;
    // 封底
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + oh, h + 2 * oh, b), plain);
    back.position.set((w + oh) / 2, 0, -(t / 2 - b / 2)); this.add(back);
    // 右半疊書頁（封底這側），上表面＝右頁
    this.rightPage = new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.92 });
    const rs = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, h, stackT), [edge, edge, edge, edge, this.rightPage, edge]);
    rs.position.set((w - 0.004) / 2 + 0.002, 0, -stackT / 2); this.add(rs);
    // 會翻開的一半：封面＋左半疊
    this.front = new THREE.Group(); this.add(this.front);
    const fc = new THREE.Mesh(new THREE.BoxGeometry(w + oh, h + 2 * oh, b), [plain, plain, plain, plain, coverMat, plain]);
    fc.position.set((w + oh) / 2, 0, t / 2 - b / 2); this.front.add(fc);
    const ls = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, h, stackT), [edge, edge, edge, edge, edge, paperPlain]);
    ls.position.set((w - 0.004) / 2 + 0.002, 0, stackT / 2); this.front.add(ls);
    // 書脊
    this.spine = new THREE.Mesh(spineGeometry(t + 0.001, h + 2 * oh, Math.min(0.006, t * 0.18)), spineMat); this.add(this.spine);
    // 三張翻頁
    this.sheets = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(w - 0.006, h - 0.004, 20, 1); g.translate((w - 0.006) / 2, 0, 0);
      g.userData.base = g.attributes.position.array.slice();
      const frontM = new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.92, side: THREE.FrontSide });
      const backM = new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.92, side: THREE.BackSide });
      const s = new THREE.Group(); const m1 = new THREE.Mesh(g, frontM), m2 = new THREE.Mesh(g, backM);
      s.add(m1, m2); s.position.set(0.002, 0, 0.0004 * (3 - i)); s.visible = false; s.userData = { g, frontM, backM };
      this.front.parent.add(s); this.sheets.push(s);
    }
    // 攤開後看得到的兩頁：靠書脊處往下彎進裝訂線，中段微微拱起
    const curved = (sign) => {
      const W = w - 0.004, seg = 40;
      const g = new THREE.PlaneGeometry(W, h - 0.002, seg, 1);
      const pa = g.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) {
        const d = pa[i] + W / 2;                 // 0（書脊）→ W（書口）
        const f = d / W;
        // 從書脊（最低）快速拱起，再緩緩放低到書口：真書攤開的樣子
        const rise = 0.010 * (1 - Math.exp(-d / 0.018)) * (1 - 0.38 * f);
        pa[i] = sign * (d + 0.0015); pa[i + 2] = 0.0004 + rise;
      }
      if (sign < 0) g.setIndex(Array.from(g.index.array).reverse());   // 鏡像後三角形繞向相反，翻回來讓正面朝上
      g.computeVertexNormals();
      if (sign < 0) { const uv = g.attributes.uv.array; for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i]; }
      return g;
    };
    this.pageR = new THREE.Mesh(curved(1), new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.9 }));
    this.pageL = new THREE.Mesh(curved(-1), new THREE.MeshStandardMaterial({ map: kit.paper, roughness: 0.9 }));
    this.pageR.visible = this.pageL.visible = false; this.add(this.pageR, this.pageL);
    this.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.book = this; } });
    this.openT = 0; this.sheetT = [0, 0, 0];
  }
  setContent(pages) {
    // pages: { left: CanvasTexture, right: CanvasTexture }
    const [s1, s2, s3] = this.sheets;
    // 紙背以 BackSide 畫，貼圖要左右鏡像才會正著讀
    const mirrored = pages.left.clone(); mirrored.wrapS = THREE.RepeatWrapping; mirrored.repeat.x = -1; mirrored.offset.x = 1; mirrored.needsUpdate = true;
    s3.userData.backM.map = mirrored; s3.userData.backM.needsUpdate = true;
    this.pageL.material.map = pages.left; this.pageL.material.needsUpdate = true;
    this.pageR.material.map = pages.right; this.pageR.material.needsUpdate = true;
  }
  // 放回時：翻頁紙與彎曲左頁收起，讓左半疊隨封面一起闔上
  hideFlips() { this.sheets.forEach(s => s.visible = false); this.pageL.visible = false; this._noFlip = true; }
  resetPages() { this._noFlip = false; this.setSheets([0, 0, 0]); this.pageL.visible = false; }
  // 0..1：封面翻開（0＝闔上，1＝攤平）
  setOpen(k) {
    this.openT = k;
    this.front.rotation.y = -Math.PI * k;
    this.spine.visible = k < 0.55;
    const show = k > 0.02;
    this.sheets.forEach(s => s.visible = show && !this.pageL.visible && !this._noFlip);
    this.pageR.visible = k > 0.35 && (this.sheetT[2] > 0.25 || this._noFlip);
  }
  // 翻頁：每張 0..1
  setSheets(ts) {
    const w = this.w - 0.006;
    this.sheetT = ts.slice();
    this.pageR.visible = this.openT > 0.35 && (ts[2] > 0.25 || this._noFlip);
    ts.forEach((k, i) => {
      const s = this.sheets[i]; const g = s.userData.g; const base = g.userData.base; const p = g.attributes.position.array;
      const phi = Math.PI * easeInOut(k); const curl = 0.9 * Math.sin(phi);
      // 沿頁寬積分：尖端落後，形成弧度
      const cols = 21;
      for (let c = 0; c < cols; c++) {
        const f = c / (cols - 1);
        let X = 0, Z = 0; const steps = c; const dx = w / (cols - 1);
        for (let q = 0; q < steps; q++) { const ff = (q + 0.5) / (cols - 1); const a = phi - curl * Math.pow(ff, 1.4); X += Math.cos(a) * dx; Z += Math.sin(a) * dx; }
        for (let row = 0; row < 2; row++) { const vi = (row * cols + c) * 3; p[vi] = X; p[vi + 1] = base[vi + 1]; p[vi + 2] = Z; }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
      s.position.z = 0.0006 * (3 - i) + (k > 0.5 ? 0.0006 * i : 0) + 0.0006;
    });
    // 三張都翻完：換成彎曲的左頁（內容相同），翻頁紙收起來
    const done = ts[2] >= 0.999;
    this.pageL.visible = done && this.openT > 0.9;
    this.sheets.forEach(s => s.visible = this.openT > 0.02 && !done);
  }
}

function foilShader(sh) {
  // 燙金：金屬遮罩處顏色改成金色、粗糙度降低
  sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  #ifdef USE_METALNESSMAP
    float foilMask = texture2D( metalnessMap, vMetalnessMapUv ).g;
    roughnessFactor = mix(roughnessFactor, 0.28, foilMask);
  #endif`);
}

export function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

// 依層板框排書：回傳每本書的站立姿態（閱讀框：X→-v、Y→上、Z→-u）
export function shelfPose(layer, s, book) {
  const u = new THREE.Vector3(...layer.u), v = new THREE.Vector3(...layer.v), up = new THREE.Vector3(0, 0, 1);
  const c = new THREE.Vector3(...layer.center);
  const m = new THREE.Matrix4().makeBasis(v.clone().negate(), up, u.clone().negate());
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const p = c.clone().addScaledVector(u, s).addScaledVector(v, layer.back + 0.014 + book.w + book.oh);
  p.z = layer.floor + book.h / 2 + book.oh + 0.0008;
  return { position: p, quaternion: q };
}
