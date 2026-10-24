(function () {
  const {
    ELEMENTS, PHYS, BODIES, CHARS, CHAR_ORDER, PARTS, STAGES, TRIALS,
    elementRelation, unlocked, loadout, simulate,
  } = window.OneShot;
  const Sound = window.Sound;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'oneshot-save-v2';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 進行状況：クリアした幕 / 極を取った幕 / 達成した試練
  let progress = loadProgress();
  let stageId = firstUnclearedStage();
  let charKey = 'toki';
  let build = [];
  let attempts = 0;
  let busy = false;

  function loadProgress() {
    const empty = { cleared: [], perfects: [], trials: [] };
    try { return { ...empty, ...JSON.parse(localStorage.getItem(SAVE_KEY)) }; } catch { return empty; }
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* 保存できなくても遊べる */ }
  }
  function firstUnclearedStage() {
    const s = STAGES.find((st) => !st.hidden && !progress.cleared.includes(st.id));
    return s ? s.id : 1;
  }

  const stage = () => STAGES.find((s) => s.id === stageId);
  const unlocks = () => unlocked(progress);
  const kit = () => loadout(stage(), charKey, unlocks().secrets);
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? ms * 0.4 : ms));

  // 普通の幕は、ひとつ前の幕をクリアすると選べる。隠し幕は試練で開く
  function stageOpen(st) {
    if (st.hidden) return unlocks().stages.has(st.id);
    return st.id === 1 || progress.cleared.includes(st.id - 1);
  }

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
  const stageLabel = (st) => (st.hidden ? '隠' : kanjiNum(st.id));
  const stageTitle = (st) => (st.hidden ? '隠し幕' : `第${kanjiNum(st.id)}幕`);

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

  function loadStage(id) {
    stageId = id;
    if (!unlocks().chars.has(charKey)) charKey = 'toki';
    attempts = 0;
    busy = false;
    resetBuild();
    resetEnemyView();
    drawEnso(stage().id);
    $('log').innerHTML = '';
    render();
  }

  function resetBuild() {
    build = Array(kit().slots).fill(null);
  }

  function selectChar(key) {
    if (busy || key === charKey) return;
    charKey = key;
    resetBuild();
    $('log').innerHTML = '';
    Sound.play('place');
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
    $('ink-burst').innerHTML = '';
    document.body.classList.remove('timestop');
    $('damage-pop').className = '';
    $('enso').style.opacity = '';
  }

  const monsterCache = {};
  const monsterImage = (st) => (monsterCache[st.id] ||= window.drawMonster(st.look));

  const seal = (key) => `<span class="seal">${PARTS[key].icon}</span>`;
  const elName = (k) => ELEMENTS[k].name;

  // 剣士とこの敵の相性（カードに出す短い説明）
  function matchup(ck, st) {
    const ch = CHARS[ck];
    const out = [];
    const rel = elementRelation(ch.element, st.element);
    if (rel.kind === 'koku') out.push(['good', `${elName(ch.element)}は${elName(st.element)}に克つ ×3`]);
    if (rel.kind === 'sho') out.push(['bad', `${elName(ch.element)}は${elName(st.element)}を生む 吸収`]);
    if (rel.kind === 'same') out.push(['bad', '同じ五行 半減']);
    const vs = BODIES[st.body].vs[ch.phys];
    if (vs) {
      if (vs.mult > 1) out.push(['good', `${PHYS[ch.phys].name}は急所 ×${vs.mult}`]);
      if (vs.mult < 1) out.push(['bad', `${PHYS[ch.phys].name}は半減`]);
      if (vs.armor === 0) out.push(['good', '装甲を砕く']);
      if (vs.armor > 1) out.push(['bad', `装甲 ×${vs.armor}`]);
    }
    return out;
  }

  function render() {
    const st = stage();
    const un = unlocks();

    // 幕の選択
    $('stage-nav').innerHTML = '';
    STAGES.forEach((s) => {
      if (s.hidden && !stageOpen(s)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = stageLabel(s);
      b.title = `${stageTitle(s)} ${s.enemy}`;
      if (progress.cleared.includes(s.id)) b.classList.add('cleared');
      if (progress.perfects.includes(s.id)) { b.classList.add('perfect'); b.title += '（極）'; }
      if (s.id === stageId) b.classList.add('current');
      b.disabled = !stageOpen(s) || busy;
      b.onclick = () => loadStage(s.id);
      $('stage-nav').appendChild(b);
    });
    $('trials-btn').innerHTML = `試練帳 <b>${progress.trials.length}/${TRIALS.length}</b>`;
    $('trials-btn').disabled = busy;

    // 敵
    $('enemy-name').innerHTML = `${stageTitle(st)}<b>${st.enemy}</b>`;
    const img = monsterImage(st);
    document.querySelectorAll('.half').forEach((h) => { h.style.backgroundImage = `url(${img})`; });
    const body = BODIES[st.body];
    const tags = [`<span class="tag hp">体力 ${st.hp}</span>`];
    if (st.armor) tags.push(`<span class="tag">装甲 ${st.armor}</span>`);
    tags.push(`<span class="tag el">五行 ${elName(st.element)}</span>`);
    tags.push(`<span class="tag">${body.name}：${body.desc}</span>`);
    if (st.exact) tags.push('<span class="tag special">反射：寸分違わず</span>');
    else tags.push(`<span class="tag gold">極：ぴったり${st.hp}${progress.perfects.includes(st.id) ? ' 済' : ''}</span>`);
    tags.push(`<span class="tag">${kanjiNum(attempts + 1)}太刀目</span>`);
    $('enemy-stats').innerHTML = tags.join('');
    $('hint').textContent = st.hint;

    // 剣士
    $('chars').innerHTML = '';
    CHAR_ORDER.forEach((ck) => {
      const ch = CHARS[ck];
      const open = un.chars.has(ck);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'char' + (ck === charKey ? ' selected' : '') + (open ? '' : ' locked');
      b.disabled = !open || busy;
      if (open) {
        const mu = matchup(ck, st).map(([k, t]) => `<span class="mu ${k}">${t}</span>`).join('');
        b.innerHTML = `<span class="char-head"><span class="char-name">${ch.name}</span><span class="char-weapon">${ch.weapon}・${PHYS[ch.phys].name}・${elName(ch.element)}</span></span>`
          + `<span class="char-trait"><b>${ch.trait}</b> ${ch.traitDesc}</span>`
          + `<span class="char-mu">${mu || '<span class="mu">相性の有利不利なし</span>'}</span>`;
      } else {
        b.innerHTML = '<span class="char-head"><span class="char-name">？？？</span></span><span class="char-trait">試練を果たすと加わる</span>';
      }
      b.onclick = () => selectChar(ck);
      $('chars').appendChild(b);
    });

    // 構え
    const { parts } = kit();
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

    // 型
    $('parts').innerHTML = '';
    const prev = STAGES.find((s) => s.id === st.id - 1);
    const newParts = prev && !st.hidden ? prev.unlock.parts || [] : [];
    parts.forEach((key) => {
      const p = PARTS[key];
      const b = document.createElement('button');
      b.type = 'button';
      const isNew = newParts.includes(key);
      const own = (CHARS[charKey].extra || []).includes(key) && !st.parts.includes(key);
      b.className = 'part' + (isNew ? ' new' : '') + (p.secret ? ' secret' : '');
      const mark = p.secret ? '<span class="new-mark">秘伝</span>'
        : own ? `<span class="new-mark">${CHARS[charKey].name}</span>`
          : isNew ? '<span class="new-mark">新たに会得</span>' : '';
      b.innerHTML = `${seal(key)}<span class="part-name">${p.name}${mark}</span><span class="part-desc">${p.desc}</span>`;
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
    if (r.physMult !== 1) parts.push(`${PHYS[r.phys].name}${r.physMult > 1 ? '・急所' : '・半減'} <b>${r.afterPhys}</b>`);
    if (r.relation === 'koku') parts.push(`相剋 ${elName(r.element)}→${elName(st.element)} 会心 <b>×3</b>`);
    if (r.relation === 'same') parts.push(`同属 ${elName(r.element)} 半減 <b>${r.afterElem}</b>`);
    if (r.relation === 'sho') parts.push(`相生 ${elName(r.element)}→${elName(st.element)} <b>吸収</b>`);
    if (st.armor && r.afterElem > 0) parts.push(r.armorApplied === 0 ? '装甲 <b>無効</b>' : `装甲 <b>−${r.armorApplied}</b>`);
    parts.push(`最終 <b>${r.final}</b>／体力 ${st.hp}`);
    let verdict;
    if (r.perfect) verdict = '<span class="win">極。寸分違わず斬り伏せた。</span>';
    else if (r.win) verdict = `<span class="win">一刀両断。（ぴったりなら極、${r.final - st.hp} 多い）</span>`;
    else if (r.reflected) verdict = `<span class="lose">弾かれた。${r.final > st.hp ? '強すぎる' : '弱すぎる'}一太刀。</span>`;
    else if (r.relation === 'sho') verdict = '<span class="lose">吸い込まれた。五行が敵を生んでいる。</span>';
    else verdict = `<span class="lose">浅い。あと ${st.hp - r.final}。</span>`;
    return parts.join(' → ') + '<br>' + verdict;
  }

  async function attack() {
    if (busy) return;
    Sound.unlock();
    const st = stage();
    const r = simulate(st, build, charKey);
    busy = true;
    render();
    $('log').innerHTML = '';
    // 敵と構えが同時に見える位置へ
    $('enemy-area').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    await wait(250);

    // 構え：型を一つずつ繰り出す
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

    const bo = $('blackout');
    if (r.perfect) await perfectCinematic(st, bo);
    else if (r.win) await normalCinematic(st, bo, r);

    // 結果
    const sprite = $('enemy-sprite');
    if (r.win) {
      sprite.classList.add('split');
      $('enemy-cut').classList.add('on');
      $('enso').style.opacity = '.15';
      if (r.perfect) inkBurst();
    } else sprite.classList.add(r.reflected ? 'reflect' : 'shake');
    const pop = $('damage-pop');
    pop.innerHTML = `${r.critical ? '会心 ' : ''}${kanjiNum(r.final)}<small>${r.perfect ? '寸分違わず' : r.final}</small>`;
    pop.className = r.perfect ? 'perfect' : r.critical ? 'crit' : '';
    void pop.offsetWidth;
    pop.classList.add('show');
    const stamp = $('stamp');
    stamp.textContent = r.perfect ? '極' : r.win ? '撃破' : r.reflected ? '反射' : r.relation === 'sho' ? '吸収' : '浅し';
    stamp.className = r.perfect ? 'gold' : '';
    void stamp.offsetWidth;
    stamp.classList.add('on');
    Sound.play(r.perfect ? 'perfect' : r.win ? 'win' : r.reflected ? 'reflect' : 'fail');
    $('log').innerHTML = breakdown(st, r);
    if (r.win) {
      document.body.classList.remove('timestop');
      bo.classList.add('fade');
      await wait(260);
      bo.hidden = true;
    }

    await wait(r.perfect ? 2000 : r.win ? 1500 : 1100);

    if (r.win) showClear(st, r, record(st, r));
    else {
      // 失敗：構えはそのまま残して、すぐ次の一太刀へ
      attempts++;
      busy = false;
      resetEnemyView();
      render();
      $('log').innerHTML = breakdown(st, r);
    }
  }

  // 勝ったときの記録。今回新たに得たもの（型・剣士・幕・試練）を返す
  function record(st, r) {
    const before = unlocks();
    const firstClear = !progress.cleared.includes(st.id);
    if (firstClear) progress.cleared.push(st.id);
    if (r.perfect && !progress.perfects.includes(st.id)) progress.perfects.push(st.id);
    const newTrials = [];
    for (const t of TRIALS) {
      if (progress.trials.includes(t.id)) continue;
      const ok = t.test
        ? t.stage === st.id && t.test(r, { build, charKey })
        : STAGES.filter((s) => !s.hidden).every((s) => progress.perfects.includes(s.id));
      if (ok) { progress.trials.push(t.id); newTrials.push(t); }
    }
    saveProgress();
    const after = unlocks();
    return {
      parts: firstClear ? (st.unlock.parts || []) : [],
      secrets: [...after.secrets].filter((p) => !before.secrets.has(p)),
      chars: [...after.chars].filter((c) => !before.chars.has(c)),
      stages: [...after.stages].filter((s) => !before.stages.has(s)),
      trials: newTrials,
    };
  }

  function showCutin(text, sub, perfect) {
    const cutin = $('cutin');
    cutin.querySelector('.cutin-text').textContent = text;
    cutin.querySelector('.cutin-sub').textContent = sub;
    cutin.className = perfect ? 'perfect' : '';
    cutin.hidden = false;
    void cutin.offsetWidth;
    cutin.classList.add('on');
  }

  // 条件クリア：カットイン → 暗転 → 一閃（文字は物理属性で変わる）
  async function normalCinematic(st, bo, r) {
    showCutin(PHYS[r.phys].cut, `${CHARS[charKey].name}、${st.enemy}を斬る`, false);
    Sound.play('cutin');
    await wait(820);
    bo.className = '';
    bo.hidden = false;
    $('cutin').hidden = true;
    await wait(450);
    bo.classList.add('slash');
    Sound.play('slash');
    await wait(420);
  }

  // 完全一致：時が止まる → 金のカットイン → 長い静寂 → 金の一筋 → 十字に斬り裂く
  async function perfectCinematic(st, bo) {
    document.body.classList.add('timestop');
    Sound.play('heartbeat');
    await wait(750);
    showCutin('極', `寸分違わず ── ${CHARS[charKey].name}`, true);
    Sound.play('cutin');
    Sound.play('bell');
    await wait(1150);
    bo.className = 'perfect';
    bo.hidden = false;
    $('cutin').hidden = true;
    await wait(700);
    bo.classList.add('slash');
    Sound.play('slash');
    await wait(650);
    bo.classList.add('cross');
    Sound.play('slash');
    await wait(110);
    Sound.play('slash');
    await wait(420);
  }

  // 極のとき、墨が四方に飛び散る
  function inkBurst() {
    const box = $('ink-burst');
    box.innerHTML = '';
    for (let i = 0; i < 26; i++) {
      const d = document.createElement('i');
      const a = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 90;
      const size = 4 + Math.random() * 12;
      d.style.cssText = `--x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist}px;width:${size}px;height:${size}px;animation-delay:${Math.random() * 0.08}s`;
      box.appendChild(d);
    }
  }

  function rewardText(rw) {
    const out = [];
    (rw.chars || []).forEach((c) => out.push(`剣士「${CHARS[c].name}」`));
    (rw.parts || []).forEach((p) => out.push(`秘伝「${PARTS[p].name}」`));
    (rw.stages || []).forEach(() => out.push('隠し幕'));
    return out.join('・');
  }

  function showClear(st, r, gained) {
    const rank = attempts === 0 ? '免許皆伝' : attempts <= 2 ? '目録' : '修行中';
    const next = STAGES.find((s) => !s.hidden && s.id === st.id + 1);
    $('modal-title').textContent = r.perfect ? '極' : '一刀両断';
    $('modal').classList.toggle('perfect', r.perfect);
    let body = `<span class="rank">${rank}</span><br>${CHARS[charKey].name}が${kanjiNum(attempts + 1)}太刀で斬った`;
    if (r.perfect) body += '<br><span class="gold-line">寸分違わぬ一太刀</span>';
    else if (!st.exact) body += `<br><small>体力ぴったり（${st.hp}）で斬れば「極」</small>`;

    const items = [];
    gained.trials.forEach((t) => items.push(`<div class="unlock trial"><span class="seal">試</span><b>試練達成：${t.title}</b><small>報酬：${rewardText(t.reward)}</small></div>`));
    gained.parts.forEach((p) => items.push(`<div class="unlock">${seal(p)}<b>新たな型：${PARTS[p].name}</b><small>${PARTS[p].desc}</small></div>`));
    gained.secrets.forEach((p) => items.push(`<div class="unlock trial">${seal(p)}<b>秘伝：${PARTS[p].name}</b><small>${PARTS[p].desc}</small></div>`));
    gained.chars.forEach((c) => {
      const ch = CHARS[c];
      items.push(`<div class="unlock trial"><span class="seal">${ch.name[0]}</span><b>剣士「${ch.name}」が加わった</b><small>${ch.weapon}・${PHYS[ch.phys].name}・${elName(ch.element)}／${ch.trait}</small></div>`);
    });
    gained.stages.forEach(() => items.push('<div class="unlock trial"><span class="seal">隠</span><b>隠し幕が開いた</b><small>幕の選択に「隠」が現れた</small></div>'));
    body += items.join('');
    if (!next) body += `<br>極 ${progress.perfects.length}／${STAGES.length}・試練 ${progress.trials.length}／${TRIALS.length}`;
    $('modal-body').innerHTML = body;

    $('modal-btn').textContent = next ? '次の幕へ' : '幕を選ぶ';
    $('modal').hidden = false;
    Sound.play('clear');
    $('modal-btn').onclick = () => {
      $('modal').hidden = true;
      loadStage(next ? next.id : st.id);
    };
  }

  // 試練帳：見つけた試練は条件を、まだ遠い試練は伏せて見せる
  function showTrials() {
    $('trials-list').innerHTML = TRIALS.map((t) => {
      const done = progress.trials.includes(t.id);
      const st = t.stage && STAGES.find((s) => s.id === t.stage);
      const known = done || !st || stageOpen(st);
      const where = st ? `${stageTitle(st)} ${st.enemy}` : '全幕';
      const kind = t.reward.chars ? '新たな剣士' : t.reward.stages ? '隠し幕' : '秘伝の型';
      return `<li class="${done ? 'done' : ''}"><span class="seal">${done ? '済' : '試'}</span>`
        + `<b>${known ? t.title : '？？？'}</b><small>${known ? t.desc : `${where}に眠る試練`}</small>`
        + `<small class="reward">報酬：${done ? rewardText(t.reward) : kind}</small></li>`;
    }).join('');
    $('trials-modal').hidden = false;
  }

  $('attack-btn').onclick = attack;
  $('reset-btn').onclick = () => {
    resetBuild();
    $('log').innerHTML = '';
    Sound.play('remove');
    render();
  };
  $('mute-btn').onclick = () => { Sound.toggle(); Sound.play('place'); render(); };
  $('trials-btn').onclick = () => { Sound.play('place'); showTrials(); };
  $('trials-close').onclick = () => { $('trials-modal').hidden = true; };

  loadStage(stageId);
})();
