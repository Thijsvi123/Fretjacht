"""Laadt Bricolage Grotesque en Instrument Sans lokaal in de tests (zonder netwerk naar Google Fonts).
Zet FONTS_DIR op een map met bricolage.ttf en instrument.ttf; zonder FONTS_DIR gebruiken de tests de reservelettertypes."""
import os
FONT_DIR = os.environ.get('FONTS_DIR')
CSS = """@font-face { font-family: 'Bricolage Grotesque'; src: url(https://fonts.gstatic.com/local/bricolage.ttf) format('truetype'); font-weight: 200 800; font-stretch: 75% 100%; font-display: block; }
@font-face { font-family: 'Instrument Sans'; src: url(https://fonts.gstatic.com/local/instrument.ttf) format('truetype'); font-weight: 400 700; font-stretch: 75% 100%; font-display: block; }"""
async def use_local_fonts(target):
    if not FONT_DIR:
        return
    async def css(route):
        await route.fulfill(status=200, content_type='text/css', body=CSS, headers={'Access-Control-Allow-Origin': '*'})
    async def font(route):
        name = route.request.url.rsplit('/', 1)[-1]
        await route.fulfill(status=200, content_type='font/ttf', body=open(os.path.join(FONT_DIR, name), 'rb').read(), headers={'Access-Control-Allow-Origin': '*'})
    await target.route('https://fonts.googleapis.com/**', css)
    await target.route('https://fonts.gstatic.com/**', font)
