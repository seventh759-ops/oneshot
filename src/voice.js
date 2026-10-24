// 剣士の手応え（数値の代わりに、斬った感触を曖昧な言葉で返す）
(function (root) {
  // 剣士ごとのセリフ。phys は体質ごとに分ける（無い体質は generic）
  const LINES = {
    toki: {
      sho: '炎が呑まれた！？ あいつ、俺の火を喰って膨らんでやがる',
      over: '跳ね返された！ 力みすぎたか',
      under: '鏡に映っただけだ……軽すぎる',
      phys: { spirit: '刃がすり抜ける……斬った気がしねえ', chimera: '毛だか鱗だか、刃が滑りやがる', generic: '刃が通りきらねえ' },
      same: '同じ火同士だ。打ち消し合ってやがる',
      armor: '硬え！ 刃が表で止まった',
      plain: '浅い……もっと深く踏み込め',
      win: '斬った！',
      perfect: '……今のは何だ。刃が吸い込まれるように通った',
    },
    tessai: {
      sho: 'ぬう……打った力を、逆に喰われたわ',
      over: '力任せが過ぎたか。鏡に押し返された',
      under: '軽い。鏡が嗤っておる',
      phys: { amorphous: '泥を打つようなものよ。力が沈む', spirit: '手応えが霞のようじゃ', generic: '芯に届かん' },
      same: '同じ金気がぶつかって、鈍っておる',
      armor: '硬い。半端な一撃では砕けぬ',
      plain: 'まだ足りぬ',
      win: '砕いた。',
      perfect: 'ほう……寸分の狂いもない。久しく忘れておった感触じゃ',
    },
    hazuki: {
      sho: '……槍が吸われました。力を与えてしまったようです',
      over: '強すぎました。そのまま返されています',
      under: '弱すぎます。鏡に届いてもいません',
      phys: { spirit: '穂先が抜けてしまいます。実体が薄い', chimera: '急所が定まりません', generic: '穂先が逸れました' },
      same: '同じ木の気……互いに打ち消しています',
      armor: '硬い殻に阻まれました',
      plain: 'まだ届きません',
      win: '討ち取りました。',
      perfect: '……ぴたりと、急所に。こんな手応えは初めてです',
    },
    hisame: {
      sho: 'あら……祓うどころか、力を与えてしまいました',
      over: '力が過ぎて、鏡に返されてしまいました',
      under: '祈りが足りません。鏡に映るだけです',
      phys: { giant: '大きすぎて、祓いの力が散ってしまいます', generic: '力が散ってしまいます' },
      same: '同じ水の気配……溶け合ってしまいます',
      armor: '固い守りに、祈りが弾かれます',
      plain: 'まだ祓いきれません',
      win: '祓いました。',
      perfect: '澄みきった一太刀……鈴の音が聞こえました',
    },
  };

  // 体力に対してどこまで届いたか
  function distance(ratio) {
    if (ratio <= 0) return 'まったく手応えがない';
    if (ratio < 0.35) return 'まるで届いていない';
    if (ratio < 0.7) return 'まだ遠い';
    if (ratio < 0.9) return 'もう一押し';
    return '紙一重。ほんのわずか足りない';
  }

  // 鏡に返されたとき、どれくらい外したか
  function miss(ratio) {
    const off = Math.abs(ratio - 1);
    if (off < 0.12) return 'ほんのわずかに、ずれた';
    if (off < 0.4) return '少し、ずれた';
    return '大きく外した';
  }

  root.Voice = {
    // { line: 剣士のセリフ, feel: 手応え（無ければ null） }
    comment(charKey, stage, r) {
      const L = LINES[charKey];
      if (r.perfect) return { line: L.perfect, feel: null };
      if (r.win) return { line: L.win, feel: null };
      const ratio = r.final / stage.hp;
      // 威力が削がれた原因があれば、それを感じ取る
      let cause = null;
      if (r.relation === 'sho') cause = L.sho;
      else if (r.physMult < 1) cause = L.phys[stage.body] || L.phys.generic;
      else if (r.relation === 'same') cause = L.same;
      else if (r.armorApplied > 0 && r.armorApplied >= r.afterElem * 0.4) cause = L.armor;
      if (r.reflected) return { line: ratio > 1 ? L.over : cause || L.under, feel: miss(ratio) };
      return { line: cause || L.plain, feel: distance(ratio) };
    },
  };
})(window);
