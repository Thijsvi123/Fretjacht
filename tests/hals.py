"""Halsjacht (leren, herkennen, toepassen), Welke noot?, niveaus en het startscherm.
Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR). Eindigt met een lijst geslaagd/mislukt per controle."""
import os, asyncio, subprocess, sys, time, json, re
from datetime import date, timedelta
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
VIB = "window.__vib = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vib.push(p); return true; } });"
PORT = 8801
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'HD_' if SCHEME == 'dark' else 'H_'
R, CHECKS = {}, []
def check(name, ok, info=''): CHECKS.append((name, bool(ok), info))
def day(n): return (date.today() + timedelta(days=n)).isoformat()

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            # ---------- zonder JavaScript: er staat uitleg in plaats van alleen "Leerpad 0/15" ----------
            nojs = await b.new_context(java_script_enabled=False)
            pg = await nojs.new_page(); await pg.goto(f'http://localhost:{PORT}/index.html')
            R['nojs'] = (await pg.inner_text('main'))[:160]
            check('Zonder JavaScript: uitleg over de app', 'Leer de hals van je gitaar kennen' in R['nojs'], R['nojs'])
            await nojs.close()

            ctx = await b.new_context(viewport={'width': 390, 'height': 760}, is_mobile=True, has_touch=True, color_scheme=SCHEME)
            await use_local_fonts(ctx)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
            await page.add_init_script(FAKE); await page.add_init_script(VIB)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            async def go(h): await ev(f"location.hash = '{h}'"); await page.wait_for_timeout(450)
            async def wait_lesson(timeout=6):
                t0 = time.time()
                while time.time() - t0 < timeout:
                    if not await ev('__fj.loading()'):
                        st = await ev('__fj.lesson()')
                        if st: return st
                    await page.wait_for_timeout(60)
                return None
            async def verder():
                await page.locator('.ls-foot button', has_text=re.compile('Verder|Afronden')).first.click(); await page.wait_for_timeout(150)
            # één vraag beantwoorden (goed of fout); geeft het type terug
            async def answer(right=True, snap=None):
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): return 'end'
                t = st['type']
                if t == 'learn':
                    if snap: await shot(snap)
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120); return t
                if t == 'name':
                    nat = [0, 2, 4, 5, 7, 9, 11]
                    pc = st['pc'] if right else next(k for k in nat if k != st['pc'])
                    await page.locator(f'.keypad .key[data-pc="{pc}"]').first.click(); await page.wait_for_timeout(120)
                    if snap: await page.wait_for_timeout(250); await shot(snap)
                    fb = await ev("({title: document.querySelector('.fb-title').textContent, answer: (document.querySelector('.fb-answer') || {}).textContent || '', left: (document.querySelector('.fb-left') || {}).textContent, mark: document.querySelector('.fb-mark').className, keys: Array.from(document.querySelectorAll('.key.right, .key.wrong')).map(k => k.className), reveal: !!document.querySelector('.quizneck .mk.reveal')})")
                    R.setdefault('name_fb', []).append(fb)
                    if (await ev('__fj.lesson()') or {}).get('answered'): await verder()
                    return t
                if t == 'tapall':
                    valid = st['valid']
                    if not right:
                        # eerst een foute plek: een stap naast de eerste goede
                        v = valid[0]; f = v['f'] + 1 if v['f'] < 12 else v['f'] - 1
                        await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{f}"]').click(force=True); await page.wait_for_timeout(200)
                        R['tap_wrong'] = await ev("({wrong: !!document.querySelector('.tapneck .mk.wrong'), label: (document.querySelector('.tapneck .mk.wrong text') || {}).textContent})")
                        if not right and len(valid) < 3:
                            # een misser op weinig plekken telt als fout: daarna nog alles vinden
                            pass
                    for v in valid:
                        await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True); await page.wait_for_timeout(90)
                    await page.wait_for_timeout(250)
                    if snap: await shot(snap)
                    fb = await ev("({title: document.querySelector('.fb-title').textContent, answer: (document.querySelector('.fb-answer') || {}).textContent || '', ok: document.querySelector('.ls-foot').classList.contains('ok')})")
                    R.setdefault('tap_fb', []).append(fb)
                    await verder(); return t
                if t == 'mc':
                    idx = st['answer'] if right else (st['answer'] + 1) % len(st['options'])
                    await page.locator('.ls-opts .opt').nth(idx).click(); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(250)
                    if snap: await shot(snap)
                    R.setdefault('mc_fb', []).append(await ev("({answer: (document.querySelector('.fb-answer') || {}).textContent || '', left: (document.querySelector('.fb-left') || {}).textContent, mark: document.querySelector('.fb-mark').className})"))
                    await verder(); return t
                if t == 'multi':
                    picks = st['correct']
                    await ev(f"(() => {{ const want = {json.dumps(picks)}; document.querySelectorAll('.chip-btn').forEach(b => {{ if (want.includes(b.textContent)) b.click(); }}); }})()")
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150); await verder(); return t
                if t == 'tap':
                    v = st['valid'][0]
                    await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True)
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150); await verder(); return t
                if t == 'play':
                    await page.locator('.ls-foot .linkish').click(); await page.wait_for_timeout(200); return t
                return t
            async def run(wrong_at=(), snaps=None):
                kinds = []; n = 0
                while n < 60:
                    st = await ev('__fj.lesson()')
                    if not st or st.get('finished'): break
                    k = await answer(right=(n not in wrong_at), snap=(snaps or {}).get(n))
                    kinds.append(k); n += 1
                await page.wait_for_timeout(500)
                return kinds
            async def end_info():
                return await ev("({title: document.querySelector('.end-title').textContent, stats: Array.from(document.querySelectorAll('.end-stats div')).map(d => d.textContent), badges: Array.from(document.querySelectorAll('.end-badge b')).map(b => b.textContent)})")
            async def start_hals_node():
                await go('#voortgang'); await go('#')
                if await ev("!document.querySelector('.track-switch .on[data-track=\"hals\"]')"): await page.click('.track-switch button[data-track="hals"]'); await page.wait_for_timeout(300)
                await page.locator('.node.next').first.click(); await page.wait_for_timeout(250)
                R.setdefault('sheets', []).append(await ev("document.querySelector('.sheet .help').textContent"))
                await page.click('.sheet button.primary')
                return await wait_lesson()

            # ---------- startscherm ----------
            await page.goto(f'http://localhost:{PORT}/index.html'); await ev('localStorage.clear()')
            await ev(f"localStorage.setItem('fretjacht.stats', JSON.stringify({{xp: 135, days: {{'{day(-1)}': {{secs: 1000, xp: 60}}, '{day(0)}': {{secs: 260, xp: 20}}}}, notes: {{items: {{}}, found: 42, totalTime: 80, best: 1.1, streak: 0, bestStreak: 3}}, topics: {{'twelve-tones': {{r: 26, w: 4}}}}}}))")
            await page.reload(); await page.wait_for_timeout(1200)
            R['home'] = await ev("({level: document.querySelector('.hh-eyebrow').textContent, title: document.querySelector('.hh-title').textContent, say: document.querySelector('.hh-say').textContent, stats: Array.from(document.querySelectorAll('.hh-stat')).map(e => e.textContent), goal: document.querySelector('.hh-goal-t b').textContent, meter: document.querySelectorAll('#homeHero .lv-meter i.on').length})")
            check('Startscherm: niveau, titel en XP-meter', R['home']['level'] == 'Fretjacht niveau 2' and R['home']['title'] == 'Snarenplukker' and R['home']['meter'] > 10, R['home'])
            check('Startscherm: reeks, noten, nauwkeurigheid', R['home']['stats'] == ['1dag op rij', '42noten gevonden', '87%goed beantwoord'], R['home']['stats'])
            check('Startscherm: dagdoel in woorden', R['home']['goal'] == '4 van 15 minuten', R['home']['goal'])
            R['header'] = await ev("({chip: document.querySelector('#goalChip').textContent, label: document.querySelector('#goalChip').getAttribute('aria-label'), h1: document.querySelector('#title').scrollWidth <= document.querySelector('#title').clientWidth + 1})")
            check('Kop: dagdoel met "min" en past', R['header']['chip'] == '4/15min' and 'minuten' in R['header']['label'] and R['header']['h1'], R['header'])
            R['course_head'] = await ev("({text: document.querySelector('.track-head b').textContent, dots: document.querySelectorAll('.track-head .tdots i').length})")
            check('Muziektheorie: les 1 van 8 met stippen', R['course_head']['text'] == 'Cursus: les 1 van 8' and R['course_head']['dots'] == 8, R['course_head'])
            R['unit_count'] = await ev("document.querySelector('.uh-count').textContent")
            check('Unit-teller in woorden', R['unit_count'] == '0 van 6', R['unit_count'])
            await page.wait_for_timeout(600); await shot('home')
            # niveau omhoog: melding met confetti
            await ev('__fj.addXP(20)')
            R['levelup'] = []
            for k in range(50):
                f = await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
                R['levelup'] += [x for x in f if x not in R['levelup']]
                if any('Niveau 3' in x for x in R['levelup']): break
                await page.wait_for_timeout(150)
            check('Niveau omhoog: melding', any('Niveau 3: Straatmuzikant!' in f for f in R['levelup']), R['levelup'])
            await page.wait_for_timeout(500); await shot('levelup'); await page.wait_for_timeout(3200)
            # ---------- inhoud nakijken: elke gegenereerde vraag, plek en uitleg klopt ----------
            R['content'] = await ev("""(() => {
              const OPEN = [64, 59, 55, 50, 45, 40], NAT = [0, 2, 4, 5, 7, 9, 11], NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'], bad = [];
              for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) for (let r = 0; r < 25; r++) {
                for (const it of __fj.halsGen(i, k)) {
                  if (it.type === 'name') { const pc = (OPEN[it.s] + it.f) % 12; if (pc !== it.pc || it.f < 0 || it.f > 12) bad.push(['name', i, k, it.s, it.f, it.pc]); if (i < 6 && !NAT.includes(pc)) bad.push(['nat', i, k, it.s, it.f]); if (!it.all && !NAT.includes(pc)) bad.push(['keys', i, k, it.s, it.f]); }
                  if (it.type === 'tapall') {
                    if (!it.valid.length) bad.push(['empty', i, k, it.prompt]);
                    for (const p of it.valid) if ((OPEN[p.s] + p.f) % 12 !== it.pc) bad.push(['spot', i, k, it.prompt, p]);
                    for (const s of it.strings) for (let f = 0; f <= 12; f++) if ((OPEN[s] + f) % 12 === it.pc && !it.valid.some(p => p.s === s && p.f === f)) bad.push(['missing', i, k, it.prompt, s, f]);
                  }
                  if (it.type === 'learn') for (const m of (it.neck && it.neck.marks) || []) { const pc = (OPEN[m.s] + m.f) % 12; if (m.label !== NAMES[pc]) bad.push(['label', i, it.prompt, m.s, m.f, m.label, NAMES[pc]]); }
                }
              }
              return bad.slice(0, 10);
            })()""")
            check('Inhoud: alle vragen, plekken en stippen kloppen', not R['content'], R['content'])
            levels = await ev('__fj.halsLevels()')
            NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']; OPEN = [64, 59, 55, 50, 45, 40]
            bad = []
            for i, L in enumerate(levels):
                if not L['nat']: continue
                s = L['strings'][0]
                for f in L['anchors']:
                    nm = NAMES[(OPEN[s] + f) % 12]
                    if not re.search(rf'([Ff]ret {f}\b[^.]{{0,40}}\b{nm}\b|\b{nm}\b[^.]{{0,60}}\b(fret|op) {f}\b)', L['anchorText']): bad.append([L['title'], f, nm])
                if L.get('ex'):
                    (s1, f1), (s2, f2) = L['ex']
                    if (OPEN[s1] + f1) % 12 != (OPEN[s2] + f2) % 12: bad.append([L['title'], 'ex', L['ex']])
            R['anchors'] = bad
            check('Inhoud: ankerpunten en voorbeelden kloppen', not bad, bad)

            # ---------- Halsjacht niveau 1 ----------
            st = await start_hals_node()
            check('Halsjacht start met uitleg', st and st['type'] == 'learn', st)
            kinds = await run(snaps={0: 'learn1', 1: 'learn2', 4: 'learn_name'})
            R['learn_kinds'] = kinds
            e = await end_info(); R['learn_end'] = e
            check('Leren: uitlegkaarten en daarna vragen', kinds[:3] == ['learn', 'learn', 'learn'] and kinds.count('name') == 3, kinds)
            check('Leren klaar', 'Leren' in e['title'], e)
            await page.wait_for_timeout(500); await shot('learn_end')
            await verder(); await page.wait_for_timeout(400)
            # herkennen: één fout
            st = await start_hals_node()
            kinds = await run(wrong_at=(0,), snaps={0: 'name_wrong', 2: 'name_right'})
            e = await end_info(); R['recog_end'] = e; R['recog_kinds'] = kinds
            wrong = R['name_fb'][3] if len(R['name_fb']) > 3 else {}
            R['name_wrong'] = wrong
            check('Herkennen: fout toont kruisje, pijl met antwoord en de plek', 'bad' in wrong.get('mark', '') and ' op ' in wrong.get('answer', '') and wrong.get('reveal'), wrong)
            check('Herkennen: toetsen groen en rood', any('right' in k for k in wrong.get('keys', [])) and any('wrong' in k for k in wrong.get('keys', [])), wrong)
            check('Feedback: nog N vragen', bool(re.match(r'nog \d+ vragen?|klaar!', wrong.get('left', ''))), wrong.get('left'))
            check('Herkennen gehaald met 1 fout, snelheid per noot', e['title'] in ('Herkennen gehaald!',) and any(s.startswith('Per noot') for s in e['stats']), e)
            await page.wait_for_timeout(500); await shot('recog_end')
            await verder(); await page.wait_for_timeout(400)
            R['bin_after'] = await ev('__fj.bin()')
            check('Fout herkende noot staat in de foutenbak', any(x['type'] == 'name' for x in R['bin_after']), R['bin_after'])
            # toepassen: één misser
            st = await start_hals_node()
            check('Toepassen: tik alle plekken', st and st['type'] == 'tapall', st)
            kinds = await run(wrong_at=(0,), snaps={0: 'tapall_done', 1: 'tapall_next'})
            check('Toepassen: foute tik laat de noot daar zien', R.get('tap_wrong', {}).get('wrong') and R['tap_wrong'].get('label'), R.get('tap_wrong'))
            e = await end_info(); R['apply_end'] = e
            check('Toepassen gehaald', e['title'].startswith('Toepassen') and ('gehaald' in e['title'] or 'foutloos' in e['title']), e)
            check('Eindscherm toont nieuw plectrum Lage E beheerst', 'Lage E beheerst' in e['badges'], e['badges'])
            await page.wait_for_timeout(700); await shot('apply_end')
            await verder(); await page.wait_for_timeout(600)
            R['hals_state'] = await ev('__fj.hals()')
            R['badges'] = await ev('Object.keys(__fj.progress().badges)')
            check('Niveau 1 beheerst, volgende: A-snaar leren', R['hals_state']['levels'][0] and R['hals_state']['next'] == {'level': 2, 'step': 'Leren'}, R['hals_state'])
            check('Plectrum: Lage E beheerst', 'halsE' in R['badges'], R['badges'])
            await shot('hals_after')
            R['hals_head'] = await ev("document.querySelector('.track-head b').textContent")
            check('Halsjacht-kop: 1 van 8 beheerst', R['hals_head'] == '1 van 8 niveaus beheerst', R['hals_head'])
            # Oefen vandaag neemt de Halsjacht mee
            await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan'] = await ev("Array.from(document.querySelectorAll('.plan li b')).map(e => e.textContent)")
            check('Oefen vandaag: stap Halsjacht', 'Halsjacht' in R['plan'], R['plan'])
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            # niveau 7 (kruizen en mollen): uitleg en 12 toetsen
            await page.locator('#unit-H7 .node').first.click(); await page.wait_for_timeout(250); await page.click('.sheet button.primary'); await wait_lesson()
            for i in range(3): await answer(True)
            st = await ev('__fj.lesson()')
            R['acc_keys'] = await ev("document.querySelectorAll('.keypad .key').length")
            check('Kruizen en mollen: 12 toetsen', st and st['type'] == 'name' and R['acc_keys'] == 12, [st, R['acc_keys']])
            await shot('keypad12')
            await page.click('.ls-close'); await page.wait_for_timeout(200); await page.locator('.sheet button', has_text='Stoppen').click(); await page.wait_for_timeout(400)

            # ---------- theorieles: pijl en "nog N" bij een fout ----------
            await page.click('.track-switch button[data-track="theory"]'); await page.wait_for_timeout(300)
            await page.locator('.node.next').first.click(); await page.wait_for_timeout(250); await page.click('.sheet button.primary'); await wait_lesson()
            for i in range(8):
                st = await ev('__fj.lesson()')
                if st['type'] == 'mc': break
                await answer(True)
            await answer(False, snap='mc_wrong')
            fb = R['mc_fb'][-1]
            check('Theorie: fout met kruisje en → antwoord', 'bad' in fb['mark'] and len(fb['answer']) > 2, fb)
            await page.click('.ls-close'); await page.wait_for_timeout(200); await page.locator('.sheet button', has_text='Stoppen').click(); await page.wait_for_timeout(400)

            # ---------- Welke noot? ----------
            await go('#m-noteq')
            vib0 = len(await ev('window.__vib'))
            for i in range(3):
                q = await ev('__fj.noteq()')
                await page.locator(f'.nq-pad .key[data-pc="{q["pc"]}"]').click(); await page.wait_for_timeout(200)
                if i == 2: R['nq_fb'] = await ev("document.querySelector('.eq-fb').textContent"); await shot('noteq_right')
                await page.wait_for_timeout(1050)
            R['nq_streak'] = await ev("(document.querySelector('.nq-stage .pr-streak.show') || { getAttribute: () => '' }).getAttribute('aria-label') || ''")
            check('Welke noot?: drie goed, reeks', R['nq_streak'] == '3 op rij' and 'Drie op rij' in R.get('nq_fb', ''), [R['nq_streak'], R.get('nq_fb')])
            q = await ev('__fj.noteq()')
            await page.locator(f'.nq-pad .key[data-pc="{next(k for k in [0, 2, 4, 5, 7, 9, 11] if k != q["pc"])}"]').click(); await page.wait_for_timeout(300)
            R['nq_wrong'] = await ev("({fb: document.querySelector('.eq-fb').textContent, reveal: !!document.querySelector('.nq-neck .mk.reveal')})")
            check('Welke noot?: fout toont de noot en de buren', 'Dit is een' in R['nq_wrong']['fb'] and 'In de buurt' in R['nq_wrong']['fb'] and R['nq_wrong']['reveal'], R['nq_wrong'])
            await shot('noteq_wrong')
            check('Welke noot?: trillen bij goed en fout', (await ev('window.__vib'))[vib0:] [-1] == [40, 70, 40])
            await page.locator('.eq-kind button', has_text='Zoek de noot').click(); await page.wait_for_timeout(300)
            q = await ev('__fj.noteq()')
            for v in q['valid']:
                await page.locator(f'.nq-neck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True); await page.wait_for_timeout(90)
            await page.wait_for_timeout(250)
            R['nq_find'] = await ev("document.querySelector('.eq-fb').textContent")
            check('Zoek de noot: alle plekken gevonden', R['nq_find'] and ':' in R['nq_find'], R['nq_find'])
            await shot('noteq_find')
            R['heat'] = await ev("document.querySelectorAll('.heatneck .mk.heat').length")
            check('Halskaart kleurt geoefende plekken', R['heat'] >= 5, R['heat'])
            await page.locator('.nq-stats').scroll_into_view_if_needed(); await page.wait_for_timeout(200); await shot('noteq_stats')

            # ---------- Oefenen en Voortgang ----------
            await go('#oefenen')
            R['pedal'] = await ev("!!document.querySelector('.pedal[data-mode=\"noteq\"]')")
            check('Pedaal Welke noot? in Oefenen', R['pedal'])
            await go('#voortgang')
            R['progress'] = await ev("({level: document.querySelector('.level-card h2').textContent, ladder: document.querySelectorAll('.lc-ladder li').length, tiles: Array.from(document.querySelectorAll('.tile .tile-l')).map(e => e.textContent), badges: document.querySelectorAll('.badge').length, hals: document.querySelector('.hals-row .help').textContent})")
            check('Voortgang: niveaukaart met ladder', R['progress']['level'] == 'Straatmuzikant' and R['progress']['ladder'] == 10, R['progress'])
            check('Voortgang: tegels noten en nauwkeurig', R['progress']['tiles'][:2] == ['Noten gevonden', 'Nauwkeurig'], R['progress']['tiles'])
            check('Voortgang: 20 plectrums en Halsjacht-regel', R['progress']['badges'] == 20 and '1 van 8' in R['progress']['hals'], R['progress'])
            R['meter_on'] = await ev("document.querySelectorAll('.level-card .lv-meter i.on').length")
            check('Voortgang: XP-meter licht op', R['meter_on'] >= 6, R['meter_on'])
            await page.wait_for_timeout(1200); await shot('progress'); await shot('progress_full', full_page=True)
            R['summary'] = await ev('__fj.summary()')
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:14}', json.dumps(v, ensure_ascii=False)[:300])
    print()
    for name, ok, info in CHECKS: print(('OK   ' if ok else 'FOUT ') + name + ('' if ok else '  ' + json.dumps(info, ensure_ascii=False)[:300]))
    print(f'{sum(1 for c in CHECKS if c[1])}/{len(CHECKS)} geslaagd')
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
