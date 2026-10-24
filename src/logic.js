// ゲームロジック（DOM非依存。ブラウザとNode両方で読み込める）
(function (root) {
  // パーツ定義。apply(state, power) で state を書き換える。
  // power は「溜め」の影響で 2 になる倍率。
  const PARTS = {
    strike: {
      name: '斬撃', icon: '⚔', desc: '威力 +4',
      apply(s, p) { s.dmg += 4 * p; return `+${4 * p}`; },
    },
    hone: {
      name: '研ぎ', icon: '◆', desc: '威力 +2',
      apply(s, p) { s.dmg += 2 * p; return `+${2 * p}`; },
    },
    focus: {
      name: '集中', icon: '✦', desc: '威力 ×2',
      apply(s, p) { s.dmg *= 2 * p; return `×${2 * p}`; },
    },
    charge: {
      name: '溜め', icon: '◎', desc: '次のパーツの効果が2倍',
      apply(s) { s.nextPower = 2; return '次を2倍'; },
    },
    pierce: {
      name: '貫通', icon: '➤', desc: '敵の装甲を無視する',
      apply(s) { s.pierce = true; return '装甲無視'; },
    },
    flame: {
      name: '炎纏い', icon: '🔥', desc: '威力 +1。攻撃が炎属性になる',
      apply(s, p) { s.dmg += 1 * p; s.flame = true; return `+${p} 炎`; },
    },
  };

  // ステージ定義
  //   hp: 体力 / armor: 最終威力から引かれる / weakFlame: 炎属性なら会心(×3)
  //   exact: 威力がぴったりHPと一致しないと反射される
  //   parts: 使えるパーツ（各1回まで）/ slots: ビルド枠
  //   unlock: クリアで解放されるパーツ
  const STAGES = [
    {
      id: 1, enemy: 'スライム', sprite: '🟢', hp: 8, armor: 0,
      slots: 2, parts: ['strike', 'focus'], unlock: 'hone',
      hint: 'パーツは左から順に処理される。順番が大事。',
    },
    {
      id: 2, enemy: '岩ゴーレム', sprite: '🗿', hp: 10, armor: 2,
      slots: 3, parts: ['strike', 'focus', 'hone'], unlock: 'charge',
      hint: '装甲は最後に威力から引かれる。',
    },
    {
      id: 3, enemy: '鉄甲亀', sprite: '🐢', hp: 20, armor: 4,
      slots: 4, parts: ['strike', 'hone', 'focus', 'charge'], unlock: 'pierce',
      hint: '「溜め」を何の前に置くかで結果が大きく変わる。',
    },
    {
      id: 4, enemy: '鏡の騎士', sprite: '🪞', hp: 14, armor: 2, exact: true,
      slots: 4, parts: ['strike', 'hone', 'focus', 'charge', 'pierce'], unlock: 'flame',
      hint: 'この敵は威力がぴったりでないと攻撃を跳ね返す。',
    },
    {
      id: 5, enemy: '氷の巨人', sprite: '🧊', hp: 72, armor: 6, weakFlame: true,
      slots: 5, parts: ['strike', 'hone', 'focus', 'charge', 'pierce', 'flame'], unlock: null,
      hint: '炎が弱点。弱点を突くと会心（×3）。',
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
