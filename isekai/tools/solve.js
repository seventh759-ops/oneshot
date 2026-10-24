// バランス確認：各敵について、その時点で持っている能力の組み合わせを総当たりし、
// 勝てる組み合わせ・極・死因ごとの数を出す
// 使い方: node isekai/tools/solve.js [--list]
const { ENEMIES, ABILITIES, resolve, ownedAbilities } = require('../src/logic.js');

function* subsets(items, max) {
  function* rec(start, cur) {
    if (cur.length) yield cur;
    if (cur.length === max) return;
    for (let i = start; i < items.length; i++) yield* rec(i + 1, [...cur, items[i]]);
  }
  yield* rec(0, []);
}

const list = process.argv.includes('--list');
const cleared = [];
for (const e of ENEMIES) {
  const own = ownedAbilities(cleared);
  let total = 0;
  const wins = [], perfects = [], deaths = {};
  for (const s of subsets(own, e.slots)) {
    total++;
    const r = resolve(e, s);
    const names = s.map((k) => ABILITIES[k].name).join('+');
    if (r.outcome === 'win') { wins.push(names); if (r.perfect) perfects.push(names); }
    else deaths[r.gate.clue] = (deaths[r.gate.clue] || 0) + 1;
  }
  console.log(`\n${e.id}. ${e.name}（枠${e.slots}・能力${own.length}）勝ち ${wins.length}/${total}  極 ${perfects.length}`);
  for (const [clue, n] of Object.entries(deaths)) console.log(`   死因 ${n}: ${clue}`);
  if (list) {
    wins.slice(0, 8).forEach((w) => console.log('   勝', w));
    perfects.forEach((w) => console.log('   極', w));
  }
  cleared.push(e.id);
}
