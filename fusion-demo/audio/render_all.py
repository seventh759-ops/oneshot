"""演出の効果音をまとめて書き出す（共通の演出音 11 種 ＋ 属性 16 系統）。

使い方: python3 fusion-demo/audio/render_all.py [出力先フォルダ]
炎の属性音は render_fire.py の fire_blast を使う。
"""
import sys
import shutil
import pathlib
import subprocess
import numpy as np
from sfx import Sound, SR

DEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent)
SOUNDS = {}


def sound(name):
    def deco(fn):
        SOUNDS[name] = fn
        return fn
    return deco


# ════════ 共通の演出音 ════════

@sound('common/drone')
def drone():
    """暗転と静寂：空気が止まるような、低く不穏な持続音"""
    s = Sound(3.0, 1)
    body = s.filt(s.white(), 'low', 140) * s.turb(0.7, 0.4)
    s.add_stereo(body, s.filt(s.white(), 'low', 150) * s.turb(0.6, 0.4), 0.9)
    for f, p in ((48, -0.4), (48.7, 0.4), (72.3, 0)):
        s.add(s.filt(s.osc(f, 'saw'), 'low', 220) * s.turb(0.3, 0.3), 0.12, p)
    s.buf *= s.env([(0, 0), (0.6, 1), (2.4, 1), (3.0, 0)])
    s.reverb(3.0, 0.4, 2000)
    return s


@sound('common/tick')
def tick():
    """決め台詞の文字送り：小さく乾いた音"""
    s = Sound(0.08, 2)
    s.resonate(0.0, [3200, 5100], 0.006, 1.0, 0, q=12)
    s.burst(0.0, 0.002, 'high', 4000, gain=0.5)
    return s


@sound('common/charge')
def charge():
    """溜め：吸い込まれるように高まっていく"""
    s = Sound(1.4, 3)
    up = s.filt(s.white(), 'band', s.curve([(0, 220), (1.2, 6000), (1.4, 6000)]), q=1.4)
    s.add(up * s.env([(0, 0), (1.15, 1), (1.22, 0)]) * s.turb(12, 0.25), 0.9, s.env([(0, -0.6), (1.2, 0)]))
    s.reverse_swell(1.22, 1.0, 'low', 900, 0.7)
    s.add(s.osc(s.curve([(0, 40), (1.2, 80)])) * s.env([(0, 0), (1.2, 0.4), (1.22, 0)]), 0.6)
    s.reverb(1.6, 0.25)
    return s


@sound('common/name')
def name():
    """技名を叫ぶ：ルビが広がる風切りと、漢字が叩きつけられる衝撃"""
    s = Sound(1.8, 4)
    sw = s.filt(s.white(), 'band', s.curve([(0, 800), (0.35, 5000), (1.8, 5000)]), q=1.2)
    s.add(sw * s.env([(0, 0), (0.3, 0.8), (0.4, 0)]), 0.6, s.env([(0, -0.8), (0.4, 0.8)]))
    hit = 0.38
    s.burst(hit, 0.03, 'high', 1800, gain=0.9)
    s.thump(hit, 150, 45, 0.22, 3, 0.8)
    s.thump(hit, 65, 30, 0.9, 1.6, 0.55)
    s.burst(hit, 0.35, 'low', 700, gain=0.7)
    s.reverb(2.2, 0.35, 3000)
    return s


@sound('common/true_name')
def true_name():
    """真名解放：刃を抜くようにシャッと駆け上がり、鋭く高い「キィン」が響く"""
    s = Sound(2.6, 5)
    hit = 0.22
    # 抜く：高い方へ一気に駆け上がる
    up = s.filt(s.white(), 'band', s.curve([(0, 2500), (hit, 9500), (2.6, 9500)]), q=2.5)
    s.add(up * s.env([(0, 0), (hit - 0.02, 0.9), (hit, 0)]), 0.6, s.env([(0, -0.6), (hit, 0)]))
    # キィン：鋭い立ち上がりの、高く澄んだ響き（わずかにうねらせる）
    s.burst(hit, 0.002, 'high', 7000, gain=0.7)
    base = 1760
    for k, (r, g, d) in enumerate(((1, 1, 1.3), (2.32, 0.55, 0.9), (3.9, 0.3, 0.6), (5.6, 0.15, 0.35))):
        beat = 1 + 0.25 * np.sin(2 * np.pi * (2.3 + k * 1.1) * s.t)
        s.add(s.osc(base * r) * s.after(hit, d) * beat, 0.16 * g, (-1) ** k * 0.25)
    # 細いきらめき
    s.add(s.filt(s.white(), 'high', 9000) * s.env([(hit, 0), (hit + 0.05, 0.12), (2.2, 0)]) * s.turb(9, 0.6), 1.0)
    s.reverb(2.4, 0.4, 9000, 2.2, 0.02)
    return s


