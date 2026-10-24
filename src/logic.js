// ゲームロジック（DOM非依存。ブラウザとNode両方で読み込める）
(function (root) {
  // 型（パーツ）定義。apply(state, power) で state を書き換える。
  // power は「溜め」の影響で 2 になる倍率。
  const PARTS = {
    strike: {
      name: '抜刀', icon: '抜', desc: '威力 +4',
      apply(s, p) { s.dmg += 4 * p; return `+${4 * p}`; },
    },
    hone: {
      name: '研ぎ', icon: '研', desc: '威力 +2',
      apply(s, p) { s.dmg += 2 * p; return `+${2 * p}`; },
    },
    focus: {
      name: '集中', icon: '集', desc: '威力 ×2',
      apply(s, p) { s.dmg *= 2 * p; return `×${2 * p}`; },
    },
    zanshin: {
      name: '残心', icon: '残', desc: '最後に置けば威力 +5（それ以外は +1）',
      apply(s, p, c) { const v = (c.last ? 5 : 1) * p; s.dmg += v; return `+${v}`; },
    },
    charge: {
      name: '溜め', icon: '溜', desc: '次の型の効果が2倍',
      apply(s) { s.nextPower = 2; return '次を2倍'; },
    },
    pierce: {
      name: '貫き', icon: '貫', desc: '敵の装甲を無視する',
      apply(s) { s.pierce = true; return '装甲無視'; },
    },
    echo: {
      name: '二の太刀', icon: '二', desc: '直前の型をもう一度繰り出す',
      apply(s, p, c) {
        if (!c.prev || c.prev === 'echo') return '空振り';
        return '再：' + PARTS[c.prev].apply(s, p, c);
      },
    },
    mine: {
      name: '峰打ち', icon: '峰', desc: '威力 −3（加減のための型）',
      apply(s, p) { s.dmg = Math.max(0, s.dmg - 3 * p); return `−${3 * p}`; },
    },
    flame: {
      name: '炎刃', icon: '炎', desc: '威力 +1。斬撃が炎をまとう',
      apply(s, p) { s.dmg += 1 * p; s.flame = true; return `+${p} 炎`; },
    },
  };

  // ステージ定義
  //   hp: 体力 / armor: 最終威力から引かれる / weakFlame: 炎属性なら会心(×3)
  //   exact: 威力がぴったりHPと一致しないと反射される
  //   parts: 使える型（各1回まで）/ slots: 構えの枠
  //   unlock: クリアで会得する型
  //   look: 異形の描画パラメータ（main.js の drawMonster で使う）
  const STAGES = [
    {
      id: 1, enemy: '一つ目泥坊主', hp: 12, armor: 0,
      slots: 3, parts: ['strike', 'hone', 'focus', 'zanshin'], unlock: 'charge',
      hint: '型は左から順に繰り出される。どこに何を置くかで威力が変わる。',
      look: { body: 'blob', eyes: 1, mouth: 'drip', seed: 3 },
    },
    {
      id: 2, enemy: '百々目鬼', hp: 19, armor: 2,
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge'], unlock: 'pierce',
      hint: '体中の目が硬い瞼に守られている。装甲は最後に威力を削ぐ。',
      look: { body: 'tall', eyes: 9, mouth: 'none', seed: 11 },
    },
    {
      id: 3, enemy: '土蜘蛛', hp: 16, armor: 12,
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce'], unlock: 'echo',
      hint: '甲殻が分厚い。削り合うか、貫くか。',
      look: { body: 'spider', eyes: 6, mouth: 'fang', seed: 23 },
    },
    {
      id: 4, enemy: '雲外鏡', hp: 21, armor: 0, exact: true,
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce', 'echo'], unlock: 'mine',
      hint: '鏡の化生。寸分違わぬ一太刀でなければ、そのまま跳ね返す。',
      look: { body: 'mirror', eyes: 2, mouth: 'grin', seed: 37 },
    },
    {
      id: 5, enemy: '氷喰らい', hp: 100, armor: 8, weakFlame: true,
      slots: 5, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce', 'echo', 'mine', 'flame'], unlock: null,
      hint: '凍てついた大口の異形。炎が弱点で、弱点を突けば会心（×3）。',
      look: { body: 'maw', eyes: 4, mouth: 'maw', seed: 51 },
    },
  ];

  // ビルドを実行し、各ステップのログと結果を返す
  function simulate(stage, build) {
    const s = { dmg: 0, nextPower: 1, pierce: false, flame: false };
    const steps = [];
    const seq = build.filter(Boolean);
    seq.forEach((key, i) => {
      const power = s.nextPower;
      s.nextPower = 1;
      const note = PARTS[key].apply(s, power, { prev: seq[i - 1], last: i === seq.length - 1 });
      steps.push({ key, note, dmg: s.dmg, charged: power > 1 });
    });
    let dmg = s.dmg;
    let critical = false;
    if (stage.weakFlame && s.flame) { dmg *= 3; critical = true; }
    const armorApplied = s.pierce ? 0 : Math.min(stage.armor, dmg);
    dmg -= armorApplied;
    const win = stage.exact ? dmg === stage.hp : dmg >= stage.hp;
    const reflected = stage.exact && dmg !== stage.hp && dmg > 0;
    return { steps, raw: s.dmg, critical, armorApplied, pierce: s.pierce, final: dmg, win, reflected };
  }

  const api = { PARTS, STAGES, simulate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OneShot = api;
})(this);
