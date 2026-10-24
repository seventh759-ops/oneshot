// バランス確認：各ステージ × 剣士で、全ビルドを総当たりして勝ち筋の数を出す
// 使い方: node tools/solve.js [ステージ番号] [--list]
const { STAGES, CHARS, CHAR_ORDER, TRIALS, PARTS, loadout, simulate } = require('../src/logic.js');

function* builds(parts, slots) {
  // 長さ 1..slots の順列（各型1回まで）
  function* rec(cur, rest) {
    if (cur.length) yield cur;
    if (cur.length === slots) return;
    for (let i = 0; i < rest.length; i++) {
      yield* rec([...cur, rest[i]], rest.filter((_, j) => j !== i));
    }
  }
  yield* rec([], parts);
}

const only = Number(process.argv[2]) || null;
const list = process.argv.includes('--list');
const name = (b) => b.map((k) => PARTS[k].name).join('→');

// 秘伝なし（クリアだけで進む道）と、秘伝あり（試練をこなした後）の2通りを見る
for (const st of STAGES) {
  if (only && st.id !== only) continue;
  console.log(`\n第${st.id}幕 ${st.enemy}  体力${st.hp} 装甲${st.armor}`);
  for (const secrets of [[], ['tsubame', 'mikiri']]) {
    for (const ck of CHAR_ORDER) {
      const { parts, slots } = loadout(st, ck, secrets);
      let total = 0, wins = [], perf = [], best = 0;
      const trialHits = {};
      for (const b of builds(parts, slots)) {
        total++;
        const r = simulate(st, b, ck);
        best = Math.max(best, r.final);
        if (r.win) wins.push(b);
        if (r.perfect) perf.push(b);
        for (const t of TRIALS) {
          if (t.stage === st.id && t.test(r, { build: b })) (trialHits[t.id] ||= []).push(b);
        }
      }
      const tr = Object.entries(trialHits).map(([k, v]) => `試練${k}:${v.length}`).join(' ');
      console.log(`  ${secrets.length ? '秘伝あり' : '秘伝なし'} ${CHARS[ck].name}: 勝ち ${wins.length} 極 ${perf.length} / ${total} 最大${best} ${tr}`);
      if (list) {
        perf.slice(0, 4).forEach((b) => console.log('      極', name(b)));
        wins.filter((b) => !perf.includes(b)).slice(0, 3).forEach((b) => console.log('      勝', name(b)));
        Object.entries(trialHits).forEach(([k, v]) => console.log('      試練', k, name(v[0])));
      }
    }
  }
}
