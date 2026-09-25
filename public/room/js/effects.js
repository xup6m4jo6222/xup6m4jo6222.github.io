// 霧氣粒子：香氛機噴霧、咖啡熱氣。線性光空間繪製，之後跟整個畫面一起調色。
import * as THREE from 'three';

const vert = /* glsl */`
attribute float aSize; attribute float aAlpha; attribute float aSeed;
uniform float uScale;
varying float vAlpha; varying float vSeed;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z;
  vAlpha = aAlpha; vSeed = aSeed;
}`;
const frag = /* glsl */`
uniform vec3 uColor; uniform float uTime;
varying float vAlpha; varying float vSeed;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  float n = noise(p * 3.2 + vSeed * 17.0 + uTime * 0.15) * 0.6 + noise(p * 7.0 - vSeed * 5.0) * 0.4;
  float a = smoothstep(0.5, 0.05, r) * (0.55 + 0.45 * n) * vAlpha;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Mist {
  constructor({ origin, count = 90, rise = 0.07, spread = 0.012, life = [2.6, 4.2], size = [0.012, 0.075], drift = 0.018, strength = 1 }) {
    this.o = { origin: origin.clone(), count, rise, spread, life, size, drift };
    this.strength = strength; this.target = strength; this.burst = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3); this.sz = new Float32Array(count); this.al = new Float32Array(count); this.seed = new Float32Array(count);
    this.age = new Float32Array(count); this.lifeA = new Float32Array(count); this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { this.seed[i] = Math.random(); this.respawn(i, Math.random()); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.al, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uTime: { value: 0 }, uScale: { value: 800 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  respawn(i, ageFrac = 0) {
    const o = this.o, a = Math.random() * Math.PI * 2, r = Math.random() * o.spread;
    this.pos[i * 3] = o.origin.x + Math.cos(a) * r; this.pos[i * 3 + 1] = o.origin.y + Math.sin(a) * r; this.pos[i * 3 + 2] = o.origin.z;
    this.vel[i * 3] = (Math.random() - 0.5) * o.drift; this.vel[i * 3 + 1] = (Math.random() - 0.5) * o.drift; this.vel[i * 3 + 2] = o.rise * (0.7 + Math.random() * 0.6);
    this.lifeA[i] = o.life[0] + Math.random() * (o.life[1] - o.life[0]);
    this.age[i] = ageFrac * this.lifeA[i];
    // 預先推進到對應年齡
    for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * this.age[i];
  }
  update(dt, t, pxScale) {
    this.strength += (this.target - this.strength) * Math.min(1, dt * 1.5);
    this.burst = Math.max(0, this.burst - dt * 0.5);
    const o = this.o, n = o.count;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt * (1 + this.burst * 0.8);
      const k = this.age[i] / this.lifeA[i];
      if (k >= 1) { this.respawn(i, 0); continue; }
      const sw = Math.sin(t * 0.9 + this.seed[i] * 12) * 0.006;
      this.pos[i * 3] += (this.vel[i * 3] + sw) * dt; this.pos[i * 3 + 1] += (this.vel[i * 3 + 1] - sw * 0.6) * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt * (1 - k * 0.55);
      this.sz[i] = o.size[0] + (o.size[1] - o.size[0]) * Math.pow(k, 0.7);
      const fade = Math.min(1, k * 6) * Math.pow(1 - k, 1.6);
      this.al[i] = fade * 0.12 * this.strength * (1 + this.burst);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uScale.value = pxScale;
  }
}

// 光裡的浮塵：微粒只分布在燈的光錐（或燈罩周圍）裡，亮度跟著那盞燈所屬的光組走。
// 位置、飄動、閃爍全在頂點著色器算，CPU 每幀只更新幾個 uniform。
const dustVert = /* glsl */`
attribute vec3 aDrift; attribute float aSeed; attribute float aW; attribute float aG;
uniform float uTime; uniform float uScale; uniform vec4 uGain;
varying float vA;
void main(){
  float t = uTime * (0.35 + aSeed * 0.5);
  // 緩慢的布朗式飄動：三個不同頻率疊加，幅度幾公分
  vec3 p = position + aDrift * vec3(sin(t + aSeed * 31.0), cos(t * 0.83 + aSeed * 17.0), sin(t * 0.61 + aSeed * 7.0) - 0.35 * fract(uTime * 0.012 + aSeed));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float g = aG < 0.5 ? uGain.x : (aG < 1.5 ? uGain.y : uGain.z);
  float spark = pow(0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 60.0), 5.0);
  vA = aW * g * (0.3 + 0.7 * spark);
  gl_PointSize = max(1.1, (0.0022 + 0.0022 * aSeed) * uScale / -mv.z);
}`;
const dustFrag = /* glsl */`
uniform vec3 uColor; varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r) * vA;
  if (a < 0.001) discard;
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

