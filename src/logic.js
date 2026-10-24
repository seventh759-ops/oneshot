// ゲームロジック（DOM非依存。ブラウザとNode両方で読み込める）
(function (root) {
  // ── 五行 ──
  const ELEMENTS = {
    fire: { name: '火' }, water: { name: '水' }, wood: { name: '木' }, metal: { name: '金' }, earth: { name: '土' },
  };
  // 相剋：攻撃側が敵に克つ → 会心×3
  const KOKU = { water: 'fire', fire: 'metal', metal: 'wood', wood: 'earth', earth: 'water' };
  // 相生：攻撃側が敵を生む → 吸収されて0
  const SHO = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };

  function elementRelation(atk, def) {
    if (!atk || !def) return { mult: 1, label: null };
    if (KOKU[atk] === def) return { mult: 3, label: '相剋', kind: 'koku' };
    if (SHO[atk] === def) return { mult: 0, label: '相生', kind: 'sho' };
    if (atk === def) return { mult: 0.5, label: '同属', kind: 'same' };
    return { mult: 1, label: null };
  }

  // ── 物理属性 ──
  const PHYS = {
    slash: { name: '斬撃', cut: '一閃' },
    blunt: { name: '打撃', cut: '粉砕' },
    thrust: { name: '刺突', cut: '一穿' },
    mystic: { name: '巫術', cut: '調伏' },
  };

  // ── 敵の体質：物理属性ごとの効き方 ──
  //   mult: 威力倍率 / armor: 装甲倍率（0で無視）
  const BODIES = {
    amorphous: { name: '不定形', desc: '打撃は半減', vs: { blunt: { mult: 0.5 } } },
    eyes: { name: '多眼', desc: '刺突は急所 ×2', vs: { thrust: { mult: 2 } } },
    shell: { name: '甲殻', desc: '斬撃は装甲2倍／打撃は装甲を砕く', vs: { slash: { armor: 2 }, blunt: { armor: 0 } } },
    spirit: { name: '霊体', desc: '巫術以外は半減', vs: { slash: { mult: 0.5 }, blunt: { mult: 0.5 }, thrust: { mult: 0.5 } } },
    giant: { name: '巨体', desc: '巫術は半減', vs: { mystic: { mult: 0.5 } } },
    chimera: { name: '混成', desc: '斬撃・刺突は半減／打撃は装甲2倍', vs: { slash: { mult: 0.5 }, thrust: { mult: 0.5 }, blunt: { armor: 2 } } },
  };

  // ── 剣士 ──
  const CHARS = {
    toki: {
      name: '朱鷺', weapon: '刀', phys: 'slash', element: 'fire',
      trait: '烈火', traitDesc: '威力を足す型がすべて +1', slots: 0,
    },
    tessai: {
      name: '鉄斎', weapon: '金棒', phys: 'blunt', element: 'metal',
      trait: '剛剣', traitDesc: '装甲を半分にする。枠が1つ少ない', slots: -1,
    },
    hazuki: {
      name: '葉月', weapon: '槍', phys: 'thrust', element: 'wood',
      trait: '連舞', traitDesc: '常に「二の太刀」を使える', slots: 0, extra: ['echo'],
    },
    hisame: {
      name: '氷雨', weapon: '御幣', phys: 'mystic', element: 'water',
      trait: '静水', traitDesc: '「溜め」が次の2つの型に効く', slots: 0,
    },
  };
  const CHAR_ORDER = ['toki', 'tessai', 'hazuki', 'hisame'];

  // 威力を足す（朱鷺の烈火で +1）
  function add(s, base, p) {
    const v = (base + s.addBonus) * p;
    s.dmg += v;
    return `+${v}`;
  }

  // ── 型（パーツ） ──
  //   apply(state, power, ctx) で state を書き換え、表示用の短い文字を返す
  //   power は「溜め」の影響で 2 になる倍率
  const PARTS = {
    strike: { name: '抜刀', icon: '抜', desc: '威力 +4', apply: (s, p) => add(s, 4, p) },
    hone: { name: '研ぎ', icon: '研', desc: '威力 +2', apply: (s, p) => add(s, 2, p) },
    focus: {
      name: '集中', icon: '集', desc: '威力 ×2',
      apply(s, p) { s.dmg *= 2 * p; return `×${2 * p}`; },
    },
    zanshin: {
      name: '残心', icon: '残', desc: '最後に置けば威力 +5（それ以外は +1）',
      apply: (s, p, c) => add(s, c.last ? 5 : 1, p),
    },
    charge: {
      name: '溜め', icon: '溜', desc: '次の型の効果が2倍',
      apply(s) { s.charges = s.chargeSpan; return s.chargeSpan > 1 ? '次の2つを2倍' : '次を2倍'; },
    },
    pierce: {
      name: '貫き', icon: '貫', desc: '敵の装甲を無視する',
      apply(s) { s.pierce = true; return '装甲無視'; },
    },
    echo: {
      name: '二の太刀', icon: '二', desc: '直前の型をもう一度繰り出す',
      apply(s, p, c) {
        if (!c.prev || c.prev === 'echo') return '空振り';
        return '再：' + PARTS[c.prev].apply(s, p, { ...c, prev: c.prevPrev });
      },
    },
    flame: {
      name: '炎刃', icon: '炎', desc: '威力 +1。五行が「火」になる',
      apply(s, p) { s.element = 'fire'; return add(s, 1, p) + ' 火'; },
    },
    gansai: {
      name: '岩砕', icon: '岩', desc: '威力 +1。五行が「土」になる',
      apply(s, p) { s.element = 'earth'; return add(s, 1, p) + ' 土'; },
    },
    mine: {
      name: '峰打ち', icon: '峰', desc: '威力 −3。物理が「打撃」になる',
      apply(s, p) { s.dmg = Math.max(0, s.dmg - 3 * p); s.phys = 'blunt'; return `−${3 * p} 打撃`; },
    },
    // 以下は試練で会得する秘伝
    tsubame: {
      name: '燕返し', icon: '燕', desc: '最後に置けば威力 ×3（それ以外は空振り）', secret: true,
      apply(s, p, c) { if (!c.last) return '空振り'; s.dmg *= 3 * p; return `×${3 * p}`; },
    },
    mikiri: {
      name: '見切り', icon: '見', desc: '威力 +1（極を狙う微調整）', secret: true,
      apply: (s, p) => add(s, 1, p),
    },
  };

  // ── ステージ ──
  //   hp / armor / element: 五行 / body: 体質 / exact: ぴったりでないと反射
  //   parts: 全員が使える型 / slots: 基本の枠数（剣士の特性で増減）
  //   unlock: クリアで増えるもの（表示用。実際に使える型は parts で決まる）
  //   look: 異形の描画パラメータ
  const STAGES = [
    {
      id: 1, enemy: '一つ目泥坊主', hp: 14, armor: 0, element: 'water', body: 'amorphous',
      slots: 3, parts: ['strike', 'hone', 'focus', 'zanshin'],
      unlock: { parts: ['charge'] },
      hint: '型は左から順に繰り出される。どこに何を置くかで威力が変わる。',
      look: { body: 'blob', eyes: 1, seed: 3 },
    },
    {
      id: 2, enemy: '百々目鬼', hp: 22, armor: 2, element: 'wood', body: 'eyes',
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge'],
      unlock: { parts: ['pierce'], chars: ['tessai'] },
      hint: '体中の目が硬い瞼に守られている。目を突けば急所。',
      look: { body: 'tall', eyes: 9, seed: 11 },
    },
    {
      id: 3, enemy: '土蜘蛛', hp: 14, armor: 10, element: 'earth', body: 'shell',
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce'],
      unlock: { parts: ['echo', 'flame'] },
      hint: '分厚い甲殻。刃は滑り、金棒なら砕ける。火は土を生んでしまう。',
      look: { body: 'spider', eyes: 6, seed: 23 },
    },
    {
      id: 4, enemy: '雲外鏡', hp: 39, armor: 0, element: 'metal', body: 'spirit', exact: true,
      slots: 4, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce', 'echo', 'flame'],
      unlock: { parts: ['mine', 'gansai'] },
      hint: '鏡の化生。実体が薄く、寸分違わぬ一太刀でなければ跳ね返す。',
      look: { body: 'mirror', eyes: 2, seed: 37 },
    },
    {
      id: 5, enemy: '氷喰らい', hp: 100, armor: 8, element: 'water', body: 'giant',
      slots: 5, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce', 'echo', 'flame', 'mine', 'gansai'],
      unlock: {},
      hint: '凍てついた大口の異形。水は土に克たれる。金は水を生んでしまう。',
      look: { body: 'maw', eyes: 4, seed: 51 },
    },
    {
      id: 6, enemy: '鵺', hp: 228, armor: 12, element: 'fire', body: 'chimera', hidden: true,
      slots: 5, parts: ['strike', 'hone', 'focus', 'zanshin', 'charge', 'pierce', 'echo', 'flame', 'mine', 'gansai'],
      unlock: {},
      hint: '猿の顔、狸の胴、虎の手足、蛇の尾。正体の定まらぬ隠し幕の主。',
      look: { body: 'nue', eyes: 2, seed: 67 },
    },
  ];

  // ── 試練（特定の条件で極を取ると報酬） ──
  //   test(result, ctx) が true なら達成
  const TRIALS = [
    {
      id: 'mud-nofocus', stage: 1, title: '足し算の極', desc: '「集中」を使わずに極を出した',
      test: (r, c) => r.perfect && !c.build.includes('focus'),
      reward: { parts: ['tsubame'] },
    },
    {
      id: 'spider-blunt', stage: 3, title: '甲殻砕き', desc: '打撃で極を出した',
      test: (r) => r.perfect && r.phys === 'blunt',
      reward: { chars: ['hazuki'] },
    },
    {
      id: 'eyes-thrust', stage: 2, title: '急所突き', desc: '刺突で極を出した',
      test: (r) => r.perfect && r.phys === 'thrust',
      reward: { parts: ['mikiri'] },
    },
    {
      id: 'ice-koku', stage: 5, title: '相剋の一太刀', desc: '相剋の会心で極を出した',
      test: (r) => r.perfect && r.relation === 'koku',
      reward: { chars: ['hisame'] },
    },
    {
      id: 'all-perfect', stage: null, title: '百鬼斬り', desc: '第一幕から第五幕まで、すべてで極を出した',
      test: null,
      reward: { stages: [6] },
    },
  ];

  // 進行状況（cleared / perfects / trials）から、使える剣士・秘伝・幕を求める
  function unlocked(progress) {
    const chars = new Set(['toki']);
    const secrets = new Set();
    const stages = new Set(STAGES.filter((s) => !s.hidden).map((s) => s.id));
    const grant = (rw) => {
      (rw.chars || []).forEach((c) => chars.add(c));
      (rw.parts || []).forEach((p) => { if (PARTS[p].secret) secrets.add(p); });
      (rw.stages || []).forEach((s) => stages.add(s));
    };
    for (const st of STAGES) if (progress.cleared.includes(st.id)) grant(st.unlock);
    for (const t of TRIALS) if (progress.trials.includes(t.id)) grant(t.reward);
    return { chars, secrets, stages };
  }

  // ある剣士がそのステージで使える型と枠数
  function loadout(stage, charKey, secrets) {
    const ch = CHARS[charKey];
    const parts = [...stage.parts];
    for (const p of ch.extra || []) if (!parts.includes(p)) parts.push(p);
    for (const p of secrets) if (!parts.includes(p)) parts.push(p);
    return { parts, slots: stage.slots + ch.slots };
  }

  // ビルドを実行し、各ステップのログと結果を返す
  function simulate(stage, build, charKey) {
    const ch = CHARS[charKey];
    const s = {
      dmg: 0, charges: 0, pierce: false,
      element: ch.element, phys: ch.phys,
      addBonus: charKey === 'toki' ? 1 : 0,
      chargeSpan: charKey === 'hisame' ? 2 : 1,
    };
    const steps = [];
    const seq = build.filter(Boolean);
    seq.forEach((key, i) => {
      const power = s.charges > 0 && key !== 'charge' ? 2 : 1;
      if (key !== 'charge' && s.charges > 0) s.charges--;
      const note = PARTS[key].apply(s, power, { prev: seq[i - 1], prevPrev: seq[i - 2], last: i === seq.length - 1 });
      steps.push({ key, note, dmg: s.dmg, charged: power > 1 });
    });

    const raw = s.dmg;
    let dmg = raw;
    // 物理属性 × 体質
    const vs = (BODIES[stage.body].vs || {})[s.phys] || {};
    const physMult = vs.mult ?? 1;
    dmg = Math.floor(dmg * physMult);
    const afterPhys = dmg;
    // 五行
    const rel = elementRelation(s.element, stage.element);
    dmg = Math.floor(dmg * rel.mult);
    const afterElem = dmg;
    // 装甲
    let armor = stage.armor * (vs.armor ?? 1);
    if (charKey === 'tessai') armor = Math.floor(armor / 2);
    if (s.pierce) armor = 0;
    const armorApplied = Math.min(armor, dmg);
    dmg -= armorApplied;

    const win = stage.exact ? dmg === stage.hp : dmg >= stage.hp;
    const reflected = stage.exact && dmg !== stage.hp && dmg > 0;
    // 体力ぴったりで斬った（極）
    const perfect = win && dmg === stage.hp;
    return {
      steps, raw, phys: s.phys, element: s.element,
      physMult, afterPhys, relation: rel.kind || null, relationLabel: rel.label, elemMult: rel.mult, afterElem,
      armorApplied, final: dmg, win, reflected, perfect,
      critical: rel.kind === 'koku',
    };
  }

  const api = {
    ELEMENTS, PHYS, BODIES, CHARS, CHAR_ORDER, PARTS, STAGES, TRIALS,
    elementRelation, unlocked, loadout, simulate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OneShot = api;
})(this);
