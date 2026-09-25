// V30 房間首頁：狀態機與互動。渲染核心在 stage.js，書在 books.js，霧在 effects.js。
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { GROUPS, setGroups, ViewData, makeBackgroundMesh, applyProjection, Pipeline } from './stage.js';
import { BookKit, Book, PALETTE, shelfPose, easeInOut } from './books.js';
import { Mist, Dust, Motes } from './effects.js';
import { sfx } from './sfx.js';

const $ = s => document.querySelector(s);
// 介面元件淡入淡出（配合 room.css 的 .fx）：淡出結束後才真的藏起來，淡出途中又要顯示就直接接回
function vis(el, on) {
  if (on) {
    if (el._t) { clearTimeout(el._t); el._t = null; }
    if (el.hidden) { el.hidden = false; void el.offsetWidth; }
    el.classList.add('show');
  } else if (!el.hidden) {
    el.classList.remove('show'); clearTimeout(el._t);
    el._t = setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; el._t = null; }, 520);
  }
}
const shown = el => !el.hidden && el.classList.contains('show');
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 設定 ----------
const VIEW_BASE = 'views';
const VIEW_NAMES = ['room', 'caseL2', 'caseR2', 'skill', 'desk', 'aroma'];
const LAYER_CATEGORY = { caseL2: 'stats', caseR2: 'ai' };            // 哪一層放哪一類作品
const SKILL_SPAN = [1.30, 0.30];                                        // 學習層板放書的範圍（沿 u，左→右）
const FOCUS_X = { room: 0.53, aroma: 0.66 };                                       // 窄螢幕時畫面要保留的水平重點（0 左、1 右）
// 熱點：平時只有小光點，滑過才浮出文字，對應的那組燈同時微微亮起
// lift：光點相對錨點抬高（公尺），避免蓋住物件本身
const HOTSPOTS = [
  { id: 'caseL2', anchor: 'caseL2', go: 'caseL2', copy: 'hot-caseL2', side: 'right', glow: 'caseL', lift: 0.0 },
  { id: 'caseR2', anchor: 'caseR2', go: 'caseR2', copy: 'hot-caseR2', side: 'right', glow: 'caseR', lift: 0.0 },
  { id: 'skill', anchor: 'skill', go: 'skill', copy: 'hot-skill', side: 'right', glow: 'skill', lift: 0.0 },
  { id: 'desk', anchor: 'monitor', go: 'desk', copy: 'hot-desk', side: 'right', glow: 'screen', lift: 0.0 },
  { id: 'aroma', anchor: 'diffuser', go: 'aroma', copy: 'hot-aroma', side: 'right', glow: 'aroma', lift: 0.12 },   // 香氛機在桌子右後角，光點浮在它上方
  { id: 'panel', anchor: 'panel', action: 'panel', copy: 'hot-panel', side: 'right', glow: 'cove', lift: 0.0 },     // 燈光開關（鋼琴右邊的牆）
  { id: 'curtain', anchor: 'curtain', action: 'curtain', side: 'left', glow: 'sky', lift: 0.0 },                   // 窗簾：文字依狀態（拉上／拉開）
];
// 檯燈是彩蛋：沒有光點也沒有提示，滑鼠移到燈上游標才變成手指，點了開關燈
const LAMP_PICK_PX = 46;

// ---------- 基本物件 ----------
const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false;
RectAreaLightUniformsLib.init();
const pipe = new Pipeline(renderer);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 60);
camera.up.set(0, 0, 1);

const S = {                      // 全域狀態
  data: null, look: null, copy: {}, works: [],
  views: {}, meshes: {},
  mode: 'loading',               // loading | intro | room | moving | view | focus
  view: 'room', from: null, to: null, moveT: 0, moveDur: 1,
  cam: null,                     // 目前鏡頭 {pos, quat, tanX, tanY, offX, offY}
  parallax: new THREE.Vector2(), pointer: new THREE.Vector2(), pointerPx: new THREE.Vector2(-1, -1),
  lampOn: true, aromaOn: true, mood: 0,
  sw: { ceil: 0, track: true, amb: true },   // 三個開關：天花板燈（0 關，1–3 三段）、軌道燈、環繞燈（天花板燈條＋落地燈）
  curtain: 1, curtainT: 1,                  // 窗簾：1 拉開、0 拉上；curtainT 是動畫中的目前值
  slot: 'night',                            // 時段：dawn 清晨、day 早上、dusk 傍晚、night 夜晚
  intro: null, time: 0,
  books: { caseL2: [], caseR2: [], skill: [] }, hover: null, focus: null,
  size: [1, 1], pr: 1,
};

// ---------- 燈光狀態：每組一個線性 RGB 增益，網頁端即時混合 ----------
const light = { cur: {}, tgt: {}, intro: {} };
const hoverBoost = {};
function initLightState() { GROUPS.forEach(g => { light.cur[g] = new THREE.Vector3(); light.tgt[g] = new THREE.Vector3(); light.intro[g] = 1; hoverBoost[g] = 0; }); }
const grade = { exposure: 0, sat: 1, shadow: new THREE.Vector3(), vignette: 0.22, tExposure: 0, tSat: 1, tShadow: new THREE.Vector3() };

function linColor(hex) { const c = new THREE.Color(); c.setStyle(hex, THREE.SRGBColorSpace); return new THREE.Vector3(c.r, c.g, c.b); }
function computeTargets() {
  const L = S.look, mood = L.moods[S.mood] || {};
  for (const g of GROUPS) {
    const base = L.groups[g] || { gain: 1, tint: '#ffffff' };
    const MG = mood.groups || {}; const mo = MG[g] || (g.startsWith('track') ? MG.track : null) || (g === 'shelf' ? MG.caseL : null) || {};   // 精油氛圍裡寫的 track 套用到三組軌道燈
    const v = linColor(base.tint).multiplyScalar(base.gain);
    if (mo.tint) v.multiply(linColor(mo.tint));
    v.multiplyScalar(mo.gain ?? 1);
    if (g === 'lamp' && !S.lampOn) v.multiplyScalar(0);
    if (g === 'aroma' && !S.aromaOn) v.multiplyScalar(0.0);
    if (g.startsWith('track') && !S.sw.track) v.multiplyScalar(0);
    if ((g === 'cove' || g === 'floorRead') && !S.sw.amb) v.multiplyScalar(0);
    if (g === 'ceil') { const m = (L.ceilModes || [])[S.sw.ceil - 1]; if (!m || S.sw.ceil === 0) v.multiplyScalar(0); else v.copy(linColor(m.tint)).multiplyScalar(m.gain); }
    const tm = ((L.times || {})[S.slot] || {}).groups || {};                       // 時段：日光、月光、補光
    if (tm[g]) { v.multiply(linColor(tm[g].tint || '#ffffff')).multiplyScalar(tm[g].gain ?? 1); }
    light.tgt[g].copy(v);
  }
  grade.tExposure = L.exposure + (mood.exposure || 0) + (((L.times || {})[S.slot] || {}).exposure || 0);
  grade.tSat = L.saturation * (mood.saturation ?? 1);
  grade.tShadow.copy(linColor(mood.shadowTint || L.shadowTint)).multiplyScalar(mood.shadowLift ?? L.shadowLift);
  grade.vignette = L.vignette ?? 0.22;
}
function stepLights(dt, snap = false) {
  const k = snap ? 1 : 1 - Math.exp(-dt / 0.45);
  for (const g of GROUPS) light.cur[g].lerp(light.tgt[g], k);
  // 開燈閃爍期間，檯燈直接用目標亮度乘上閃爍倍率（不走漸變）
  if (S.lampFlick != null && light.cur.lamp) light.cur.lamp.copy(light.tgt.lamp).multiplyScalar(lampFlicker(dt));
  grade.exposure = lerp(grade.exposure, grade.tExposure, k);
  grade.sat = lerp(grade.sat, grade.tSat, k);
  grade.shadow.lerp(grade.tShadow, k);
}
// 編碼時合併的燈組（encode.py 的 MERGE）：舊名字對到合併後的組
const ALIAS = { caseL: 'shelf', caseR: 'shelf', skill: 'shelf', trackDesk: 'track', trackBed: 'track', trackArt: 'track', floorRead: 'cove' };
const R = g => (light.cur[g] ? g : ALIAS[g] || g);
function gainOf(g) { g = R(g); const c = light.cur[g]; if (!c) return 0; return (c.x * 0.2126 + c.y * 0.7152 + c.z * 0.0722) * light.intro[g]; }
const trackGain = () => gainOf('track');