@sound('common/strike')
def strike():
    """放つ：刃が空気を裂く鋭さと、腹に響く重い衝撃。金属が鳴り続ける音は入れない"""
    s = Sound(2.6, 6)
    slice_ = s.filt(s.white(), 'band', s.curve([(0, 9000), (0.12, 1800), (2.6, 1800)]), q=1.3)
    s.add(slice_ * s.env([(0, 0), (0.008, 1), (0.16, 0)]), 0.9, s.env([(0, -0.7), (0.16, 0.7)]))
    s.burst(0.0, 0.01, 'high', 5000, gain=0.9)
    s.thump(0.0, 160, 42, 0.2, 3, 0.9)
    s.thump(0.0, 55, 24, 1.5, 1.8, 0.75)
    s.burst(0.0, 0.5, 'low', 450, gain=0.9)
    rumble = s.filt(s.white(), 'low', s.curve([(0, 200), (2.6, 60)])) * s.env([(0, 0), (0.15, 0.5), (2.6, 0)]) * s.turb(2, 0.4)
    s.add(rumble, 0.8)
    s.reverb(2.6, 0.38, 2800)
    return s


@sound('common/win')
def win():
    """撃破：静かに。遠くで一度だけ鳴る低い音と、深い残響"""
    s = Sound(3.4, 7)
    s.thump(0.0, 70, 40, 0.9, 1.2, 0.4)
    s.burst(0.0, 1.2, 'low', 260, gain=0.45)
    air = s.filt(s.white(), 'band', 600, q=0.8) * s.env([(0, 0), (0.4, 0.12), (3.0, 0)]) * s.turb(1.5, 0.5)
    s.add(air, 1.0)
    s.reverb(3.4, 0.6, 1800, 1.8, 0.04)
    return s


@sound('common/perfect')
def perfect():
    """極：逆再生の膨らみから、深い低音と銅鑼。きらめく空気が降る"""
    s = Sound(5.5, 8)
    hit = 0.9
    s.reverse_swell(hit, 0.9, 'high', 2500, 0.6)
    s.thump(hit, 70, 26, 2.2, 1.6, 0.7)
    s.burst(hit, 0.02, 'high', 2500, gain=0.6)
    # 銅鑼：たくさんの不揃いな共鳴が、ゆっくりうねりながら消える
    for k, r in enumerate((1, 1.52, 1.97, 2.41, 2.94, 3.5, 4.13, 4.87, 5.66, 6.5)):
        f = 78 * r
        wob = 1 + 0.4 * np.sin(2 * np.pi * (0.4 + k * 0.17) * s.t + k)
        s.add(s.osc(f * (1 + 0.004 * np.sin(2 * np.pi * 0.3 * s.t))) * s.after(hit, 3.5 - k * 0.22) * wob, 0.07 / (1 + k * 0.25), (k % 3 - 1) * 0.35)
    shim = s.filt(s.white(), 'high', 6500) * s.env([(hit, 0), (hit + 1.2, 0.09), (5.5, 0)]) * s.turb(7, 0.6)
    s.add_stereo(shim, s.filt(s.white(), 'high', 6500) * s.env([(hit, 0), (hit + 1.2, 0.09), (5.5, 0)]) * s.turb(7, 0.6))
    s.reverb(4.0, 0.5, 4000, 1.6, 0.03)
    return s


