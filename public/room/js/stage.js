// 渲染核心：預渲染光層 → 深度重建網格 → 與即時物件（書、霧）同場 → 統一調色與色調轉換。
// 光層算法必須與 room-v30/look.py 一致（反解 → 加權相加 → 曝光 → 暗部偏色 → 飽和度 → Khronos PBR Neutral → sRGB）。
import * as THREE from 'three';

// 光組清單以渲染資料為準（room/camera.json 的 groups）；啟動時由 main.js 呼叫 setGroups
export const GROUPS = ['lamp', 'caseL', 'caseR', 'skill', 'bed', 'fill', 'moon', 'screen', 'aroma'];
export function setGroups(list) { GROUPS.length = 0; list.forEach(g => GROUPS.push(g)); }

// ---------- 鏡頭：Blender 座標（Z 朝上）直接沿用 ----------
// 投影以「正切單位」描述：tanX、tanY 是半視角正切，offX、offY 是畫面中心的偏移（Blender shift 換算而來）
export function applyProjection(cam, p, near = 0.03, far = 60) {
  const m = cam.projectionMatrix;
  const a = 1 / p.tanX, b = 1 / p.tanY;
  m.set(
    a, 0, p.offX / p.tanX, 0,
    0, b, p.offY / p.tanY, 0,
    0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
    0, 0, -1, 0);
  cam.projectionMatrixInverse.copy(m).invert();
}

export class ViewData {
  constructor(name) { this.name = name; this.ready = false; }
  async load(base, renderer, onProgress) {
    const info = await (await fetch(`${base}/${this.name}/camera.json`)).json();
    this.info = info;
    const W = info.width, H = info.height;
    this.aspect = W / H;
    this.tanY = Math.tan(info.vfov / 2);
    this.tanX = this.tanY * this.aspect;
    // Blender 平移以畫面高為單位（sensor fit 垂直）
    this.offX = info.shift[0] * 2 * this.tanY;
    this.offY = info.shift[1] * 2 * this.tanY;
    const M = info.matrix; // 4x4 row-major
    this.matrixWorld = new THREE.Matrix4().set(...M[0], ...M[1], ...M[2], ...M[3]);
    this.position = new THREE.Vector3().setFromMatrixPosition(this.matrixWorld);
    this.quaternion = new THREE.Quaternion().setFromRotationMatrix(this.matrixWorld);
    this.viewMatrix = this.matrixWorld.clone().invert();
    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const tex = await Promise.all(info.groups.map(g => new Promise((res, rej) => loader.load(`${base}/${this.name}/${g}.avif`, t => {
      t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter; t.anisotropy = Math.min(8, maxAniso); onProgress && onProgress(); res(t);
    }, undefined, rej))));
    this.textures = {};
    info.groups.forEach((g, i) => this.textures[g] = tex[i]);
    // 深度：R 高位、G 低位，×far/65535 公尺；影像第一列在最上，資料貼圖第一列要在最下
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `${base}/${this.name}/depth.png`; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, img.width, img.height).data;
    const dw = img.width, dh = img.height, depth = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {   // 分段解碼：每 160 列讓出一幀，慢電腦上不會整個卡住
      for (let x = 0; x < dw; x++) {
        const i = ((dh - 1 - y) * dw + x) * 4;
        depth[y * dw + x] = (px[i] * 256 + px[i + 1]) / 65535 * info.far;
      }
      if (y % 160 === 159) await new Promise(r => requestAnimationFrame(() => r()));
    }
    this.depthData = depth; this.depthW = dw; this.depthH = dh;
    this.depthTex = new THREE.DataTexture(depth, dw, dh, THREE.RedFormat, THREE.FloatType);
    this.depthTex.minFilter = this.depthTex.magFilter = THREE.NearestFilter; this.depthTex.needsUpdate = true;
    onProgress && onProgress();
    this.ready = true;
    return this;
  }
  // 釋放顯示卡記憶體（每個視角約 11 層 2560×1440，全部留著會超過 1 GB）
  dispose() { Object.values(this.textures || {}).forEach(t => t.dispose()); this.depthTex && this.depthTex.dispose(); this.ready = false; }
  // 畫面座標（0..1，左下原點）→ 世界座標
  unproject(u, v, out = new THREE.Vector3()) {
    const x = Math.min(this.depthW - 1, Math.max(0, Math.floor(u * this.depthW)));
    const y = Math.min(this.depthH - 1, Math.max(0, Math.floor(v * this.depthH)));
    const z = this.depthData[y * this.depthW + x];
    out.set(((u * 2 - 1) * this.tanX + this.offX) * z, ((v * 2 - 1) * this.tanY + this.offY) * z, -z);
    return out.applyMatrix4(this.matrixWorld);
  }
  // 世界座標 → 本視角畫面座標（0..1），以及該點在本視角的深度
  project(p, out = new THREE.Vector3()) {
    const q = p.clone().applyMatrix4(this.viewMatrix);
    const z = -q.z;
    out.set(((q.x / z - this.offX) / this.tanX) * 0.5 + 0.5, ((q.y / z - this.offY) / this.tanY) * 0.5 + 0.5, z);
    return out;
  }
  depthAt(u, v) {
    const x = Math.min(this.depthW - 1, Math.max(0, Math.floor(u * this.depthW)));
    const y = Math.min(this.depthH - 1, Math.max(0, Math.floor(v * this.depthH)));
    return this.depthData[y * this.depthW + x];
  }
}

