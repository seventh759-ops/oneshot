// 16×16 のドット絵。文字ごとにパレットの色を塗る（'.' は透明）
(function (root) {
  const SPRITES = {
    slime: {
      palette: { k: '#16331b', g: '#4fc35a', l: '#b4f5a8', w: '#ffffff', b: '#10142a', c: '#ffd34d' },
      map: [
        '................',
        '................',
        '................',
        '................',
        '......kkkk......',
        '....kkllggkk....',
        '...kglggggggk...',
        '..kgggggggggggk.',
        '..kggwbggwbgggk.',
        '.kgggwwggwwggggk',
        '.kggggggggggcggk',
        '.kgggggggggcccgk',
        '.kggggggggggcggk',
        '..kgggggggggggk.',
        '...kkkkkkkkkkk..',
        '................',
      ],
    },
    ghost: {
      palette: { k: '#2b3a66', p: '#d6e6ff', s: '#8fb3ff', b: '#10142a', o: '#ffffff' },
      map: [
        '................',
        '......kkkk......',
        '....kkppppkk....',
        '...kppppppppk...',
        '..kppppppppppk..',
        '..kppbbppbbppk..',
        '..kppbbppbbppk..',
        '..kppppppppppk..',
        '..kpppbbbbpppk..',
        '..kppppopppppk..',
        '..ksppppppppsk..',
        '..kssppppppssk..',
        '..kspsppspspsk..',
        '..ks.ksksk.ksk..',
        '..k...k.k...k...',
        '................',
      ],
    },
    gargoyle: {
      palette: { k: '#1a1c22', g: '#9aa0ab', d: '#5d626b', r: '#ff4d6d' },
      map: [
        'k..............k',
        'kk............kk',
        'kdk...kkkk...kdk',
        'kddk.kggggk.kddk',
        'kdddkgrggrgkdddk',
        'kddddkggggkddddk',
        '.kdddkgkkgkdddk.',
        '..kddkggggkddk..',
        '...kkggggggkk...',
        '....kggggggk....',
        '....kggkkggk....',
        '....kgk..kgk....',
        '...kgk....kgk...',
        '...kk......kk...',
        '................',
        '................',
      ],
    },
    wolf: {
      palette: { k: '#0d0f16', f: '#56688c', l: '#a3b4d4', y: '#ffd34d', w: '#ffffff' },
      map: [
        '................',
        '.k.k......k.k...',
        '.kfk......kfk...',
        'kfffk....kfffk..',
        'kfyfk....kfyfk..',
        'kffffk..kffffk..',
        '.kwwfk..kwwfk...',
        '..kfffkkfffk....',
        '...kffffffffk...',
        '..kfffllllfffk..',
        '..kffffffffffk..',
        '..kffkffffkffk..',
        '..kfk.kffk.kfk..',
        '..kk...kk...kk..',
        '................',
        '................',
      ],
    },
    dragon: {
      palette: { k: '#2a0a0a', r: '#d2382f', o: '#ff8a3d', y: '#ffd34d', w: '#7a1b1b' },
      map: [
        'w..............w',
        'ww....kkk.....ww',
        'www..krrrk...www',
        'wwww.kryrrk.wwww',
        'wwwwwkrrrrkwwwww',
        '.wwwwkrrkkwwwww.',
        '..wwkrrrkwwww...',
        '...krrrrrrk.....',
        '..krrooorrrk....',
        '..krroooorrrk...',
        '..krrooorrrrk.kk',
        '...krrrrrrrrkkrk',
        '...krrkrrkrrrrk.',
        '...krk.krk.kkk..',
        '...kk..kk.......',
        '................',
      ],
    },
  };

  // ドット絵をキャンバスに描く。ピクセル一つひとつの位置と色も返す（砕け散る演出用）
  function drawSprite(canvas, name) {
    const sp = SPRITES[name];
    const c = canvas.getContext('2d');
    const cell = canvas.width / 16;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const pixels = [];
    sp.map.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const col = sp.palette[row[x]];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x * cell, y * cell, cell, cell);
        pixels.push({ x: x * cell, y: y * cell, col });
      }
    });
    return { pixels, cell };
  }

  root.Sprites = { SPRITES, drawSprite };
})(window);