@sound('common/death')
def death():
    """死亡：重く沈む金管の「ブォーン」と、不協和の残り香"""
    s = Sound(3.6, 9)
    shape = s.env([(0, 0), (0.06, 1), (1.2, 0.8), (3.4, 0)])
    for f, g in ((55, 1), (58.3, 0.7), (82.4, 0.6), (110, 0.35), (116.5, 0.25)):
        for det in (-0.6, 0, 0.6):
            s.add(s.osc(f + det, 'saw'), 0.06 * g)
    s.buf = np.stack([s.filt(s.buf[c], 'low', s.curve([(0, 300), (0.08, 1100), (3.6, 200)])) for c in range(2)]) * shape
    s.buf = np.tanh(s.buf * 2.5) / 2
    s.thump(0.0, 48, 28, 1.8, 1.5, 0.6)
    s.reverb(3.2, 0.4, 1800)
    return s


@sound('common/rewind')
def rewind():
    """戦いの前に戻る：時間が巻き戻るような、逆向きのきらめき"""
    s = Sound(1.6, 10)
    for i in range(14):
        st = 0.05 + i * 0.08
        s.resonate(st, [2000 + i * 260, 3100 + i * 300], 0.05, 0.25, (i % 2) * 0.8 - 0.4, q=25)
    s.buf = s.buf[:, ::-1].copy()
    s.reverse_swell(1.35, 1.2, 'band', 1800, 0.6)
    s.reverb(1.8, 0.4, 5000)
    return s


@sound('common/click')
def click():
    """操作音：小さく上品なクリック"""
    s = Sound(0.12, 11)
    s.resonate(0.0, [1900, 3300], 0.01, 1.0, 0, q=10)
    s.thump(0.0, 400, 200, 0.012, 1, 0.3)
    return s


# ════════ 属性ごとの音 ════════

@sound('element/ice')
def ice():
    """氷：ミシミシと凍りつき、パリンと砕けて、細かな破片が散る"""
    s = Sound(2.6, 21)
    # 凍る：ミシミシと軋む（摩擦で引っかかる不規則な音）
    creak = s.filt(s.white(), 'band', s.curve([(0, 500), (0.7, 1500), (2.6, 1500)]), q=4)
    stick = (s.turb(40, 1.0) > 1.15).astype(float)
    s.add(creak * stick * s.env([(0, 0), (0.6, 0.8), (0.72, 0)]), 0.9, -0.2)
    for i in range(7):
        s.resonate(0.08 + (i / 7) ** 0.7 * 0.6, [1800 + s.rng.uniform(0, 2500)], 0.012, 0.35, s.rng.uniform(-0.6, 0.6), q=18)
    # 砕ける
    hit = 0.75
    s.burst(hit, 0.06, 'high', 2500, gain=1.0)
    s.burst(hit, 0.25, 'band', 3500, q=0.8, gain=0.6)
    s.thump(hit, 120, 60, 0.12, 2, 0.4)
    for i in range(30):
        st = hit + 0.02 + s.rng.exponential(0.25)
        s.resonate(st, [s.rng.uniform(3000, 9000), s.rng.uniform(4000, 11000)], s.rng.uniform(0.01, 0.04), s.rng.uniform(0.05, 0.25) * np.exp(-(st - hit) * 2), s.rng.uniform(-0.9, 0.9), q=30)
    s.reverb(2.2, 0.35, 7000)
    return s


@sound('element/thunder')
def thunder():
    """雷：バチッと鋭く放電し、ジジジと空気が焦げ、雷鳴が転がっていく"""
    s = Sound(4.0, 22)
    s.burst(0.0, 0.004, 'high', 800, gain=1.0)
    s.burst(0.0, 0.05, 'band', 2500, q=0.6, gain=0.9)
    sizzle = s.filt(s.white(), 'band', 4500, q=1.5) * np.clip(s.turb(60, 1.2), 0, None)
    s.add(sizzle * s.env([(0, 1), (0.5, 0.4), (0.9, 0)]), 0.35, 0.2)
    for st, g, p in ((0.25, 1.0, -0.3), (0.7, 0.7, 0.4), (1.3, 0.5, -0.1)):
        roll = s.filt(s.white(), 'low', s.curve([(0, 600), (st, 600), (st + 2.2, 80), (4.0, 70)])) * s.after(st, 0.9) * s.turb(4, 0.6)
        s.add(roll, g * 1.1, p)
    s.thump(0.25, 60, 30, 1.2, 1.5, 0.45)
    s.reverb(3.0, 0.45, 2500)
    return s


