// 房間音效：真實錄音（來源與授權見 sfx/來源.md），用 Web Audio 播放。
// 原始檔前後有空白與多餘的段落，這裡記「從第幾秒開始、播多久」，播放時直接裁，不另外轉檔。
// 瀏覽器規定要有一次點擊才能出聲：開場按「進房間」那一下、或任何第一次點擊就會解鎖。
const CLIPS = {
  //         檔名                  起點   長度   音量（把各檔的峰值拉到差不多）
  switch:  { file: '0026.mp3',          at: 0.24, dur: 0.5, gain: 1.6 },   // 電燈開關「喀」
  page:    { file: '0164.mp3',          at: 0.05, dur: 0.56, gain: 0.9 },  // 翻一頁
  cover:   { file: '0362.mp3',          at: 0.02, dur: 0.95, gain: 0.55 }, // 翻開封面（大頁紙慢慢翻）
  close:   { file: '1411.mp3',          at: 0.06, dur: 0.7, gain: 0.8 },   // 闔上書
  curtainOpen:  { file: 'curtain-46261.mp3', at: 0.03, dur: 2.5, gain: 0.35 },  // 拉開窗簾（布＋金屬吊環）
  curtainClose: { file: 'curtain-46261.mp3', at: 4.2,  dur: 2.5, gain: 0.35 },  // 拉上窗簾（同一段錄音的後半）
};
const MASTER = 0.8;

let ctx = null, out = null, on = true;
const buffers = {};
try { on = localStorage.getItem('v30-sound') !== '0'; } catch {}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); out = ctx.createGain(); out.gain.value = on ? MASTER : 0; out.connect(ctx.destination);
  const files = [...new Set(Object.values(CLIPS).map(c => c.file))];
  files.forEach(f => fetch('sfx/' + f).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buffers[f] = b; }).catch(() => {}));
  return ctx;
}

export const sfx = {
  log: [],
  // 在使用者的點擊裡呼叫：建立並喚醒音訊
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  play(name, { rate = 1, gain = 1, delay = 0 } = {}) {
    if (!on || !ctx || ctx.state !== 'running') return;
    const c = CLIPS[name], b = c && buffers[c.file]; if (!b) return;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = ctx.createGain(), t0 = ctx.currentTime + delay, len = c.dur / rate, v = c.gain * gain;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.012);   // 頭尾各淡入淡出一點，裁切處不會「啪」一聲
    g.gain.setValueAtTime(v, t0 + Math.max(0.02, len - 0.25)); g.gain.linearRampToValueAtTime(0, t0 + len);
    src.connect(g); g.connect(out); src.start(t0, c.at, c.dur + 0.05);
    sfx.log.push([name, Math.round(performance.now())]);   // 驗收用：播過什麼、在什麼時間
  },
  get on() { return on; },
  setOn(v) {
    on = !!v; try { localStorage.setItem('v30-sound', on ? '1' : '0'); } catch {}
    if (out) out.gain.setTargetAtTime(on ? MASTER : 0, ctx.currentTime, 0.05);
  },
  get state() { return ctx ? ctx.state : 'none'; },
  loaded() { return Object.keys(buffers); },
};
// 回訪的人不會按「進房間」：第一次點擊任何地方就解鎖
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => sfx.unlock(), { capture: true }));
