(function () {
  const { PARTS, STAGES, simulate } = window.OneShot;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'oneshot-progress-v1';

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

  function loadStage(i) {
    stageIdx = i;
    build = Array(stage().slots).fill(null);
    attempts = 0;
    busy = false;
    $('enemy-sprite').className = '';
    $('log').innerHTML = '';
    render();
  }

  function render() {
    const st = stage();

    $('stage-nav').innerHTML = '';
    STAGES.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = s.id;
      if (cleared.includes(s.id)) b.classList.add('cleared');
      if (i === stageIdx) b.classList.add('current');
      b.disabled = i > cleared.length || busy;
      b.onclick = () => loadStage(i);
      $('stage-nav').appendChild(b);
    });

    $('enemy-name').textContent = `STAGE ${st.id} — ${st.enemy}`;
    $('enemy-sprite').textContent = st.sprite;
    const tags = [`<span class="tag hp">HP ${st.hp}</span>`];
    if (st.armor) tags.push(`<span class="tag">装甲 ${st.armor}</span>`);
    if (st.exact) tags.push('<span class="tag special">反射：ぴったりのみ有効</span>');
    if (st.weakFlame) tags.push('<span class="tag special">弱点：炎（会心×3）</span>');
    tags.push(`<span class="tag">挑戦 ${attempts + 1} 回目</span>`);
    $('enemy-stats').innerHTML = tags.join('');
    $('hint').textContent = st.hint;

    $('slots').innerHTML = '';
    build.forEach((key, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (key ? ' filled' : '');
      el.dataset.i = i;
      el.innerHTML = `<span class="idx">${i + 1}</span>` + (key
        ? `<span class="part-icon">${PARTS[key].icon}</span><span class="part-name">${PARTS[key].name}</span><span class="val"></span>`
        : '<span class="part-desc" style="color:var(--muted);font-size:12px">空き</span>');
      el.onclick = () => { if (!busy && key) { build[i] = null; render(); } };
      $('slots').appendChild(el);
    });

    $('parts').innerHTML = '';
    const newPart = stageIdx > 0 ? STAGES[stageIdx - 1].unlock : null;
    st.parts.forEach((key) => {
      const p = PARTS[key];
      const b = document.createElement('button');
      b.className = 'part' + (key === newPart ? ' new' : '');
      b.innerHTML = `<span class="part-icon">${p.icon}</span><span class="part-name">${p.name}${key === newPart ? ' <small style="color:var(--ok)">NEW</small>' : ''}</span><span class="part-desc">${p.desc}</span>`;
      b.disabled = busy || build.includes(key) || !build.includes(null);
      b.onclick = () => {
        const empty = build.indexOf(null);
        if (empty >= 0) { build[empty] = key; render(); }
      };
      $('parts').appendChild(b);
    });

    $('attack-btn').disabled = busy || build.every((k) => !k);
    $('reset-btn').disabled = busy;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function attack() {
    if (busy) return;
    const st = stage();
    const r = simulate(st, build);
    busy = true;
    render();
    $('log').innerHTML = '';

    // 各スロットを順に光らせて途中経過を見せる
    const slotEls = [...document.querySelectorAll('.slot')];
    let si = 0;
    for (let i = 0; i < build.length; i++) {
      if (!build[i]) continue;
      const step = r.steps[si++];
      const el = slotEls[i];
      el.classList.add('active');
      el.querySelector('.val').textContent = `${step.note}${step.charged ? '（溜め）' : ''} → ${step.dmg}`;
      await wait(420);
      el.classList.remove('active');
    }

    // 着弾
    const pop = $('damage-pop');
    pop.className = '';
    void pop.offsetWidth;
    pop.textContent = (r.critical ? 'CRITICAL! ' : '') + r.final;
    pop.classList.add('show');
    if (r.critical) pop.classList.add('crit');

    const sprite = $('enemy-sprite');
    sprite.className = r.win ? 'dead' : (r.reflected ? 'reflect' : 'shake');

    const parts = [`威力 <b>${r.raw}</b>`];
    if (r.critical) parts.push('会心 <b>×3</b>');
    if (st.armor) parts.push(r.pierce ? '装甲 <b>無視</b>' : `装甲 <b>−${r.armorApplied}</b>`);
    parts.push(`最終 <b>${r.final}</b> / HP ${st.hp}`);
    let verdict;
    if (r.win) verdict = '<span class="win">撃破！</span>';
    else if (r.reflected) verdict = `<span class="lose">反射された…（${r.final > st.hp ? '強すぎ' : '弱すぎ'}）</span>`;
    else verdict = `<span class="lose">倒しきれない…（あと ${st.hp - r.final}）</span>`;
    $('log').innerHTML = parts.join(' → ') + '<br>' + verdict;

    await wait(1100);

    if (r.win) {
      if (!cleared.includes(st.id)) { cleared.push(st.id); saveProgress(); }
      showClear(st);
    } else {
      // 失敗：ビルドはそのまま残して即リトライ可能
      attempts++;
      busy = false;
      sprite.className = '';
      render();
      $('log').innerHTML = parts.join(' → ') + '<br>' + verdict;
    }
  }

  function showClear(st) {
    const rank = attempts === 0 ? '★★★ 一発クリア！' : attempts <= 2 ? '★★☆' : '★☆☆';
    $('modal-title').textContent = 'STAGE CLEAR';
    let body = `${rank}<br>挑戦回数：${attempts + 1}`;
    const last = stageIdx === STAGES.length - 1;
    if (st.unlock) {
      const p = PARTS[st.unlock];
      body += `<br><span class="unlock">新パーツ解放：${p.icon} <b>${p.name}</b><br><small>${p.desc}</small></span>`;
    }
    if (last) body += '<br><br>試作版はここまで。遊んでくれてありがとう！';
    $('modal-body').innerHTML = body;
    $('modal-btn').textContent = last ? 'ステージ選択へ' : '次のステージへ';
    $('modal').hidden = false;
    $('modal-btn').onclick = () => {
      $('modal').hidden = true;
      loadStage(last ? stageIdx : stageIdx + 1);
    };
  }

  $('attack-btn').onclick = attack;
  $('reset-btn').onclick = () => { build = Array(stage().slots).fill(null); $('log').innerHTML = ''; render(); };

  loadStage(stageIdx);
})();
