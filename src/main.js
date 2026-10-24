(function () {
  const { PARTS, STAGES, simulate } = window.OneShot;
  const Sound = window.Sound;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'oneshot-progress-v1';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cleared = loadProgress();
  let stageIdx = Math.min(cleared.length, STAGES.length - 1);
  let build = [];
  let attempts = 0;
  let busy = false;

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; }
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(cleared)); } catch { /* 保存できなくても遊べる */ }
  }

  const stage = () => STAGES[stageIdx];
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? ms * 0.4 : ms));

  // 0〜9999 を漢数字に
  function kanjiNum(n) {
    if (n === 0) return '零';
    const d = '〇一二三四五六七八九';
    const units = [['千', 1000], ['百', 100], ['十', 10]];
    let out = '';
    for (const [u, v] of units) {
      const q = Math.floor(n / v);
      if (q) out += (q > 1 ? d[q] : '') + u;
      n %= v;
    }
    return out + (n ? d[n] : '');
  }

  // 円相（筆で描いた輪）をステージごとに少し違う形で描く
  function drawEnso(seed) {
    const cv = $('enso');
    const c = cv.getContext('2d');
    const W = cv.width;
    c.clearRect(0, 0, W, W);
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const start = rnd() * Math.PI * 2;
    const sweep = Math.PI * (1.7 + rnd() * 0.2);
    const R = W * 0.4;
    const N = 220;
    c.fillStyle = '#1b1815';
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const a = start + sweep * t;
      const wobble = Math.sin(t * 7 + seed) * 3;
      const r = R + wobble;
      // 入りは太く、抜けは細くかすれる
      const w = 18 * Math.pow(1 - t, 0.6) * (0.85 + rnd() * 0.3) + 1.5;
      c.globalAlpha = t > 0.75 ? 0.5 + rnd() * 0.4 : 0.9;
      c.beginPath();
      c.arc(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r, w, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function loadStage(i) {
    stageIdx = i;
    build = Array(stage().slots).fill(null);
    attempts = 0;
    busy = false;
    resetEnemyView();
    drawEnso(stage().id);
    $('log').innerHTML = '';
    render();
  }

  function resetEnemyView() {
    // 斬られた状態から戻すときはアニメーションさせない
    const sprite = $('enemy-sprite');
    sprite.className = 'instant';
    void sprite.offsetWidth;
    sprite.className = '';
    $('enemy-cut').className = '';
    $('stamp').className = '';
    $('damage-pop').className = '';
    $('enso').style.opacity = '';
  }

  const monsterCache = {};
  const monsterImage = (st) => (monsterCache[st.id] ||= window.drawMonster(st.look));

  const seal = (key) => `<span class="seal">${PARTS[key].icon}</span>`;

  function render() {
    const st = stage();

    $('stage-nav').innerHTML = '';
    STAGES.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = kanjiNum(s.id);
      b.title = `第${kanjiNum(s.id)}幕 ${s.enemy}`;
      if (cleared.includes(s.id)) b.classList.add('cleared');
      if (i === stageIdx) b.classList.add('current');
      b.disabled = i > cleared.length || busy;
      b.onclick = () => loadStage(i);
      $('stage-nav').appendChild(b);
    });

    $('enemy-name').innerHTML = `第${kanjiNum(st.id)}幕<b>${st.enemy}</b>`;
    const img = monsterImage(st);
    document.querySelectorAll('.half').forEach((h) => { h.style.backgroundImage = `url(${img})`; });
    const tags = [`<span class="tag hp">体力 ${st.hp}</span>`];
    if (st.armor) tags.push(`<span class="tag">装甲 ${st.armor}</span>`);
    if (st.exact) tags.push('<span class="tag special">反射：寸分違わず</span>');
    if (st.weakFlame) tags.push('<span class="tag special">弱点：炎（会心×3）</span>');
    tags.push(`<span class="tag">${kanjiNum(attempts + 1)}太刀目</span>`);
    $('enemy-stats').innerHTML = tags.join('');
    $('hint').textContent = st.hint;

    $('slots').innerHTML = '';
    build.forEach((key, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (key ? ' filled' : '');
      el.tabIndex = key && !busy ? 0 : -1;
      el.innerHTML = `<span class="idx">${kanjiNum(i + 1)}</span>` + (key
        ? `${seal(key)}<span class="part-name">${PARTS[key].name}</span><span class="val"></span>`
        : '<span class="empty">空き</span>');
      const remove = () => { if (!busy && key) { build[i] = null; Sound.play('remove'); render(); } };
      el.onclick = remove;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); remove(); } };
      $('slots').appendChild(el);
    });

    $('parts').innerHTML = '';
    const newPart = stageIdx > 0 ? STAGES[stageIdx - 1].unlock : null;
    st.parts.forEach((key) => {
      const p = PARTS[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'part' + (key === newPart ? ' new' : '');
      b.innerHTML = `${seal(key)}<span class="part-name">${p.name}${key === newPart ? '<span class="new-mark">新たに会得</span>' : ''}</span><span class="part-desc">${p.desc}</span>`;
      b.disabled = busy || build.includes(key) || !build.includes(null);
      b.onclick = () => {
        const empty = build.indexOf(null);
        if (empty >= 0) { build[empty] = key; Sound.play('place'); render(); }
      };
      $('parts').appendChild(b);
    });

    $('attack-btn').disabled = busy || build.every((k) => !k);
    $('reset-btn').disabled = busy;
    $('mute-btn').textContent = Sound.muted ? '音：無' : '音：有';
  }

  function breakdown(st, r) {
    const parts = [`威力 <b>${r.raw}</b>`];
    if (r.critical) parts.push('会心 <b>×3</b>');
    if (st.armor) parts.push(r.pierce ? '装甲 <b>貫通</b>' : `装甲 <b>−${r.armorApplied}</b>`);
    parts.push(`最終 <b>${r.final}</b>／体力 ${st.hp}`);
    let verdict;
    if (r.win) verdict = '<span class="win">一刀両断。</span>';
    else if (r.reflected) verdict = `<span class="lose">弾かれた。${r.final > st.hp ? '強すぎる' : '弱すぎる'}一太刀。</span>`;
    else verdict = `<span class="lose">浅い。あと ${st.hp - r.final}。</span>`;
    return parts.join(' → ') + '<br>' + verdict;
  }

  async function attack() {
    if (busy) return;
    Sound.unlock();
    const st = stage();
    const r = simulate(st, build);
    busy = true;
    render();
    $('log').innerHTML = '';
    // 敵と構えが同時に見える位置へ
    $('enemy-area').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    await wait(250);

    // 一. 構え：型を一つずつ繰り出す
    const slotEls = [...document.querySelectorAll('.slot')];
    let si = 0;
    for (let i = 0; i < build.length; i++) {
      if (!build[i]) continue;
      const step = r.steps[si];
      const el = slotEls[i];
      el.classList.add('active');
      el.querySelector('.val').textContent = `${step.note}${step.charged ? '（溜）' : ''} → ${step.dmg}`;
      Sound.play('step', si);
      si++;
      await wait(380);
      el.classList.remove('active');
    }
    await wait(200);

    // 成功したときだけ、カットイン → 暗転 → 一閃
    const bo = $('blackout');
    if (r.win) {
      const cutin = $('cutin');
      cutin.querySelector('.cutin-sub').textContent = `${st.enemy}、斬る`;
      cutin.hidden = false;
      cutin.classList.remove('on');
      void cutin.offsetWidth;
      cutin.classList.add('on');
      Sound.play('cutin');
      await wait(820);

      bo.className = '';
      bo.hidden = false;
      cutin.hidden = true;
      await wait(450);
      bo.classList.add('slash');
      Sound.play('slash');
      await wait(420);
    }

    // 結果
    const sprite = $('enemy-sprite');
    if (r.win) { sprite.classList.add('split'); $('enemy-cut').classList.add('on'); $('enso').style.opacity = '.15'; }
    else sprite.classList.add(r.reflected ? 'reflect' : 'shake');
    const pop = $('damage-pop');
    pop.innerHTML = `${r.critical ? '会心 ' : ''}${kanjiNum(r.final)}<small>${r.final}</small>`;
    pop.className = r.critical ? 'crit' : '';
    void pop.offsetWidth;
    pop.classList.add('show');
    const stamp = $('stamp');
    stamp.textContent = r.win ? '撃破' : r.reflected ? '反射' : '浅し';
    stamp.classList.add('on');
    Sound.play(r.win ? 'win' : r.reflected ? 'reflect' : 'fail');
    $('log').innerHTML = breakdown(st, r);
    if (r.win) {
      bo.classList.add('fade');
      await wait(260);
      bo.hidden = true;
    }

    await wait(r.win ? 1500 : 1100);

    if (r.win) {
      if (!cleared.includes(st.id)) { cleared.push(st.id); saveProgress(); }
      showClear(st);
    } else {
      // 失敗：構えはそのまま残して、すぐ次の一太刀へ
      attempts++;
      busy = false;
      resetEnemyView();
      render();
      $('log').innerHTML = breakdown(st, r);
    }
  }

  function showClear(st) {
    const rank = attempts === 0 ? '免許皆伝' : attempts <= 2 ? '目録' : '修行中';
    const last = stageIdx === STAGES.length - 1;
    $('modal-title').textContent = '一刀両断';
    let body = `<span class="rank">${rank}</span><br>${kanjiNum(attempts + 1)}太刀で斬った`;
    if (st.unlock) {
      const p = PARTS[st.unlock];
      body += `<div class="unlock">${seal(st.unlock)}<b>新たな型：${p.name}</b><small>${p.desc}</small></div>`;
    }
    if (last) body += '<br>試作版はここまで。遊んでくれてありがとう。';
    $('modal-body').innerHTML = body;
    $('modal-btn').textContent = last ? '幕を選ぶ' : '次の幕へ';
    $('modal').hidden = false;
    Sound.play('clear');
    $('modal-btn').onclick = () => {
      $('modal').hidden = true;
      loadStage(last ? stageIdx : stageIdx + 1);
    };
  }

  $('attack-btn').onclick = attack;
  $('reset-btn').onclick = () => {
    build = Array(stage().slots).fill(null);
    $('log').innerHTML = '';
    Sound.play('remove');
    render();
  };
  $('mute-btn').onclick = () => { Sound.toggle(); Sound.play('place'); render(); };

  loadStage(stageIdx);
})();
