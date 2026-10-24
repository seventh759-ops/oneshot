// 効果音（Web Audio で合成。音声ファイルなし）
(function (root) {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('oneshot-muted') === '1'; } catch { /* 既定は音あり */ }

  // ブラウザの制約で、最初のクリック後に初期化する
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }

  // 音量エンベロープ付きの出口
  function env(t, attack, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(master);
    return g;
  }

  function tone(type, freq, t, attack, peak, decay, freqEnd) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    o.connect(env(t, attack, peak, decay));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function noiseHit(t, filterType, f0, f1, q, attack, peak, decay) {
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    n.connect(f);
    f.connect(env(t, attack, peak, decay));
    n.start(t);
    n.stop(t + attack + decay + 0.05);
  }

  // 都節音階（ミ ファ ラ シ ド）で琴っぽい撥弦
  const MIYAKO = [329.6, 349.2, 440, 493.9, 523.3, 659.3, 698.5, 880];
  function pluck(freq, t, peak = 0.25) {
    tone('triangle', freq, t, 0.004, peak, 1.4);
    tone('sine', freq * 2, t, 0.004, peak * 0.35, 0.6);
  }

  const sounds = {
    // 型を置く：拍子木
    place(t) { tone('square', 1800, t, 0.001, 0.05, 0.04); tone('sine', 950, t, 0.001, 0.18, 0.08); },
    remove(t) { tone('sine', 600, t, 0.001, 0.12, 0.07); },
    // 型を繰り出す：一段ずつ音が上がる
    step(t, i) { pluck(MIYAKO[Math.min(i, MIYAKO.length - 1)], t, 0.18); },
    // カットイン：風切り
    cutin(t) {
      noiseHit(t, 'bandpass', 400, 4000, 1.2, 0.25, 0.5, 0.35);
      tone('sawtooth', 90, t, 0.02, 0.08, 0.5, 60);
    },
    // 一閃：鋭い高音と金属の残響
    slash(t) {
      noiseHit(t, 'highpass', 3000, 9000, 0.7, 0.003, 0.7, 0.18);
      tone('sine', 3200, t, 0.002, 0.18, 0.5, 2400);
      [2637, 3951, 5274].forEach((f, i) => tone('sine', f, t + 0.01, 0.002, 0.05 / (i + 1), 1.2));
    },
    // 撃破：太鼓
    win(t) {
      tone('sine', 120, t, 0.004, 0.9, 0.9, 45);
      noiseHit(t, 'lowpass', 900, 200, 0.8, 0.003, 0.4, 0.25);
      tone('sine', 120, t + 0.32, 0.004, 0.5, 0.7, 45);
    },
    // 浅い：鈍い音
    fail(t) {
      tone('sine', 160, t, 0.004, 0.5, 0.35, 90);
      noiseHit(t, 'lowpass', 500, 150, 0.7, 0.003, 0.25, 0.2);
    },
    // 弾かれた：金属音
    reflect(t) {
      [620, 1490, 2380, 3170].forEach((f, i) => tone('sine', f, t, 0.002, 0.25 / (i + 1), 1.0));
      noiseHit(t, 'bandpass', 2500, 1500, 3, 0.002, 0.3, 0.12);
    },
    // 極：時が止まる鼓動
    heartbeat(t) {
      tone('sine', 70, t, 0.005, 0.7, 0.25, 40);
      tone('sine', 65, t + 0.22, 0.005, 0.5, 0.25, 38);
    },
    // 極：澄んだ鈴（りん）
    bell(t) {
      [880, 2380, 4320, 5950].forEach((f, i) => tone('sine', f, t, 0.003, 0.22 / (i + 1), 2.6 - i * 0.4));
    },
    // 極の決着：太鼓の連打と鈴と琴
    perfect(t) {
      [0, 0.12, 0.24].forEach((d, i) => tone('sine', 130 - i * 8, t + d, 0.004, 0.6 + i * 0.15, 0.6, 42));
      noiseHit(t + 0.24, 'lowpass', 1200, 200, 0.8, 0.003, 0.5, 0.35);
      sounds.bell(t + 0.5);
      [0, 2, 4, 5, 7].forEach((n, i) => pluck(MIYAKO[n], t + 0.7 + i * 0.09, 0.2));
    },
    // ステージクリア：琴のアルペジオ
    clear(t) {
      [0, 2, 3, 4, 6, 7].forEach((n, i) => pluck(MIYAKO[n], t + i * 0.11));
    },
  };

  root.Sound = {
    play(name, ...args) {
      if (muted || !ensure()) return;
      try { sounds[name](ctx.currentTime + 0.01, ...args); } catch { /* 音が出なくても続行 */ }
    },
    unlock() { ensure(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('oneshot-muted', muted ? '1' : '0'); } catch { /* 保存できなくても続行 */ }
      if (!muted) ensure();
      return muted;
    },
  };
})(window);
