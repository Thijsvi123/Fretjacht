"""Nieuwe functies: dagelijkse opdrachten, reeksbevriezer, uitlegkaartje, voortgang voor de cursus,
halsverkenner, doeltonen en gehoortraining. Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR)."""
import os, asyncio, subprocess, sys, time, json
from datetime import date, timedelta
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
PORT = 8797
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'FD_' if SCHEME == 'dark' else 'F_'
R = {}
COUNTER = {'node': 'nodes', 'fix': 'fixed', 'combo': 'combo', 'notes': 'notes', 'challenge': 'challenge', 'scales': 'scales', 'targets': 'targets', 'earq': 'earq', 'srs': 'srs'}
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 760}, is_mobile=True, has_touch=True, color_scheme=SCHEME, permissions=['clipboard-read', 'clipboard-write'])
            await use_local_fonts(ctx)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
            await page.add_init_script(FAKE)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            # --- reeksbevriezer: eergisteren gehaald, gisteren gemist, één bevriezer ---
            d2 = (date.today() - timedelta(days=2)).isoformat(); d1 = (date.today() - timedelta(days=1)).isoformat()
            await page.goto(f'http://localhost:{PORT}/index.html'); await ev('localStorage.clear()')
            await ev(f"localStorage.setItem('fretjacht.stats', JSON.stringify({{days: {{'{d2}': {{secs: 1000, xp: 30}}}}, freezes: 1}}))")
            await page.reload(); await page.wait_for_timeout(1500)
            R['freeze'] = await ev('__fj.freezes()')
            R['streak_after_freeze'] = (await ev('__fj.progress()'))['streak']
            R['freeze_flash'] = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
            await shot('freeze_flash')
            # --- leerpad: opdrachten en uitlegkaartje ---
            await page.wait_for_timeout(2600)
            R['quests'] = await ev('__fj.quests()')
            R['quest_rows'] = await ev("document.querySelectorAll('#questCard .q-list li').length")
            R['unit_sum'] = await ev("({open: document.querySelector('.unit-sum') && document.querySelector('.unit-sum').open, items: Array.from(document.querySelectorAll('.unit-sum li')).map(e => e.textContent.slice(0, 40))})")
            await shot('path'); await shot('path_full', full_page=True)
            # opdrachten afmaken: bevriezer verdienen
            for q in R['quests']:
                if q['id'] == 'pedals': await ev("__fj.markPlayed(['notes', 'scales', 'ear'])")
                else: await ev(f"__fj.questBump('{COUNTER[q['id']]}', {q['target']})")
                await page.wait_for_timeout(250)
            await page.wait_for_timeout(400)
            R['quests_done'] = await ev('__fj.quests()')
            R['freezes_after_quests'] = (await ev('__fj.freezes()'))['n']
            R['quest_flashes'] = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
            await page.wait_for_timeout(9000)
            await shot('quests_done')
            # --- halsverkenner ---
            await ev("location.hash = '#m-explorer'"); await page.wait_for_timeout(500)
            R['explorer_marks'] = await ev("document.querySelectorAll('.neck .mk.ex').length")
            R['explorer_title'] = await ev("document.querySelector('.exp-title').textContent")
            await page.locator('.neck .cell[data-s="5"][data-f="5"]').click(force=True); await page.wait_for_timeout(200)
            R['explorer_tap'] = await ev("document.querySelector('.exp-info').textContent")
            await page.locator('.neck .cell[data-s="5"][data-f="6"]').click(force=True); await page.wait_for_timeout(200)
            R['explorer_tap_wrong'] = await ev("document.querySelector('.exp-info').textContent")
            await page.click('#playBtn'); await page.wait_for_timeout(1200)
            R['explorer_play_hit'] = await ev("document.querySelectorAll('.neck .mk.ex.hit').length")
            await shot('explorer')
            await page.locator('.exp-kind button', has_text='Akkoord').click(); await page.wait_for_timeout(300)
            R['explorer_chord'] = await ev("({title: document.querySelector('.exp-title').textContent, marks: document.querySelectorAll('.neck .mk.ex').length})")
            await page.locator('.exp-roots button').nth(4).click(); await page.wait_for_timeout(200)
            R['explorer_e'] = await ev("document.querySelector('.exp-title').textContent")
            await page.locator('.exp-kind button', has_text='Toonladder').click(); await page.wait_for_timeout(200)
            # --- doeltonen in eigen tempo ---
            await ev("location.hash = '#m-targets'"); await page.wait_for_timeout(500)
            await page.click('.controls .mic-btn'); await page.wait_for_timeout(600)
            hits = 0; seq = []
            for i in range(5):
                for k in range(40):
                    t = await ev('__fj.targets()')
                    if not t['hit']: break
                    await page.wait_for_timeout(100)
                seq.append(f"{t['chord']}:{t['want']}")
                await page.wait_for_timeout(800)   # het akkoord klinkt eerst; dan luistert de app weer
                e = await ev('__fj.expected()')
                if e:
                    if i == 1:
                        await ev(f'__fake.play({e[0] + 1}, {{dur: 0.6}})'); await page.wait_for_timeout(800)
                        R['targets_wrong'] = await ev("document.querySelector('.pr-toast').textContent")
                    await ev(f'__fake.play({e[0]}, {{dur: 0.6}})'); await page.wait_for_timeout(700)
                    if (await ev('__fj.targets()'))['hit']: hits += 1
                if i == 2: await shot('targets')
            R['targets_hits'] = f'{hits}/5'; R['targets_seq'] = seq
            R['targets_stat'] = await ev("Array.from(document.querySelectorAll('.figures dd')).map(e => e.textContent)")
            # doeltonen met tempo (100 bpm): één maat niets spelen = te laat
            await ev("(() => { const s = JSON.parse(localStorage.getItem('fretjacht.settings')); s.targets.tempo = 100; s.targets.target = '3'; localStorage.setItem('fretjacht.settings', JSON.stringify(s)); })()")
            await page.reload(); await page.wait_for_timeout(600)
            await ev("location.hash = '#m-targets'"); await page.wait_for_timeout(500)
            await page.click('#tgGo'); await page.wait_for_timeout(600)
            t = await ev('__fj.targets()'); R['tempo_first'] = t
            await page.wait_for_timeout(2700)
            R['tempo_late'] = await ev("document.querySelector('.pr-toast').textContent")
            e = await ev('__fj.expected()')
            if e: await ev(f'__fake.play({e[0]}, {{dur: 0.6}})')
            await page.wait_for_timeout(800)
            R['tempo_hit'] = (await ev('__fj.targets()'))['hit']
            await shot('targets_tempo')
            await page.click('#tgGo')
            # --- gehoortraining ---
            await ev("location.hash = '#m-earq'"); await page.wait_for_timeout(600)
            k = await ev('__fj.earq()')
            await page.locator(f'.eq-opts .opt[data-k="{k}"]').click(); await page.wait_for_timeout(300)
            R['earq_right'] = await ev("document.querySelector('.eq-fb').textContent")
            await page.wait_for_timeout(1900)
            k2 = await ev('__fj.earq()')
            wrong = await ev(f"Array.from(document.querySelectorAll('.eq-opts .opt')).map(b => b.dataset.k).find(x => x !== '{k2}')")
            await page.locator(f'.eq-opts .opt[data-k="{wrong}"]').click(); await page.wait_for_timeout(400)
            R['earq_wrong'] = await ev("document.querySelector('.eq-fb').textContent")
            R['earq_cmp'] = await ev("document.querySelectorAll('.eq-cmp button').length")
            await shot('earq')
            await page.locator('.eq-kind button', has_text='Akkoorden').click(); await page.wait_for_timeout(400)
            R['earq_chords'] = await ev("Array.from(document.querySelectorAll('.eq-opts .opt')).map(b => b.textContent)")
            # --- Oefenen: nieuwe pedalen ---
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(500)
            R['hub_new'] = await ev("['targets', 'earq', 'explorer'].map(m => !!document.querySelector(`.pedal[data-mode=${m}]`))")
            await shot('hub_full', full_page=True)
            # --- Voortgang: kopiëren voor de cursus ---
            await ev("location.hash = '#voortgang'"); await page.wait_for_timeout(500)
            await page.click('#copyProgress'); await page.wait_for_timeout(500)
            R['clipboard'] = await ev('navigator.clipboard.readText()')
            R['copy_flash'] = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
            await shot('progress'); await shot('progress_full', full_page=True)
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:22}', json.dumps(v, ensure_ascii=False)[:500])
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