// ---------- 鏡頭 ----------
function fitCover(v, aspect, focus = 0.5) {
  // 保持預渲染的視角，只裁掉超出螢幕比例的部分；裁切位置朝 focus 靠
  let tanX, tanY, offX = v.offX, offY = v.offY;
  if (aspect <= v.aspect) {
    tanY = v.tanY; tanX = tanY * aspect;
    const room = v.tanX - tanX; offX = v.offX + clamp((focus * 2 - 1) * v.tanX, -room, room);
  } else {
    tanX = v.tanX; tanY = tanX / aspect;
    const room = v.tanY - tanY; offY = v.offY + clamp(0, -room, room);
  }
  return { pos: v.position.clone(), quat: v.quaternion.clone(), tanX, tanY, offX, offY };
}
function viewCam(name) {
  const v = S.views[name];
  let focus = FOCUS_X[name] ?? 0.5;
  // 窄螢幕看書櫃層：裁切對準書所在的位置，不讓書被裁掉
  const list = S.books[name];
  if (list && list.length) {
    const c = new THREE.Vector3(); list.forEach(b => c.add(b.userData.home.position)); c.multiplyScalar(1 / list.length);
    focus = clamp(v.project(c).x, 0, 1);
  }
  return fitCover(v, S.size[0] / S.size[1], focus);
}
function setCamera(c) {
  camera.position.copy(c.pos); camera.quaternion.copy(c.quat); camera.updateMatrixWorld(true);
  applyProjection(camera, c);
}
function mixCam(a, b, t, arc = 0) {
  const pos = a.pos.clone().lerp(b.pos, t); pos.z += Math.sin(Math.PI * t) * arc;
  return { pos, quat: a.quat.clone().slerp(b.quat, t), tanX: lerp(a.tanX, b.tanX, t), tanY: lerp(a.tanY, b.tanY, t), offX: lerp(a.offX, b.offX, t), offY: lerp(a.offY, b.offY, t) };
}
// 推近＋溶接：兩個視角各自只在自己拍攝位置附近移動，避免深度重建被拉扯
function lookQuat(from, to) {
  const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 0, 1));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
function transitionCams(R, V, vName, e) {
  const v = S.views[vName];
  const fwdV = new THREE.Vector3(0, 0, -1).applyQuaternion(V.quat);
  const dB = Math.max(0.4, v.depthAt(0.5, 0.5));
  const T = V.pos.clone().addScaledVector(fwdV, dB);                 // 特寫要看的那一點
  const w = smooth(0, 0.5, e);
  const sizeV = 1 / (1 + 0.45 * (1 - e));                              // 特寫推近過程中目標的相對大小
  const posR = R.pos.clone().lerp(T, 0.08 * w);
  const quatR = R.quat.clone().slerp(lookQuat(posR, T), w);
  const tanYt = V.tanY * dB / T.distanceTo(posR) / sizeV;
  const tanYR = lerp(R.tanY, tanYt, w), asp = R.tanX / R.tanY;
  const camR = { pos: posR, quat: quatR, tanY: tanYR, tanX: tanYR * asp, offX: lerp(R.offX, 0, w), offY: lerp(R.offY, 0, w) };
  const camV = { ...V, pos: V.pos.clone().addScaledVector(fwdV, -0.45 * dB * (1 - e)) };
  if (window.__twoCam) return { camR, camV, e };
  // 兩層用同一台鏡頭畫：兩張重建的是同一個世界，疊起來不會重影（時鐘、書、霧這些即時物件也只畫一次位置）
  const k = smooth(0, 1, e), kp = 1 - Math.pow(1 - smooth(0, 1, e), 1.6);   // 位置提早抵達：對焦回來時離特寫的拍攝點很近，拉扯最少
  const pos = R.pos.clone().lerp(V.pos, kp);
  const quat = R.quat.clone().slerp(V.quat, k);
  const tanY = Math.exp(lerp(Math.log(R.tanY), Math.log(V.tanY), k));
  const cam = { pos, quat, tanY, tanX: tanY * lerp(R.tanX / R.tanY, V.tanX / V.tanY, k), offX: lerp(R.offX, V.offX, k), offY: lerp(R.offY, V.offY, k) };
  return { camR: cam, camV: cam, e };
}
function toScreen(p) {
  const v = p.clone().project(camera);
  return { x: (v.x + 1) / 2 * S.size[0], y: (1 - v.y) / 2 * S.size[1], behind: v.z > 1 || v.z < -1 };
}

// ---------- 讀資料 ----------
async function fetchJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }
async function loadCopy() { try { S.copy = (await fetchJSON('copy.json')).text || {}; } catch { S.copy = {}; } applyCopy(); }
function T(id, fb = '') { const v = S.copy[id]; return v == null ? fb : v; }
function lines(id) { return T(id).split('\n').map(s => s.trim()).filter(Boolean).map(s => s.split('｜').map(x => x.trim())); }
function applyCopy() {
  document.querySelectorAll('[data-copy]').forEach(el => { const v = S.copy[el.dataset.copy]; if (v != null) el.textContent = v; });
  if (S.copy['page-title']) document.title = S.copy['page-title'];
  buildHotspots(); buildOils(); updateLampButton(); buildMobileNav();
}

// ---------- 書 ----------
const kit = new BookKit();
const bookGroup = new THREE.Group(); scene.add(bookGroup);
function clearBooks() { for (const k in S.books) { S.books[k].forEach(b => { bookGroup.remove(b); (b.userData.shadows || []).forEach(q => shadowGroup.remove(q)); }); S.books[k] = []; } }
function buildBooks() {
  if (!S.data) return;
  clearBooks();
  const showDrafts = !/^否/.test(T('show-drafts', '是').trim());
  const catLabel = { stats: T('hot-caseL2', '統計專案'), ai: T('hot-caseR2', 'AI 實作') };
  for (const [layerKey, cat] of Object.entries(LAYER_CATEGORY)) {
    const layer = S.data.layers[layerKey];
    const list = S.works.filter(w => w.category === cat && (showDrafts || !w.draft));
    let s = layer.inner[1] - 0.03;
    list.forEach((w, i) => {
      const color = PALETTE.cloth[(cat === 'stats' ? [0, 3, 4, 2, 8] : [1, 5, 9, 3, 7])[i % 5]];
      const b = new Book(kit, { key: w.slug, title: w.title, color, foil: PALETTE.foilGold, coverSub: catLabel[cat], draft: w.draft });
      b.userData.work = w; b.userData.layer = layerKey;
      s -= b.t / 2; placeOnShelf(b, layer, s); s -= b.t / 2 + 0.003;
      bookGroup.add(b); S.books[layerKey].push(b);
    });
  }
  // 學習層板
  const sk = S.data.layers.skill;
  let s = SKILL_SPAN[0];
  lines('learning-books').forEach(([title, author], i) => {
    const color = PALETTE.cloth[[4, 1, 6, 2, 5, 0, 8, 9][i % 8]];
    const foil = lumOf(color) > 0.6 ? '#6b5431' : PALETTE.foilGold;
    const b = new Book(kit, { key: 'learn-' + title, title, color, foil, coverSub: author || '' });
    b.userData.learn = { title, author }; b.userData.layer = 'skill';
    s -= b.t / 2; if (s < SKILL_SPAN[1]) return; placeOnShelf(b, sk, s); s -= b.t / 2 + 0.002;
    bookGroup.add(b); S.books.skill.push(b);
  });
  buildHotspots(); buildMobileNav();
}
function lumOf(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; }
// 柔邊陰影貼圖（書底與背板共用）
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.filter = 'blur(14px)'; x.fillStyle = '#fff'; x.fillRect(30, 30, 68, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
})();
const shadowGroup = new THREE.Group(); scene.add(shadowGroup);
function shadowQuad(w, h, opacity) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); q.renderOrder = 2; q.userData.base = opacity; return q;
}
function addShadows(b, layer) {
  const u = new THREE.Vector3(...layer.u), v = new THREE.Vector3(...layer.v), up = new THREE.Vector3(0, 0, 1);
  const h = b.userData.home;
  // 書底：平貼層板
  const floor = shadowQuad(b.t * 2.2 + 0.02, b.w * 1.25 + 0.02, 0.62);
  floor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, up));
  floor.position.copy(h.position).addScaledVector(v, -b.w / 2); floor.position.z = layer.floor + 0.0006;
  // 背板：燈條由前上方打下，影子落在書後方稍低處
  const back = shadowQuad(b.t * 2.0 + 0.02, b.h * 1.05, 0.45);
  back.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u.clone().negate(), up, v));
  back.position.copy(h.position).addScaledVector(v, -(b.w + b.oh) - 0.012); back.position.z = layer.floor + b.h * 0.42;
  b.userData.shadows = [floor, back]; shadowGroup.add(floor, back);
}
function setShadow(b, k) { (b.userData.shadows || []).forEach(q => q.material.opacity = q.userData.base * k); }
function placeOnShelf(b, layer, s) {
  const p = shelfPose(layer, s, b);
  b.position.copy(p.position); b.quaternion.copy(p.quaternion);
  b.userData.home = { position: p.position.clone(), quaternion: p.quaternion.clone(), v: new THREE.Vector3(...layer.v) };
  b.userData.slide = 0; b.userData.slideT = 0;
  b.setOpen(0);
  addShadows(b, layer);
}

