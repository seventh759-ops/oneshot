// 体力の候補ごとに、剣士別の「勝ち／極」の数を出す（ステージ調整用）
// 使い方: node tools/tune.js <ステージ番号> [装甲] [秘伝あり=1]
const { STAGES, CHARS, CHAR_ORDER, loadout, simulate } = require('../src/logic.js');
const [id, armorArg, sec] = process.argv.slice(2).map(Number);
const st = { ...STAGES.find((s) => s.id === id) };
if (!Number.isNaN(armorArg) && armorArg !== undefined) st.armor = armorArg;
const secrets = sec ? ['tsubame', 'mikiri'] : [];
function* builds(parts, slots) {
  function* rec(cur, rest) {
    if (cur.length) yield cur;
    if (cur.length === slots) return;
    for (let i = 0; i < rest.length; i++) yield* rec([...cur, rest[i]], rest.filter((_, j) => j !== i));
  }
  yield* rec([], parts);
}
const dist = {};
for (const ck of CHAR_ORDER) {
  const { parts, slots } = loadout(st, ck, secrets);
  const h = {};
  for (const b of builds(parts, slots)) {
    const r = simulate({ ...st, exact: false }, b, ck);
    h[r.final] = (h[r.final] || 0) + 1;
  }
  dist[ck] = h;
}
const finals = new Set(Object.values(dist).flatMap((h) => Object.keys(h).map(Number)));
const top = [...finals].sort((a, b) => b - a).slice(0, 40);
console.log(`第${st.id}幕 装甲${st.armor} ${secrets.length ? '秘伝あり' : ''}`);
console.log('体力 | ' + CHAR_ORDER.map((c) => CHARS[c].name + '(勝/極)').join(' | '));
for (const hp of top.sort((a, b) => a - b)) {
  const row = CHAR_ORDER.map((c) => {
    const h = dist[c];
    const win = Object.entries(h).filter(([k]) => Number(k) >= hp).reduce((a, [, v]) => a + v, 0);
    return `${win}/${h[hp] || 0}`;
  });
  console.log(String(hp).padStart(4) + ' | ' + row.join(' | '));
}
