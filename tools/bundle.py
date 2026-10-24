"""index.html と src/ を1ファイルにまとめる（Artifact公開用）。
使い方: python3 tools/bundle.py <出力パス>"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'src/style.css').read_text()
html = html.replace('<link rel="stylesheet" href="src/style.css">', f'<style>\n{css}</style>')
for name in ('logic.js', 'sound.js', 'monster.js', 'voice.js', 'main.js'):
    js = (root / 'src' / name).read_text()
    html = html.replace(f'<script src="src/{name}"></script>', f'<script>\n{js}</script>')
# Artifactの外枠が付くので html/head/body タグは外す
html = re.sub(r'<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*', '', html)
html = html.replace('<meta charset="utf-8">\n', '').replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="claude:viewport-fit-sides" content="cover">')
pathlib.Path(sys.argv[1]).write_text(html)