// 證照：有填才畫一張卡片蓋在相框畫心上；沒填就維持相框原本的畫
const certGroup = new THREE.Group(); scene.add(certGroup);
function buildCertificates() {
  certGroup.clear();
  const list = lines('certificates');
  (S.data.certificates || []).forEach((f, i) => {
    const row = list[i]; if (!row || !row[0]) return;
    const [name, year] = row;
    const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
    x.fillStyle = '#f1ebdf'; x.fillRect(0, 0, 900, 1200);
    x.strokeStyle = '#b89c6a'; x.lineWidth = 6; x.strokeRect(48, 48, 804, 1104); x.lineWidth = 2; x.strokeRect(70, 70, 760, 1060);
    x.fillStyle = '#7998c3'; x.beginPath(); x.arc(450, 300, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2b2026'; x.textAlign = 'center'; x.font = '700 76px "LXGW WenKai TC"';
    const words = []; let cur = '';
    for (const ch of [...name]) { if (x.measureText(cur + ch).width > 660 && cur) { words.push(cur); cur = ch; } else cur += ch; }
    if (cur) words.push(cur);
    words.forEach((w, k) => x.fillText(w, 450, 560 + k * 100));
    if (year) { x.font = '400 44px "Chiron GoRound TC"'; x.fillStyle = '#6b5a62'; x.fillText(year, 450, 620 + words.length * 100); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const P = ['tl', 'tr', 'bl', 'br'].map(k => new THREE.Vector3(...f[k]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(p => [p.x, p.y, p.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 0, 0], 2));
    g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals();
    certGroup.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.0, 0.95, 0.86), side: THREE.DoubleSide })));
  });
}