@sound('element/water')
def water():
    """水：ザバッと跳ね、泡がいくつも昇り、流れが残る"""
    s = Sound(2.8, 23)
    s.burst(0.0, 0.18, 'band', 1400, q=0.6, gain=1.0)
    spray = s.filt(s.white(), 'high', 4000) * s.after(0.02, 0.35) * s.turb(30, 0.5)
    s.add_stereo(spray, s.filt(s.white(), 'high', 4000) * s.after(0.02, 0.35) * s.turb(30, 0.5), 0.5)
    s.thump(0.0, 110, 55, 0.15, 1.5, 0.5)
    for _ in range(26):
        st = 0.1 + s.rng.exponential(0.5)
        s.bubble(st, s.rng.uniform(500, 1600), s.rng.uniform(0.5, 2.0), s.rng.uniform(0.01, 0.03), s.rng.uniform(0.06, 0.2), s.rng.uniform(-0.8, 0.8))
    flow = s.filt(s.white(), 'band', s.curve([(0, 900), (2.8, 500)]) * s.turb(1.2, 0.3), q=0.9) * s.env([(0, 0), (0.3, 0.35), (2.6, 0)]) * s.turb(3, 0.5)
    s.add_stereo(flow, s.filt(s.white(), 'band', 700, q=0.9) * s.env([(0, 0), (0.3, 0.35), (2.6, 0)]) * s.turb(3, 0.5))
    s.reverb(2.0, 0.3, 4500)
    return s


@sound('element/wind')
def wind():
    """風：左から右へ、うなりを上げて突風が吹き抜ける（口笛のような音は入れない）"""
    s = Sound(2.4, 24)
    for k in range(3):
        f = s.curve([(0, 300 + k * 150), (0.6, 1600 + k * 500), (1.6, 500 + k * 100), (2.4, 400)]) * s.turb(2, 0.2)
        g = s.filt(s.white(), 'band', f, q=1.6 + k * 0.4) * s.env([(0, 0), (0.5, 1), (1.7, 0.2), (2.3, 0)]) * s.turb(5 + k, 0.45)
        s.add(g, 0.7 / (k + 1), s.env([(0, -0.95), (1.6, 0.95)]) * (1 - k * 0.2))
    body = s.filt(s.white(), 'low', 250) * s.env([(0, 0), (0.6, 0.6), (2.0, 0)]) * s.turb(3, 0.4)
    s.add(body, 0.9)
    s.reverb(2.0, 0.25, 3000)
    return s


@sound('element/earth')
def earth():
    """土：地面が割れてゴリゴリとせり上がり、ドンと砕けて破片が降る（弾む音程の音は入れない）"""
    s = Sound(3.2, 25)
    up = 0.95
    grind = s.filt(s.white(), 'band', s.curve([(0, 200), (up, 600), (3.2, 600)]), q=1.5) * np.clip(s.turb(26, 0.9), 0.1, None) * s.turb(9, 0.4)
    s.add(grind * s.env([(0, 0), (up, 1), (up + 0.05, 0)]), 1.0)
    rumble = s.filt(s.white(), 'low', s.curve([(0, 60), (up, 350), (3.2, 80)]))
    s.add(rumble * s.env([(0, 0), (up, 1.6), (up + 0.4, 0.5), (3.0, 0)]), 1.0)
    s.burst(up, 0.3, 'band', 600, q=0.7, gain=1.0)
    s.burst(up, 0.9, 'low', 300, gain=1.2)
    s.burst(up, 0.02, 'high', 2000, gain=0.5)
    for i in range(5):
        st = up + 0.3 + i * 0.22 + s.rng.uniform(0, 0.1)
        s.burst(st, 0.12, 'low', 320, gain=0.6 * (1 - i * 0.12), pan=s.rng.uniform(-0.6, 0.6))
    gravel = s.filt(s.white(), 'band', 1200, q=0.8) * np.clip(s.turb(35, 1.0) - 1.2, 0, None) * s.env([(up, 0), (up + 0.2, 0.8), (2.6, 0)])
    s.add(gravel, 0.6, 0.3)
    s.reverb(2.4, 0.3, 2200)
    return s


