import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// asset directory 경로
const dir = path.resolve(__dirname, '../asset/characters/monsters');
// 폴더 내 PNG 파일 목록
const files = fs.readdirSync(dir);
const actions = ['idle','walk','attack','hit','die','move','fly','fly'];
const assets = {};
files.forEach(file => {
  if (!file.endsWith('.png')) return;
  const name = file.replace('.png','');
  const parts = name.split('_');
  if (parts.length < 2) return;
  const action = parts.slice(1).join('_');
  const base = parts[0];
  // hitbox/NOhitbox 건너뛰기
  if (action.includes('hitbox') || action.includes('NOhitbox')) return;
  // asset 구조에 맞춰 매핑
  assets[base] = assets[base] || [];
  if (!assets[base].includes(action)) assets[base].push(action);
});
// JSON으로 기록 (브라우저가 접근할 수 있는 asset 디렉터리)
const outPath = path.resolve(__dirname, '../src/config/monsterAssets.json');
fs.writeFileSync(outPath, JSON.stringify(assets, null, 2));
console.log(`Generated ${outPath} with ${Object.keys(assets).length} entries.`);
