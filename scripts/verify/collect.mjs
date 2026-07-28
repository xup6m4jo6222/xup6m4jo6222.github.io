/**
 * 票 05：收 probe-fps.js 回報的讀數。
 *
 * 為什麼要一台收集器，而不是讀截圖：手機那組數字要能逐項比對（每幀成本的中位與 p95），
 * 從截圖抄數字會抄錯，而且 pointCap 是從那個數字反推的——抄錯就整條錯。
 *
 *   node scripts/verify/collect.mjs
 */
import { createServer } from 'node:http';

const seen = [];
createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	if (req.method !== 'POST') { res.end('ok'); return; }
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', () => {
		try {
			const r = JSON.parse(body);
			const i = seen.findIndex((s) => s.id === r.id);
			if (i < 0) seen.push(r); else seen[i] = r; // 同一台只留最新一筆
			console.clear();
			console.log(`收到 ${seen.length} 台的讀數　${new Date().toTimeString().slice(0, 8)}\n`);
			for (const s of seen) {
				console.log(`── ${s.ua}`);
				console.log(`   ${s.mode}　${s.vw}×${s.vh}　DPR ${s.dpr}　點數 ${s.points}　已跑 ${s.secs}s`);
				console.log(`   畫面更新率 最近5秒 ${s.fpsRecent} / 全程 ${s.fpsAll} fps　母題重畫 ${s.redraws} 次/秒`);
				console.log(`   每幀成本 中位 ${s.med}ms　p95 ${s.p95}ms　最大 ${s.max}ms　長工作 ${s.jank} 次`);
				console.log(`   → 11ms 預算下擺得下 ≈ ${s.cap} 個點\n`);
			}
		} catch (e) {
			console.log('壞掉的回報', e.message);
		}
		res.end('ok');
	});
}).listen(4455, '0.0.0.0', () => console.log('收集器開在 :4455（避開別的對話佔用的 4400），等回報……'));
