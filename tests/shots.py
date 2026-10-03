import os, asyncio, subprocess, sys, time
from playwright.async_api import async_playwright
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8792'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    shots = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            for scheme, plan in [('light', ['notes', 'scales', 'chords', 'tuner']), ('dark', ['ear', 'bends', 'metro', 'heatmap'])]:
                ctx = await b.new_context(viewport={'width': 390, 'height': 760}, color_scheme=scheme, device_scale_factor=1, is_mobile=True, has_touch=True)
                await use_local_fonts(ctx)
                page = await ctx.new_page(); await page.add_init_script(FAKE)
                await page.goto('http://localhost:8792/index.html')
                # wat scores zodat de hittekaart iets laat zien
                await page.evaluate("""localStorage.setItem('fretjacht.stats', JSON.stringify({notes: {items: {'5-9': {n: 3, total: 4.5}, '4-0': {n: 2, total: 13}, '3-4': {n: 2, total: 3}, '2-2': {n: 1, total: 9}, '1-7': {n: 4, total: 6}, '0-5': {n: 2, total: 2.4}}, found: 14, totalTime: 38, best: 0.9, streak: 3, bestStreak: 6}, routine: {days: []}}))""")
                await page.reload()
                await page.click('#micPill'); await page.wait_for_timeout(300)
                for v in plan:
                    await page.evaluate(f"location.hash = '{'' if v == 'home' else '#m-' + v}'"); await page.wait_for_timeout(350)
                    if v == 'notes':
                        e = await page.evaluate('__fj.expected()'); await page.evaluate(f'__fake.play({e[0]})'); await page.wait_for_timeout(450)
                    if v == 'scales':
                        for k in range(4):
                            e = await page.evaluate('__fj.expected()'); await page.evaluate(f'__fake.play({e[0]}, {{dur: 0.5}})'); await page.wait_for_timeout(330)
                    if v == 'chords':
                        e = await page.evaluate('__fj.expected()'); await page.evaluate(f'__fake.play({e[0]}, {{dur: 0.6}})'); await page.wait_for_timeout(450)
                    if v == 'ear':
                        await page.wait_for_timeout(1800)
                        e = await page.evaluate('__fj.expected()'); await page.evaluate(f'__fake.play({e[0] + 2})'); await page.wait_for_timeout(450)
                    if v == 'bends':
                        await page.evaluate('__fake.glide(62, 2, 500, 250, 700)'); await page.wait_for_timeout(1500)
                    if v == 'metro':
                        await page.click('#metroBtn'); await page.wait_for_timeout(700)
                    f = f'{SP}s_{scheme}_{v}.png'
                    await page.screenshot(path=f); shots.append(f)
                await ctx.close()
            await b.close()
    finally: srv.terminate()
    ims = [Image.open(f) for f in shots]
    w, hgt = ims[0].size
    sheet = Image.new('RGB', (w * 4 + 30, hgt * 2 + 10), 'white')
    for i, im in enumerate(ims): sheet.paste(im, ((i % 4) * (w + 10), (i // 4) * (hgt + 10)))
    sheet.save(SP + 'sheet.png'); print('ok', sheet.size)
asyncio.run(main())