@sound('element/light')
def light():
    """光：高い響きがふわっと満ち、澄んだ空気がきらめきながら広がる"""
    s = Sound(3.2, 26)
    for k, f in enumerate((1046.5, 1318.5, 1568, 2093, 2637, 3136)):
        wob = s.turb(0.8 + k * 0.3, 0.5)
        s.add(s.osc(f * (1 + 0.003 * np.sin(2 * np.pi * (4 + k) * s.t))) * s.env([(0, 0), (0.5 + k * 0.08, 1), (3.0, 0)]) * wob, 0.045 / (1 + k * 0.3), (k % 2) * 0.8 - 0.4)
    air = s.filt(s.white(), 'band', s.curve([(0, 3000), (3.2, 8000)]), q=0.8) * s.env([(0, 0), (0.6, 0.25), (3.0, 0)]) * s.turb(6, 0.6)
    s.add_stereo(air, s.filt(s.white(), 'band', 6000, q=0.8) * s.env([(0, 0), (0.6, 0.25), (3.0, 0)]) * s.turb(6, 0.6))
    s.reverse_swell(0.5, 0.5, 'high', 5000, 0.3)
    s.reverb(3.2, 0.55, 8000, 1.6, 0.03)
    return s


@sound('element/dark')
def dark():
    """闇：本物の逆再生で吸い込まれ、ぷつりと途切れ、濁った低音とささやきが残る"""
    s = Sound(3.2, 27)
    cut = 0.7
    s.reverse_swell(cut, 0.7, 'low', 3000, 1.0)
    s.add(s.osc(36) * s.after(cut, 1.4), 0.6)
    for f, p in ((55, -0.5), (58.3, 0.5), (77.8, 0)):
        s.add(s.filt(s.osc(f, 'saw'), 'low', 260) * s.after(cut, 1.6) * s.turb(0.6, 0.4), 0.18, p)
    for fc, p in ((700, -0.7), (1150, 0.7), (2400, 0)):
        wh = s.filt(s.white(), 'band', fc * s.turb(2, 0.15), q=6) * s.env([(cut, 0), (cut + 0.4, 0.5), (3.0, 0)]) * s.turb(4, 0.7)
        s.add(wh, 0.6, p)
    s.reverb(3.0, 0.45, 1500)
    return s


@sound('element/poison')
def poison():
    """毒：ゴボゴボと低く泡立ち、ジュウッと何かが溶ける"""
    s = Sound(2.6, 28)
    for _ in range(40):
        st = s.rng.uniform(0, 2.0)
        s.bubble(st, s.rng.uniform(140, 420), s.rng.uniform(0.8, 3.0), s.rng.uniform(0.02, 0.05), s.rng.uniform(0.1, 0.3), s.rng.uniform(-0.6, 0.6))
    sizzle = s.filt(s.white(), 'high', 5000) * s.turb(45, 0.6) * s.env([(0, 0), (0.3, 0.5), (2.2, 0)])
    s.add_stereo(sizzle, s.filt(s.white(), 'high', 5200) * s.turb(45, 0.6) * s.env([(0, 0), (0.3, 0.5), (2.2, 0)]), 0.5)
    s.add(s.filt(s.white(), 'low', 180) * s.env([(0, 0), (0.4, 0.6), (2.4, 0)]) * s.turb(2, 0.5), 0.8)
    s.reverb(1.8, 0.25, 3000)
    return s


@sound('element/sound')
def sound_el():
    """音：衝撃波がドンと抜け、共鳴が上へ滑り、こだまが左右に返る"""
    s = Sound(3.0, 29)
    s.burst(0.0, 0.25, 'low', 500, gain=1.0)
    s.thump(0.0, 120, 50, 0.3, 2, 0.5)
    ring = s.osc(s.curve([(0, 380), (1.0, 1500), (3.0, 1500)])) * s.env([(0, 0), (0.05, 1), (1.2, 0)])
    ring += 0.5 * s.osc(s.curve([(0, 570), (1.0, 2250), (3.0, 2250)])) * s.env([(0, 0), (0.08, 1), (1.1, 0)])
    s.add(s.filt(ring, 'band', 1200, q=0.5), 0.25)
    whoosh = s.filt(s.white(), 'band', s.curve([(0, 2000), (0.6, 400), (3.0, 400)]), q=1) * s.env([(0, 0), (0.05, 0.8), (0.7, 0)])
    s.add(whoosh, 0.5)
    s.echo(0.19, 0.5, 0.55)
    s.reverb(2.4, 0.3, 4000)
    return s


