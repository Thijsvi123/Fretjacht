import os, asyncio, subprocess, sys, time, json, random
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
PORT = 8790
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errors = []; results = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=1, is_mobile=True, has_touch=True)
            await use_local_fonts(ctx)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
            await page.add_init_script(FAKE)
            await page.goto(f'http://localhost:{PORT}/index.html')
            await page.evaluate('localStorage.clear()'); await page.reload()
            ev = page.evaluate
            async def exp(): return await ev('__fj.expected()')
            async def hit(): return await ev("!!document.querySelector('.prompt.hit')")
            async def wait_for(cond, timeout=4.0):
                t0 = time.time()
                while time.time() - t0 < timeout:
                    if await cond(): return True
                    await page.wait_for_timeout(40)
                return False
            async def goto(mode):
                await ev(f"location.hash = '#m-{mode}'"); await page.wait_for_timeout(250)
            # start microfoon via de pil
            await page.click('#micPill'); await page.wait_for_timeout(400)
            results['mic'] = await ev("document.getElementById('micPill').dataset.state")

            # --- Noten zoeken ---
            await goto('notes'); ok = 0
            for i in range(5):
                e = await exp(); await ev(f'__fake.play({random.choice(e)}, {{fund: {random.choice([0.7, 0.2])}}})')
                if await wait_for(hit, 3): ok += 1
                await page.wait_for_timeout(800)
            results['notes'] = f'{ok}/5'

            # --- Alle posities ---
            await goto('positions'); rounds = 0
            for r in range(3):
                for step in range(10):
                    if await hit(): break
                    e = await exp()
                    if not e: break
                    await ev(f'__fake.play({e[0]})'); await page.wait_for_timeout(450)
                if await wait_for(hit, 2): rounds += 1
                await page.wait_for_timeout(1800)
            results['positions'] = f'{rounds}/3 rondes'

            # --- Intervallen ---
            await goto('intervals'); ok = 0
            for i in range(4):
                e = await exp(); await ev(f'__fake.play({e[0]})'); await page.wait_for_timeout(500)
                e = await exp()
                if e: await ev(f'__fake.play({e[0]})')
                if await wait_for(hit, 2.5): ok += 1
                await page.wait_for_timeout(2400)
            results['intervals'] = f'{ok}/4'

            # --- Trappen ---
            await goto('degrees'); ok = 0
            for i in range(4):
                e = await exp(); await ev(f'__fake.play({e[0]})')
                if await wait_for(hit, 2.5): ok += 1
                await page.wait_for_timeout(1900)
            results['degrees'] = f'{ok}/4'

            # --- Toonladders ---
            await goto('scales'); done = 0
            for r in range(2):
                for k in range(20):
                    if await hit(): break
                    e = await exp()
                    if not e: break
                    await ev(f'__fake.play({e[0]}, {{dur: 0.5}})'); await page.wait_for_timeout(330)
                if await wait_for(hit, 2): done += 1
                results['scales_text'] = await ev("document.querySelector('.pr-toast').textContent")
                await page.click('#nextBox'); await page.wait_for_timeout(300)
            results['scales'] = f'{done}/2 boxen'

            # --- Akkoordtonen ---
            await goto('chords'); ok = 0
            for i in range(3):
                for k in range(5):
                    if await hit(): break
                    e = await exp()
                    if not e: break
                    await ev(f'__fake.play({e[0]}, {{dur: 0.6}})'); await page.wait_for_timeout(420)
                if await wait_for(hit, 2): ok += 1
                await page.wait_for_timeout(2700)
            results['chords'] = f'{ok}/3'

            # --- Op gehoor: niveau 1 en 4 ---
            for lv in (1, 4):
                await ev(f"(() => {{ const s = JSON.parse(localStorage.getItem('fretjacht.settings') || '{{}}'); s.ear = Object.assign(s.ear || {{}}, {{level: {lv}}}); localStorage.setItem('fretjacht.settings', JSON.stringify(s)); }})()")
                await page.reload(); await page.click('#micPill'); await page.wait_for_timeout(300)
                await goto('ear'); ok = 0
                for i in range(2):
                    await page.wait_for_timeout(600)
                    # wacht tot het voorspelen klaar is
                    await wait_for(lambda: ev("document.querySelector('.pr-toast').textContent.indexOf('Luister') < 0"), 6)
                    wrong = await exp()
                    if wrong: await ev(f'__fake.play({wrong[0] + 1}, {{dur: 0.4}})'); await page.wait_for_timeout(500)
                    results[f'ear{lv}_help'] = await ev("document.querySelector('.pr-toast').textContent")
                    for k in range(8):
                        if await hit(): break
                        e = await exp()
                        if not e: break
                        await ev(f'__fake.play({e[0]}, {{dur: 0.5}})'); await page.wait_for_timeout(380)
                    if await wait_for(hit, 2): ok += 1
                    await page.wait_for_timeout(1700)
                results[f'ear{lv}'] = f'{ok}/2'

            # --- Bends ---
            await goto('bends')
            await ev('__fake.glide(62, 2, 500, 250, 700)'); await page.wait_for_timeout(1700)
            results['bend_ok'] = await ev("document.querySelector('.pr-toast').textContent")
            await page.wait_for_timeout(400)
            await ev('__fake.glide(62, 1.7, 500, 250, 700)'); await page.wait_for_timeout(1700)
            results['bend_low'] = await ev("document.querySelector('.pr-toast').textContent")

            # --- 60 seconden (verkort: we spelen 8 s mee) ---
            await goto('challenge'); await page.click('#goBtn'); await page.wait_for_timeout(2700)
            t0 = time.time()
            while time.time() - t0 < 8:
                e = await exp()
                if e: await ev(f'__fake.play({e[0]}, {{dur: 0.5}})')
                await page.wait_for_timeout(330)
            results['challenge_score'] = await ev("document.querySelector('.pr-where small') ? document.querySelector('.pr-where small').textContent : ''")

            # --- Metronoom met meting op de tel ---
            await ev("(() => { const s = JSON.parse(localStorage.getItem('fretjacht.settings') || '{}'); s.metro = Object.assign(s.metro || {}, {onbeat: true, phones: true, bpm: 100}); localStorage.setItem('fretjacht.settings', JSON.stringify(s)); })()")
            await page.reload(); await page.click('#micPill'); await page.wait_for_timeout(300)
            await goto('metro'); await page.click('#metroBtn'); await page.wait_for_timeout(500)
            for i in range(8):
                await ev("""(() => { const m = __fj.metro(); const next = m.beats.filter(t => t > m.now + 0.05)[0] ?? (m.beats[m.beats.length - 1] + 60 / m.bpm); if (next != null) setTimeout(() => __fake.play(57, {dur: 0.3}), (next - m.now) * 1000); })()""")
                await page.wait_for_timeout(600)
            await page.wait_for_timeout(500)
            results['metro'] = await ev("document.querySelector('.timing').innerText.replace(/\\n+/g, ' | ')")
            await page.click('#tapBtn'); await page.wait_for_timeout(500); await page.click('#tapBtn'); await page.wait_for_timeout(500); await page.click('#tapBtn')
            results['tap_bpm'] = await ev("document.querySelector('.bpm').textContent")
            await page.click('#metroBtn')

            # --- Stemapparaat ---
            await goto('tuner'); await ev('__fake.play(45, {cents: -30, dur: 1.5})'); await page.wait_for_timeout(600)
            results['tuner'] = await ev("document.querySelector('.tuner-card .where').textContent")

            # --- Hittekaart ---
            await goto('heatmap')
            results['heatmap'] = await ev("({heat: document.querySelectorAll('.mk.heat:not(.h0)').length, grey: document.querySelectorAll('.mk.h0').length})")

            # --- Tabbladen ---
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(300)
            results['home_stats'] = await ev("Array.from(document.querySelectorAll('.pd-stat')).map(e => e.textContent)")
            # instellingen
            await ev("location.hash = '#instellingen'"); await page.wait_for_timeout(300)
            await ev('__fake.play(57, {dur: 1})'); await page.wait_for_timeout(400)
            results['settings_level'] = await ev("document.querySelector('.lvl-text').textContent")
            await b.close()
    finally:
        srv.terminate()
    for k, v in results.items(): print(f'{k:16} {v}')
    print('ERRORS:', json.dumps(errors[:15], ensure_ascii=False))
asyncio.run(main())
