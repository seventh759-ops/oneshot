// 墨で描く異形（ステージの look パラメータから毎回同じ形を描く）
(function (root) {
  const INK = '#1b1815';
  const PAPER = '#ece4d0';
  const SHU = '#c63a2c';

  function rng(seed) {
    let s = seed * 9301 + 49297;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  }

  // ふちがゆらいだ塊
  function blob(c, r, cx, cy, rx, ry, rough, n = 48) {
    const off = r() * 10;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + Math.sin(a * 3 + off) * rough * 0.5 + (r() - 0.5) * rough;
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
    c.fill();
  }

  // 筆の線（入りが太く抜けが細い）
  function stroke(c, r, pts, width) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const steps = Math.max(14, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
      for (let j = 0; j < steps; j++) {
        const t = (i + j / steps) / (pts.length - 1);
        const x = x0 + (x1 - x0) * (j / steps), y = y0 + (y1 - y0) * (j / steps);
        c.beginPath();
        c.arc(x, y, Math.max(0.8, width * (1 - t * 0.85) * (0.85 + r() * 0.3)), 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function eye(c, x, y, size, look) {
    c.save();
    c.fillStyle = PAPER;
    c.beginPath(); c.ellipse(x, y, size, size * 0.62, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = SHU;
    c.beginPath(); c.arc(x + look * size * 0.25, y, size * 0.46, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(x + look * size * 0.25, y, size * 0.1, size * 0.4, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function teeth(c, r, x0, x1, y, h, dir, count) {
    c.save();
    c.fillStyle = PAPER;
    const w = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const hh = h * (0.6 + r() * 0.6);
      c.beginPath();
      c.moveTo(x0 + i * w, y);
      c.lineTo(x0 + (i + 1) * w, y);
      c.lineTo(x0 + (i + 0.5) * w, y + hh * dir);
      c.closePath(); c.fill();
    }
    c.restore();
  }

  function splatter(c, r, W, n) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = W * (0.3 + r() * 0.17);
      c.globalAlpha = 0.5 + r() * 0.5;
      c.beginPath(); c.arc(W / 2 + Math.cos(a) * d, W / 2 + Math.sin(a) * d, 1 + r() * 4, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  const BODIES = {
    // 一つ目泥坊主：崩れかけた泥の山、巨大な一つ目、垂れる口
    blob(c, r, W, L) {
      blob(c, r, W * 0.5, W * 0.6, W * 0.34, W * 0.3, 0.18);
      blob(c, r, W * 0.5, W * 0.4, W * 0.2, W * 0.2, 0.15);
      for (let i = 0; i < 6; i++) {
        const x = W * (0.25 + r() * 0.5);
        stroke(c, r, [[x, W * 0.78], [x + (r() - 0.5) * 8, W * (0.86 + r() * 0.08)]], 7);
      }
      eye(c, W * 0.5, W * 0.42, W * 0.13, 0.4);
      c.save(); c.fillStyle = '#5c1a14';
      blob(c, r, W * 0.5, W * 0.64, W * 0.12, W * 0.05, 0.2, 24);
      c.restore();
      teeth(c, r, W * 0.42, W * 0.58, W * 0.615, W * 0.04, 1, 5);
    },
    // 百々目鬼：ひょろ長い体に無数の目
    tall(c, r, W, L) {
      blob(c, r, W * 0.5, W * 0.52, W * 0.18, W * 0.38, 0.12);
      stroke(c, r, [[W * 0.36, W * 0.45], [W * 0.2, W * 0.6], [W * 0.17, W * 0.82]], 9);
      stroke(c, r, [[W * 0.64, W * 0.45], [W * 0.8, W * 0.58], [W * 0.84, W * 0.8]], 9);
      for (let i = 0; i < L.eyes; i++) {
        const x = W * (0.4 + r() * 0.2) + (i % 2 ? 1 : -1) * W * 0.03;
        const y = W * (0.22 + (i / L.eyes) * 0.62);
        eye(c, x, y, W * (0.03 + r() * 0.03), r() - 0.5);
      }
    },
    // 土蜘蛛：丸い胴、八本の節足、牙
    spider(c, r, W, L) {
      for (let side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const ay = W * (0.42 + i * 0.07);
          const kx = W * 0.5 + side * W * (0.3 + r() * 0.06), ky = ay - W * (0.16 - i * 0.03);
          const fx = W * 0.5 + side * W * (0.44 + r() * 0.04), fy = ay + W * (0.18 + i * 0.03);
          stroke(c, r, [[W * 0.5 + side * W * 0.12, ay], [kx, ky], [fx, fy]], 8);
        }
      }
      blob(c, r, W * 0.5, W * 0.55, W * 0.2, W * 0.17, 0.1);
      blob(c, r, W * 0.5, W * 0.38, W * 0.13, W * 0.11, 0.1);
      const pos = [[-0.05, 0.35], [0.05, 0.35], [-0.09, 0.31], [0.09, 0.31], [-0.03, 0.29], [0.03, 0.29]];
      pos.slice(0, L.eyes).forEach(([dx, dy], i) => eye(c, W * (0.5 + dx), W * dy, W * (i < 2 ? 0.032 : 0.02), 0));
      teeth(c, r, W * 0.45, W * 0.55, W * 0.44, W * 0.08, 1, 2);
    },
    // 雲外鏡：鏡の縁から髪が伸び、鏡面に顔
    mirror(c, r, W, L) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const R0 = W * 0.27, R1 = W * (0.36 + r() * 0.1);
        stroke(c, r, [[W / 2 + Math.cos(a) * R0, W / 2 + Math.sin(a) * R0],
          [W / 2 + Math.cos(a + 0.15) * R1, W / 2 + Math.sin(a + 0.15) * R1]], 5);
      }
      c.beginPath(); c.arc(W / 2, W / 2, W * 0.29, 0, Math.PI * 2); c.fill();
      c.save();
      c.fillStyle = '#4d4a45';
      c.beginPath(); c.arc(W / 2, W / 2, W * 0.235, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff30';
      c.beginPath(); c.ellipse(W * 0.44, W * 0.42, W * 0.06, W * 0.13, -0.6, 0, Math.PI * 2); c.fill();
      c.restore();
      eye(c, W * 0.43, W * 0.46, W * 0.05, 0.3);
      eye(c, W * 0.57, W * 0.46, W * 0.05, 0.3);
      c.save(); c.fillStyle = INK;
      c.beginPath(); c.ellipse(W / 2, W * 0.6, W * 0.12, W * 0.045, 0, 0, Math.PI); c.fill(); c.restore();
      teeth(c, r, W * 0.39, W * 0.61, W * 0.6, W * 0.035, 1, 7);
    },
    // 氷喰らい：氷柱を背負った大口
    maw(c, r, W, L) {
      for (let i = 0; i < 7; i++) {
        const x = W * (0.22 + i * 0.093), h = W * (0.12 + r() * 0.14);
        c.beginPath(); c.moveTo(x - W * 0.04, W * 0.34); c.lineTo(x + W * 0.04, W * 0.34); c.lineTo(x + (r() - 0.5) * 10, W * 0.34 - h); c.closePath(); c.fill();
      }
      blob(c, r, W * 0.5, W * 0.56, W * 0.36, W * 0.27, 0.12);
      c.save(); c.fillStyle = '#5c1a14';
      blob(c, r, W * 0.5, W * 0.64, W * 0.25, W * 0.12, 0.08);
      c.restore();
      teeth(c, r, W * 0.27, W * 0.73, W * 0.53, W * 0.09, 1, 9);
      teeth(c, r, W * 0.29, W * 0.71, W * 0.76, W * 0.07, -1, 8);
      [[0.33, 0.42], [0.43, 0.39], [0.57, 0.39], [0.67, 0.42]].slice(0, L.eyes)
        .forEach(([x, y]) => eye(c, W * x, W * y, W * 0.035, 0));
    },
  };

  // 異形を描いた画像（dataURL）を返す
  root.drawMonster = function (look, W = 440) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = W;
    const c = cv.getContext('2d');
    const r = rng(look.seed);
    c.fillStyle = INK;
    BODIES[look.body](c, r, W, look);
    c.fillStyle = INK;
    splatter(c, r, W, 18);
    return cv.toDataURL();
  };
})(window);
