import asyncio, subprocess, sys, time, json
from playwright.async_api import async_playwright
FAKE = open('tests/fake.js').read()
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8791'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            page = await b.new_page(viewport={'width': 390, 'height': 760})
            errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
            await page.add_init_script(FAKE)
            await page.goto('http://localhost:8791/index.html')
            await page.evaluate("localStorage.setItem('fretjacht.settings', JSON.stringify({metro: {onbeat: true, phones: true, bpm: 100}}))")
            await page.reload(); await page.click('#micPill'); await page.wait_for_timeout(300)
            await page.evaluate("location.hash = '#m-metro'"); await page.wait_for_timeout(300)
            await page.click('#metroBtn'); await page.wait_for_timeout(500)
            print('latency', await page.evaluate('__fj.latency()'))
            for i in range(5):
                await page.evaluate("""(() => { const m = __fj.metro(); const next = m.beats.filter(t => t > m.now + 0.05)[0] ?? (m.beats[m.beats.length - 1] + 60 / m.bpm); window.__sched = window.__sched || []; window.__sched.push(next); if (next != null) setTimeout(() => __fake.play(57, {dur: 0.3}), (next - m.now) * 1000); })()""")
                await page.wait_for_timeout(600)
            print('onsets', json.dumps(await page.evaluate('__fj.onsets()'))[:600])
            print('sched', await page.evaluate('window.__sched'))
            print('beats', (await page.evaluate('__fj.metro()'))['beats'][-8:])
            print('timing', await page.evaluate("document.querySelector('.timing').innerText.replace(/\\n+/g,' | ')"))
            print('errs', errs)
            await b.close()
    finally: srv.terminate()
asyncio.run(main())