// 掛畫：本人用 GPT 生的畫放在 web/art/wall-art.(jpg|png|webp)，網頁直接貼上，不必重新渲染；沒有就維持渲染裡的佔位畫
const artMat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: null }, uLight: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D uTex; uniform vec3 uLight; varying vec2 vUv;
    void main(){ vec3 c = pow(texture2D(uTex, vUv).rgb, vec3(2.2));
      float g = mix(0.45, 1.2, smoothstep(0.0, 1.0, vUv.y));   // 畫燈由上往下打的漸層
      gl_FragColor = vec4(c * g * uLight, 1.0); }` });
let artMesh = null;
async function buildArt() {
  if (artMesh) { scene.remove(artMesh); artMesh = null; }
  const q = S.data.art; if (!q) return;
  for (const ext of ['jpg', 'png', 'webp']) {
    const url = `art/wall-art.${ext}` + (location.port === '4330' ? `?t=${Date.now()}` : '');   // 本機預覽才強制重抓（換圖即時生效）；正式網站要能快取
    const tex = await new Promise(res => new THREE.TextureLoader().load(url, res, undefined, () => res(null)));
    if (!tex) continue;
    tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; artMat.uniforms.uTex.value = tex;
    // 往外推 8 公釐：太貼近渲染圖裡的畫布會和它的深度互搶，出現直條紋
    const nrm = new THREE.Vector3(...(q.normal || [0.766, -0.643, 0]));
    const P = ['tl', 'tr', 'bl', 'br'].map(k => new THREE.Vector3(...q[k]).addScaledVector(nrm, 0.008));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(p => [p.x, p.y, p.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    artMesh = new THREE.Mesh(g, artMat); artMat.side = THREE.DoubleSide; scene.add(artMesh);
    return;
  }
}

// 書本照明：層板燈條（面光）＋環境光
const shelfLights = {};
const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x2a1810, 0.2); hemi.position.set(0, 0, 3); scene.add(hemi);
const readLight = new THREE.RectAreaLight(0xfff0de, 0, 0.7, 0.5); scene.add(readLight);
function buildShelfLights() {
  for (const [k, ly] of Object.entries(S.data.layers)) {
    const u = new THREE.Vector3(...ly.u), v = new THREE.Vector3(...ly.v), c = new THREE.Vector3(...ly.center);
    const width = Math.abs(ly.inner[1] - ly.inner[0]) + 0.1;
    const L = new THREE.RectAreaLight(0xffc98e, 1, k === 'skill' ? 2.6 : width, 0.05);
    const p = c.clone().addScaledVector(v, (ly.front ?? 0.2) - 0.07); p.z = ly.ceil - 0.004;
    if (k === 'skill') p.addScaledVector(u, 0);
    L.position.copy(p); L.lookAt(p.clone().add(new THREE.Vector3(0, 0, -1)).addScaledVector(v, -0.15));
    scene.add(L); shelfLights[k] = { light: L, group: ly.light };
  }
}
function updateBookLights() {
  const B = S.look.books || {};
  for (const k in shelfLights) { const { light: L, group } = shelfLights[k]; const c = light.cur[R(group)]; const m = light.intro[R(group)];
    L.color.setRGB(c.x, c.y, c.z).multiplyScalar(1 / Math.max(1e-3, Math.max(c.x, c.y, c.z))); L.intensity = (B.strip ?? 6) * Math.max(c.x, c.y, c.z) * m; }
  const amb = (gainOf('fill') + gainOf('moon')) * 0.5;
  hemi.intensity = (B.ambient ?? 0.6) * amb;
  const tA = light.cur[R('trackArt')]; if (tA) { const t = tA; const k = (S.look.art ?? 0.55) * (light.intro[R('trackArt')] ?? 1); artMat.uniforms.uLight.value.set(t.x * k + 0.03 * amb, t.y * k + 0.03 * amb, t.z * k + 0.03 * amb); }
  const m = light.cur.moon; hemi.color.setRGB(m.x, m.y, m.z).multiplyScalar(1 / Math.max(1e-3, Math.max(m.x, m.y, m.z)) || 1);
  scene.environmentIntensity = (B.env ?? 0.12) * (0.4 + amb);
}

// ---------- 霧 ----------
let mist = null, steam = null, dust = null, motes = null, motes2 = null, motesK = 0;
const FX = new URLSearchParams(location.search).get('fx') || 'ac';   // 夢幻粒子：定案 ac＝微光浮塵為主、緩升光點一點點（本人 9/25）；a／b／c 單獨、none 關
function buildEffects() {
  mist = new Mist({ origin: new THREE.Vector3(...S.data.anchors.diffuser), count: 110, rise: 0.075, spread: 0.006, size: [0.01, 0.09], drift: 0.02, life: [2.8, 4.6] });
  steam = new Mist({ origin: new THREE.Vector3(...S.data.anchors.coffee), count: 26, rise: 0.035, spread: 0.02, size: [0.008, 0.05], drift: 0.008, life: [2.2, 3.6] });
  scene.add(mist.points, steam.points);
  // 光裡的浮塵：檯燈光錐、床頭燈與落地燈周圍、六盞軌道燈的光束
  const E = [], V = a => new THREE.Vector3(...a);
  E.push({ pos: V(S.data.anchors.lamp), dir: new THREE.Vector3(0.12, -0.1, -1), angle: 0.62, length: 0.55, count: 260, group: 0, weight: 1.0 });
  for (const l of S.data.lights || []) {
    if (l.name === 'Shade bulb') E.push({ pos: V(l.pos), dir: null, radius: 0.55, count: 200, group: 1, weight: 0.8 });
    if (l.name === 'V31 floor lamp') E.push({ pos: V(l.pos), dir: null, radius: 0.4, count: 90, group: 1, weight: 0.35 });   // 畫面上疊在深色窗簾前，太多像雜訊
    if (/^V31 track /.test(l.name)) E.push({ pos: V(l.pos), dir: V(l.dir), angle: 0.2, length: 2.6, start: 0.4, farBias: true, count: 130, group: 2, weight: 0.4 });
  }
  dust = new Dust(E); scene.add(dust.points);
}

// ---------- 熱點與介面 ----------
function hasBooks(layerKey) { return (S.books[layerKey] || []).length > 0; }
function buildHotspots() {
  const box = $('#hotspots'); if (!S.data) return;
  box.innerHTML = '';
  for (const h of HOTSPOTS) {
    if (LAYER_CATEGORY[h.go] && !hasBooks(h.go)) continue;        // 沒有作品的分類不出現
    if (h.go === 'skill' && !hasBooks('skill')) continue;
    const b = document.createElement('button'); b.className = 'hot' + (h.side === 'left' ? ' left' : ''); b.dataset.id = h.id;
    b.innerHTML = `<span class="dot"></span><span class="label"></span>`;
    b.querySelector('.label').textContent = hotLabel(h);
    b.setAttribute('aria-label', b.querySelector('.label').textContent);
    b.addEventListener('click', e => { e.stopPropagation(); if (h.action === 'panel') togglePanel(); else if (h.action === 'curtain') toggleCurtain(); else goTo(h.go); });
    b.addEventListener('pointerenter', () => { S.hoverGlow = R(h.glow); if (h.go && S.mode === 'room') ensureView(h.go).catch(() => {}); });   // 滑過就先解碼，點下去少等一段
    b.addEventListener('pointerleave', () => { if (S.hoverGlow === R(h.glow)) S.hoverGlow = null; });
    box.appendChild(b); h.el = b;
  }
  HOTSPOTS.forEach(h => { if (!box.contains(h.el)) h.el = null; });
}
function hotLabel(h) {
  if (h.action === 'curtain') return S.curtain ? T('curtain-close', '拉上窗簾') : T('curtain-open', '拉開窗簾');
  return T(h.copy, h.id);
}
function refreshHotLabels() { for (const h of HOTSPOTS) if (h.el) { const t = hotLabel(h); h.el.querySelector('.label').textContent = t; h.el.setAttribute('aria-label', t); } }
function buildMobileNav() {
  const nav = $('#mobilenav'); nav.innerHTML = '';
  for (const h of HOTSPOTS) {
    if (LAYER_CATEGORY[h.go] && !hasBooks(h.go)) continue;
    if (h.go === 'skill' && !hasBooks('skill')) continue;
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = hotLabel(h);
    b.onclick = () => h.action === 'panel' ? togglePanel() : h.action === 'curtain' ? (toggleCurtain(), buildMobileNav()) : goTo(h.go); nav.appendChild(b);
  }
}
function isNarrow() { return S.size[0] < 760; }
function updateOverlay() {
  const inRoom = S.mode === 'room';
  for (const h of HOTSPOTS) {
    if (!h.el) continue;
    if (!S.data.anchors[h.anchor]) { h.el.classList.remove('on'); continue; }
    const a = new THREE.Vector3(...S.data.anchors[h.anchor]); a.z += h.lift || 0;
    const p = toScreen(a);
    h.el.style.left = p.x + 'px'; h.el.style.top = p.y + 'px';
    h.el.style.transform = h.side === 'left' ? 'translate(calc(-100% + 14px), -50%)' : 'translate(-14px, -50%)';
    const on = inRoom && !p.behind && p.x > 10 && p.x < S.size[0] - 10;
    h.el.classList.toggle('on', on); h.el.style.pointerEvents = on ? 'auto' : 'none';
  }
  const mn = $('#mobilenav'), mnOn = isNarrow() && inRoom; if (mnOn !== shown(mn)) vis(mn, mnOn);
  const lp = $('#lightpanel');
  if (S.panelOpen && !inRoom) { S.panelOpen = false; vis(lp, false); }
  if (S.panelOpen && S.data.anchors.panel) {
    const p = toScreen(new THREE.Vector3(...S.data.anchors.panel));
    if (isNarrow()) { lp.style.left = '50%'; lp.style.top = 'auto'; lp.style.bottom = '84px'; lp.style.transform = 'translateX(-50%)'; }
    else { lp.style.left = clamp(p.x + 28, 12, S.size[0] - 260) + 'px'; lp.style.top = clamp(p.y - 90, 70, S.size[1] - 240) + 'px'; lp.style.bottom = 'auto'; lp.style.transform = 'none'; }
  }
  // 電腦螢幕與時鐘
  placeQuad($('#screen'), S.data.screen, S.mode === 'view' && S.view === 'desk');
}
function placeQuad(el, q, on) {
  if (!on) { el.classList.remove('on'); if (!el.hidden) setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 700); return; }
  el.hidden = false;
  const pts = ['tl', 'tr', 'br', 'bl'].map(k => toScreen(new THREE.Vector3(...q[k])));
  // 寬螢幕在直式手機上會被裁掉兩側：這時視窗不貼在螢幕上，改成畫面中央的卡片（背後仍是螢幕與桌面）
  const flat = Math.min(...pts.map(p => p.x)) < 8 || Math.max(...pts.map(p => p.x)) > S.size[0] - 8;
  el.classList.toggle('flat', flat);
  el.style.transform = flat ? 'none' : homography(el.offsetWidth, el.offsetHeight, pts);
  requestAnimationFrame(() => el.classList.add('on'));
}
// 桌上時鐘：數字畫在 3D 面板上（會被檯燈手臂正確擋住，全景裡也看得到微光）
const clockCanvas = document.createElement('canvas'); clockCanvas.width = 512; clockCanvas.height = 224;
const clockTex = new THREE.CanvasTexture(clockCanvas); clockTex.colorSpace = THREE.SRGBColorSpace;
const clockMat = new THREE.MeshBasicMaterial({ map: clockTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff });
let clockMesh = null;
function buildClock() {
  const c = S.data.clock; const K = S.look.clock || {};
  const along = new THREE.Vector3(0.643, 0.766, 0), nOut = new THREE.Vector3(0.766, -0.643, 0), up = new THREE.Vector3(0, 0, 1);
  const fc = new THREE.Vector3(...c.center).addScaledVector(nOut, K.out ?? 0.052).addScaledVector(along, K.shift ?? 0); fc.z += K.dz ?? 0.004;
  clockMesh = new THREE.Mesh(new THREE.PlaneGeometry(K.w ?? 0.15, K.h ?? 0.06), clockMat);
  clockMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, up, nOut));
  clockMesh.position.copy(fc); clockMesh.renderOrder = 4; scene.add(clockMesh);
}
function drawClock(text) {
  const x = clockCanvas.getContext('2d'); x.clearRect(0, 0, 512, 224);
  x.font = '400 150px "Chiron GoRound TC"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(255,140,60,0.9)'; x.shadowBlur = 24; x.fillStyle = '#ffb877'; x.fillText(text, 256, 118);
  x.shadowBlur = 0; x.fillStyle = '#ffd9b0'; x.fillText(text, 256, 118);
  clockTex.needsUpdate = true;
}
// 把 w×h 的元素貼到四個螢幕點（CSS matrix3d）
function homography(w, h, p) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]], dst = p.map(q => [q.x, q.y]);
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); B.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); B.push(Y);
  }
  const s = solve(A, B);
  const m = [s[0], s[3], 0, s[6], s[1], s[4], 0, s[7], 0, 0, 1, 0, s[2], s[5], 0, 1];
  return `matrix3d(${m.map(v => v.toFixed(9)).join(',')})`;
}
function solve(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// ---------- 燈光開關（三個）與窗簾 ----------
function togglePanel(force) {
  S.panelOpen = force ?? !S.panelOpen; renderPanel(); vis($('#lightpanel'), S.panelOpen);
}
function renderPanel() {
  const modes = T('sw-ceil-modes', '明亮｜柔和｜暮紫').split('｜').map(x => x.trim());
  const set = (id, on, state) => { const b = $(id); b.classList.toggle('on', on); b.querySelector('small').textContent = state; };
  set('#sw-ceil', S.sw.ceil > 0, S.sw.ceil > 0 ? modes[S.sw.ceil - 1] || '' : T('sw-off', '關'));
  set('#sw-track', S.sw.track, S.sw.track ? T('sw-on', '開') : T('sw-off', '關'));
  set('#sw-amb', S.sw.amb, S.sw.amb ? T('sw-on', '開') : T('sw-off', '關'));
}
function flipSwitch(k) {
  sfx.play('switch', { rate: 0.96 + Math.random() * 0.08 });
  if (k === 'ceil') S.sw.ceil = (S.sw.ceil + 1) % ((S.look.ceilModes || []).length + 1);   // 像家裡的燈：按一次換一段，最後一下關掉
  else S.sw[k] = !S.sw[k];
  computeTargets(); renderPanel();
}
$('#sw-ceil').addEventListener('click', e => { e.stopPropagation(); flipSwitch('ceil'); });
$('#sw-track').addEventListener('click', e => { e.stopPropagation(); flipSwitch('track'); });
$('#sw-amb').addEventListener('click', e => { e.stopPropagation(); flipSwitch('amb'); });
$('#lightpanel').addEventListener('click', e => e.stopPropagation());
function toggleCurtain() {
  S.curtain = S.curtain ? 0 : 1; sfx.play(S.curtain ? 'curtainOpen' : 'curtainClose'); refreshHotLabels();
  if (!S.views.roomc?.ready) ensureView('roomc').catch(e => console.warn(e));
}
// 時段：依訪客電腦的時間（網址加 ?time=dawn|day|dusk|night 可以指定，方便檢查）
function timeSlot() {
  const q = new URLSearchParams(location.search).get('time'); if (['dawn', 'day', 'dusk', 'night'].includes(q)) return q;
  const h = new Date().getHours(); return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night';
}
function applySlotDefaults() {
  const d = (((S.look.times || {})[S.slot]) || {}).defaults || {};
  S.sw.ceil = d.ceil ?? 0; S.sw.track = d.track ?? true; S.sw.amb = d.amb ?? true; S.curtain = S.curtainT = d.curtain ?? 1;
}
function updateLampButton() {
  const h = HOTSPOTS.find(x => x.action === 'lamp'); if (!h || !h.el) return;
  const t = S.lampOn ? T('lamp-off', '關燈') : T('lamp-on', '開燈');
  h.el.querySelector('.label').textContent = t; h.el.setAttribute('aria-label', t);
}
function toggleLamp() { sfx.play('switch', { rate: 1.08, gain: 0.8 }); S.lampOn = !S.lampOn; if (S.lampOn) S.lampFlick = 0; updateLampButton(); computeTargets(); store.set('v30-lamp', S.lampOn ? '1' : '0'); }
// 開燈閃爍：燈絲先閃兩下再穩定（0.42 秒）；回傳檯燈亮度倍率
function lampFlicker(dt) {
  if (S.lampFlick == null) return 1;
  S.lampFlick += dt; const t = S.lampFlick;
  if (t > 0.42) { S.lampFlick = null; return 1; }
  return t < 0.06 ? 0.55 : t < 0.12 ? 0.1 : t < 0.2 ? 0.8 : t < 0.26 ? 0.3 : 1;
}

function buildOils() {
  const ul = $('#oillist'); if (!S.look) return; ul.innerHTML = '';
  lines('oils').forEach(([name, desc], i) => {
    const mood = S.look.moods[i]; if (!mood) return;
    const li = document.createElement('li'); const b = document.createElement('button'); b.className = 'oil' + (i === S.mood && S.aromaOn ? ' on' : '');
    b.innerHTML = `<i></i><b></b><span></span>`; b.querySelector('i').style.color = b.querySelector('i').style.background = mood.swatch;
    b.querySelector('b').textContent = name; b.querySelector('span').textContent = desc || '';
    b.onclick = () => selectOil(i); li.appendChild(b); ul.appendChild(li);
  });
}
function selectOil(i) {
  S.mood = i; S.aromaOn = true; store.set('v30-mood', String(i)); store.set('v30-aroma', '1');
  computeTargets(); buildOils();
  if (mist) { mist.target = 1; mist.burst = 1.4; const c = linColor(S.look.moods[i].mist || '#ffffff'); mist.mat.uniforms.uColor.value.setRGB(c.x, c.y, c.z); }
}
$('#aromaoff').addEventListener('click', () => { S.aromaOn = false; store.set('v30-aroma', '0'); computeTargets(); buildOils(); if (mist) mist.target = 0; });

// ---------- 轉場 ----------
async function ensureView(name, onProgress) {
  if (S.views[name]?.ready) return S.views[name];
  if (!S.views[name]) S.views[name] = new ViewData(name);
  if (!S.views[name]._p) S.views[name]._p = S.views[name].load(VIEW_BASE, renderer, onProgress).then(v => { S.meshes[name] = makeBackgroundMesh(v); S.meshes[name].visible = false; scene.add(S.meshes[name]); return v; });
  return S.views[name]._p;
}
// 點下去才一次把 11 張光層送進顯示卡、編譯著色器，會卡住一整幀（實測 0.4 秒，慢電腦 1 秒以上）：
// 改成一幀送一張、著色器非同步編譯，全部就緒才開始移動
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
async function warmView(name) {
  const v = S.views[name], m = S.meshes[name]; if (!v || !m || v._warm || name === 'room' || name === 'roomc') return;   // 全景一直在畫，早就在顯示卡裡
  for (const t of Object.values(v.textures)) { renderer.initTexture(t); await nextFrame(); }
  renderer.initTexture(v.depthTex);
  m.visible = true; const p = renderer.compileAsync(m, camera, scene); m.visible = false;
  try { await p; } catch (e) { console.warn(e); }
  v._warm = true;
}
let going = false;
async function goTo(name) {
  if (S.mode === 'moving' || S.mode === 'focus' || S.mode === 'intro') return;
  if (name === S.view || going) return;
  vis($('#hint'), false);
  going = true;
  try { await ensureView(name); touchView(name); await warmView(name); } finally { going = false; }
  if (S.mode === 'moving' || S.mode === 'focus' || name === S.view) return;
  S.from = S.view; S.to = name; S.moveT = 0;
  const a = S.camNow || S.cam, b = viewCam(name);   // 從畫面上實際的鏡頭（含滑鼠視差）出發，起步不跳
  const dist = a.pos.distanceTo(b.pos);
  S.moveDur = clamp(2.0 + dist * 0.08, 2.2, 2.7);
  S.moveA = a; S.moveB = b; S.mode = 'moving';
  S.roomCam = name === 'room' ? b : a; S.viewCamT = name === 'room' ? a : b; S.viewName = name === 'room' ? S.from : name;
  vis($('#back'), false); vis($('#aroma'), false);
}
function arrive() {
  S.view = S.to; S.cam = S.moveB; S.mode = S.view === 'room' ? 'room' : 'view';
  vis($('#back'), S.view !== 'room');
  const hint = $('#hint');
  if (S.books[S.view]) { hint.textContent = T('layer-hint', '點一本書，把它拿出來'); vis(hint, true); } else vis(hint, false);
  vis($('#aroma'), S.view === 'aroma');
  if (S.view === 'aroma') buildOils();
}
$('#back').addEventListener('click', () => back());
function back() {
  if (shown($('#reader'))) return closeReader();
  if (S.mode === 'focus') return returnBook();
  if (S.mode === 'view') goTo('room');
}
window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.panelOpen) return togglePanel(false); back(); } });

// ---------- 滑過與點書 ----------
const ray = new THREE.Raycaster();
canvas.addEventListener('pointermove', e => {
  S.pointerPx.set(e.clientX, e.clientY);
  S.pointer.set(e.clientX / S.size[0] * 2 - 1, -(e.clientY / S.size[1]) * 2 + 1);
});
canvas.addEventListener('pointerleave', () => { S.pointerPx.set(-1, -1); });
canvas.addEventListener('click', e => {
  S.pointer.set(e.clientX / S.size[0] * 2 - 1, -(e.clientY / S.size[1]) * 2 + 1);
  if (S.mode === 'view' && S.books[S.view]) { const b = pickBook(); if (b) openBook(b); }
  if (S.mode === 'room' && S.data?.anchors?.lamp) { const lp = toScreen(new THREE.Vector3(...S.data.anchors.lamp)); if (Math.hypot(lp.x - e.clientX, lp.y - e.clientY) < LAMP_PICK_PX) toggleLamp(); }
  if (S.panelOpen) togglePanel(false);
});
function pickBook() {
  const list = S.books[S.view]; if (!list || !list.length) return null;
  ray.setFromCamera(S.pointer, camera);
  const hit = ray.intersectObjects(list, true)[0];
  return hit ? hit.object.userData.book : null;
}
function updateHover(dt) {
  const tip = $('#booktip');
  let b = null;
  if (S.mode === 'view' && S.books[S.view] && S.pointerPx.x >= 0) b = pickBook();
  S.hover = b;
  // 檯燈彩蛋：全景時滑鼠離燈頭夠近，游標變成手指（沒有光點、沒有文字）
  S.lampHover = false;
  if (!b && S.mode === 'room' && S.pointerPx.x >= 0 && S.data?.anchors?.lamp) {
    const lp = toScreen(new THREE.Vector3(...S.data.anchors.lamp));
    S.lampHover = Math.hypot(lp.x - S.pointerPx.x, lp.y - S.pointerPx.y) < LAMP_PICK_PX;
  }
  canvas.style.cursor = b || S.lampHover ? 'pointer' : '';
  for (const k in S.books) for (const bk of S.books[k]) {
    if (S.focus && S.focus.book === bk) continue;
    const want = bk === b ? 1 : 0; bk.userData.slideT += (want - bk.userData.slideT) * Math.min(1, dt * 10);
    const h = bk.userData.home; bk.position.copy(h.position).addScaledVector(h.v, 0.035 * easeInOut(bk.userData.slideT)); setShadow(bk, 1 - 0.35 * bk.userData.slideT);
  }
  if (b) {
    const w = b.userData.work, l = b.userData.learn;
    tip.innerHTML = ''; tip.append(document.createTextNode(w ? w.title : l.title));
    const sub = w ? (w.draft ? T('book-draft', '').split('，')[0] : (w.date || '')) : (l.author || '');
    if (sub) { const sm = document.createElement('small'); sm.textContent = sub; tip.append(sm); }
    tip.style.left = S.pointerPx.x + 'px'; tip.style.top = S.pointerPx.y + 'px'; tip.hidden = false;
  } else tip.hidden = true;
}

// 拿書：抽出 → 浮到眼前 → 翻開 → 翻三頁 → 攤開微傾
function openBook(b) {
  const w = b.userData.work, l = b.userData.learn;
  const pages = {
    left: kit.pageTexture('title', { category: w ? (w.category === 'ai' ? T('hot-caseR2') : T('hot-caseL2')) : T('hot-skill'), title: w ? w.title : l.title, date: w ? w.date : (l.author || '') }),
    right: kit.pageTexture('right', { body: w ? (w.summary || '') : '', note: w && w.draft ? T('book-draft') : '' }),
  };
  b.setContent(pages);
  S.focus = { book: b, t: 0, closing: false, rt: 0, cued: {} };
  S.mode = 'focus'; vis($('#hint'), false); $('#booktip').hidden = true; canvas.style.cursor = '';
  $('#bookread').hidden = !(w && w.url);
}
function returnBook() {
  if (!S.focus || S.focus.closing) return;
  vis($('#bookui'), false);
  S.focus.closing = true; S.focus.rt = 0;
}
$('#bookreturn').addEventListener('click', returnBook);
$('#bookread').addEventListener('click', () => {
  const w = S.focus?.book.userData.work; if (!w || !w.url) return;
  $('#readertitle').textContent = w.title; $('#readerframe').src = w.url; vis($('#reader'), true);
});
function closeReader() { vis($('#reader'), false); setTimeout(() => { if (!shown($('#reader'))) $('#readerframe').src = 'about:blank'; }, 560); }
$('#readerclose').addEventListener('click', closeReader);

const FOCUS_END = 4.25;
function focusPoses(b) {
  // 在目前鏡頭前找「闔上」與「攤開」兩個位置
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const c = S.cam;
  // 畫面中心（含平移）方向
  const center = fwd.clone().addScaledVector(right, c.offX).addScaledVector(up, c.offY).normalize();
  const dOpen = Math.max((2 * b.w / 0.74) / (2 * c.tanX), (b.h * 0.93 / 0.72) / (2 * c.tanY));
  const face = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate()));
  const tilt = new THREE.Quaternion().setFromAxisAngle(right, -0.36);
  const faceTilt = tilt.clone().multiply(face);
  // 先飛到最終距離、闔著（書本置中），再原地翻開
  const closedPos = camera.position.clone().addScaledVector(center, dOpen * 0.92).addScaledVector(right, -b.w / 2).addScaledVector(up, dOpen * c.tanY * 0.08);
  const openPos = camera.position.clone().addScaledVector(center, dOpen).addScaledVector(up, dOpen * c.tanY * 0.06);
  return { closedPos, openPos, face, faceTilt };
}
// 拿書時間軸（秒）：抽出 0–0.6；浮到眼前 0.6–1.9；翻開 1.9–2.8；翻三頁 2.8 起
// 放回時間軸：直接闔上 0–0.6；飛回並轉正 0.5–1.6；推回書櫃 1.5–2.1（不倒翻頁）
const RETURN_END = 2.1;
function updateFocus(dt) {
  const F = S.focus; if (!F) return;
  const b = F.book, home = b.userData.home;
  const pulled = home.position.clone().addScaledVector(home.v, b.w * 0.75);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  if (!F.closing) {
    F.t = Math.min(FOCUS_END, F.t + dt);
    const t = F.t, P = focusPoses(b);
    cue(F, 'cover', 1.95, t, () => sfx.play('cover'));   // 音效對齊動畫：翻開封面、再翻三頁
    [0, 1, 2].forEach(i => cue(F, 'page' + i, 2.85 + i * 0.32, t, () => sfx.play('page', { rate: 0.95 + i * 0.05, gain: 1 - i * 0.12 })));
    const k1 = ease(smooth(0, 0.6, t)), k2 = ease(smooth(0.6, 1.9, t)), k3 = ease(smooth(1.9, 2.8, t));
    const pos = home.position.clone().lerp(pulled, k1);
    if (k2 > 0) { pos.lerp(P.closedPos, k2); pos.z += Math.sin(Math.PI * k2) * 0.04; }
    if (k3 > 0) pos.lerp(P.openPos, k3);
    b.position.copy(pos);
    const q = home.quaternion.clone().slerp(P.face, k2); if (k3 > 0) q.slerp(P.faceTilt, k3);
    b.quaternion.copy(q);
    b.setOpen(k3);
    setShadow(b, 1 - smooth(0.05, 0.7, t));
    b.setSheets([0, 1, 2].map(i => smooth(2.8 + i * 0.32, 2.8 + i * 0.32 + 0.75, t)));
    F.layered = t > 0.6;
    F.blur = smooth(0.6, 1.9, t) * 0.9;
    readLight.intensity = smooth(0.8, 2.0, t) * ((S.look.books || {}).reading ?? 9);
    if (t >= FOCUS_END - 0.35 && !shown($('#bookui')) && !F.uiShown) { F.uiShown = true; vis($('#bookui'), true); }
    F.lastPos = b.position.clone(); F.lastQuat = b.quaternion.clone(); F.lastOpen = k3;
    readLight.position.copy(camera.position).addScaledVector(right, -0.35).addScaledVector(up, 0.45); readLight.lookAt(P.openPos);
    return;
  }
  // 放回：翻過的頁與封面一起闔上，然後飛回
  F.rt = Math.min(RETURN_END, F.rt + dt);
  const t = F.rt;
  cue(F, 'close', 0.22, t, () => sfx.play('close'));   // 書闔上那一下（錄音的「啪」在第 0.3 秒左右，對齊 0.55 秒闔緊）
  const kc = ease(smooth(0, 0.6, t)), kf = ease(smooth(0.5, 1.6, t)), ki = ease(smooth(1.5, 2.1, t));
  b.hideFlips();
  b.setOpen(F.lastOpen * (1 - kc));
  const pos = F.lastPos.clone().lerp(pulled, kf); pos.z += Math.sin(Math.PI * kf) * 0.04;
  pos.lerp(home.position, ki);
  b.position.copy(pos);
  b.quaternion.copy(F.lastQuat.clone().slerp(home.quaternion, kf));
  setShadow(b, smooth(1.2, 2.1, t));
  F.layered = t < 1.5;
  F.blur = (1 - smooth(0.3, 1.5, t)) * 0.9;
  readLight.intensity = (1 - smooth(0, 0.9, t)) * ((S.look.books || {}).reading ?? 9);
  if (t >= RETURN_END) {
    b.resetPages(); b.setOpen(0); b.position.copy(home.position); b.quaternion.copy(home.quaternion); setShadow(b, 1);
    S.focus = null; S.mode = 'view'; readLight.intensity = 0;
    if (S.books[S.view]) vis($('#hint'), true);
  }
}
function cue(F, k, at, t, fn) { if (t >= at && !F.cued[k]) { F.cued[k] = true; fn(); } }
// 柔和的加減速（五次平滑）：起步與收尾都更緩
function ease(x) { return x * x * x * (x * (x * 6 - 15) + 10); }

// ---------- 開場 ----------
const INTRO = [ // 組, 開始秒, 淡入秒
  ['moon', 0.0, 1.6], ['cove', 0.2, 1.8], ['lamp', 0.5, 0.7], ['track', 0.9, 0.8], ['skill', 1.1, 0.8], ['caseL', 1.6, 0.7], ['caseR', 1.95, 0.7],
  ['bed', 2.3, 0.8], ['fill', 2.5, 1.0], ['screen', 2.7, 0.6], ['aroma', 2.9, 0.6],
  ['sky', 0.0, 1.4], ['shelf', 1.1, 0.9], ['ceil', 0.3, 1.0]];
function startIntro(returning) {
  const rest = viewCam('room');
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(rest.quat);
  const start = { ...rest, pos: rest.pos.clone().addScaledVector(fwd, returning ? 0.12 : 0.75) };
  S.intro = { t: 0, dur: returning ? 1.1 : 3.6, start, rest, returning };
  S.cam = start; S.mode = 'intro';
}
function updateIntro(dt) {
  const I = S.intro; if (!I) return;
  I.t += dt;
  const t = I.t;
  for (const g of GROUPS) {
    if (I.returning) { light.intro[g] = 1; continue; }   // 開場畫面已經上好色：燈直接是亮的
    const row = INTRO.find(r => r[0] === g); light.intro[g] = row ? smooth(row[1], row[1] + row[2], t) : 1;
  }
  const k = easeOutCubic(clamp(t / I.dur, 0, 1));
  S.cam = mixCam(I.start, I.rest, k);
  pipe.finalMat.uniforms.uFade.value = I.returning ? 1 : smooth(0, 0.8, t);
  if (t >= I.dur + (I.returning ? 0 : 0.2)) {
    S.intro = null; S.mode = 'room'; S.cam = viewCam('room'); GROUPS.forEach(g => light.intro[g] = 1);
    document.body.classList.add('ready'); store.set('v30-visited', '1');
    preloadRest();
  }
  if (t > 0.3) document.body.classList.add('loaded');
  if (t > I.dur * 0.75) document.body.classList.add('ready');
}
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
// 其他視角：只先下載進瀏覽器快取，點進去才放進顯示卡；全景的兩套一直留著
async function preloadRest() {
  try { await ensureView('roomc'); } catch (e) { console.warn(e); }
  for (const n of VIEW_NAMES) {
    if (n === 'room') continue;
    try {
      const info = await (await fetch(`${VIEW_BASE}/${n}/camera.json`)).json();
      for (const g of info.groups) await fetch(`${VIEW_BASE}/${n}/${g}.avif`);
      await fetch(`${VIEW_BASE}/${n}/depth.png`);
    } catch (e) { console.warn(e); }
  }
}
// 顯示卡裡最多留兩個特寫：最久沒用的釋放
const viewUse = [];
function touchView(name) {
  if (name === 'room' || name === 'roomc') return;
  const i = viewUse.indexOf(name); if (i >= 0) viewUse.splice(i, 1); viewUse.push(name);
  while (viewUse.length > 2) {
    const old = viewUse.shift(); const v = S.views[old], m = S.meshes[old];
    if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); delete S.meshes[old]; }
    if (v) { v.dispose(); delete S.views[old]; }
  }
}

// ---------- 開場畫面：線稿隨載入上色 ----------
const LD = { p: 0, shown: 0, c: 0, drawn: false, t0: performance.now() };
window.__introDrawn?.then(() => { LD.drawn = true; });
function setLoad(p) { LD.p = Math.max(LD.p, p); }
(function ldTick() {   // 顯示值平滑追上實際進度；上色（--c）等線稿描完才開始，最快約 1.2 秒掃過整張
  LD.shown += (LD.p - LD.shown) * 0.12;
  if (LD.drawn) LD.c = Math.min(LD.shown, LD.c + 1 / 72);
  if (LD.c > 0.02) $('#loading')?.classList.add('unnamed');   // 上色一開始，名字就淡出（不等渲染完成）
  const el = $('#loading'); if (el) { el.style.setProperty('--p', LD.shown.toFixed(4)); el.style.setProperty('--c', LD.c.toFixed(4)); }
  if (!document.body.classList.contains('loaded')) requestAnimationFrame(ldTick);
})();
// 聲音開關（預設開；記在這台瀏覽器）
function updateSoundButton() { const b = $('#soundbtn'); b.setAttribute('aria-pressed', String(sfx.on)); const sp = b.querySelector('span'); sp.dataset.copy = sfx.on ? 'sound-on' : 'sound-off'; sp.textContent = T(sp.dataset.copy, sfx.on ? '聲音：開' : '聲音：關'); }
$('#soundbtn').addEventListener('click', () => { sfx.setOn(!sfx.on); updateSoundButton(); });
// 開場的兩個選項：房間上完色、名字淡出之後才浮現；選過「進房間」的人下次不再問
function entryChoice() {
  return new Promise(res => {
    const box = $('#ldchoice'), go = $('#enterroom');
    const ld = $('#loading');
    if (!box || store.get('v30-entry') === 'room' || new URLSearchParams(location.search).has('enter')) { ld?.classList.add('colored'); return res(); }   // 網址加 enter：驗收截圖直接進房間
    box.hidden = false; void box.offsetWidth;   // 先讓按鈕以透明狀態出現在版面上，下一步的淡入才會有漸變
    ld?.classList.add('colored');   // 進度條淡出、按鈕淡入（room.css）
    const pick = () => { sfx.unlock(); store.set('v30-entry', 'room'); box.classList.add('chosen'); go.disabled = true; res(); };
    go.addEventListener('click', pick);
    window.addEventListener('keydown', function k(e) { if (e.key === 'Enter' && !box.classList.contains('chosen')) { window.removeEventListener('keydown', k); pick(); } });
  });
}
function ldFinish() {   // 上色完成、名字至少停留 1.4 秒
  setLoad(1);
  return new Promise(res => { const f = () => (LD.c > 0.985 && performance.now() - LD.t0 > 1400) ? setTimeout(res, 250) : requestAnimationFrame(f); f(); });
}
{ const slotNow = timeSlot(); const im = $('#loading .ld-color'); if (im) im.src = `intro-color-${slotNow}.jpg`; setLoad(0.08); }

// ---------- 每幀 ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  S.pr = Math.min(window.devicePixelRatio || 1, [1.75, 1.25, 1.0, 0.8][S.quality || 0]);   // 畫質等級：跑不動時自動往下降
  S.size = [w, h];
  renderer.setPixelRatio(S.pr); renderer.setSize(w, h, false);
  pipe.setSize(Math.round(w * S.pr), Math.round(h * S.pr));
  if (S.views.room?.ready && S.mode !== 'intro' && S.mode !== 'moving' && S.mode !== 'focus') S.cam = viewCam(S.view);
}
window.addEventListener('resize', resize);


function setGains(mesh, name) {
  const u = mesh.material.uniforms.uGain.value;
  const isRoom = name === 'room' || name === 'roomc';
  // 特寫只渲染了「窗簾拉開」一種：窗簾拉上時日光按比例壓暗（全景有自己那一套，不必）
  const skyK = isRoom ? 1 : 0.15 + 0.85 * S.curtainT;
  GROUPS.forEach((g, i) => u[i].copy(light.cur[g]).multiplyScalar(light.intro[g] * (1 + 0.45 * hoverBoost[g]) * (g === 'sky' ? skyK : 1)));
  const U = mesh.material.uniforms;
  if (isRoom && S.win && S.cityTex) {
    const cg = (((S.look.times || {})[S.slot]) || {}).city || { gain: 1, tint: '#ffffff' };
    U.uCity.value = S.cityTex; U.uCityGain.value.copy(linColor(cg.tint || '#ffffff')).multiplyScalar((cg.gain ?? 1) * Math.min(1, light.intro.sky ?? 1));
    U.uWin.value.set(S.win.x0, S.win.x1, S.win.gy, S.win.z1);
    if (S.look.cityMap) U.uCityMap.value.set(...S.look.cityMap);
  } else U.uCityGain.value.set(0, 0, 0);
}
// 全景用哪一套：窗簾拉開（room）或拉上（roomc，還沒載好就先用拉開的）
function roomMesh() { return S.curtainT < 0.5 && S.meshes.roomc && S.views.roomc?.ready ? 'roomc' : 'room'; }
function renderScene(target, meshName, clearAlpha, hideFocus, sheetDark = 1) {
  for (const n in S.meshes) S.meshes[n].visible = n === meshName;
  if (meshName) { setGains(S.meshes[meshName], meshName); S.meshes[meshName].material.uniforms.uSheetDark.value = sheetDark; }
  const fb = S.focus && hideFocus ? S.focus.book : null;
  if (fb) fb.visible = false;
  renderer.setRenderTarget(target); renderer.setClearColor(0x000000, clearAlpha); renderer.clear(true, true, true);
  renderer.render(scene, camera);
  if (fb) fb.visible = true;
}
function renderBookLayer() {
  const b = S.focus.book;
  const vis = [];
  scene.traverseVisible(o => { if ((o.isMesh || o.isPoints) && !isInside(o, b)) { vis.push(o); } });
  vis.forEach(o => o.visible = false);
  renderer.setRenderTarget(pipe.rtBook); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
  renderer.render(scene, camera);
  vis.forEach(o => o.visible = true);
}
function isInside(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }

let last = performance.now();
// 自動畫質：全景或特寫靜止時量 2 秒平均每幀時間，太慢就降一級（解析度 → 光暈 → 浮塵），最多降三級
const PERF = { acc: 0, n: 0, t: 0 };
const NO_AUTO_Q = new URLSearchParams(location.search).has('noauto');   // 驗收截圖時關掉（背景在渲染時電腦很慢，會誤降畫質）
function autoQuality(dtMs) {
  if (NO_AUTO_Q) return;
  if (S.mode !== 'room' && S.mode !== 'view') { PERF.acc = PERF.n = PERF.t = 0; return; }
  PERF.acc += dtMs; PERF.n++; PERF.t += dtMs;
  if (PERF.t < 2000) return;
  const avg = PERF.acc / PERF.n; PERF.acc = PERF.n = PERF.t = 0;
  S.fps = Math.round(1000 / avg);
  if (avg > 26 && (S.quality || 0) < 3) { S.quality = (S.quality || 0) + 1; resize(); console.info('畫質降到', S.quality, '平均每幀', avg.toFixed(1), 'ms'); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dtRaw = now - last; const dt = S.paused ? 0 : Math.min(0.05, dtRaw / 1000); last = now; S.time += dt; if (!S.paused) autoQuality(dtRaw);
  if (!S.cam) return;
  stepLights(dt);
  S.curtainT += clamp(S.curtain - S.curtainT, -dt / 2.2, dt / 2.2);   // 窗簾 2.2 秒拉開／拉上
  GROUPS.forEach(g => { const want = S.mode === 'room' && S.hoverGlow === g ? 1 : 0; hoverBoost[g] += (want - hoverBoost[g]) * Math.min(1, dt * 5); });
  updateIntro(dt);
  let mix = 0, tcams = null, transBlur = 0;
  if (S.mode === 'moving') {
    S.moveT += dt / S.moveDur;
    const t = clamp(S.moveT, 0, 1);
    const e = S.to === 'room' ? 1 - ease(t) : ease(t);    // e：0＝全景，1＝特寫
    tcams = transitionCams(S.roomCam, S.viewCamT, S.viewName, e);
    S.cam = e < 0.5 ? tcams.camR : tcams.camV;
    mix = smooth(0.38, 0.58, e);   // 兩層在最模糊的那一段交接（見 transBlur）
    // 失焦溶接：兩個視角交界那段（e≈0.5）畫面輕微失焦，藏住深度重建的拉扯與重影，過了交界再對焦
    transBlur = smooth(0.04, 0.32, e) * (1 - smooth(0.62, 0.9, e));   // 中段完全失焦：兩層的拉扯與交接都藏在這裡，對焦回來時鏡頭已接近特寫
    if (S.moveT >= 1) { arrive(); mix = 0; tcams = null; }
  }
  // 房間全景的微視差（滑鼠）
  let camNow = S.cam;
  if (S.mode === 'room' && !isNarrow()) {
    S.parallax.lerp(new THREE.Vector2(S.pointerPx.x < 0 ? 0 : S.pointer.x, S.pointerPx.x < 0 ? 0 : S.pointer.y), Math.min(1, dt * 2));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(S.cam.quat), up = new THREE.Vector3(0, 1, 0).applyQuaternion(S.cam.quat);
    camNow = { ...S.cam, pos: S.cam.pos.clone().addScaledVector(right, S.parallax.x * 0.018).addScaledVector(up, S.parallax.y * 0.01) };
  } else S.parallax.multiplyScalar(Math.exp(-dt * 6));   // 離開全景時視差歸零，回來時從 0 慢慢接回
  S.camNow = camNow;
  setCamera(camNow);
  updateHover(dt);
  updateFocus(dt);
  updateBookLights();
  const pxScale = S.size[1] * S.pr / (2 * camNow.tanY);
  if (mist) { mist.update(dt, S.time, pxScale); mist.points.visible = mist.strength > 0.01; }
  if (steam) steam.update(dt, S.time, pxScale);
  if (dust) { const k = (S.look.dust ?? 0.35) * (S.view === 'room' && S.mode !== 'moving' ? 1 : 0.6) * ((S.quality || 0) >= 3 ? 0 : 1);   // 近距離特寫時浮塵較大顆，壓淡一點
    dust.update(S.time, pxScale, gainOf('lamp') * k, gainOf('bed') * k, trackGain() * k, 1); }
  if (!motes && FX !== 'none' && S.views.room?.ready) {   // 散景要用全景鏡頭的位置：等全景載好才建
    motes = new Motes(FX[0], viewCam('room')); scene.add(motes.points);
    if (FX[1]) { motes2 = new Motes(FX[1], viewCam('room'), 0.35); scene.add(motes2.points); }   // 第二種只加一點點：數量約三分之一
  }
  if (motes) {   // 只在全景出現；轉場與特寫時淡掉
    motesK += ((S.view === 'room' && S.mode !== 'moving' ? 1 : 0) - motesK) * Math.min(1, dt * 2);
    const mk = (S.look.motes ?? 1) * motesK * ((S.quality || 0) >= 3 ? 0 : 1);
    motes.update(S.time, pxScale, mk); if (motes2) motes2.update(S.time, pxScale, mk * 0.7);
  }
  clockMat.color.setScalar(0.55 * (0.3 + 0.7 * light.intro.screen));
  if (mist) { const m = S.look.moods[S.mood] || {}; const c = linColor(m.mist || '#fff4e8').multiplyScalar(0.05 + 0.5 * (gainOf('lamp') * 0.35 + gainOf('aroma') * 0.9)); mist.mat.uniforms.uColor.value.set(c.x, c.y, c.z); }
  if (steam) { const c = linColor('#fff1e0').multiplyScalar(0.04 + 0.12 * (gainOf('fill') + gainOf('lamp'))); steam.mat.uniforms.uColor.value.set(c.x, c.y, c.z); }

  if (tcams) {
    setCamera(tcams.camR); renderScene(pipe.rtA, roomMesh(), 1, false, 0.28);
    S.meshes[S.viewName].material.uniforms.uEdge.value = 0.07 * (1 - smooth(0.55, 0.97, tcams.e));
    // 快到特寫時特寫層幾乎就在自己的拍攝位置：不再把深度斷層挖成透明（否則會露出全景層裡、特寫刻意藏起的椅子）
    S.meshes[S.viewName].material.uniforms.uEdgeCut.value = 0.04 + 4 * smooth(0.6, 0.9, tcams.e);
    setCamera(tcams.camV); renderScene(pipe.rtB, S.viewName, 0, false);
    setCamera(S.cam);
  } else if (S.view === 'room' && S.views.roomc?.ready && S.curtainT > 0.001 && S.curtainT < 0.999) {
    // 窗簾拉動中：兩套全景交疊（拉開的在底，拉上的依進度蓋上去）
    renderScene(pipe.rtA, 'room', 1, false);
    const cu = S.meshes.roomc.material.uniforms.uCurt; cu.value = 1 - ease(S.curtainT);   // 布往兩側收（拉上那套在上層，alpha 標出布蓋住的地方）
    renderScene(pipe.rtB, 'roomc', 0, false); cu.value = -1;
    mix = 1;
  } else {
    renderScene(pipe.rtA, S.view === 'room' ? roomMesh() : S.view, 1, S.focus && S.focus.layered);
  }
  const U = pipe.finalMat.uniforms;
  pipe.composite(mix, tcams ? 1 : 0);
  const BL = S.look.bloom || {}; Object.assign(pipe.bloom, { strength: (BL.strength ?? 0) * ((((S.look.times || {})[S.slot]) || {}).bloom ?? 1), threshold: BL.threshold ?? 1.0, knee: BL.knee ?? 0.5, spread: BL.spread ?? 1.0 });
  if ((S.quality || 0) >= 2) pipe.bloom.strength = 0;   // 第二級起關掉光暈
  pipe.runBloom(grade.exposure);
  const blurAmt = Math.max(S.focus ? S.focus.blur : 0, transBlur);
  if (blurAmt > 0.001) { pipe.blur(); U.uBlur.value = blurAmt; } else U.uBlur.value = 0;
  if (S.focus && S.focus.layered) { renderBookLayer(); U.uBook.value = 1; } else U.uBook.value = 0;
  U.uExposure.value = grade.exposure; U.uSat.value = grade.sat; U.uShadow.value.copy(grade.shadow);
  U.uVignette.value = grade.vignette; U.uTime.value = S.time % 10;
  pipe.final();
  updateOverlay();
}

// ---------- 啟動 ----------
async function boot() {
  resize();
  const [data, look] = await Promise.all([fetchJSON('scene.json'), fetchJSON('look.json')]);
  S.data = data; S.look = look;
  try { setGroups((await fetchJSON(`${VIEW_BASE}/room/camera.json`)).groups); } catch {}
  initLightState();
  S.lampOn = store.get('v30-lamp') !== '0';
  S.aromaOn = store.get('v30-aroma') !== '0';
  S.mood = clamp(parseInt(store.get('v30-mood') || '0', 10) || 0, 0, look.moods.length - 1);
  S.slot = timeSlot(); applySlotDefaults(); document.body.dataset.slot = S.slot;
  try {   // 燈光開關面板與窗（patch-v34 寫出）
    const pj = await fetchJSON('panel.json');
    const pc = pj.panel.center, pn = pj.panel.n; S.data.anchors.panel = [pc[0] + pn[0] * 0.03, pc[1] + pn[1] * 0.03, pc[2]];
    const w = pj.window; S.win = w; S.data.anchors.curtain = [(w.x0 + w.x1) / 2, w.gy - 0.45, 1.55];
  } catch (e) { console.warn('panel.json', e); }
  S.cityTex = await new Promise(res => new THREE.TextureLoader().load(`city/${S.slot}.jpg`, t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; res(t); }, undefined,
    () => new THREE.TextureLoader().load('city/night.jpg', t => { t.colorSpace = THREE.NoColorSpace; res(t); }, undefined, () => res(null))));
  await loadCopy(); updateSoundButton();
  try { S.works = (await fetchJSON('works.json')).works; } catch { S.works = []; }
  const fontsIn = await kit.ready();
  // 字型晚到：等它到了、而且沒有書被拿在手上時，重畫書脊的燙金書名
  if (!fontsIn) kit.fontsDone.then(function redo() { if (S.focus) return setTimeout(redo, 1500); buildBooks(); });
  buildShelfLights(); buildBooks(); buildEffects(); buildCertificates(); buildClock(); tick();
  if (!S.aromaOn) mist.target = 0;
  computeTargets(); stepLights(0, true);
  let got = 0; const total = GROUPS.length + 1;
  await ensureView('room', () => { got++; setLoad(0.15 + 0.75 * got / total); });
  buildArt(); kit.loadTextures();   // 掛畫（400 KB）與書本布紋紙張（1.1 MB）等房間主圖下載完才抓，不跟它搶頻寬
  await ldFinish();
  await entryChoice();
  renderScreenApps();
  startIntro(true);   // 開場畫面已經把房間上好色了：直接接到亮著燈的房間，只留短短的推近
  requestAnimationFrame(frame);
  live();
}
function renderScreenApps() {
  const ul = $('#screenapps'); ul.innerHTML = '';
  S.works.filter(w => w.category === 'ai' && !w.draft).forEach(w => {
    const li = document.createElement('li'); const a = document.createElement('a'); a.href = w.url;
    a.innerHTML = '<span></span><small></small>'; a.querySelector('span').textContent = w.title; a.querySelector('small').textContent = w.summary || '';
    a.onclick = e => { e.preventDefault(); $('#readertitle').textContent = w.title; $('#readerframe').src = w.url; vis($('#reader'), true); };
    li.appendChild(a); ul.appendChild(li);
  });
}
function live() {
  try {
    if (location.port !== '4330') return;   // 即時重讀只在本機預覽伺服器有；正式網站是靜態檔
    const es = new EventSource('/events');
    es.onmessage = async e => {
      if (e.data === 'ready') return;
      const before = JSON.stringify([T('learning-books'), T('show-drafts'), T('hot-caseL2'), T('hot-caseR2')]);
      await loadCopy();
      try { S.look = await fetchJSON('look.json'); computeTargets(); buildOils(); } catch {}
      let wchanged = false;
      try { const w = (await fetchJSON('works.json')).works; wchanged = JSON.stringify(w) !== JSON.stringify(S.works); S.works = w; } catch {}
      if (wchanged || before !== JSON.stringify([T('learning-books'), T('show-drafts'), T('hot-caseL2'), T('hot-caseR2')])) { buildBooks(); renderScreenApps(); }
      buildCertificates(); buildArt();
    };
  } catch {}
}
// 桌上時鐘：台灣時間
const taipei = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
function tick() { drawClock(taipei.format(new Date())); }
tick(); setInterval(tick, 10000);

boot().catch(e => { __showError('啟動失敗：' + (e.stack || e.message || e)); });
window.__sfx = sfx;
window.__room = { S, light, camera, goTo, scene, openBook, returnBook, selectOil, buildCertificates, startIntro, drawClock };
