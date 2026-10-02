import os, asyncio, subprocess, sys, time, json
from playwright.async_api import async_playwright
FAKE = open('tests/fake.js').read()
PORT = 8795
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
R = {}
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'D_' if SCHEME == 'dark' else 'L_'
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 760}, is_mobile=True, has_touch=True, color_scheme=SCHEME)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
            await page.add_init_script(FAKE)
            await page.goto(f'http://localhost:{PORT}/index.html'); await page.evaluate('localStorage.clear()'); await page.reload(); await page.wait_for_timeout(600)
            ev = page.evaluate
            R['path_units'] = await ev("document.querySelectorAll('.unit:not(.locked)').length")
            R['path_locked'] = await ev("Array.from(document.querySelectorAll('.unit.locked h2')).map(e => e.textContent)")
            R['nodes'] = await ev("Array.from(document.querySelectorAll('.node')).map(n => n.className.replace('node ', ''))")
            await page.screenshot(path=SP + PFX + 'path.png')

            async def foot_primary():
                await page.click('.ls-foot button.primary')
            async def answer(wrong=False):
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): return 'end'
                if st.get('answered'):
                    await foot_primary(); await page.wait_for_timeout(120); return 'cont'
                t = st['type']
                if t == 'mc':
                    idx = st['answer'] if not wrong else (st['answer'] + 1) % len(st['options'])
                    await page.locator('.ls-opts .opt').nth(idx).click()
                    await foot_primary(); await page.wait_for_timeout(120); await foot_primary()
                elif t == 'multi':
                    picks = st['correct'] if not wrong else st['correct'][:1]
                    await ev(f"(() => {{ const want = {json.dumps(picks)}; document.querySelectorAll('.chip-btn').forEach(b => {{ if (want.includes(b.textContent)) b.click(); }}); }})()")
                    await foot_primary(); await page.wait_for_timeout(120); await foot_primary()
                elif t == 'tap':
                    v = st['valid'][0]
                    s, f = (v['s'], v['f']) if not wrong else ((v['s'] + 3) % 6, v['f'])
                    await page.locator(f'.tapneck .cell[data-s="{s}"][data-f="{f}"]').click(force=True)
                    await foot_primary(); await page.wait_for_timeout(120); await foot_primary()
                elif t == 'play':
                    t0 = time.time()
                    while time.time() - t0 < 8:
                        st2 = await ev('__fj.lesson()')
                        if not st2 or st2.get('answered') or st2.get('finished'): break
                        e = await ev('__fj.expected()')
                        if e: await ev(f'__fake.play({e[0]}, {{dur: 0.6}})')
                        await page.wait_for_timeout(420)
                    await page.wait_for_timeout(200)
                    st2 = await ev('__fj.lesson()')
                    if st2 and st2.get('answered'): await foot_primary()
                await page.wait_for_timeout(150)
                return t
            async def run_lesson(wrong_first=False, shots=None):
                kinds = []; n = 0
                while n < 40:
                    st = await ev('__fj.lesson()')
                    if not st or st.get('finished'): break
                    if shots and st.get('type') in shots and not st.get('answered'):
                        await page.screenshot(path=SP + PFX + f"item_{st['type']}.png"); shots.remove(st['type'])
                    k = await answer(wrong=(wrong_first and n == 0))
                    kinds.append(k); n += 1
                return kinds
            # unit 1, alle knooppunten
            done_nodes = 0; shots = ['mc', 'tap', 'play', 'multi']
            for i in range(6):
                btn = page.locator('.node.next')
                if await btn.count() == 0: break
                await btn.first.click(); await page.wait_for_timeout(200)
                await page.click('.sheet button.primary'); await page.wait_for_timeout(500)
                kinds = await run_lesson(wrong_first=(i == 0), shots=shots)
                if i == 0: R['node1_kinds'] = kinds
                end_title = await ev("document.querySelector('.end-title') ? document.querySelector('.end-title').textContent : ''")
                if i == 0:
                    await page.screenshot(path=SP + PFX + 'end.png')
                R[f'node{i+1}'] = end_title
                await page.click('.ls-foot button.primary'); await page.wait_for_timeout(500)
                done_nodes += 1
            R['done_nodes'] = done_nodes
            R['nodes_after'] = await ev("Array.from(document.querySelectorAll('.node')).map(n => n.className.replace('node ', ''))")
            R['progress1'] = await ev('__fj.progress()')
            # Oefen vandaag
            await page.click('#todayBtn'); await page.wait_for_timeout(300)
            await page.screenshot(path=SP + PFX + 'plan.png')
            R['plan'] = await ev("Array.from(document.querySelectorAll('.plan li b')).map(e => e.textContent)")
            await page.click('.sheet button.primary'); await page.wait_for_timeout(600)
            seq = []
            for step in range(8):
                d = await ev('__fj.daily()')
                if not d['active']: break
                v = await ev('document.body.dataset.view')
                seq.append(v + ':' + (await ev("location.hash")))
                if v == 'lesson':
                    await run_lesson()
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(600)
                elif v == 'mode':
                    if 'intervals' in seq[-1]: R['intervals_set_during'] = await ev('__fj.settings().intervals.set')
                    e = await ev('__fj.expected()')
                    if e: await ev(f'__fake.play({e[0]})'); await page.wait_for_timeout(800)
                    await page.click('#sessionBar button'); await page.wait_for_timeout(600)
                else:
                    break
            R['daily_seq'] = seq
            R['intervals_set_after'] = await ev("(JSON.parse(localStorage.getItem('fretjacht.settings') || '{}').intervals || {}).set")
            R['daily_done'] = await ev("!!document.querySelector('.sheet h3') && document.querySelector('.sheet h3').textContent")
            if await page.locator('.sheet button.primary').count(): await page.click('.sheet button.primary')
            # dagdoel halen
            await ev('__fj.addSecs(15 * 60 - __fj.progress().secs - 2)'); await page.wait_for_timeout(300)
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(300)
            await ev("location.hash = '#m-notes'"); await page.wait_for_timeout(300)
            e = await ev('__fj.expected()'); await ev(f'__fake.play({e[0]}, {{dur: 1.5}})')
            R['flash'] = []
            for k in range(40):
                f = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
                if f:
                    R['flash'] = f; await page.wait_for_timeout(350); await page.screenshot(path=SP + PFX + 'flash.png'); break
                await page.wait_for_timeout(100)
            R['after_goal'] = await ev('__fj.progress()')
            await ev("location.hash = '#voortgang'"); await page.wait_for_timeout(400)
            R['progress_badges'] = await ev("document.querySelectorAll('.badge.got').length")
            R['cal_cells'] = await ev("document.querySelectorAll('.cal-c').length")
            await page.screenshot(path=SP + PFX + 'progress.png', full_page=True)
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(300)
            await page.screenshot(path=SP + PFX + 'practice.png')
            await ev("location.hash = ''"); await page.wait_for_timeout(400)
            await page.screenshot(path=SP + PFX + 'path_after.png')
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:14}', json.dumps(v, ensure_ascii=False)[:400])
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