const bgVert = /* glsl */`
uniform sampler2D uDepth; uniform mat4 uSrcWorld; uniform vec4 uSrcProj; // tanX tanY offX offY
varying vec3 vWorld;
void main(){
  float z = texture2D(uDepth, uv).r;
  vec3 pv = vec3(((uv.x*2.0-1.0)*uSrcProj.x + uSrcProj.z)*z, ((uv.y*2.0-1.0)*uSrcProj.y + uSrcProj.w)*z, -z);
  vec4 w = uSrcWorld * vec4(pv, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const bgFrag = /* glsl */`
precision highp float;
uniform sampler2D uL[__NG__]; uniform vec3 uGain[__NG__];
uniform sampler2D uDepth; uniform mat4 uSrcView; uniform mat4 uSrcWorld; uniform vec4 uSrcProj;
uniform mat4 uCurViewProj; uniform float uEdgeCut; uniform float uSheetDark; uniform float uEdge;
uniform float uCurt; uniform vec4 uCurtX; uniform vec3 uCurtZ;
uniform sampler2D uCity; uniform vec3 uCityGain; uniform vec4 uWin; uniform vec3 uCamPos; uniform vec4 uCityMap;   // 窗外城市：窗洞 x0 x1 玻璃y 頂高；貼圖對應 中心方位角 水平視角 地平線 垂直視角
varying vec3 vWorld;
vec3 dec(vec3 e){ vec3 t = pow(e, vec3(2.2)); return t / max(vec3(1e-4), 1.0 - t); }
void main(){
  vec4 q = uSrcView * vec4(vWorld, 1.0);
  float zq = -q.z;
  vec2 uv = vec2(((q.x/zq - uSrcProj.z)/uSrcProj.x)*0.5+0.5, ((q.y/zq - uSrcProj.w)/uSrcProj.y)*0.5+0.5);
  // 窗簾拉動（只用在拉上那套全景）：布從中線往兩側壓縮，和 Blender 裡收攏窗簾的算法相同
  // uCurt：0 拉開 … 1 拉上，-1 不處理；uCurtX：左緣 中線 右緣 收攏比例；uCurtZ：下緣 上緣 布面最小 y
  float ca = -1.0;
  if (uCurt >= 0.0) {
    float z0 = texture2D(uDepth, uv).r;
    vec3 Wc = (uSrcWorld * vec4(((uv.x*2.0-1.0)*uSrcProj.x + uSrcProj.z)*z0, ((uv.y*2.0-1.0)*uSrcProj.y + uSrcProj.w)*z0, -z0, 1.0)).xyz;
    if (Wc.y > uCurtZ.z && Wc.x > uCurtX.x - 0.03 && Wc.x < uCurtX.z + 0.03 && Wc.z > uCurtZ.x - 0.03 && Wc.z < uCurtZ.y) {
      float w = uCurtX.w + (1.0 - uCurtX.w) * uCurt, xs;
      if (Wc.x < uCurtX.y) { float e = uCurtX.x + (uCurtX.y - uCurtX.x) * w; ca = clamp((e - Wc.x) / 0.03 + 0.5, 0.0, 1.0); xs = uCurtX.x + (Wc.x - uCurtX.x) / w; }
      else { float e = uCurtX.z - (uCurtX.z - uCurtX.y) * w; ca = clamp((Wc.x - e) / 0.03 + 0.5, 0.0, 1.0); xs = uCurtX.z - (uCurtX.z - Wc.x) / w; }
      vec4 q2 = uSrcView * vec4(xs, Wc.y, Wc.z, 1.0); float z2 = -q2.z;
      uv = vec2(((q2.x/z2 - uSrcProj.z)/uSrcProj.x)*0.5+0.5, ((q2.y/z2 - uSrcProj.w)/uSrcProj.y)*0.5+0.5);
    }
  }
  vec3 c = vec3(0.0); vec3 cm = vec3(0.0);   // cm：月光組另外累加，落在窗玻璃上的不算（補光在玻璃上映出一塊白弧）
  SUM_LAYERS
  // 以原視角的逐像素深度重建表面點：靜止時精準，也讓即時物件被櫃板正確遮住
  float zs = texture2D(uDepth, uv).r;
  vec3 ps = vec3(((uv.x*2.0-1.0)*uSrcProj.x + uSrcProj.z)*zs, ((uv.y*2.0-1.0)*uSrcProj.y + uSrcProj.w)*zs, -zs);
  vec4 clip = uCurViewProj * (uSrcWorld * vec4(ps, 1.0));
  gl_FragDepth = clamp(clip.z/clip.w*0.5+0.5, 0.0, 1.0);
  // 窗外城市：重建出來的點落在窗玻璃上，就沿「目前鏡頭 → 這一點」的方向去查城市照片（渲染裡玻璃後面是全黑，只留反射）
  if (uCityGain.x + uCityGain.y + uCityGain.z > 0.0) {
    // Cycles 的深度會穿過透明玻璃、落在外面的黑背板上：改判斷「從鏡頭到這一點的視線有沒有穿過窗洞」
    vec3 W = (uSrcWorld * vec4(ps, 1.0)).xyz;
    vec3 d = normalize(W - uCamPos);
    vec3 I = uCamPos + d * ((uWin.z - uCamPos.y) / max(d.y, 1e-4));
    if (W.y > uWin.z - 0.01 && d.y > 0.0 && I.x > uWin.x && I.x < uWin.y && I.z > 0.01 && I.z < uWin.w) {
      vec2 cu = vec2(0.5 + (atan(d.x, d.y) - uCityMap.x) / uCityMap.y, uCityMap.z + asin(clamp(d.z, -1.0, 1.0)) / uCityMap.w);
      c += pow(texture2D(uCity, cu).rgb, vec3(2.2)) * uCityGain;
      cm = vec3(0.0);
    }
  }
  c += cm;
  // 深度斷層上被拉長的三角形（轉場時才看得到）：標成透明，讓另一個視角補上
  float sheet = abs(zq - zs) / max(zs, 0.05);
  float a = 1.0 - smoothstep(uEdgeCut, uEdgeCut*2.5, sheet);
  // 畫面邊緣柔和漸隱：轉場時特寫的方框不會露出硬邊
  // 淡出寬度 uEdge 隨轉場進度收掉：快到特寫時邊緣改由特寫自己接手，到達時不會跳
  if (uEdge > 0.0005) a *= smoothstep(0.0, uEdge, uv.x) * smoothstep(1.0, 1.0 - uEdge, uv.x) * smoothstep(0.0, uEdge, uv.y) * smoothstep(1.0, 1.0 - uEdge, uv.y);
  c *= mix(uSheetDark, 1.0, a);   // 主視角：拉長處壓暗成陰影，而不是條紋
  if (uCurt >= 0.0) a = ca >= 0.0 ? ca * smoothstep(0.0, 0.12, uCurt) : uCurt;   // 布蓋住的地方用拉上那套；其餘整間依進度交疊
  gl_FragColor = vec4(c, a);
}`;

export function makeBackgroundMesh(view) {
  const GX = 480, GY = 270;
  const geo = new THREE.PlaneGeometry(1, 1, GX, GY);
  const mat = new THREE.ShaderMaterial({
    vertexShader: bgVert,
    fragmentShader: bgFrag.replace(/__NG__/g, String(GROUPS.length)).replace('SUM_LAYERS', GROUPS.map((g, i) => `${g === 'moon' ? 'cm' : 'c'} += dec(texture2D(uL[${i}], uv).rgb) * uGain[${i}];`).join('\n  ')),
    uniforms: {
      uL: { value: GROUPS.map(g => view.textures[g]) },
      uGain: { value: GROUPS.map(() => new THREE.Vector3(1, 1, 1)) },
      uDepth: { value: view.depthTex },
      uSrcWorld: { value: view.matrixWorld },
      uSrcView: { value: view.viewMatrix },
      uSrcProj: { value: new THREE.Vector4(view.tanX, view.tanY, view.offX, view.offY) },
      uCurViewProj: { value: new THREE.Matrix4() },
      uEdgeCut: { value: 0.04 },
      uSheetDark: { value: 1 }, uEdge: { value: 0.07 },
      uCity: { value: null }, uCityGain: { value: new THREE.Vector3() }, uWin: { value: new THREE.Vector4() }, uCamPos: { value: new THREE.Vector3() },
      uCityMap: { value: new THREE.Vector4(0.37, 0.942, 0.67, 0.628) },
      uCurt: { value: -1 }, uCurtX: { value: new THREE.Vector4(1.678, 2.80, 3.922, 0.2) }, uCurtZ: { value: new THREE.Vector3(0.025, 3.30, 3.2) },   // 窗簾範圍：room-v34-c.blend 兩片布的實測外框
    },
    depthWrite: true, depthTest: true, side: THREE.DoubleSide, transparent: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.onBeforeRender = (r, s, cam) => { mat.uniforms.uCurViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); mat.uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); };
  return mesh;
}

// ---------- 最終合成：兩個視角交叉、書本層、模糊、調色、色調轉換 ----------
const finalFrag = /* glsl */`
precision highp float;
uniform sampler2D tC; uniform sampler2D tBlur; uniform sampler2D tBook; uniform sampler2D tBloom;
uniform float uBlur; uniform float uBook; uniform float uFade; uniform float uBloom;
uniform float uExposure; uniform float uSat; uniform vec3 uShadow; uniform float uVignette;
uniform vec2 uRes; uniform float uTime;
varying vec2 vUv;
vec3 neutral(vec3 color){
  const float start = 0.8 - 0.04; const float desat = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float off = x < 0.08 ? x - 6.25*x*x : 0.04;
  color -= off;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < start) return color;
  const float d = 1.0 - start;
  float np = 1.0 - d*d/(peak + d - start);
  color *= np/peak;
  float g = 1.0 - 1.0/(desat*(peak - np) + 1.0);
  return mix(color, vec3(np), g);
}
vec3 srgb(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void main(){
  vec3 c = texture2D(tC, vUv).rgb;
  if (uBlur > 0.0) c = mix(c, texture2D(tBlur, vUv).rgb, uBlur);
  if (uBook > 0.0) { vec4 bk = texture2D(tBook, vUv); c = c * (1.0 - bk.a) + bk.rgb; }
  c *= exp2(uExposure);
  c += texture2D(tBloom, vUv).rgb * uBloom;   // 光暈：亮處往外柔和擴散（已含曝光）
  c += uShadow * exp(-dot(c, vec3(0.3333)) * 12.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = l + (c - l) * uSat;
  c = max(c, 0.0);
  vec2 q = vUv - 0.5; c *= 1.0 - uVignette * dot(q, q) * 1.6;
  vec3 o = srgb(neutral(c)) * uFade;
  o += (hash(vUv * uRes) - 0.5) / 255.0;   // 抖色，避免暗部色階斷層
  gl_FragColor = vec4(o, 1.0);
}`;
const blurFrag = /* glsl */`
precision highp float; uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
  s += texture2D(tSrc, vUv + uDir*1.3846153846).rgb * 0.3162162162; s += texture2D(tSrc, vUv - uDir*1.3846153846).rgb * 0.3162162162;
  s += texture2D(tSrc, vUv + uDir*3.2307692308).rgb * 0.0702702703; s += texture2D(tSrc, vUv - uDir*3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;
const mixFrag = /* glsl */`
precision highp float; uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform float uHole; varying vec2 vUv;
void main(){ vec4 a = texture2D(tA, vUv); vec3 c = a.rgb;
  // 全景那層被拉扯的地方（a 透明度低）由特寫那層優先補上
  if (uMix >= 0.0 && uMix < 2.0 && (uMix > 0.0 || a.a < 0.999)) { vec4 b = texture2D(tB, vUv); c = mix(c, b.rgb, clamp(max(uMix, (1.0 - a.a) * uHole), 0.0, 1.0) * b.a); }
  gl_FragColor = vec4(c, 1.0); }`;
// 泛光：柔性門檻抽出亮部 → 逐級縮小（13 點取樣，避免閃爍）→ 逐級放大相加（帳篷濾波）
const brightFrag = /* glsl */`
precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uExposure; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;
vec3 tap(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main(){
  vec3 c = (tap(vec2(-1.0,-1.0)) + tap(vec2(1.0,-1.0)) + tap(vec2(-1.0,1.0)) + tap(vec2(1.0,1.0))) * 0.25 * exp2(uExposure);
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}`;
const downFrag = /* glsl */`
precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 t(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){
  vec3 a = t(-2.0,2.0), b = t(0.0,2.0), c = t(2.0,2.0), d = t(-2.0,0.0), e = t(0.0,0.0), f = t(2.0,0.0), g = t(-2.0,-2.0), h = t(0.0,-2.0), i = t(2.0,-2.0);
  vec3 j = t(-1.0,1.0), k = t(1.0,1.0), l = t(-1.0,-1.0), m = t(1.0,-1.0);
  vec3 o = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  gl_FragColor = vec4(o, 1.0);
}`;
const upFrag = /* glsl */`
precision highp float; uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uSpread; varying vec2 vUv;
vec3 t(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
void main(){
  vec3 s = t(0.0,0.0)*4.0 + (t(-1.0,0.0)+t(1.0,0.0)+t(0.0,-1.0)+t(0.0,1.0))*2.0 + t(-1.0,-1.0)+t(1.0,-1.0)+t(-1.0,1.0)+t(1.0,1.0);
  gl_FragColor = vec4(texture2D(tPrev, vUv).rgb + s / 16.0 * uSpread, 1.0);
}`;
const quadVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Pipeline {
  constructor(renderer) {
    this.r = renderer;
    const mk = (samples = 4, alpha = true) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples, depthBuffer: true });
    this.rtA = mk(); this.rtB = mk(); this.rtBook = mk();
    this.rtSmallA = mk(0); this.rtSmallB = mk(0);
    this.rtC = mk(0);
    this.bloomDown = Array.from({ length: 6 }, () => mk(0)); this.bloomUp = Array.from({ length: 6 }, () => mk(0));
    this.bloom = { strength: 0, threshold: 1.0, knee: 0.5, spread: 1.0 };
    this.rtA.texture.colorSpace = THREE.NoColorSpace;
    const quad = new THREE.PlaneGeometry(2, 2);
    this.finalMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: finalFrag, depthTest: false, depthWrite: false,
      uniforms: { tC: { value: this.rtC.texture }, tBlur: { value: this.rtSmallB.texture }, tBook: { value: this.rtBook.texture }, tBloom: { value: null },
        uBlur: { value: 0 }, uBook: { value: 0 }, uFade: { value: 1 }, uBloom: { value: 0 }, uExposure: { value: 0 }, uSat: { value: 1 },
        uShadow: { value: new THREE.Vector3() }, uVignette: { value: 0.22 }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } } });
    const q = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, depthTest: false, depthWrite: false, uniforms });
    this.mixMat = q(mixFrag, { tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, uMix: { value: 0 }, uHole: { value: 0 } });
    this.brightMat = q(brightFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uExposure: { value: 0 }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
    this.downMat = q(downFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.upMat = q(upFrag, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 } });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: blurFrag, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } } });
    this.copyMat = new THREE.ShaderMaterial({ vertexShader: quadVert, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`, uniforms: { tSrc: { value: null } } });
    this.quadScene = new THREE.Scene(); this.quad = new THREE.Mesh(quad, this.finalMat); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) {
    for (const rt of [this.rtA, this.rtB, this.rtBook, this.rtC]) rt.setSize(w, h);
    this.bloomDown.forEach((rt, i) => rt.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1))));
    this.bloomUp.forEach((rt, i) => rt.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1))));
    const sw = Math.max(1, Math.round(w / 4)), sh = Math.max(1, Math.round(h / 4));
    this.rtSmallA.setSize(sw, sh); this.rtSmallB.setSize(sw, sh);
    this.finalMat.uniforms.uRes.value.set(w, h);
    this.small = [sw, sh];
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quadScene, this.quadCam); }
  // 兩個視角先合成成一張（轉場時交叉溶接），模糊與泛光都從這張取
  composite(mix, hole = 0) { this.mixMat.uniforms.uMix.value = mix; this.mixMat.uniforms.uHole.value = hole; this.pass(this.mixMat, this.rtC); }
  runBloom(exposure) {
    const B = this.bloom, D = this.bloomDown, U = this.bloomUp;
    if (B.strength <= 0) { this.finalMat.uniforms.uBloom.value = 0; return; }
    const texel = rt => new THREE.Vector2(1 / rt.width, 1 / rt.height);
    const bm = this.brightMat.uniforms;
    bm.tSrc.value = this.rtC.texture; bm.uTexel.value.copy(texel(this.rtC)); bm.uExposure.value = exposure; bm.uThreshold.value = B.threshold; bm.uKnee.value = B.knee;
    this.pass(this.brightMat, D[0]);
    for (let i = 1; i < D.length; i++) { this.downMat.uniforms.tSrc.value = D[i - 1].texture; this.downMat.uniforms.uTexel.value.copy(texel(D[i - 1])); this.pass(this.downMat, D[i]); }
    // 最小一級直接當起點，往上逐級放大並加回該級的抽亮結果
    let prev = D[D.length - 1];
    for (let i = D.length - 2; i >= 0; i--) {
      const um = this.upMat.uniforms; um.tSrc.value = prev.texture; um.tPrev.value = D[i].texture; um.uTexel.value.copy(texel(prev)); um.uSpread.value = B.spread;
      this.pass(this.upMat, U[i]); prev = U[i];
    }
    this.finalMat.uniforms.tBloom.value = prev.texture; this.finalMat.uniforms.uBloom.value = B.strength / D.length;
  }
  blur() {
    this.copyMat.uniforms.tSrc.value = this.rtC.texture; this.pass(this.copyMat, this.rtSmallA);
    const [sw, sh] = this.small;
    for (let i = 0; i < 3; i++) {
      this.blurMat.uniforms.tSrc.value = this.rtSmallA.texture; this.blurMat.uniforms.uDir.value.set((1 + i) / sw, 0); this.pass(this.blurMat, this.rtSmallB);
      this.blurMat.uniforms.tSrc.value = this.rtSmallB.texture; this.blurMat.uniforms.uDir.value.set(0, (1 + i) / sh); this.pass(this.blurMat, this.rtSmallA);
    }
    this.copyMat.uniforms.tSrc.value = this.rtSmallA.texture; this.pass(this.copyMat, this.rtSmallB);
  }
  final() { this.pass(this.finalMat, null); }
}
