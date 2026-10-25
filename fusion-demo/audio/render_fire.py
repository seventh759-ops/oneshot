"""炎の必殺技の効果音を合成して WAV / MP3 に書き出す。

指示文: Epic cinematic fire magic explosion, powerful anime special move, deep sub-bass boom,
        roaring flames rushing forward, high-energy impact, massive fire blast

使い方: python3 fusion-demo/audio/render_fire.py <出力先フォルダ>
"""
import sys
import pathlib
import subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 5.0
N = int(SR * DUR)
HIT = 0.55  # 着弾の時刻（秒）
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def sec(x):
    return int(x * SR)


def envelope(points):
    """[(秒, 値), ...] を折れ線でつないだ音量の形"""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def turbulence(rate, depth, seed):
    """不規則な揺らぎ：ゆっくり変わるランダムな値（炎のちらつき用）"""
    r = np.random.default_rng(seed)
    n = int(DUR * rate) + 4
    pts = r.standard_normal(n)
    x = np.interp(t * rate, np.arange(n), pts)
    b, a = signal.butter(2, rate / (SR / 2))
    x = signal.lfilter(b, a, x)
    return 1 + depth * x / (np.abs(x).max() + 1e-9)


def moving_filter(x, kind, freqs, q=0.7, block=256):
    """時間とともに周波数が動くフィルター（ブロックごとに係数を更新）"""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(freqs[i], 30, SR / 2 - 500))
        if kind == 'band':
            bw = f / q
            lo, hi = max(20, f - bw / 2), min(SR / 2 - 100, f + bw / 2)
            b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'bandpass')
        else:
            b, a = signal.butter(2, f / (SR / 2), 'low' if kind == 'low' else 'high')
        if zi is None or len(zi) != max(len(a), len(b)) - 1:
            zi = signal.lfilter_zi(b, a) * 0
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y


def pan(mono, p):
    """p: -1 = 左、+1 = 右（配列でも可）。等パワーで振る"""
    ang = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(ang), mono * np.sin(ang)])


def sweep_freq(points):
    xs, ys = zip(*points)
    return np.exp(np.interp(t, xs, np.log(ys)))


white = lambda seed: np.random.default_rng(seed).standard_normal(N)
out = np.zeros((2, N))

# ── 1. 迫る：炎が押し寄せる風圧（左から中央へ、こもりから明るさへ） ──
rush = moving_filter(white(1), 'band', sweep_freq([(0, 250), (HIT, 2600), (HIT + 0.2, 1200), (DUR, 800)]), q=1.2)
rush *= envelope([(0, 0), (0.05, 0.05), (HIT - 0.05, 0.9), (HIT + 0.05, 0.4), (HIT + 0.6, 0)]) * turbulence(14, 0.35, 11)
out += pan(rush * 0.55, envelope([(0, -0.8), (HIT, 0), (DUR, 0)]))
rumble = moving_filter(white(2), 'low', sweep_freq([(0, 80), (HIT, 400), (DUR, 120)]))
rumble *= envelope([(0, 0), (HIT, 1.0), (HIT + 0.3, 0.3), (HIT + 1.5, 0)])
out += pan(rumble * 0.6, 0)

# ── 2. 着弾：破裂音・低いキック・深く沈む低音 ──
crack = signal.lfilter(*signal.butter(2, 1500 / (SR / 2), 'high'), white(3))
crack *= np.exp(-np.clip(t - HIT, 0, None) * 60) * (t >= HIT)
out += pan(crack * 0.7, 0)

def pitched(f0, f1, dec, start, sat=2.5):
    tt = np.clip(t - start, 0, None)
    f = f1 + (f0 - f1) * np.exp(-tt * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt / dec) * (t >= start)
    return np.tanh(s * sat) / np.tanh(sat)

kick = pitched(140, 45, 0.18, HIT, 3)
sub = pitched(60, 27, 1.1, HIT, 1.8)
out += pan(kick * 0.6 + sub * 0.55, 0)

