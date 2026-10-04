"""Het pad Gehoor: tien niveaus met elk Leren, Herkennen en Toepassen.
- het derde pad naast Muziektheorie en de Halsjacht, ook op een kleine telefoon
- Leren: uitleg met geluid, daarna drie luistervragen; het geluid speelt vanzelf, Luister speelt het nog een keer
- bij een fout: "Hoor jouw keuze" en "Hoor het goede antwoord"
- Toepassen zonder gitaar: naspelen op toetsen die klinken, missers tellen mee
- Toepassen met gitaar: naspelen op de gitaar (nep-microfoon), en "Verder zonder gitaar" midden in een vraag
- niveau beheerst: plectrum Goed gehoor; Oefen vandaag, Voortgang, Vrij oefenen, Herhalen en opdrachten
Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR). Eindigt met een lijst geslaagd/mislukt per controle."""
import os, asyncio, subprocess, sys, time, json, re
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
PORT = 8809
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'GD_' if SCHEME == 'dark' else 'G_'
R, CHECKS = {}, []
def check(name, ok, info=''): CHECKS.append((name, bool(ok), info))
NOW = '2026-10-04T10:00:00'

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
            await page.clock.set_fixed_time(NOW)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            async def fresh(stats=None, settings=None):
                await page.goto(f'http://localhost:{PORT}/index.html'); await ev('localStorage.clear()')
                if stats is not None: await ev(f"localStorage.setItem('fretjacht.stats', {json.dumps(json.dumps(stats))})")
                if settings is not None: await ev(f"localStorage.setItem('fretjacht.settings', {json.dumps(json.dumps(settings))})")
                await page.reload(); await page.wait_for_timeout(900)
                await ev("document.querySelectorAll('.flash').forEach(x => x.remove())")
            async def wait_lesson(timeout=6):
                t0 = time.time()
                while time.time() - t0 < timeout:
                    if not await ev('__fj.loading()'):
                        st = await ev('__fj.lesson()')
                        if st: return st
                    await page.wait_for_timeout(60)
                return None
            async def verder():
                await page.locator('.ls-foot button', has_text=re.compile('^Verder$')).first.click(); await page.wait_for_timeout(150)
            async def open_node(sel='.node.next'):
                await page.locator(sel).first.click(); await page.wait_for_timeout(250)
                sheet = await ev("document.querySelector('.sheet').innerText")
                await page.click('.sheet button.primary')
                await wait_lesson()
                return sheet
            async def stop_lesson():
                await page.click('.ls-close'); await page.wait_for_timeout(200)
                if await page.locator('.sheet button', has_text='Stoppen').count(): await page.locator('.sheet button', has_text='Stoppen').click()
                await page.wait_for_timeout(400)
            # tik op de toetsen wat de app verwacht; miss: eerst één foute toets
            async def pad_play(miss=False):
                st = await ev('__fj.lesson()')
                missed = False
                for _ in range(12):
                    st = await ev('__fj.lesson()')
                    if not st or st.get('answered') or st.get('finished') or st['type'] != 'play': break
                    e = (await ev('__fj.expected()'))[0]
                    keys = await ev('__fj.padKeys()')
                    if st['step'] == 'rel': target = e
                    else: target = next(k for k in sorted(keys) if k % 12 == e % 12)
                    if miss and not missed and st['step'] != 'set' and (await ev("document.querySelectorAll('.slots .slot.on').length")) >= 1:
                        wrong = next(k for k in sorted(keys) if k % 12 not in (e % 12, min(keys) % 12) and abs(k - target) <= 4)
                        await page.locator(f'.ear-pad .key[data-midi="{wrong}"]').click(); await page.wait_for_timeout(250)
                        R['miss_toast'] = await ev("document.querySelector('.ls-toast').textContent")
                        R['miss_key'] = await ev(f"document.querySelector('.ear-pad .key[data-midi=\"{wrong}\"]').className")
                        await shot('pad_miss')
                        missed = True
                    await page.locator(f'.ear-pad .key[data-midi="{target}"]').click(); await page.wait_for_timeout(160)
                await page.wait_for_timeout(250)
                return await ev('__fj.lesson()')
            async def mic_play():
                t0 = time.time()
                while time.time() - t0 < 12:
                    st = await ev('__fj.lesson()')
                    if not st or st.get('answered') or st.get('finished') or st['type'] != 'play': break
                    e = await ev('__fj.expected()')
                    if e: await ev(f'__fake.play({e[0]}, {{dur: 0.6}})')
                    await page.wait_for_timeout(480)
                await page.wait_for_timeout(250)
                return await ev('__fj.lesson()')
            async def answer(wrong=False):
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): return 'end'
                if st.get('answered'): await verder(); return 'cont'
                t = st['type']
                if t == 'learn':
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120)
                elif t == 'mc':
                    idx = st['answer'] if not wrong else (st['answer'] + 1) % len(st['options'])
                    await page.locator('.ls-opts .opt').nth(idx).click(); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(200); await verder()
                elif t == 'play':
                    st2 = await (pad_play() if st.get('pad') else mic_play())
                    if st2 and st2.get('answered'): await verder()
                await page.wait_for_timeout(100)
                return t
            async def run(limit=40):
                kinds = []
                for _ in range(limit):
                    k = await answer()
                    if k == 'end': break
                    if k != 'cont': kinds.append(k)
                await page.wait_for_timeout(500)
                return kinds
            end_info = lambda: ev("({title: document.querySelector('.end-title').textContent, stats: Array.from(document.querySelectorAll('.end-stats div')).map(d => d.textContent), moments: Array.from(document.querySelectorAll('.ls-end .moments li b')).map(b => b.textContent)})")

            # ======================= 1. het derde pad =======================
            await fresh({'xp': 40, 'days': {'2026-10-03': {'secs': 600, 'xp': 40}}}, {'guitar': False})
            R['tabs'] = await ev("Array.from(document.querySelectorAll('.track-switch button')).map(b => b.textContent)")
            check('Drie paden: Muziektheorie, Halsjacht en Gehoor', R['tabs'] == ['Muziektheorie', 'Halsjacht', 'Gehoor'], R['tabs'])
            await page.click('.track-switch button[data-track="gehoor"]'); await page.wait_for_timeout(400)
            R['head'] = await ev("""({b: document.querySelector('.track-head b').textContent, dots: document.querySelectorAll('.track-head .tdots i').length, units: Array.from(document.querySelectorAll('.unit h2')).map(e => e.textContent),
              next: document.querySelector('.node.next').getAttribute('aria-label'), labels: Array.from(document.querySelectorAll('#unit-G1 .node-lbl')).map(e => e.textContent), stored: __fj.settings().track,
              free: Array.from(document.querySelectorAll('.uh-link')).map(b => b.textContent).slice(0, 10)})""")
            check('Gehoor: tien niveaus, van kwint en octaaf tot melodietjes', R['head']['dots'] == 10 and len(R['head']['units']) == 10 and R['head']['units'][0] == 'Kwint en octaaf' and R['head']['units'][-1] == 'Korte melodietjes', R['head'])
            check('Gehoor: per niveau Leren, Herkennen en Toepassen; Leren staat klaar', R['head']['labels'] == ['Leren', 'Herkennen', 'Toepassen'] and R['head']['next'] == 'Leren: beschikbaar', R['head'])
            check('Gehoor: het gekozen pad wordt onthouden', R['head']['stored'] == 'gehoor', R['head'])
            check('Gehoor: Vrij oefenen bij de interval- en akkoordniveaus', R['head']['free'].count('Vrij oefenen') == 8, R['head']['free'])
            await shot('path')
            await page.reload(); await page.wait_for_timeout(800)
            check('Na herladen staat Gehoor nog open', await ev("document.querySelector('.track-switch .on').dataset.track") == 'gehoor')
            # kleine telefoon
            await page.set_viewport_size({'width': 375, 'height': 667}); await page.wait_for_timeout(300)
            R['small'] = await ev("""({w: document.documentElement.scrollWidth, cut: Array.from(document.querySelectorAll('.track-switch button span:last-child')).some(s => s.scrollWidth > s.clientWidth + 1),
              btnW: Math.round(document.querySelector('.track-switch button').getBoundingClientRect().width)})""")
            check('Kleine telefoon: drie tabs passen, niets breder dan het scherm', R['small']['w'] <= 375 and not R['small']['cut'], R['small'])
            await shot('path_small')
            await page.set_viewport_size({'width': 390, 'height': 760}); await page.wait_for_timeout(200)

            # ======================= 2. Leren: uitleg, geluid, drie vragen =======================
            sheet = await open_node()
            R['learn_sheet'] = sheet
            check('Leren: blad zegt dat het geluid aan moet', 'Gehoor niveau 1' in sheet and 'geluid' in sheet, sheet)
            R['learn1'] = await ev("({title: document.querySelector('.ls-prompt').textContent, listen: Array.from(document.querySelectorAll('.lsn')).map(b => b.textContent), tip: (document.querySelector('.learn-tip') || {}).textContent || ''})")
            check('Leren: eerste kaartje met een geluidstest en de tip over de stille modus', R['learn1']['title'] == 'Luisteren' and R['learn1']['listen'] == ['Probeer het geluid'] and 'stille modus' in R['learn1']['tip'], R['learn1'])
            n0 = (await ev('__fj.heard()'))['n']
            for _ in range(2): await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150)
            R['learn3'] = await ev("({title: document.querySelector('.ls-prompt').textContent, btns: Array.from(document.querySelectorAll('.ls-foot button')).map(b => b.textContent)})")
            check('Laatste kaartje: De kwint, knop "Naar de vragen"', R['learn3']['title'] == 'De kwint' and R['learn3']['btns'][-1] == 'Naar de vragen', R['learn3'])
            await page.click('.ls-foot button.primary'); await page.wait_for_timeout(900)
            st = await ev('__fj.lesson()')
            h1 = await ev('__fj.heard()')
            R['q1'] = {'st': st, 'heard': h1, 'stage': await ev("({btn: !!document.querySelector('.ear-play'), fret: !!document.querySelector('.ear-fret svg'), kind: document.querySelector('.ls-kind').textContent})")}
            check('Luistervraag: het geluid speelt vanzelf', st['type'] == 'mc' and st['hear'] and h1['n'] > n0 and h1['sp'] and 'n' in h1['sp'], R['q1'])
            check('Luistervraag: de fret met koptelefoon en een knop Luister', R['q1']['stage']['btn'] and R['q1']['stage']['fret'] and R['q1']['stage']['kind'] == 'Luister', R['q1'])
            check('Luistervraag: kiezen tussen kwint en octaaf', sorted(st['options']) == ['octaaf', 'reine kwint'], st['options'])
            await shot('learn_q')
            await page.click('.ear-play'); await page.wait_for_timeout(200)
            check('Luister: speelt het nog een keer', (await ev('__fj.heard()'))['n'] == h1['n'] + 1)
            # fout: vergelijken
            eq0 = await ev("JSON.parse(localStorage.getItem('fretjacht.stats')).earq || {n: {}, ok: {}}")
            await page.locator('.ls-opts .opt').nth((st['answer'] + 1) % 2).click(); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(400)
            R['cmp'] = await ev("Array.from(document.querySelectorAll('.ls-cmp button')).map(b => b.textContent)")
            mine, right = st['options'][(st['answer'] + 1) % 2], st['options'][st['answer']]
            check('Fout: hoor je eigen keuze en het goede antwoord', R['cmp'] == [f'Hoor {mine}', f'Hoor {right}'], R['cmp'])
            n1 = (await ev('__fj.heard()'))['n']
            await page.locator('.ls-cmp .cmp-mine').click(); await page.wait_for_timeout(150)
            hm = await ev('__fj.heard()')
            await page.locator('.ls-cmp .cmp-right').click(); await page.wait_for_timeout(150)
            hr = await ev('__fj.heard()')
            check('Vergelijken speelt twee verschillende geluiden, het goede klinkt als de vraag', hm['n'] == n1 + 1 and hr['n'] == n1 + 2 and hm['sp'] != hr['sp'] and hr['sp'] == h1['sp'], [hm, hr, h1])
            R['wrong_fb'] = await ev("document.querySelector('.fb').innerText")
            check('Fout: uitleg met geheugensteun', 'Denk aan' in R['wrong_fb'], R['wrong_fb'])
            await shot('learn_wrong')
            await verder()
            kinds = await run()
            e = await end_info(); R['learn_end'] = e
            check('Leren klaar', 'Leren' in e['title'], e)
            eq1 = await ev("JSON.parse(localStorage.getItem('fretjacht.stats')).earq")
            check('Luistervragen tellen mee bij Gehoortraining', sum(eq1['n'].values()) >= sum(eq0['n'].values()) + 4 and sum(eq1['ok'].values()) >= 3, eq1)
            await verder(); await page.wait_for_timeout(500)
            check('Herhalen: de foute luistervraag staat klaar', any(x['type'] == 'mc' for x in await ev('__fj.bin()')))

            # ======================= 3. Herkennen: tien luistervragen =======================
            sheet = await open_node()
            check('Herkennen: tien keer, 80% goed', 'Tien keer' in sheet and '80%' in sheet, sheet)
            kinds = await run()
            e = await end_info(); R['recog_end'] = e
            check('Herkennen: tien luistervragen, gehaald', kinds == ['mc'] * 10 and ('gehaald' in e['title'] or 'foutloos' in e['title']), [kinds, e])
            await verder(); await page.wait_for_timeout(500)

            # ======================= 4. Toepassen zonder gitaar: toetsen =======================
            sheet = await open_node()
            check('Toepassen zonder gitaar: op de toetsen in de app', 'toetsen' in sheet, sheet)
            st = await ev('__fj.lesson()')
            R['pad'] = {'st': st, 'keys': await ev('__fj.padKeys()'), 'foot': await ev("Array.from(document.querySelectorAll('.ls-foot button')).map(b => b.textContent)"),
                        'slots': await ev("Array.from(document.querySelectorAll('.slots .slot b')).map(b => b.textContent)"), 'mic': await ev("!!document.querySelector('.heard-line')"), 'kind': await ev("document.querySelector('.ls-kind').textContent")}
            check('Toepassen: naspelen op 13 toetsen, zonder microfoon', st['type'] == 'play' and st['pad'] and len(R['pad']['keys']) == 13 and not R['pad']['mic'] and R['pad']['kind'] == 'Speel na op de toetsen', R['pad'])
            check('Toepassen: knoppen Hint en Laat zien, geen Start microfoon', R['pad']['foot'] == ['Hint', 'Laat zien'], R['pad']['foot'])
            check('Toepassen: de eerste toon staat er al, de tweede is ?', len(R['pad']['slots']) == 2 and R['pad']['slots'][0] != '?' and R['pad']['slots'][1] == '?', R['pad']['slots'])
            await shot('pad')
            # de toetsen klinken
            n2 = (await ev('__fj.heard()'))['n']
            st2 = await pad_play(miss=True)
            R['pad_fb'] = await ev("({title: document.querySelector('.fb-title').textContent, ok: document.querySelector('.ls-foot').classList.contains('ok'), answer: (document.querySelector('.fb-answer') || {}).textContent || ''})")
            check('Een foute toets: "Je tikte …, zoek hoger of lager" en de toets kleurt rood', 'Je tikte' in R.get('miss_toast', '') and ('hoger' in R.get('miss_toast', '') or 'lager' in R.get('miss_toast', '')) and 'miss' in R.get('miss_key', ''), [R.get('miss_toast'), R.get('miss_key')])
            check('Eén misser: toch goed, "op één misser na"', R['pad_fb']['ok'] and 'één misser' in R['pad_fb']['title'] and '→' in R['pad_fb']['answer'], R['pad_fb'])
            await shot('pad_done')
            await verder()
            kinds = await run()
            e = await end_info(); R['apply_end'] = e
            check('Toepassen gehaald, met het plectrum Goed gehoor', 'Toepassen' in e['title'] and 'Nieuwe mijlpaal: Goed gehoor' in e['moments'], e)
            await verder(); await page.wait_for_timeout(500)
            R['g1'] = await ev('__fj.gehoor()')
            check('Niveau 1 beheerst, de volgende stap is niveau 2 Leren', R['g1']['levels'][0] and R['g1']['next'] == {'level': 2, 'step': 'Leren'}, R['g1'])

            # ======================= 5. Toepassen met gitaar =======================
            await ev('__fj.setGuitar(true)'); await page.wait_for_timeout(300)
            await page.click('.track-switch button[data-track="gehoor"]'); await page.wait_for_timeout(300)
            await page.locator('#unit-G1 .node').nth(2).click(); await page.wait_for_timeout(250)
            R['guitar_sheet'] = await ev("document.querySelector('.sheet .help').textContent")
            check('Toepassen met gitaar: de app luistert mee', 'gitaar' in R['guitar_sheet'] and 'luistert' in R['guitar_sheet'], R['guitar_sheet'])
            await page.click('.sheet button.primary'); st = await wait_lesson()
            R['guitar_item'] = {'st': st, 'foot': await ev("Array.from(document.querySelectorAll('.ls-foot button')).map(b => b.textContent)"), 'pad': await ev("!!document.querySelector('.ear-pad')"), 'kind': await ev("document.querySelector('.ls-kind').textContent")}
            check('Met gitaar: geen toetsen, wel Overslaan en "Verder zonder gitaar"', not R['guitar_item']['pad'] and 'Overslaan' in R['guitar_item']['foot'] and any('zonder gitaar' in f for f in R['guitar_item']['foot']) and R['guitar_item']['kind'] == 'Speel na op je gitaar', R['guitar_item'])
            await shot('guitar_item')
            st2 = await mic_play()
            R['guitar_fb'] = await ev("({title: document.querySelector('.fb-title').textContent, ok: document.querySelector('.ls-foot').classList.contains('ok')})")
            check('Met gitaar: nagespeeld via de microfoon', st2 and st2.get('answered') and R['guitar_fb']['ok'], [st2, R['guitar_fb']])
            await page.wait_for_timeout(2600)
            # midden in een vraag: geen gitaar bij de hand
            st = await ev('__fj.lesson()')
            if st and st.get('answered'): await verder(); st = await ev('__fj.lesson()')
            # na automatisch doorgaan negeert de les tikken onderaan even (0,7 s): daarna pas tikken
            await page.wait_for_timeout(800)
            await page.locator('.ls-foot .linkish').click(); await page.wait_for_timeout(500)
            R['switch'] = {'st': await ev('__fj.lesson()'), 'guitar': await ev('__fj.guitar()'), 'keys': len(await ev('__fj.padKeys()'))}
            check('"Verder zonder gitaar": dezelfde vraag, nu op de toetsen', R['switch']['guitar'] is False and R['switch']['st']['type'] == 'play' and R['switch']['st']['pad'] and R['switch']['keys'] >= 13, R['switch'])
            await stop_lesson()

            # ======================= 6. andere niveaus: akkoorden, I–IV–V en melodietjes =======================
            for lvl, step, name in [(6, 1, 'majmin'), (7, 2, 'chord7'), (8, 1, 'prog'), (8, 2, 'prog_play'), (9, 1, 'mel'), (9, 2, 'mel_play')]:
                await ev(f"__fj.lessonWith(__fj.gehoorGen({lvl}, {step}), {{title: 'Gehoor'}})"); await wait_lesson(); await page.wait_for_timeout(700)
                st = await ev('__fj.lesson()')
                R['lvl_' + name] = {'type': st['type'], 'prompt': st['prompt'], 'options': st.get('options'), 'keys': len(await ev('__fj.padKeys()')), 'w': await ev('document.documentElement.scrollWidth')}
                await shot('lvl_' + name)
                kinds = await run()
                e = await end_info()
                R['lvl_' + name]['end'] = e['title']; R['lvl_' + name]['kinds'] = sorted(set(kinds))
                await verder(); await page.wait_for_timeout(300)
            check('Niveau 7: majeur of mineur', R['lvl_majmin']['prompt'] == 'Welk akkoord hoor je?' and sorted(R['lvl_majmin']['options']) == ['majeur', 'mineur'], R['lvl_majmin'])
            check('Niveau 8: alle tonen van het akkoord spelen, op de toetsen', R['lvl_chord7']['type'] == 'play' and R['lvl_chord7']['keys'] >= 13 and R['lvl_chord7']['end'] in ('Foutloos!', 'Les voltooid!'), R['lvl_chord7'])
            check('Niveau 9: I, IV of V herkennen', R['lvl_prog']['type'] == 'mc' and ('Welk akkoord komt daarna?' in R['lvl_prog']['prompt'] or R['lvl_prog']['prompt'] == 'Welk rondje hoor je?'), R['lvl_prog'])
            check('Niveau 9: de grondtonen meespelen', R['lvl_prog_play']['type'] == 'play' and R['lvl_prog_play']['prompt'] == 'Speel de grondtonen mee', R['lvl_prog_play'])
            check('Niveau 10: welke melodie, en de melodie naspelen', R['lvl_mel']['type'] == 'mc' and R['lvl_mel_play']['prompt'] == 'Speel de melodie na' and R['lvl_mel_play']['keys'] >= 12, [R['lvl_mel'], R['lvl_mel_play']])
            check('Toetsen passen op de telefoon', all(R[k]['w'] <= 390 for k in R if k.startswith('lvl_')), {k: R[k]['w'] for k in R if k.startswith('lvl_')})
            # de eerste toon krijg je: nog een keer tikken telt niet als misser, en de toon erna is meteen goed (hier de octaaf, de hoogste toets)
            await ev("__fj.lessonWith(__fj.gehoorGen(0, 2).filter(x => x.skill === 'ear-play-iv-12').slice(0, 1), {title: 'Gehoor'})"); await wait_lesson()
            for _ in range(20):
                if await ev('__fj.padKeys().length'): break
                await page.wait_for_timeout(200)
            keys = sorted(await ev('__fj.padKeys()'))
            R['given'] = {'keys': len(keys), 'guitar': await ev('__fj.guitar()'), 'slots': await ev("Array.from(document.querySelectorAll('.slots .slot')).map(s => s.className.replace('slot ', '') + ':' + s.querySelector('b').textContent)")}
            if keys:
                await page.locator(f'.ear-pad .key[data-midi="{keys[0]}"]').click(); await page.wait_for_timeout(250)
                R['given']['toast'] = await ev("(document.querySelector('.ls-toast') || {}).textContent || ''")
                R['given']['after_first'] = (await ev('__fj.lesson()') or {}).get('answered')
                await page.locator(f'.ear-pad .key[data-midi="{keys[-1]}"]').click(); await page.wait_for_timeout(300)
                st = await ev('__fj.lesson()') or {}
                R['given'].update({'answered': st.get('answered'), 'ok': await ev("!!document.querySelector('.ls-foot.ok')"), 'title': await ev("(document.querySelector('.fb-title') || {}).textContent || ''")})
            g = R['given']
            check('Naspelen: de eerste toon staat al goed; nog een keer tikken is geen misser', g['slots'][:1] and g['slots'][0].startswith('on:') and 'krijg je al' in g.get('toast', '') and g.get('after_first') is False, g)
            check('Naspelen: meteen de tweede toon tikken is goed, zonder misser (octaaf op de hoogste toets)', g.get('answered') and g.get('ok') and 'misser' not in g.get('title', 'misser'), g)
            await run(); await verder(); await page.wait_for_timeout(300)

            # ======================= 7. Herhalen, Oefen vandaag, opdrachten, Voortgang en Vrij oefenen =======================
            await ev("location.hash = '#oefenen'"); await page.wait_for_timeout(500)
            if await page.locator('.srs-card .srs-go').count():
                await page.click('.srs-card .srs-go'); st = await wait_lesson()
                R['srs'] = {'type': st['type'], 'hear': st['hear'], 'bin': st['bin']}
                check('Herhalen: de luistervraag komt terug, met geluid', st['bin'] and st['hear'], R['srs'])
                await shot('srs_ear')
                await run(); await verder(); await page.wait_for_timeout(500)
            else: check('Herhalen: de luistervraag komt terug, met geluid', False, 'geen herhaalknop')
            await ev("location.hash = ''"); await page.wait_for_timeout(500)
            await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan'] = await ev("Array.from(document.querySelectorAll('.plan li')).map(e => e.querySelector('b').textContent + ': ' + e.querySelector('small').textContent)")
            check('Oefen vandaag: een stap Gehoor', any(x.startswith('Gehoor: Niveau 2, Grote en kleine terts') for x in R['plan']), R['plan'])
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            R['earq_count'] = await ev("(JSON.parse(localStorage.getItem('fretjacht.stats')).days['2026-10-04'].c || {}).earq || 0")
            check('Opdracht "Herken … op gehoor" telt mee', R['earq_count'] >= 10, R['earq_count'])
            await ev("location.hash = '#voortgang'"); await page.wait_for_timeout(500)
            R['progress'] = await ev("({row: (document.querySelector('.gehoor-row .help') || {}).textContent || '', badges: document.querySelectorAll('.badge').length, ear: Array.from(document.querySelectorAll('.badge.got b')).map(b => b.textContent)})")
            check('Voortgang: Gehoor-regel en het plectrum Goed gehoor', '1 van 10' in R['progress']['row'] and 'Goed gehoor' in R['progress']['ear'] and R['progress']['badges'] == 22, R['progress'])
            await shot('progress', full_page=True)
            # Vrij oefenen bij niveau 1: Gehoortraining met kwint en octaaf
            await ev("location.hash = ''"); await page.wait_for_timeout(400)
            await page.click('.track-switch button[data-track="gehoor"]'); await page.wait_for_timeout(300)
            before = (await ev('__fj.settings()'))['earq']
            await page.locator('#unit-G1 .uh-link').click(); await page.wait_for_timeout(700)
            R['free'] = {'mode': await ev('__fj.mode()'), 'ivs': (await ev('__fj.settings()'))['earq']['ivs'], 'opts': await ev("Array.from(document.querySelectorAll('.eq-opts .opt')).map(b => b.textContent)")}
            check('Vrij oefenen: Gehoortraining met de intervallen van het niveau', R['free']['mode'] == 'earq' and R['free']['ivs'] == [7, 12] and len(R['free']['opts']) == 2, R['free'])
            await ev("location.hash = ''"); await page.wait_for_timeout(400)
            check('Daarna staan de eigen instellingen van Gehoortraining terug', (await ev('__fj.settings()'))['earq'] == before, [before, (await ev('__fj.settings()'))['earq']])
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:16}', json.dumps(v, ensure_ascii=False)[:300])
    print()
    for name, ok, info in CHECKS: print(('OK   ' if ok else 'FOUT ') + name + ('' if ok else '  ' + json.dumps(info, ensure_ascii=False)[:500]))
    print(f'{sum(1 for c in CHECKS if c[1])}/{len(CHECKS)} geslaagd')
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