@sound('element/time')
def time_el():
    """刻：コチ、コチと時計が刻み、止まった一瞬のあと、時間が巻き戻るうなりが走る"""
    s = Sound(3.0, 30)
    for i in range(6):
        st = i * 0.17
        s.resonate(st, [2400, 3900, 6100], 0.012, 0.8 if i % 2 == 0 else 0.55, 0.25 if i % 2 else -0.25, q=20)
        s.burst(st, 0.0015, 'high', 6000, gain=0.4)
    stop = 1.2
    s.reverse_swell(stop + 0.85, 0.85, 'band', 1200, 0.9)
    rev = s.filt(s.white(), 'band', s.curve([(0, 4000), (stop, 4000), (stop + 0.85, 250), (3.0, 250)]), q=2) * s.env([(stop, 0), (stop + 0.84, 0.8), (stop + 0.86, 0)])
    s.add(rev, 0.6)
    s.thump(stop + 0.86, 90, 45, 0.4, 1.5, 0.5)
    s.reverb(2.2, 0.35, 4000)
    return s


@sound('element/life')
def life():
    """命：木がコロコロと鳴り、葉ずれがさやさやと揺れ、あたたかく芽吹く"""
    s = Sound(2.8, 31)
    for i, f in enumerate((523, 587, 659, 784, 880, 1046)):
        s.resonate(i * 0.09 + s.rng.uniform(0, 0.03), [f, f * 2.76, f * 5.4], 0.06, 0.5, (i - 2.5) * 0.25, q=25)
    for k in range(2):
        rustle = s.filt(s.white(), 'band', 5000 + k * 1500, q=0.7) * np.clip(s.turb(30, 1.0) - 0.8, 0, None) * s.env([(0, 0), (0.4, 0.8), (2.4, 0)])
        s.add(rustle, 0.4, -0.5 + k)
    for f in (261.6, 329.6, 392):
        s.add(s.filt(s.osc(f, 'saw'), 'low', 900) * s.env([(0, 0), (0.6, 1), (2.6, 0)]) * s.turb(0.8, 0.3), 0.03)
    s.reverb(2.6, 0.45, 5000)
    return s


@sound('element/steel')
def steel():
    """鋼：刃と刃がガキッと打ち合い、もう一度カキンと弾き、シャリッと擦れる（ベルのように鳴らさない）"""
    s = Sound(1.6, 32)
    s.resonate(0.0, [1240, 1873, 2650, 3410, 4870, 6230], 0.07, 1.0, -0.2, q=45)
    s.burst(0.0, 0.006, 'high', 3000, gain=0.8)
    s.thump(0.0, 220, 110, 0.06, 2, 0.4)
    s.resonate(0.14, [980, 1510, 2210, 2980, 4100], 0.05, 0.7, 0.3, q=45)
    s.burst(0.14, 0.005, 'high', 3500, gain=0.5, pan=0.3)
    scrape = s.filt(s.white(), 'band', s.curve([(0, 1800), (0.22, 1800), (0.6, 7000), (1.6, 7000)]) * s.turb(40, 0.15), q=6)
    s.add(scrape * s.env([(0.22, 0), (0.26, 0.8), (0.6, 0)]), 0.7, s.env([(0.2, -0.4), (0.6, 0.5)]))
    s.reverb(1.6, 0.25, 6000)
    return s