# ── 3. 炎の本体：左右別々に揺らぐ、乱れたうなり ──
roar_env = envelope([(0, 0), (HIT - 0.02, 0), (HIT + 0.08, 1.0), (HIT + 0.8, 0.75), (HIT + 2.6, 0.15), (DUR, 0)])
for ch, seed in ((0, 21), (1, 22)):
    body = moving_filter(white(seed), 'low', sweep_freq([(0, 3000), (HIT, 3000), (HIT + 0.4, 1600), (DUR, 500)]))
    mid = moving_filter(white(seed + 10), 'band', sweep_freq([(0, 500), (HIT + 0.3, 420), (DUR, 260)]), q=0.9)
    flick = turbulence(9, 0.55, seed + 30) * turbulence(23, 0.25, seed + 40)
    out[ch] += (body * 0.5 + mid * 0.55) * roar_env * flick

# ── 4. 前へ噴き出す炎：高い帯域が下へ落ち、左右に広がる ──
blast = moving_filter(white(5), 'band', sweep_freq([(HIT, 5000), (HIT + 1.2, 700), (DUR, 500)]), q=1.0)
blast *= envelope([(HIT, 0), (HIT + 0.04, 1), (HIT + 1.4, 0)]) * turbulence(18, 0.4, 51)
out += np.stack([blast, -blast * 0.6 + moving_filter(white(6), 'band', sweep_freq([(HIT, 4600), (HIT + 1.2, 650), (DUR, 500)]), q=1.0) * envelope([(HIT, 0), (HIT + 0.05, 1), (HIT + 1.4, 0)]) * 0.6]) * 0.32

# ── 5. 火の粉：まばらにはぜて、だんだん減る ──
pops = np.zeros((2, N))
for _ in range(140):
    st = HIT + 0.05 + rng.exponential(0.7)
    if st > DUR - 0.1:
        continue
    i = sec(st)
    L = rng.integers(60, 400)
    burst = rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 5))
    f = rng.uniform(2500, 7000)
    b, a = signal.butter(2, [f * 0.7 / (SR / 2), min(f * 1.4, SR / 2 - 100) / (SR / 2)], 'bandpass')
    burst = signal.lfilter(b, a, burst) * rng.uniform(0.2, 1.0) * np.exp(-(st - HIT) / 1.4)
    p = rng.uniform(-0.9, 0.9)
    pops[:, i:i + L] += pan(burst, p)[:, : min(L, N - i)]
out += pops * 0.9

# ── 6. 余韻：低い空気のうねり ──
tail = moving_filter(white(8), 'low', sweep_freq([(0, 200), (DUR, 90)]))
out += pan(tail * envelope([(HIT, 0), (HIT + 0.3, 0.35), (DUR, 0)]), 0)

# ── 7. 残響：高い音ほど早く消える、減衰するノイズで畳み込む ──
rl = int(SR * 2.4)
rt = np.arange(rl) / SR
ir = np.zeros((2, rl))
for ch in range(2):
    nz = np.random.default_rng(90 + ch).standard_normal(rl) * np.exp(-rt * 2.6)
    ir[ch] = moving_filter_ir = signal.lfilter(*signal.butter(1, 3500 / (SR / 2)), nz)
ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 40
wet = np.stack([signal.fftconvolve(out[c], ir[c])[:N] for c in range(2)])
mix = out + wet * 0.35

# ── 仕上げ：やわらかく潰して音量をそろえ、終わりを自然に消す ──
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= envelope([(0, 1), (DUR - 0.6, 1), (DUR, 0)])
mix /= np.abs(mix).max() / 0.89  # 約 -1 dBFS

dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
dest.mkdir(parents=True, exist_ok=True)
wav = dest / 'fire_blast.wav'
wavfile.write(wav, SR, (mix.T * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-b:a', '320k', str(dest / 'fire_blast.mp3')], check=True)
print('peak', float(np.abs(mix).max()), 'rms', float(np.sqrt((mix ** 2).mean())), '->', wav)
