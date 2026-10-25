"""効果音を合成するための部品（numpy / scipy）。

ブラウザの合成音が電子音に聞こえる原因だった「規則的な揺れ」「澄みすぎた正弦波」「残響の薄さ」を避けるため、
不規則な揺らぎ・時間とともに動くフィルター・共鳴・本物の逆再生・畳み込みの残響を使う。
"""
import pathlib
import subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000


class Sound:
    """ステレオの音の器。t はこの音の時間軸（秒）"""

    def __init__(self, dur, seed=0):
        self.dur = dur
        self.n = int(SR * dur)
        self.t = np.arange(self.n) / SR
        self.buf = np.zeros((2, self.n))
        self.rng = np.random.default_rng(seed)
        self._seed = seed * 1000

    # ── 素材 ──
    def white(self):
        self._seed += 1
        return np.random.default_rng(self._seed).standard_normal(self.n)

    def env(self, points):
        """[(秒, 値), ...] を折れ線でつないだ形"""
        xs, ys = zip(*points)
        return np.interp(self.t, xs, ys)

    def curve(self, points):
        """周波数などを、対数でなめらかにつないだ形"""
        xs, ys = zip(*points)
        return np.exp(np.interp(self.t, xs, np.log(ys)))

    def turb(self, rate, depth):
        """不規則な揺らぎ（1 を中心に ±depth）"""
        self._seed += 1
        r = np.random.default_rng(self._seed)
        k = int(self.dur * rate) + 4
        x = np.interp(self.t * rate, np.arange(k), r.standard_normal(k))
        b, a = signal.butter(2, min(rate / (SR / 2), 0.99))
        x = signal.lfilter(b, a, x)
        return 1 + depth * x / (np.abs(x).max() + 1e-9)

    def after(self, start, decay):
        """start 秒から指数で減っていく形"""
        tt = np.clip(self.t - start, 0, None)
        return np.exp(-tt / decay) * (self.t >= start)

    # ── 加工 ──
    def filt(self, x, kind, freqs, q=0.7, block=256):
        """時間とともに周波数が動くフィルター。freqs は数値か配列"""
        freqs = np.broadcast_to(np.asarray(freqs, float), x.shape)
        y = np.zeros_like(x)
        zi = None
        for i in range(0, len(x), block):
            f = float(np.clip(freqs[i], 25, SR / 2 - 800))
            if kind == 'band':
                bw = f / q
                lo, hi = max(20, f - bw / 2), min(SR / 2 - 200, f + bw / 2)
                b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'bandpass')
            elif kind == 'peak':
                b, a = signal.iirpeak(f / (SR / 2), q)
            else:
                b, a = signal.butter(2, f / (SR / 2), 'low' if kind == 'low' else 'high')
            if zi is None or len(zi) != max(len(a), len(b)) - 1:
                zi = np.zeros(max(len(a), len(b)) - 1)
            y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
        return y

    def osc(self, freqs, shape='sine', phase=0.0):
        """周波数の配列から発振。shape: sine / saw / tri"""
        ph = 2 * np.pi * np.cumsum(np.broadcast_to(np.asarray(freqs, float), self.t.shape)) / SR + phase
        if shape == 'sine':
            return np.sin(ph)
        if shape == 'saw':
            return 2 * ((ph / (2 * np.pi)) % 1) - 1
        return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1

    # ── 置く ──
    def add(self, mono, gain=1.0, pan=0.0):
        """等パワーで左右に振って足す。pan は数値か配列（-1 左 〜 +1 右）"""
        ang = (np.asarray(pan) + 1) * np.pi / 4
        self.buf[0] += mono * gain * np.cos(ang)
        self.buf[1] += mono * gain * np.sin(ang)

    def add_stereo(self, left, right, gain=1.0):
        self.buf[0] += left * gain
        self.buf[1] += right * gain

    def place(self, snippet, start, gain=1.0, pan=0.0):
        """短い音（モノラル配列）を start 秒の位置に置く"""
        i = int(start * SR)
        if i >= self.n:
            return
        k = min(len(snippet), self.n - i)
        ang = (pan + 1) * np.pi / 4
        self.buf[0, i:i + k] += snippet[:k] * gain * np.cos(ang)
        self.buf[1, i:i + k] += snippet[:k] * gain * np.sin(ang)

    # ── よく使う音 ──
    def thump(self, start, f0, f1, decay, sat=2.0, gain=1.0):
        """音程が急に落ちる低い打撃（キック、サブベース）"""
        tt = np.clip(self.t - start, 0, None)
        f = f1 + (f0 - f1) * np.exp(-tt * 7)
        s = self.osc(f) * self.after(start, decay)
        self.add(np.tanh(s * sat) / np.tanh(sat), gain)

    def burst(self, start, decay, kind, f, q=0.7, gain=1.0, pan=0.0):
        """ノイズの一撃（破裂音、衝撃の芯）"""
        x = self.filt(self.white(), kind, f, q) * self.after(start, decay)
        self.add(x, gain, pan)

    def resonate(self, start, freqs, decay, gain=1.0, pan=0.0, q=40):
        """一瞬の打撃を細い共鳴に通す（金属・木・ガラスの「物」の響き）。鐘のように長くは鳴らさない"""
        L = int(SR * (decay * 5 + 0.05))
        hit = self.rng.standard_normal(L) * np.exp(-np.arange(L) / (SR * 0.002))
        out = np.zeros(L)
        for i, f in enumerate(freqs):
            b, a = signal.iirpeak(min(f, SR / 2 - 1000) / (SR / 2), q)
            out += signal.lfilter(b, a, hit) * np.exp(-np.arange(L) / (SR * decay * (1 - 0.08 * i))) / (1 + i * 0.4)
        self.place(out / (np.abs(out).max() + 1e-9), start, gain, pan)

    def bubble(self, start, f0, rise, decay, gain=1.0, pan=0.0):
        """泡の音：音程が少し上がりながら消える短い正弦波（実際の泡の鳴り方）"""
        L = int(SR * decay * 6)
        tt = np.arange(L) / SR
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + rise * tt)) / SR) * np.exp(-tt / decay)
        self.place(s, start, gain, pan)

    def reverse_swell(self, end, length, kind, f, gain=1.0):
        """本物の逆再生：減衰する音を作って裏返し、end 秒で終わるように置く"""
        L = int(SR * length)
        x = self.rng.standard_normal(L) * np.exp(-np.arange(L) / (SR * length / 4))
        b, a = signal.butter(2, f / (SR / 2), kind) if kind != 'band' else signal.butter(2, [f * 0.6 / (SR / 2), f * 1.6 / (SR / 2)], 'bandpass')
        x = signal.lfilter(b, a, x)[::-1]
        self.place(x / (np.abs(x).max() + 1e-9), max(0, end - length), gain)

    # ── 仕上げ ──
    def reverb(self, length=2.4, mix=0.3, bright=3500, decay=2.6, predelay=0.012):
        """高い音ほど早く消える、減衰するノイズで畳み込む"""
        L = int(SR * length)
        rt = np.arange(L) / SR
        wet = np.zeros_like(self.buf)
        for c in range(2):
            ir = np.random.default_rng(900 + c).standard_normal(L) * np.exp(-rt * decay)
            ir = signal.lfilter(*signal.butter(1, bright / (SR / 2)), ir)
            ir = np.concatenate([np.zeros(int(SR * predelay)), ir])
            ir /= np.sqrt((ir ** 2).sum())
            wet[c] = signal.fftconvolve(self.buf[c], ir)[: self.n]
        self.buf = self.buf + wet * mix

    def echo(self, time, feedback, mix, pingpong=True):
        """こだま（左右に交互に返す）"""
        d = int(SR * time)
        out = self.buf.copy()
        src = self.buf.copy()
        g = mix
        for k in range(1, 8):
            shift = d * k
            if shift >= self.n:
                break
            ch = (k % 2) if pingpong else None
            piece = (src[0] + src[1]) / 2 * g
            if ch is None:
                out[:, shift:] += np.stack([piece[: self.n - shift]] * 2)
            else:
                out[ch, shift:] += piece[: self.n - shift]
            g *= feedback
        self.buf = out

    def finish(self, path, peak=0.89, drive=1.2, fade=0.3):
        """やわらかく潰して音量をそろえ、WAV と MP3 に書き出す"""
        x = np.tanh(self.buf * drive) / np.tanh(drive)
        f = int(SR * min(fade, self.dur / 3))
        x[:, -f:] *= np.linspace(1, 0, f)
        m = np.abs(x).max()
        if m > 0:
            x *= peak / m
        path = pathlib.Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        wavfile.write(path.with_suffix('.wav'), SR, (x.T * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path.with_suffix('.wav')), '-b:a', '256k', str(path.with_suffix('.mp3'))], check=True)
        return float(np.sqrt((x ** 2).mean()))