@sound('element/star')
def star():
    """星：ゴォォと空を裂いて迫り、ズドンと大地に落ちる。重い地鳴りの上に、かすかなきらめき"""
    s = Sound(4.2, 33)
    hit = 1.1
    roar = s.filt(s.white(), 'low', s.curve([(0, 150), (hit, 2500), (4.2, 300)])) * s.env([(0, 0), (hit - 0.05, 1.3), (hit + 0.05, 0)]) * s.turb(10, 0.3)
    s.add(roar, 0.8, s.env([(0, 0.8), (hit, 0)]))
    fall = s.filt(s.white(), 'band', s.curve([(0, 3500), (hit, 500), (4.2, 500)]), q=4) * s.env([(0, 0), (hit, 0.5), (hit + 0.02, 0)])
    s.add(fall, 0.35)
    s.burst(hit, 0.02, 'high', 2500, gain=0.8)
    s.thump(hit, 90, 22, 2.2, 1.8, 0.8)
    s.burst(hit, 0.6, 'low', 1400, gain=0.9)
    for i in range(4):
        s.burst(hit + 0.3 + i * 0.25 + s.rng.uniform(0, 0.1), 0.15, 'low', 300, gain=0.5 * (1 - i * 0.15), pan=s.rng.uniform(-0.6, 0.6))
    tail = s.filt(s.white(), 'low', 130) * s.env([(hit, 0), (hit + 0.3, 0.9), (4.2, 0)]) * s.turb(2, 0.4)
    s.add(tail, 0.9)
    for _ in range(8):
        st = hit + 0.6 + s.rng.uniform(0, 1.6)
        s.resonate(st, [s.rng.uniform(4000, 8000)], 0.05, 0.08, s.rng.uniform(-0.9, 0.9), q=40)
    s.reverb(3.0, 0.4, 3000)
    return s


@sound('element/illusion')
def illusion():
    """幻：わずかにずれた響きが揺らぎ、こだまが重なって、出どころがわからなくなる"""
    s = Sound(3.4, 34)
    for f, p in ((880, -0.9), (887, 0.9), (1318, -0.5), (1327, 0.5), (659, 0)):
        vib = 1 + 0.006 * np.sin(2 * np.pi * s.rng.uniform(4, 7) * s.t)
        trem = 1 + 0.5 * np.sin(2 * np.pi * s.rng.uniform(3, 6) * s.t)
        s.add(s.osc(f * vib) * s.env([(0, 0), (0.6, 1), (2.6, 0)]) * trem, 0.06, p)
    s.reverse_swell(0.6, 0.6, 'band', 2500, 0.4)
    s.echo(0.23, 0.55, 0.6)
    s.reverb(3.0, 0.55, 6000)
    return s


@sound('element/blood')
def blood():
    """血：ドクン、ドクンと重い鼓動が二度ずつ。湿った音と、低い脈動"""
    s = Sound(2.6, 35)
    for st, g in ((0.0, 1.0), (0.26, 0.7), (1.0, 0.9), (1.26, 0.6)):
        s.thump(st, 75, 38, 0.12, 2.5, g)
        s.burst(st, 0.06, 'low', 220, gain=g * 0.8)
    wet = s.filt(s.white(), 'band', s.curve([(0, 1200), (0.7, 1200), (0.9, 400), (2.6, 400)]), q=3) * s.env([(0.55, 0), (0.6, 0.6), (0.85, 0)]) * s.turb(25, 0.6)
    s.add(wet, 0.5, 0.2)
    s.add(s.filt(s.osc(41, 'saw'), 'low', 120) * s.env([(0, 0), (0.6, 1), (2.4, 0)]), 0.12)
    s.reverb(2.0, 0.3, 2500)
    return s


if __name__ == '__main__':
    only = sys.argv[2:] or None
    for name, fn in SOUNDS.items():
        if only and name not in only:
            continue
        # 静かにしたい音は、最大音量を控えめに書き出す
        quiet = {'common/win': 0.5, 'common/tick': 0.4, 'common/click': 0.4, 'common/drone': 0.55, 'common/true_name': 0.7}
        rms = fn().finish(DEST / name, peak=quiet.get(name, 0.89))
        print(f'{name}: rms {rms:.3f}')
    # 炎は render_fire.py の音を使う
    fire = pathlib.Path(__file__).parent / 'fire_blast.wav'
    if fire.exists():
        (DEST / 'element').mkdir(parents=True, exist_ok=True)
        shutil.copy(fire, DEST / 'element/fire.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(DEST / 'element/fire.wav'), '-b:a', '256k', str(DEST / 'element/fire.mp3')], check=True)
        print('element/fire: fire_blast を使用')
