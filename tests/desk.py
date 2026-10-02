import asyncio, subprocess, sys, time
from playwright.async_api import async_playwright
from PIL import Image
FAKE = open('tests/fake.js').read()
SP = '/tmp/claude-0/-home-claude-fretjacht/d43e012e-f961-53b4-9e20-62d9af333a24/scratchpad/'
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8793'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            ctx = await b.new_context(viewport={'width': 1200, 'height': 820}, color_scheme='light')
            page = await ctx.new_page(); await page.add_init_script(FAKE)
            await page.goto('http://localhost:8793/index.html'); await page.wait_for_timeout(300)
            await page.screenshot(path=SP + 'd_home.png')
            await page.click('#micPill'); await page.evaluate("location.hash='#m-scales'"); await page.wait_for_timeout(400)
            for k in range(3):
                e = await page.evaluate('__fj.expected()'); await page.evaluate(f'__fake.play({e[0]}, {{dur: 0.5}})'); await page.wait_for_timeout(330)
            await page.screenshot(path=SP + 'd_scales.png')
            await b.close()
    finally: srv.terminate()
    a, c = Image.open(SP + 'd_home.png'), Image.open(SP + 'd_scales.png')
    sheet = Image.new('RGB', (a.width, a.height + c.height + 10), 'white'); sheet.paste(a, (0, 0)); sheet.paste(c, (0, a.height + 10))
    sheet = sheet.resize((sheet.width * 2 // 3, sheet.height * 2 // 3)); sheet.save(SP + 'desk.png'); print('ok')
asyncio.run(main())
