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
    charge: {
      name: '溜め', icon: '溜', desc: '次の型の効果が2倍',
      apply(s) { s.nextPower = 2; return '次を2倍'; },
    },
    pierce: {
      name: '貫き', icon: '貫', desc: '敵の装甲を無視する',
      apply(s) { s.pierce = true; return '装甲無視'; },
    },
    flame: {
      name: '炎刃', icon: '炎', desc: '威力 +1。斬撃が炎をまとう',
      apply(s, p) { s.dmg += 1 * p; s.flame = true; return `+${p} 炎`; },
    },
  };

  // ステージ定義
  //   hp: 体力 / armor: 最終威力から引かれる / weakFlame: 炎属性なら会心(×3)
  //   exact: 威力がぴったりHPと一致しないと反射される
  //   parts: 使える型（各1回まで）/ slots: ビルド枠
  //   unlock: クリアで会得する型
  const STAGES = [
    {
      id: 1, enemy: '小鬼', sprite: '鬼', hp: 8, armor: 0,
      slots: 2, parts: ['strike', 'focus'], unlock: 'hone',
      hint: '型は左から順に繰り出される。順番がすべて。',
    },
    {
      id: 2, enemy: '石灯籠の付喪神', sprite: '灯', hp: 10, armor: 2,
      slots: 3, parts: ['strike', 'focus', 'hone'], unlock: 'charge',
      hint: '硬い身体は、最後に威力を削ぐ。',
    },
    {
      id: 3, enemy: '鉄甲の大蟹', sprite: '蟹', hp: 20, armor: 4,
      slots: 4, parts: ['strike', 'hone', 'focus', 'charge'], unlock: 'pierce',
      hint: '「溜め」を何の前に置くかで、太刀筋が大きく変わる。',
    },
    {
      id: 4, enemy: '鏡の武者', sprite: '鏡', hp: 14, armor: 2, exact: true,
      slots: 4, parts: ['strike', 'hone', 'focus', 'charge', 'pierce'], unlock: 'flame',
      hint: '鏡の武者は、寸分違わぬ一太刀でなければ跳ね返す。',
    },
    {
      id: 5, enemy: '氷の大入道', sprite: '氷', hp: 72, armor: 6, weakFlame: true,
      slots: 5, parts: ['strike', 'hone', 'focus', 'charge', 'pierce', 'flame'], unlock: null,
      hint: '炎が弱点。弱点を突けば会心（×3）。',
    },
  ];

  // ビルドを実行し、各ステップのログと結果を返す
  function simulate(stage, build) {
    const s = { dmg: 0, nextPower: 1, pierce: false, flame: false };
    const steps = [];
    for (const key of build) {
      if (!key) continue;
      const power = s.nextPower;
      s.nextPower = 1;
      const note = PARTS[key].apply(s, power);
      steps.push({ key, note, dmg: s.dmg, charged: power > 1 });
    }
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