export class Dust {
  // emitters: [{ pos, dir（null＝燈罩周圍球形）, angle（半角，弧度）, length, radius, count, group（0 檯燈／1 床區／2 軌道燈）, weight }]
  constructor(emitters) {
    const P = [], D = [], S = [], W = [], G = [];
    const up = new THREE.Vector3(0, 0, 1);
    for (const e of emitters) {
      const dir = e.dir ? e.dir.clone().normalize() : null;
      const side = dir ? new THREE.Vector3().crossVectors(dir, Math.abs(dir.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize() : null;
      const side2 = dir ? new THREE.Vector3().crossVectors(dir, side) : null;
      for (let i = 0; i < e.count; i++) {
        let p, w;
        if (dir) {
          // 光錐內：沿軸距離偏向靠燈那段；徑向越靠近軸越亮
          const d = e.length * ((e.start ?? 0.12) + (1 - (e.start ?? 0.12)) * Math.pow(Math.random(), 0.8));
          const rr = Math.tan(e.angle) * d * Math.sqrt(Math.random());
          const a = Math.random() * Math.PI * 2;
          p = e.pos.clone().addScaledVector(dir, d).addScaledVector(side, Math.cos(a) * rr).addScaledVector(side2, Math.sin(a) * rr);
          const radial = rr / (Math.tan(e.angle) * d + 1e-4);
          w = (1 - radial * radial) / (1 + d * d * 0.6);
          if (e.farBias) w = (1 - radial * radial) * Math.pow(d / e.length, 1.5);   // 光束照到東西那端最明顯，靠燈頭的一段幾乎看不到
        } else {
          const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          const r = e.radius * (0.35 + 0.65 * Math.cbrt(Math.random()));
          p = e.pos.clone().addScaledVector(v, r);
          w = 1 / (1 + (r / e.radius) * (r / e.radius) * 4);
        }
        P.push(p.x, p.y, p.z);
        D.push(0.01 + Math.random() * 0.03, 0.01 + Math.random() * 0.03, 0.008 + Math.random() * 0.02);
        S.push(Math.random()); W.push(w * (e.weight ?? 1)); G.push(e.group);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aDrift', new THREE.Float32BufferAttribute(D, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(S, 1));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 1));
    g.setAttribute('aG', new THREE.Float32BufferAttribute(G, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,   // 純相加：顏色直接加上去，不動透明度
      uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uGain: { value: new THREE.Vector4(1, 1, 1, 0) }, uColor: { value: new THREE.Color(1.0, 0.82, 0.62) } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6;
  }
  update(t, pxScale, lamp, bed, track, strength) {
    const u = this.mat.uniforms; u.uTime.value = t; u.uScale.value = pxScale;
    u.uGain.value.set(lamp * strength, bed * strength, track * strength, 0);
  }
}

// ---------- 夢幻粒子（房間全景的空氣）：三種風格比較用 ----------
// a 微光浮塵：整間房空氣裡的細小光點，慢飄、偶爾閃
// b 散景光斑：鏡頭前少量失焦的大光圓，慢慢漂
// c 緩升光點：小光點由低處往上飄，淡入淡出
const moteVert = /* glsl */`
attribute vec3 aDrift; attribute float aSeed; attribute float aSize; attribute float aW;
uniform float uTime; uniform float uScale; uniform float uRise; uniform float uH;
varying float vA; varying float vSoft;
void main(){
  vec3 p = position;
  float s = aSeed * 6.2832;
  p += aDrift * vec3(sin(uTime * 0.13 + s), cos(uTime * 0.11 + s * 1.7), sin(uTime * 0.09 + s * 2.3));
  float life = 1.0;
  if (uRise > 0.0) { float h = mod(uTime * uRise * (0.6 + aSeed) + aSeed * uH, uH); p.z += h; life = smoothstep(0.0, 0.25, h / uH) * smoothstep(1.0, 0.6, h / uH); }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed * 1.3) + s * 3.0);
  vA = aW * life * tw * tw;
  vSoft = aSize > 0.02 ? 1.0 : 0.0;
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const moteFrag = /* glsl */`
precision highp float; uniform vec3 uColor; uniform float uGain; varying float vA; varying float vSoft;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = vSoft > 0.5 ? smoothstep(1.0, 0.55, r) * (0.75 + 0.25 * smoothstep(0.55, 0.9, r)) : exp(-r * r * 5.0);   // 散景：平的圓帶一圈亮邊；微光：柔點
  a *= vA * uGain; if (a < 0.0005) discard;
  gl_FragColor = vec4(uColor * a, 0.0);
}`;
export class Motes {
  constructor(style, cam, amount = 1) {   // amount：數量比例（混搭時第二種只放一點點）
    const P = [], D = [], S = [], Z = [], W = [];
    const R = (a, b) => a + Math.random() * (b - a);
    const box = { x: [-2.6, 4.0], y: [-3.8, 3.4], z: [0.15, 3.2] };
    let rise = 0, H = 1;
    if (style === 'b') {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quat), right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quat), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quat);
      for (let i = 0; i < 34; i++) {
        const d = R(0.6, 2.2), p = cam.pos.clone().addScaledVector(fwd, d).addScaledVector(right, R(-1.1, 1.1) * d * cam.tanX).addScaledVector(up, R(-1, 1) * d * cam.tanY);
        P.push(p.x, p.y, p.z); D.push(R(0.02, 0.06), R(0.02, 0.06), R(0.02, 0.05)); S.push(Math.random()); Z.push(R(0.05, 0.13)); W.push(R(0.07, 0.16));
      }
    } else {
      const n = Math.round((style === 'c' ? 160 : 520) * amount);
      if (style === 'c') { rise = 0.05; H = 2.2; }
      for (let i = 0; i < n; i++) {
        P.push(R(...box.x), R(...box.y), style === 'c' ? R(0.1, 1.0) : R(...box.z));
        D.push(R(0.02, 0.1), R(0.02, 0.1), R(0.01, 0.06)); S.push(Math.random()); Z.push(style === 'c' ? R(0.008, 0.016) : R(0.006, 0.013)); W.push(style === 'c' ? R(1.0, 2.2) : R(0.5, 1.3));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aDrift', new THREE.Float32BufferAttribute(D, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(S, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(Z, 1));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(W, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: moteVert, fragmentShader: moteFrag, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uRise: { value: rise }, uH: { value: H }, uGain: { value: 1 }, uColor: { value: new THREE.Color(1.0, 0.84, 0.66) } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 7;
  }
  update(t, pxScale, gain) { const u = this.mat.uniforms; u.uTime.value = t; u.uScale.value = pxScale; u.uGain.value = gain; this.points.visible = gain > 0.002; }
}
