// 一撃転生：ゲームロジック（DOM非依存。ブラウザとNode両方で読み込める）
//
// 主人公の能力《一撃必殺》は、当てて倒しきれば必ず勝つ。
// 外しても、当てて倒しきれなくても死ぬ。死ぬと戦いの前に戻される。
// 勝敗は数値ではなく「能力の組み合わせが、敵の条件を満たすか」で決まる。
(function (root) {
  // ── 能力 ──
  //   apply(atk) で一撃の性質を書き換える
  const ABILITIES = {
    fire: {
      name: 'ファイア', desc: '一撃が炎の魔法になる',
      apply(a) { a.magic = true; a.element = a.element === 'ice' ? 'void' : 'fire'; },
    },
    ice: {
      name: 'フリーズ', desc: '一撃が氷の魔法になる',
      apply(a) { a.magic = true; a.element = a.element === 'fire' ? 'void' : 'ice'; },
    },
    might: {
      name: '怪力', desc: '物理の一撃が岩をも砕く',
      apply(a) { a.might = true; },
    },
    bow: {
      name: '遠当て', desc: '離れた相手に一撃を届かせる',
      apply(a) { a.ranged = true; },
    },
    pierce: {
      name: '貫通', desc: '一撃が一点を貫く',
      apply(a) { a.pierce = true; },
    },
    // ↓ 倒した敵から奪う能力
    split: {
      name: '分裂', desc: '一撃が二つに分かれ、同時に当たる', stolen: true,
      apply(a) { a.split = true; },
    },
    phase: {
      name: 'すり抜け', desc: '一撃が守りをすり抜ける', stolen: true,
      apply(a) { a.phase = true; },
    },
    wing: {
      name: '飛翔', desc: '空へ跳び、上から一撃を見舞う', stolen: true,
      apply(a) { a.wing = true; },
    },
    gale: {
      name: '疾風', desc: '目にも留まらぬ速さで一撃を放つ', stolen: true,
      apply(a) { a.gale = true; },
    },
  };
  const START_ABILITIES = ['fire', 'ice', 'might', 'bow', 'pierce'];

  // 組んだ能力から、一撃の性質を求める
  function buildAttack(abilities) {
    const a = { magic: false, element: null, might: false, ranged: false, pierce: false, split: false, phase: false, wing: false, gale: false };
    for (const k of abilities) if (k) ABILITIES[k].apply(a);
    // 怪力は物理の一撃にしか乗らない
    a.smash = a.might && !a.magic;
    return a;
  }

  // ── 敵 ──
  //   hit: 当てる関門（順に調べ、最初に満たせなかったもので死ぬ）
  //   kill: 倒しきる関門（同上）
  //   各関門 { test(a), death: 死に様, clue: 死に帳に残る手がかり }
  //   perfect(a, n): 偶然見つかる「極」の解き方（n は使った能力の数。余計な能力を足さない最小の形）
  const ENEMIES = [
    {
      id: 1, name: 'スライム', slots: 2, sprite: 'slime', steal: 'split',
      intro: 'ぷるぷるしている。いかにも最初の敵だ。',
      hit: [],
      kill: [
        {
          test: (a) => a.pierce || a.element === 'fire',
          death: '当たった。スライムはぺしゃんこに潰れ――ぷるん、と元に戻った。体の奥で、小さな核が光っている。顔に覆いかぶさってきて、息が――',
          clue: '体の奥に核がある。核が無事だと元に戻る',
        },
      ],
      perfect: (a, n) => n === 1 && a.element === 'fire',
      perfectText: '核ごと、跡形もなく蒸発した。',
    },
    {
      id: 2, name: 'ゴースト', slots: 2, sprite: 'ghost', steal: 'phase',
      intro: '墓場に揺れる青白い影。足がない。',
      hit: [
        {
          test: (a) => a.magic || a.phase,
          death: '振り抜いた。手応えがない。一撃は霧のように影をすり抜けた。冷たい指が、首に――',
          clue: 'ただの一撃は体をすり抜ける',
        },
      ],
      kill: [
        {
          test: (a) => a.element !== 'fire',
          death: '炎が影を包んだ。ゴーストは嬉しそうに炎を吸い込み、青い火の塊になって覆いかぶさってきた――',
          clue: '炎を吸って力にする',
        },
        {
          test: (a) => a.pierce,
          death: '当たった。影は散った――が、胸のあたりに残った小さな光が、また影を集めていく。気づけば背後に――',
          clue: '散っても、胸の奥の光が残ると戻ってくる',
        },
      ],
    },
    {
      id: 3, name: 'ガーゴイル', slots: 3, sprite: 'gargoyle', steal: 'wing',
      intro: '古城の屋根から、石の魔物がこちらを見下ろしている。',
      hit: [
        {
          test: (a) => a.ranged || a.wing,
          death: '跳びかかった。届かない。ガーゴイルは翼を広げて舞い上がり、真上から急降下してきた――',
          clue: '空にいる。近づいても届かない',
        },
      ],
      kill: [
        {
          test: (a) => a.smash || a.phase,
          death: '当たった。カン、と乾いた音。石の肌には傷ひとつない。石の爪が振り下ろされた――',
          clue: '石の体。ただの一撃では傷もつかない',
        },
      ],
      perfect: (a, n) => n === 2 && a.phase && a.ranged,
      perfectText: '石の体をすり抜けた一撃が、内側の心臓だけを射抜いた。',
    },
    {
      id: 4, name: '双頭の狼', slots: 3, sprite: 'wolf', steal: 'gale',
      intro: '森の奥。二つの頭が、それぞれこちらを睨んでいる。',
      hit: [
        {
          test: (a) => a.gale || a.wing || a.element === 'ice',
          death: '狙いを定めた――はずだった。狼は地を蹴って残像を残し、消えた。せめて足さえ止まれば――喉元に牙が――',
          clue: '地を駆ける足が速すぎて、狙っても捉えられない。足を止めるか、それ以上の速さがあれば',
        },
      ],
      kill: [
        {
          test: (a) => a.split,
          death: '当たった。片方の頭が崩れ落ちる。もう片方の頭が、低く唸った――',
          clue: '頭が二つ。片方だけ倒しても生きている',
        },
      ],
      perfect: (a, n) => n === 2 && a.wing && a.split,
      perfectText: '真上から二つに分かれた一撃が、二つの頭を同時に落とした。',
    },
    {
      id: 5, name: '炎竜', slots: 4, sprite: 'dragon', steal: null,
      intro: '火山の主。空を覆う翼と、燃えさかる鱗。',
      hit: [
        {
          test: (a) => a.ranged || a.wing,
          death: '踏み込んだ。竜はひと羽ばたきで空へ。地上の者に届く高さではない。炎の息が降ってきた――',
          clue: '空を飛ぶ。地上からは届かない',
        },
        {
          test: (a) => a.gale,
          death: '一撃を放った。竜は空中で身をひねり、かわした。巨体に似合わぬ速さ――',
          clue: '空中で身をひねってかわす。ゆっくりした一撃では当たらない',
        },
      ],
      kill: [
        {
          test: (a) => a.element !== 'fire',
          death: '炎が鱗に吸い込まれた。竜は、満足げに喉を鳴らした――',
          clue: '炎は鱗に吸われる',
        },
        {
          test: (a) => a.pierce,
          death: '当たった。だが、分厚い鱗の上を滑っただけ。喉元に一枚だけ逆さに生えた鱗が見えた――',
          clue: '鱗の上からでは通らない。喉元に逆さの鱗が一枚ある',
        },
        {
          test: (a) => a.element === 'ice' || a.phase,
          death: '逆鱗を貫いた。竜が吠える。だが傷口から噴き出した炎が、たちまち傷を塞いでいく――',
          clue: '逆鱗を貫いても、体の炎が傷を塞いでしまう',
        },
      ],
      perfect: (a, n) => n === 4 && a.wing && a.phase && a.pierce && a.gale,
      perfectText: '天から鱗をすり抜け、逆鱗の奥の心臓だけを貫いた。',
    },
  ];

  // 一撃の結果
  //   { outcome: 'win' | 'miss' | 'survive', gate: 失敗した関門, perfect, attack }
  function resolve(enemy, abilities) {
    const a = buildAttack(abilities);
    const n = abilities.filter(Boolean).length;
    for (const g of enemy.hit) if (!g.test(a)) return { outcome: 'miss', gate: g, attack: a };
    for (const g of enemy.kill) if (!g.test(a)) return { outcome: 'survive', gate: g, attack: a };
    return { outcome: 'win', perfect: !!(enemy.perfect && enemy.perfect(a, n)), attack: a };
  }

  // これまで倒した敵から奪った能力を含め、使える能力
  function ownedAbilities(cleared) {
    const own = [...START_ABILITIES];
    for (const e of ENEMIES) if (cleared.includes(e.id) && e.steal) own.push(e.steal);
    return own;
  }

  const api = { ABILITIES, START_ABILITIES, ENEMIES, buildAttack, resolve, ownedAbilities };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Isekai = api;
})(this);
