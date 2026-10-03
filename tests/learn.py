"""Leerflow end-to-end: leerpad, lessen, foutenbak, Oefen vandaag, Oefenen (pedalboard) en Voortgang.
Gebruikt een nep-microfoon (tests/fake.js). SCHEME=dark voor donkere modus, SHOTS=<map> voor schermafbeeldingen,
FONTS_DIR=<map met bricolage.ttf en instrument.ttf> voor de echte lettertypes."""
import os, asyncio, subprocess, sys, time, json
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
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
            await use_local_fonts(ctx)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
            await page.add_init_script(FAKE)
            await page.goto(f'http://localhost:{PORT}/index.html'); await page.evaluate('localStorage.clear()'); await page.reload(); await page.wait_for_timeout(900)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            R['path_units'] = await ev("document.querySelectorAll('.unit:not(.locked)').length")
            R['path_locked'] = await ev("Array.from(document.querySelectorAll('.unit.locked h2')).map(e => e.textContent)")
            R['nodes'] = await ev("Array.from(document.querySelectorAll('.node')).map(n => n.className.replace('node ', ''))")
            R['side_fret'] = await ev("document.querySelectorAll('.side-fret svg.mascot').length")
            R['bin_btn_hidden'] = await ev("document.querySelector('.bin-btn').hidden")
            await shot('path')

            async def wait_lesson(timeout=6):
                t0 = time.time()
                while time.time() - t0 < timeout:
                    if not await ev('__fj.loading()'):
                        st = await ev('__fj.lesson()')
                        if st: return st
                    await page.wait_for_timeout(60)
                return None
            async def click_text(sel, text):
                await page.locator(sel, has_text=text).first.click()
            async def answer(wrong=False):
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): return 'end'
                if st.get('answered'):
                    await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(120); return 'cont'
                t = st['type']
                if t == 'mc':
                    idx = st['answer'] if not wrong else (st['answer'] + 1) % len(st['options'])
                    await page.locator('.ls-opts .opt').nth(idx).click()
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120); await click_text('.ls-foot button', 'Verder')
                elif t == 'multi':
                    picks = st['correct'] if not wrong else st['correct'][:1]
                    await ev(f"(() => {{ const want = {json.dumps(picks)}; document.querySelectorAll('.chip-btn').forEach(b => {{ if (want.includes(b.textContent)) b.click(); }}); }})()")
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120); await click_text('.ls-foot button', 'Verder')
                elif t == 'tap':
                    v = st['valid'][0]
                    s, f = (v['s'], v['f']) if not wrong else ((v['s'] + 3) % 6, v['f'])
                    await page.locator(f'.tapneck .cell[data-s="{s}"][data-f="{f}"]').click(force=True)
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120); await click_text('.ls-foot button', 'Verder')
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
                    if st2 and st2.get('answered'): await click_text('.ls-foot button', 'Verder')
                await page.wait_for_timeout(150)
                return t
            async def run_lesson(wrong_first=False, shots=None, wrong_shot=None):
                kinds = []; n = 0
                while n < 40:
                    st = await ev('__fj.lesson()')
                    if not st or st.get('finished'): break
                    if shots and st.get('type') in shots and not st.get('answered'):
                        await shot('item_' + st['type']); shots.remove(st['type'])
                    if wrong_first and n == 0 and wrong_shot and st.get('type') == 'mc':
                        # foute keuze vastleggen: feedback met de fret en de foutenbak-melding
                        idx = (st['answer'] + 1) % len(st['options'])
                        await page.locator('.ls-opts .opt').nth(idx).click(); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(450)
                        await shot(wrong_shot)
                        R['wrong_note'] = await ev("document.querySelector('.fb-note') ? document.querySelector('.fb-note').textContent : ''")
                        await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(150)
                        kinds.append('mc-wrong'); n += 1; continue
                    k = await answer(wrong=(wrong_first and n == 0))
                    kinds.append(k); n += 1
                return kinds
            async def open_next_node():
                btn = page.locator('.node.next')
                if await btn.count() == 0: return False
                await btn.first.click(); await page.wait_for_timeout(200)
                await page.click('.sheet button.primary')
                return bool(await wait_lesson())

            # --- les 1 met een fout: eindscherm biedt "Herstel je fouten" ---
            shots = ['mc', 'tap', 'play', 'multi']
            await open_next_node()
            R['node1_kinds'] = await run_lesson(wrong_first=True, shots=shots, wrong_shot='wrong')
            await page.wait_for_timeout(500)
            R['node1'] = await ev("document.querySelector('.end-title').textContent")
            R['fix_btn'] = await ev("document.querySelector('.fix-btn') ? document.querySelector('.fix-btn').textContent : ''")
            R['bin_after_node1'] = (await ev('__fj.progress()'))['bin']
            await page.wait_for_timeout(700); await shot('end')
            # herstelronde
            await page.click('.fix-btn')
            await page.wait_for_timeout(300); await shot('loader')
            st = await wait_lesson()
            R['fix_mode'] = bool(st and st.get('bin'))
            await shot('fix_item')
            await run_lesson()
            await page.wait_for_timeout(500)
            R['fix_end'] = await ev("document.querySelector('.end-title').textContent")
            pr = await ev('__fj.progress()')
            R['fix_progress'] = {'bin': pr['bin'], 'binCleared': pr['binCleared'], 'secs': pr['secs'], 'badges': sorted(pr['badges'].keys())}
            await page.wait_for_timeout(900); await shot('fix_end')
            await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(600)
            R['just_done'] = await ev("document.querySelectorAll('.node.just-done').length")
            await page.wait_for_timeout(1200); await shot('path_justdone')

            # --- les 2 t/m 6; in les 3 een fout die in de foutenbak blijft ---
            done_nodes = 1
            for i in range(1, 6):
                if not await open_next_node(): break
                await run_lesson(wrong_first=(i == 2))
                await page.wait_for_timeout(400)
                R[f'node{i+1}'] = await ev("document.querySelector('.end-title') ? document.querySelector('.end-title').textContent : ''")
                await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(500)
                done_nodes += 1
            R['done_nodes'] = done_nodes
            R['nodes_after'] = await ev("Array.from(document.querySelectorAll('.node')).map(n => n.className.replace('node ', '').replace(' just-done', '').replace(' just-next', ''))")
            R['bin_btn'] = await ev("({hidden: document.querySelector('.bin-btn').hidden, n: document.querySelector('.bin-btn .todo-count').textContent})")
            await page.wait_for_timeout(1300); await shot('path_bin')

            # --- Oefenen: pedalboard met herhaalkaart ---
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(500)
            R['hub'] = await ev("({pedals: document.querySelectorAll('.pedal').length, wide: document.querySelectorAll('.pedal.wide').length, bin: !!document.querySelector('.srs-card.todo'), on: document.querySelectorAll('.pedal.on').length})")
            await shot('hub'); await shot('hub_full', full_page=True)
            await page.click('.srs-card .srs-go'); st = await wait_lesson()
            await run_lesson(); await page.wait_for_timeout(500)
            R['hub_fix_end'] = await ev("document.querySelector('.end-title').textContent")
            await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(500)
            R['hash_after_hub_fix'] = await ev('location.hash')
            R['hub_bin_after'] = await ev("!!document.querySelector('.srs-card:not(.todo)')")
            # pedaal intrappen
            await page.click('.pedal[data-mode="notes"]'); await page.wait_for_timeout(120)
            R['stomp'] = await ev("!!document.querySelector('.pedal.stomp')")
            await page.wait_for_timeout(450); await shot('stomp_loader')
            await page.wait_for_timeout(900)
            R['after_stomp'] = await ev('location.hash')

            # --- Oefen vandaag ---
            await ev("location.hash = ''"); await page.wait_for_timeout(500)
            await page.click('#todayBtn'); await page.wait_for_timeout(350)
            await shot('plan')
            R['plan'] = await ev("Array.from(document.querySelectorAll('.plan li b')).map(e => e.textContent)")
            await page.click('.sheet button.primary'); await page.wait_for_timeout(1300)
            seq = []
            for step in range(8):
                d = await ev('__fj.daily()')
                if not d['active']: break
                if await ev('__fj.loading()'): await page.wait_for_timeout(1000)
                v = await ev('document.body.dataset.view')
                seq.append(v + ':' + (await ev("location.hash")))
                if v == 'lesson':
                    await wait_lesson(3)
                    await run_lesson(); await page.wait_for_timeout(300)
                    await click_text('.ls-foot button', 'Verder'); await page.wait_for_timeout(900)
                elif v == 'mode':
                    if 'intervals' in seq[-1]: R['intervals_set_during'] = await ev('__fj.settings().intervals.set')
                    e = await ev('__fj.expected()')
                    if e: await ev(f'__fake.play({e[0]})'); await page.wait_for_timeout(800)
                    await page.click('#sessionBar button'); await page.wait_for_timeout(1100)
                else:
                    await page.wait_for_timeout(600)
            R['daily_seq'] = seq
            R['intervals_set_after'] = await ev("(JSON.parse(localStorage.getItem('fretjacht.settings') || '{}').intervals || {}).set")
            await page.wait_for_timeout(300)
            R['daily_done'] = await ev("!!document.querySelector('.sheet h3') && document.querySelector('.sheet h3').textContent")
            await page.wait_for_timeout(900); await shot('session_done')
            if await page.locator('.sheet button.primary').count(): await page.click('.sheet button.primary')

            # --- dagdoel halen: melding, confetti ---
            await ev('__fj.addSecs(15 * 60 - __fj.progress().secs - 2)'); await page.wait_for_timeout(300)
            await ev("location.hash = '#m-notes'"); await page.wait_for_timeout(400)
            e = await ev('__fj.expected()'); await ev(f'__fake.play({e[0]}, {{dur: 1.5}})')
            R['flash'] = []
            for k in range(40):
                f = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
                if f:
                    R['flash'] = f; R['confetti'] = await ev("!!document.querySelector('canvas.confetti')")
                    await page.wait_for_timeout(500); await shot('goal'); break
                await page.wait_for_timeout(100)
            await page.wait_for_timeout(2600)

            # --- Voortgang ---
            await ev("location.hash = '#voortgang'"); await page.wait_for_timeout(500)
            R['progress_badges'] = await ev("document.querySelectorAll('.badge.got').length")
            R['cal_cells'] = await ev("document.querySelectorAll('.cal-c').length")
            R['streak_card'] = await ev("document.querySelector('.sc-n').textContent")
            await shot('progress'); await shot('progress_full', full_page=True)
            await ev("location.hash = ''"); await page.wait_for_timeout(600)
            await shot('path_after')
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:20}', json.dumps(v, ensure_ascii=False)[:400])
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
