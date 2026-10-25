"""時計が時を刻む音（チクタク音）を合成して WAV に書き出す。単体で動く（numpy / scipy のみ）。

音響設計（精密な歯車が噛み合う質感）
- 2種類の音を1秒ごとに交互に鳴らす
    Tick：約6200Hz の金属的な響き
    Tack：約4800Hz の、少し鈍い金属の響き
    （ハイパスを 4000Hz にするため、響きはどちらも 4000Hz より上に置く）
- エンベロープ：アタック 1ms 以下、ディケイ 5〜10ms（指数減衰）、サスティン 0
- 音源：高周波の正弦波と、ホワイトノイズの「摩擦音」をブレンド
    摩擦音は、細かな歯が次々に当たるように、極小の接触を 0.25〜0.45ms 間隔で 3 回連ねる（アタック 1ms 以内に収める）
- ハイパス（8次バターワース）で 4000Hz 以下をカットする
    HPF_ON_FRICTION_ONLY = True にすると、ハイパスを摩擦音だけにかけ、響きは元の高さ（2600Hz / 1650Hz）に戻る
- 最後に全体のピークを -3dBFS に合わせ、音割れを防ぐ

使い方:
    python3 clock_tick.py                 # clock_loop.wav（10秒、1秒ごとに Tick / Tack）
    python3 clock_tick.py 30 out.wav      # 長さ（秒）と出力先を指定
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
HPF_CUTOFF = 4000            # ハイパスの境目（Hz）
HPF_ON_FRICTION_ONLY = False  # True：ハイパスは摩擦音だけ。響きは元の低めの高さに戻す
PEAK = 10 ** (-3 / 20)       # 出力のピーク（-3dBFS）


def envelope(n, attack, decay):
    """アタック attack 秒で最大に達し、decay 秒の時定数で指数的に消える。サスティンなし"""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1 / SR), 0, 1)
    return a * np.exp(-np.clip(t - attack, 0, None) / decay)


def highpass(x, cutoff=HPF_CUTOFF):
    return signal.sosfilt(signal.butter(8, cutoff / (SR / 2), 'high', output='sos'), x)


def friction(n, decay, center, rng):
    """金属の鋭い摩擦音：細かな歯が次々に当たる極小の接触を 3 回、1ms 以内に連ねたノイズ"""
    t = np.arange(n) / SR
    contacts = np.zeros(n)
    at = 0.0
    for k in range(3):
        contacts += (0.55 ** k) * np.exp(-np.clip(t - at, 0, None) / 0.0007) * (t >= at)
        at += rng.uniform(0.00025, 0.00045)
    noise = rng.standard_normal(n)
    sos = signal.butter(2, [center * 0.75 / (SR / 2), min(center * 1.6, SR / 2 - 200) / (SR / 2)], 'bandpass', output='sos')
    noise = signal.sosfilt(sos, noise)
    x = noise * (contacts + envelope(n, 0.0002, decay) * 0.85)
    return highpass(x) / (np.abs(highpass(x)).max() + 1e-12)


def hit(freq, partials, friction_mix, attack, decay, friction_center, length=0.05, seed=0):
    """一打の音。

    freq           : 響きの中心の高さ（Hz）
    partials       : 正弦波の倍音 [(倍率, 音量, 減衰の倍率), ...]。整数倍からずらすと金属的になる
    friction_mix   : 摩擦音の割合（0〜1）。残りが正弦波の響き
    friction_center: 摩擦音の中心の高さ（Hz）
    """
    n = int(SR * length)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)

    ring = np.zeros(n)
    for ratio, gain, dmul in partials:
        ring += gain * np.sin(2 * np.pi * freq * ratio * t) * envelope(n, attack, decay * dmul)
    if not HPF_ON_FRICTION_ONLY:
        ring = highpass(ring)
    ring /= np.abs(ring).max() + 1e-12

    x = (1 - friction_mix) * ring + friction_mix * friction(n, decay * 0.7, friction_center, rng)
    # 音量の形を付け直す：中身（高さ・摩擦の質感）はそのまま、立ち上がりと減衰を指定どおりにそろえる
    #   ノイズの偶然で打音ごとにピークの位置や消え方がばらつくのを防ぐ
    amp = np.abs(signal.hilbert(x))
    amp = signal.sosfiltfilt(signal.butter(2, 2000 / (SR / 2), output='sos'), amp)
    x = x / np.maximum(amp, amp.max() * 0.02) * envelope(n, attack, decay)
    x = highpass(x)
    return x / (np.abs(x).max() + 1e-12)


def tick(seed=1):
    """Tick：高く鋭い金属。減衰 7ms"""
    f = 2600 if HPF_ON_FRICTION_ONLY else 6200
    return hit(f, [(1, 1.0, 1.0), (1.53, 0.5, 0.7), (2.17, 0.25, 0.5)],
               friction_mix=0.5, attack=0.0003, decay=0.007, friction_center=9000, seed=seed)


def tack(seed=2):
    """Tack：少し低く鈍い金属。摩擦音を多めに、減衰 6ms（Tick より少し詰まった音）"""
    f = 1650 if HPF_ON_FRICTION_ONLY else 4800
    return hit(f, [(1, 1.0, 1.0), (1.37, 0.35, 0.6)],
               friction_mix=0.55, attack=0.0003, decay=0.006, friction_center=6500, seed=seed)


def clock_loop(seconds=10.0, interval=1.0, tack_gain=0.85, start=0.05):
    """interval 秒ごとに Tick と Tack を交互に鳴らす（ステレオ。わずかに左右へ振る）"""
    n = int(SR * seconds)
    out = np.zeros((2, n))
    k = 0
    pos = start
    while pos < seconds:
        is_tick = k % 2 == 0
        x = tick(seed=10 + k) if is_tick else tack(seed=10 + k) * tack_gain
        i = int(pos * SR)
        m = min(len(x), n - i)
        ang = ((-0.1 if is_tick else 0.1) + 1) * np.pi / 4
        out[0, i:i + m] += x[:m] * np.cos(ang)
        out[1, i:i + m] += x[:m] * np.sin(ang)
        k += 1
        pos += interval
    return out


def normalize(x, peak=PEAK):
    """音割れを防ぐため、全体のピークを peak に合わせる"""
    m = np.abs(x).max()
    return x * (peak / m) if m > 0 else x


def write(path, x):
    wavfile.write(path, SR, (normalize(x).T * 32767).astype(np.int16))


if __name__ == '__main__':
    seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0
    path = sys.argv[2] if len(sys.argv) > 2 else 'clock_loop.wav'
    write(path, clock_loop(seconds))
    print(f'{path}: {seconds:.0f} 秒、1秒ごとに Tick / Tack')
