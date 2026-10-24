// 各ステージの解の数と最大威力を調べるバランス確認用スクリプト
// 使い方: node tools/solve.js
const { STAGES, simulate } = require('../src/logic.js');

function* builds(parts, slots) {
  // 長さ 1..slots の順列（各パーツ1回まで）
  function* rec(cur, rest) {
    if (cur.length) yield cur;
    if (cur.length === slots) return;
    for (let i = 0; i < rest.length; i++) {
      yield* rec([...cur, rest[i]], rest.filter((_, j) => j !== i));
    }
  }
  yield* rec([], parts);
}

for (const st of STAGES) {
  let total = 0, wins = [], best = 0, perfect = 0;
  for (const b of builds(st.parts, st.slots)) {
    total++;
    const r = simulate(st, b);
    best = Math.max(best, r.final);
    if (r.win) wins.push(b.join(','));
    if (r.perfect) perfect++;
  }
  console.log(`Stage ${st.id} ${st.enemy}: HP${st.hp} 最大${best} 解 ${wins.length}/${total}（うち極 ${perfect}）`);
  wins.slice(0, 10).forEach((w) => console.log('   ', w));
}
