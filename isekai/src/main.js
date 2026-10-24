(function () {
  const { ABILITIES, ENEMIES, resolve, ownedAbilities } = window.Isekai;
  const { drawSprite } = window.Sprites;
  const Sound = window.Sound;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'isekai-oneshot-v1';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? ms * 0.3 : ms));

  // 進行状況：倒した敵 / 極を出した敵 / 死んだ回数 / 敵ごとの死に帳 / プロローグを見たか
  let save = load();
  let enemyId = firstUndefeated();
  let build = [];
  let busy = false;
  let pixels = [];

  function load() {
    const empty = { cleared: [], perfects: [], deaths: 0, notes: {}, prologue: false };
    let data;
    try { data = { ...empty, ...JSON.parse(localStorage.getItem(SAVE_KEY)) }; } catch { return empty; }
    // 書き直した手がかりは、古い文言を新しい文言に置き換える
    const RENAMED = { '速すぎて、狙っても捉えられない': '地を駆ける足が速すぎて、狙っても捉えられない。足を止めるか、それ以上の速さがあれば' };
    for (const id of Object.keys(data.notes)) data.notes[id] = data.notes[id].map((n) => RENAMED[n] || n);
    return data;
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 保存できなくても遊べる */ }
  }
  function firstUndefeated() {
    const e = ENEMIES.find((en) => !save.cleared.includes(en.id));
    return e ? e.id : ENEMIES[ENEMIES.length - 1].id;
  }
  const enemy = () => ENEMIES.find((e) => e.id === enemyId);
  const enemyOpen = (e) => e.id === 1 || save.cleared.includes(e.id - 1);

  function loadEnemy(id) {
    enemyId = id;
    build = Array(enemy().slots).fill(null);
    busy = false;
    $('enemy-canvas').className = '';
    pixels = drawSprite($('enemy-canvas'), enemy().sprite).pixels;
    $('fx-canvas').getContext('2d').clearRect(0, 0, 256, 256);
    render();
  }

  function render() {
    const e = enemy();
    const own = ownedAbilities(save.cleared);

    $('stage-nav').innerHTML = '';
    ENEMIES.forEach((en) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = en.id;
      b.title = enemyOpen(en) ? en.name : '？？？';
      if (save.cleared.includes(en.id)) b.classList.add('cleared');
      if (save.perfects.includes(en.id)) b.classList.add('perfect');
      if (en.id === enemyId) b.classList.add('current');
      b.disabled = !enemyOpen(en) || busy;
      b.onclick = () => loadEnemy(en.id);
      $('stage-nav').appendChild(b);
    });
    $('death-count').textContent = save.deaths ? `死亡 ${save.deaths}回` : '';
    $('mute-btn').textContent = Sound.muted ? '音：OFF' : '音：ON';

    $('enemy-label').textContent = `${e.name}が あらわれた！`;
    $('enemy-intro').textContent = e.intro;

    // 死に帳：この敵について、死んで覚えたことだけ
    const notes = save.notes[e.id] || [];
    $('notes').innerHTML = notes.length
      ? notes.map((n) => `<li>${n}</li>`).join('')
      : '<li class="empty">まだ何も知らない。……死んで覚えるしかない。</li>';

    $('slots').innerHTML = '';
    build.forEach((k, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'slot' + (k ? ' filled' : '');
      el.textContent = k ? `《${ABILITIES[k].name}》` : '空き';
      el.disabled = busy || !k;
      el.onclick = () => { build[i] = null; Sound.play('remove'); render(); };
      $('slots').appendChild(el);
    });

    $('abilities').innerHTML = '';
    own.forEach((k) => {
      const ab = ABILITIES[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ability' + (ab.stolen ? ' stolen' : '');
      b.innerHTML = `<span><span class="name">${ab.name}</span>${ab.stolen ? '<span class="tag">奪った</span>' : ''}</span><span class="desc">${ab.desc}</span>`;
      b.disabled = busy || build.includes(k) || !build.includes(null);
      b.onclick = () => { build[build.indexOf(null)] = k; Sound.play('place'); render(); };
      $('abilities').appendChild(b);
    });

    $('attack-btn').disabled = busy;
    $('reset-btn').disabled = busy;
  }

  // ── 一撃 ──
  async function attack() {
    if (busy) return;
    const e = enemy();
    const r = resolve(e, build);
    busy = true;
    render();
    $('enemy-win').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

    // 能力を一撃に込める
    const slotEls = [...document.querySelectorAll('.slot')];
    Sound.play('charge');
    for (const el of slotEls) {
      if (!el.classList.contains('filled')) continue;
      el.classList.add('glow');
      await wait(220);
    }
    await wait(250);

    // 放つ
    flash();
    Sound.play('strike');
    const line = $('strike-line');
    line.className = '';
    void line.offsetWidth;
    line.className = 'on';
    await wait(380);

    if (r.outcome === 'win') await victory(e, r);
    else await death(e, r);
  }

  function flash() {
    const f = $('flash');
    f.hidden = true;
    void f.offsetWidth;
    f.hidden = false;
    setTimeout(() => { f.hidden = true; }, 360);
  }

  // 敵のドット絵が砕け散る
  function shatter() {
    const cv = $('fx-canvas');
    const c = cv.getContext('2d');
    $('enemy-canvas').classList.add('gone');
    const cell = cv.width / 16;
    const parts = pixels.map((p) => ({ ...p, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 8 - 2 }));
    let frame = 0;
    return new Promise((done) => {
      (function step() {
        c.clearRect(0, 0, cv.width, cv.height);
        for (const p of parts) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.6;
          c.globalAlpha = Math.max(0, 1 - frame / 40);
          c.fillStyle = p.col;
          c.fillRect(p.x, p.y, cell, cell);
        }
        c.globalAlpha = 1;
        if (++frame < 40 && !reduced) requestAnimationFrame(step);
        else { c.clearRect(0, 0, cv.width, cv.height); done(); }
      })();
    });
  }

  async function victory(e, r) {
    await shatter();
    const firstClear = !save.cleared.includes(e.id);
    const firstPerfect = r.perfect && save.perfects.length === 0;
    if (firstClear) save.cleared.push(e.id);
    if (r.perfect && !save.perfects.includes(e.id)) save.perfects.push(e.id);
    persist();

    $('victory-title').textContent = r.perfect ? '極' : '一撃必殺';
    $('victory-title').className = r.perfect ? 'perfect' : '';
    let text = `${e.name}を、一撃で倒した。`;
    if (r.perfect) text = `${e.perfectText}<br>${e.name}を、一撃で倒した。`;
    if (firstPerfect) text += '<p class="reveal">余計な能力を込めず、最小の組み合わせで決めた一撃は「極」となる。</p>';
    $('victory-text').innerHTML = text;
    const steal = firstClear && e.steal ? ABILITIES[e.steal] : null;
    $('victory-reward').innerHTML = steal
      ? `<span class="got">《${steal.name}》</span>を奪った！<small>${steal.desc}</small>`
      : '';
    const next = ENEMIES.find((en) => en.id === e.id + 1);
    $('next-btn').textContent = next ? '次の敵へ' : (firstClear ? '試作版はここまで' : '閉じる');
    $('victory').hidden = false;
    Sound.play(r.perfect ? 'perfect' : 'win');
    if (steal) setTimeout(() => Sound.play('steal'), 700);
    $('next-btn').onclick = () => {
      $('victory').hidden = true;
      loadEnemy(next ? next.id : e.id);
    };
  }

  const GODDESS = [
    'おかえりなさい。……また死にましたね？',
    'はい、戻しておきました。次は当ててくださいね。',
    'その死に様、ちゃんと覚えておいてくださいね。',
    '死ぬのも仕事のうちです。たぶん。',
    '何度でも戻せますよ。私の残業が増えるだけです。',
    '大丈夫、死んだ分だけ詳しくなっています。',
  ];

  async function death(e, r) {
    $('enemy-canvas').classList.add('hurt');
    await wait(300);
    save.deaths++;
    const notes = (save.notes[e.id] ||= []);
    const isNew = !notes.includes(r.gate.clue);
    if (isNew) notes.push(r.gate.clue);
    persist();

    Sound.play('death');
    $('death-kind').textContent = r.outcome === 'miss' ? '── 外した ──' : '── 倒しきれなかった ──';
    $('death-text').textContent = '';
    $('death-title').hidden = true;
    $('death-after').hidden = true;
    $('death').hidden = false;

    // 死に様を一文字ずつ
    const text = r.gate.death;
    for (let i = 0; i < text.length; i++) {
      $('death-text').textContent = text.slice(0, i + 1);
      if (i % 2 === 0) Sound.play('type');
      await wait(28);
    }
    await wait(400);
    $('death-title').hidden = false;
    $('death-title').textContent = '死亡';
    await wait(700);
    $('death-clue').textContent = isNew ? `死に帳に記した：${r.gate.clue}` : '……前にも、こうして死んだ。';
    $('goddess').textContent = save.deaths === 1
      ? '最初の死、おめでとうございます。ここからが本番ですよ。'
      : GODDESS[(save.deaths + e.id) % GODDESS.length];
    $('death-after').hidden = false;
    $('revive-btn').focus();
  }

  function revive() {
    $('death').hidden = true;
    Sound.play('revive');
    busy = false;
    $('enemy-canvas').className = '';
    render();
  }

  function showPrologue() {
    $('prologue-text').innerHTML = [
      '――目を覚ますと、女神がいた。',
      '「あなたは死にました。でもご安心を。異世界に転生させてあげます」',
      '「特典として能力をひとつ。《一撃必殺》――当てて倒しきれば、どんな相手にも必ず勝てます」',
      '「ただし、攻撃できるのは一度だけ。外したら死にます。当てても倒しきれなかったら、やっぱり死にます」',
      '「大丈夫。死んだら、戦いの前に戻してあげますから」',
    ].map((t) => `<p>${t}</p>`).join('');
    $('prologue').hidden = false;
  }

  $('attack-btn').onclick = attack;
  $('reset-btn').onclick = () => { build = build.map(() => null); Sound.play('remove'); render(); };
  $('revive-btn').onclick = revive;
  $('mute-btn').onclick = () => { Sound.toggle(); Sound.play('place'); render(); };
  $('prologue-btn').onclick = () => {
    save.prologue = true;
    persist();
    $('prologue').hidden = true;
    Sound.play('revive');
  };

  loadEnemy(enemyId);
  if (!save.prologue) showPrologue();
})();
