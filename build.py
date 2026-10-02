#!/usr/bin/env python3
"""Bouwt index.html uit src/: één bestand, klaar voor GitHub Pages."""
import base64, glob, os
ROOT = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(ROOT, 'src', 'style.css'), encoding='utf-8').read()
body = open(os.path.join(ROOT, 'src', 'body.html'), encoding='utf-8').read()
js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'src', 'js', '*.js'))))
icon = base64.b64encode(open(os.path.join(ROOT, 'src', 'icon180.png'), 'rb').read()).decode()
html = f'''<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fretjacht</title>
<meta name="theme-color" content="#ECEEF1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101216" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Fretjacht">
<link rel="apple-touch-icon" href="data:image/png;base64,{icon}">
<link rel="icon" type="image/png" href="data:image/png;base64,{icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&display=swap">
<style>
{css}
</style>
</head>
<body data-view="path">
{body}
<script>
(() => {{
'use strict';
{js}
}})();
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
print(f'index.html gebouwd: {len(html) // 1024} KB')
