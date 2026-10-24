// 効果音（Web Audio で合成したピコピコ音。音声ファイルなし）
(function (root) {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('isekai-muted') === '1'; } catch { /* 既定は音あり */ }

  // ブラウザの制約で、最初のクリック後に初期化する
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function note(type, freq, t, dur, vol = 0.3, freqEnd) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol = 0.3) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf; src.connect(g); g.connect(master);
    src.start(t);
  }

  const C = 523.25, E = 659.25, G = 783.99, C2 = 1046.5;
  const sounds = {
    place(t) { note('square', 880, t, 0.06, 0.15); },
    remove(t) { note('square', 440, t, 0.06, 0.12); },
    charge(t) { note('square', 220, t, 0.5, 0.12, 880); },
    strike(t) { noise(t, 0.25, 0.5); note('square', 1200, t, 0.25, 0.25, 80); },
    win(t) { [C, E, G, C2].forEach((f, i) => note('square', f, t + i * 0.09, 0.18, 0.2)); },
    perfect(t) {
      [C, E, G, C2, G, C2].forEach((f, i) => note('square', f, t + i * 0.08, 0.2, 0.18));
      [C2, C2 * 1.5, C2 * 2].forEach((f, i) => note('triangle', f, t + 0.55 + i * 0.12, 0.6, 0.15));
    },
    death(t) { noise(t, 0.4, 0.4); note('square', 440, t, 0.9, 0.25, 55); note('square', 330, t + 0.15, 0.9, 0.18, 40); },
    revive(t) { [0, 1, 2, 3, 4, 5].forEach((i) => note('sine', 660 * Math.pow(1.19, i), t + i * 0.06, 0.4, 0.12)); },
    steal(t) { [G, C2, E * 2].forEach((f, i) => note('triangle', f, t + i * 0.1, 0.35, 0.18)); },
    type(t) { note('square', 1600, t, 0.015, 0.04); },
  };

  root.Sound = {
    play(name) {
      if (muted || !ensure()) return;
      try { sounds[name](ctx.currentTime + 0.01); } catch { /* 音が出なくても続行 */ }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('isekai-muted', muted ? '1' : '0'); } catch { /* 保存できなくても続行 */ }
      if (!muted) ensure();
      return muted;
    },
  };
})(window);
