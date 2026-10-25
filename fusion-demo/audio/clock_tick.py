"""時計が時を刻む音（チクタク音）を合成して WAV に書き出す。単体で動く（numpy / scipy のみ）。

音響設計
- 2種類の音を1秒ごとに交互に鳴らす
    Tick：やや高め（約2600Hz）の金属的な響き
    Tack：やや低め（約1650Hz）の、木製寄りの鈍い響き
- エンベロープ：アタック 1ms 以下、ディケイ 10〜30ms（指数減衰）、サスティン 0
- 音源：ホワイトノイズ（目的の高さに細く絞る）と高周波の正弦波をブレンド
- 400Hz 以下は急峻なハイパス（8次バターワース）でカットする
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
LOW_CUT = 400          # これより下は不要な雑音としてカット
PEAK = 10 ** (-3 / 20)  # 出力のピーク（-3dBFS）


def envelope(n, attack, decay):
    """アタック attack 秒で最大に達し、decay 秒の時定数で指数的に消える。サスティンなし"""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1 / SR), 0, 1)
    return a * np.exp(-np.clip(t - attack, 0, None) / decay)


def hit(freq, partials, noise_mix, q, attack, decay, length=0.08, seed=0):
    """一打の音。

    freq      : 中心の高さ（Hz）
    partials  : 正弦波の倍音 [(倍率, 音量, 減衰の倍率), ...]。整数倍からずらすと金属的、少なく低めだと木製寄り
    noise_mix : ノイズの割合（0〜1）。残りが正弦波
    q         : ノイズを絞るバンドパスの鋭さ。高いほど音程感が出て「パン」という拍手っぽさが消える
    """
    n = int(SR * length)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)

    # 正弦波：倍音ごとに少しずつ早く消える
    tone = np.zeros(n)
    for ratio, gain, dmul in partials:
        tone += gain * np.sin(2 * np.pi * freq * ratio * t) * envelope(n, attack, decay * dmul)
    tone /= np.abs(tone).max() + 1e-12

    # ノイズ：目的の高さだけに細く絞る（幅広いノイズのままだと拍手の音になる）
    noise = rng.standard_normal(n)
    sos = signal.butter(2, [freq / (1 + 1 / q) / (SR / 2), min(freq * (1 + 1 / q), SR / 2 - 100) / (SR / 2)], 'bandpass', output='sos')
    noise = signal.sosfilt(sos, noise) * envelope(n, attack, decay * 0.6)
    noise /= np.abs(noise).max() + 1e-12

    x = (1 - noise_mix) * tone + noise_mix * noise
    # 低音域（400Hz 以下）を完全にカット
    x = signal.sosfilt(signal.butter(8, LOW_CUT / (SR / 2), 'high', output='sos'), x)
    return x / (np.abs(x).max() + 1e-12)


def tick(seed=1):
    """Tick：約2600Hz。整数倍からずらした倍音で金属的に、減衰 18ms"""
    return hit(2600, [(1, 1.0, 1.0), (2.41, 0.45, 0.6), (3.87, 0.2, 0.4)],
               noise_mix=0.35, q=6, attack=0.0005, decay=0.018, seed=seed)


def tack(seed=2):
    """Tack：約1650Hz。倍音を少なく、ノイズを多めにして木製寄りの鈍さに、減衰 12ms"""
    return hit(1650, [(1, 1.0, 1.0), (1.9, 0.25, 0.5)],
               noise_mix=0.5, q=4, attack=0.0003, decay=0.012, seed=seed)


def clock_loop(seconds=10.0, interval=1.0, tack_gain=0.8, start=0.05):
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
        pan = -0.1 if is_tick else 0.1
        ang = (pan + 1) * np.pi / 4
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
