# 一太刀（ONE SHOT）

一撃必殺のビルドパズル（試作版）。

ビルドターンでパーツを並べ、1回だけ攻撃する。その1撃で敵を倒せばクリアで、新しいパーツが解放される。

## 遊び方

`index.html` をブラウザで開く（ビルド不要）。

## 構成

- `src/logic.js` … パーツ・ステージ定義と計算処理（DOM非依存）
- `src/main.js` … 画面と演出（構え→カットイン→暗転→一閃→結果）
- `src/sound.js` … 効果音（Web Audio で合成）
- `src/style.css` … 見た目
- `tools/solve.js` … 全ビルドを総当たりして各ステージの解の数を出す（`node tools/solve.js`）
- `tools/bundle.py` … 1ファイルにまとめる（`python3 tools/bundle.py out.html`）
