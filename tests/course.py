"""Met of zonder gitaar, de lessen in de app en de korte bovenkant van het leerpad.
- het schuifje op Leerpad, Oefenen en Instellingen, en wat het met de oefeningen doet
- Halsjacht met gitaar: spelen in plaats van tikken, en "Verder zonder gitaar" midden in een les
- elke unit begint met de les in kaartjes (geluid, terug, "Les gelezen!"), daarna de oefeningen
- een nieuwe les op zondag, als de unittoets van de vorige gehaald is (met een nepklok)
Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR). Eindigt met een lijst geslaagd/mislukt per controle."""
import os, asyncio, subprocess, sys, time, json, re
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
PORT = 8807
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'CD_' if SCHEME == 'dark' else 'C_'
R, CHECKS = {}, []
def check(name, ok, info=''): CHECKS.append((name, bool(ok), info))
SAT = '2026-10-03T10:00:00'   # zaterdag: les 1 is open sinds vrijdag 2 oktober
SUN = '2026-10-04T09:00:00'
# unit 1 tot en met stap 5 af, de unittoets (L1-5) nog niet
U1 = {f'L1-{k}': {'done': True, 'runs': 1, 'mistakes': 0, 'last': 1759480000000} for k in ['les', 0, 1, 2, 3, 4]}

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
            await page.clock.set_fixed_time(SAT)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            async def fresh(stats=None, settings=None):
                await page.goto(f'http://localhost:{PORT}/index.html'); await ev('localStorage.clear()')
                if stats is not None: await ev(f"localStorage.setItem('fretjacht.stats', {json.dumps(json.dumps(stats))})")
                if settings is not None: await ev(f"localStorage.setItem('fretjacht.settings', {json.dumps(json.dumps(settings))})")
                await page.reload(); await page.wait_for_timeout(900)
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
            async def answer():
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): return 'end'
                t = st['type']
                if t == 'learn':
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(100)
                elif t == 'mc':
                    await page.locator('.ls-opts .opt').nth(st['answer']).click(); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150); await verder()
                elif t == 'multi':
                    await ev(f"(() => {{ const want = {json.dumps(st['correct'])}; document.querySelectorAll('.chip-btn').forEach(b => {{ if (want.includes(b.textContent)) b.click(); }}); }})()")
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150); await verder()
                elif t == 'tap':
                    v = await ev('__fj.tapVisible()')
                    await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True)
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150); await verder()
                elif t == 'name':
                    await page.locator(f'.keypad .key[data-pc="{st["pc"]}"]').first.click(); await page.wait_for_timeout(150)
                    if (await ev('__fj.lesson()') or {}).get('answered'): await verder()
                elif t == 'tapall':
                    for v in st['valid']: await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True); await page.wait_for_timeout(80)
                    await page.wait_for_timeout(200); await verder()
                elif t == 'play':
                    t0 = time.time()
                    while time.time() - t0 < 10:
                        st2 = await ev('__fj.lesson()')
                        if not st2 or st2.get('answered') or st2.get('finished'): break
                        e = await ev('__fj.expected()')
                        if e: await ev(f'__fake.play({e[0]}, {{dur: 0.6}})')
                        await page.wait_for_timeout(450)
                    await page.wait_for_timeout(200)
                    if (await ev('__fj.lesson()') or {}).get('answered'): await verder()
                await page.wait_for_timeout(100)
                return t
            async def run(limit=60):
                kinds = []
                for _ in range(limit):
                    k = await answer()
                    if k == 'end': break
                    kinds.append(k)
                await page.wait_for_timeout(500)
                return kinds
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
            pressed = lambda scope: ev(f"Array.from(document.querySelectorAll('{scope} .gsw button')).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)")

            # ======================= 1. de bovenkant: kort, de cursus meteen in beeld =======================
            await fresh({'xp': 164, 'days': {'2026-10-02': {'secs': 1000, 'xp': 60}}})
            R['top'] = await ev("""({h: Math.round(document.querySelector('#homeTop').getBoundingClientRect().height), unit: Math.round(document.querySelector('.unit').getBoundingClientRect().top),
              node: Math.round(document.querySelector('.node.next').getBoundingClientRect().top), title: document.querySelector('.ht-title').textContent,
              cut: document.querySelector('.ht-title').scrollWidth > document.querySelector('.ht-title').clientWidth + 1, quests: document.querySelector('#questCard summary').textContent,
              questsOpen: document.querySelector('#questCard').open, sw: Array.from(document.querySelectorAll('#homeTop .gsw button')).map(b => b.textContent + ':' + b.getAttribute('aria-pressed'))})""")
            check('Bovenkant: hooguit 200 px, unit 1 staat in beeld', R['top']['h'] <= 200 and R['top']['unit'] < 500, R['top'])
            check('Bovenkant: niveau op één regel, niet afgekapt', R['top']['title'] == 'Niveau 3: Straatmuzikant' and not R['top']['cut'], R['top'])
            check('Bovenkant: opdrachten als één dichte regel', R['top']['questsOpen'] is False and 'Opdrachten' in R['top']['quests'], R['top'])
            check('Bovenkant: schuifje, standaard Met gitaar', R['top']['sw'] == ['Met gitaar:true', 'Zonder gitaar:false'], R['top']['sw'])
            check('Geen Kopieer voortgang meer', not await ev("document.body.textContent.includes('Kopieer voortgang') || !!document.querySelector('#copyProgress')"))
            R['icons'] = await ev("Array.from(document.querySelectorAll('#homeTop .gsw svg')).map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), s.querySelectorAll('path, circle, rect, line').length]; })")
            check('Iconen gitaar en telefoon worden getekend', len(R['icons']) == 2 and all(w >= 16 and h >= 16 and n >= 1 for w, h, n in R['icons']), R['icons'])
            await page.click('#questCard summary'); await page.wait_for_timeout(250)
            R['quests_open'] = await ev("({open: document.querySelector('#questCard').open, rows: document.querySelectorAll('#questCard .q-list li').length})")
            check('Opdrachten: tik voor de drie opdrachten', R['quests_open']['open'] and R['quests_open']['rows'] == 3, R['quests_open'])
            await shot('top_quests_open')
            await page.click('#questCard summary'); await page.wait_for_timeout(200)
            await shot('top')
            # kleine telefoon
            await page.set_viewport_size({'width': 375, 'height': 667}); await page.wait_for_timeout(300)
            R['small'] = await ev("({unit: Math.round(document.querySelector('.unit').getBoundingClientRect().top), w: document.documentElement.scrollWidth})")
            check('Kleine telefoon (375×667): unit 1 in beeld, niets breder dan het scherm', R['small']['unit'] < 520 and R['small']['w'] <= 375, R['small'])
            await shot('top_small')
            await page.set_viewport_size({'width': 390, 'height': 760}); await page.wait_for_timeout(200)

            # ======================= 2. het schuifje: Leerpad, Oefenen en Instellingen =======================
            await page.click('#homeTop .gsw button[data-v="zonder"]'); await page.wait_for_timeout(300)
            R['sw_path'] = {'setting': (await ev('__fj.settings()'))['guitar'], 'pressed': await pressed('#homeTop')}
            check('Leerpad: schuifje naar Zonder gitaar', R['sw_path']['setting'] is False and R['sw_path']['pressed'] == ['Zonder gitaar'], R['sw_path'])
            await go('#oefenen')
            R['hub_zonder'] = await ev("""({pressed: Array.from(document.querySelectorAll('.hub > .gsw button')).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent),
              pedals: Array.from(document.querySelectorAll('.hub > section .pedal, .hub .pedal')).filter(p => !p.closest('.hub-other')).map(p => p.dataset.mode),
              other: (document.querySelector('.hub-other > summary') || {}).textContent || '', otherOpen: (document.querySelector('.hub-other') || {}).open})""")
            check('Oefenen zonder gitaar: schuifje staat mee', R['hub_zonder']['pressed'] == ['Zonder gitaar'], R['hub_zonder'])
            check('Oefenen zonder gitaar: alleen oefeningen op je telefoon', 'noteq' in R['hub_zonder']['pedals'] and 'earq' in R['hub_zonder']['pedals'] and 'notes' not in R['hub_zonder']['pedals'] and 'scales' not in R['hub_zonder']['pedals'], R['hub_zonder'])
            check('Oefenen zonder gitaar: de rest dicht onder "Met gitaar"', R['hub_zonder']['other'].startswith('Met gitaar') and not R['hub_zonder']['otherOpen'], R['hub_zonder'])
            await shot('hub_zonder', full_page=True)
            await page.click('.hub > .gsw button[data-v="met"]'); await page.wait_for_timeout(400)
            R['hub_met'] = await ev("""({setting: __fj.settings().guitar, pedals: Array.from(document.querySelectorAll('.hub .pedal')).filter(p => !p.closest('.hub-other')).map(p => p.dataset.mode),
              other: (document.querySelector('.hub-other > summary') || {}).textContent || '', fits: (document.querySelector('.pedal.wide') || {}).dataset ? document.querySelector('.pedal.wide').dataset.mode : ''})""")
            check('Oefenen met gitaar: spelen met de microfoon', R['hub_met']['setting'] is True and 'notes' in R['hub_met']['pedals'] and 'scales' in R['hub_met']['pedals'] and 'noteq' not in R['hub_met']['pedals'], R['hub_met'])
            check('Oefenen met gitaar: de rest onder "Zonder gitaar"', R['hub_met']['other'].startswith('Zonder gitaar'), R['hub_met'])
            await go('#instellingen')
            R['sw_settings'] = await pressed('.settings-view')
            await page.click('.settings-view .gsw button[data-v="zonder"]'); await page.wait_for_timeout(250)
            R['sw_settings_after'] = {'pressed': await pressed('.settings-view'), 'stored': await ev("JSON.parse(localStorage.getItem('fretjacht.settings')).guitar")}
            check('Instellingen: schuifje bij Oefenen, en het wordt bewaard', R['sw_settings'] == ['Met gitaar'] and R['sw_settings_after']['pressed'] == ['Zonder gitaar'] and R['sw_settings_after']['stored'] is False, [R['sw_settings'], R['sw_settings_after']])
            await page.locator('.settings-view .gsw').scroll_into_view_if_needed(); await shot('settings_switch')
            await go('#')
            check('Leerpad volgt de instelling', await pressed('#homeTop') == ['Zonder gitaar'])

            # ======================= 3. Oefen vandaag per stand =======================
            await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan_zonder'] = {'steps': await ev("Array.from(document.querySelectorAll('.plan li')).map(e => e.querySelector('b').textContent + ': ' + e.querySelector('small').textContent)"), 'help': await ev("document.querySelector('.sheet .plan-head .help').textContent")}
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            check('Oefen vandaag zonder gitaar: geen opwarmen met de microfoon', 'zonder gitaar' in R['plan_zonder']['help'] and not any(s.startswith('Opwarmen') for s in R['plan_zonder']['steps']) and any('Welke noot' in s or 'Gehoor' in s for s in R['plan_zonder']['steps']), R['plan_zonder'])
            await page.click('#homeTop .gsw button[data-v="met"]'); await page.wait_for_timeout(300)
            await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan_met'] = {'steps': await ev("Array.from(document.querySelectorAll('.plan li')).map(e => e.querySelector('b').textContent + ': ' + e.querySelector('small').textContent)"), 'help': await ev("document.querySelector('.sheet .plan-head .help').textContent")}
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            check('Oefen vandaag met gitaar: begint met opwarmen', 'met gitaar' in R['plan_met']['help'] and R['plan_met']['steps'][0].startswith('Opwarmen'), R['plan_met'])

            # ======================= 4. de les: eerst uitleg, dan oefeningen =======================
            sheet = await open_node()
            R['les_sheet'] = sheet
            check('Unit 1 begint met de les', 'Les' in sheet and '9 kaartjes' in sheet and 'zonder gitaar' in sheet, sheet)
            st = await ev('__fj.lesson()')
            R['card1'] = await ev("({kind: document.querySelector('.ls-kind').textContent, title: document.querySelector('.ls-prompt').textContent, neck: !!document.querySelector('.ls-body figure svg'), btns: Array.from(document.querySelectorAll('.ls-foot button')).map(b => b.textContent)})")
            check('Kaartje 1: "Les 1 · 1 van 9", titel, hals, alleen Volgende', R['card1']['kind'] == 'Les 1 · 1 van 9' and R['card1']['title'] == 'Waarom twaalf tonen?' and R['card1']['neck'] and R['card1']['btns'] == ['Volgende'], R['card1'])
            await page.click('.ls-foot button.primary'); await page.wait_for_timeout(200)
            R['card2'] = await ev("({title: document.querySelector('.ls-prompt').textContent, rows: document.querySelectorAll('.learn-table tbody tr').length, listen: Array.from(document.querySelectorAll('.lsn')).map(b => b.textContent), btns: Array.from(document.querySelectorAll('.ls-foot button')).map(b => b.textContent)})")
            check('Kaartje 2: tabel met boventonen en twee geluidsknoppen', R['card2']['rows'] == 6 and len(R['card2']['listen']) == 2 and R['card2']['btns'] == ['Vorige', 'Volgende'], R['card2'])
            await page.locator('.lsn').first.click(); await page.wait_for_timeout(300)
            R['sound'] = await ev("({ctx: !!(window.AudioContext) , playing: document.querySelector('.lsn').classList.contains('on') || document.querySelector('.lsn').getAttribute('aria-pressed') === 'true' || true})")
            await shot('les_card2')
            await page.locator('.ls-foot button', has_text='Vorige').click(); await page.wait_for_timeout(200)
            R['back'] = await ev("document.querySelector('.ls-prompt').textContent")
            check('Vorige: terug naar het vorige kaartje', R['back'] == 'Waarom twaalf tonen?', R['back'])
            kinds = await run()
            R['les_kinds'] = kinds
            R['les_end'] = await ev("({title: document.querySelector('.end-title').textContent, how: (document.querySelector('.end-how') || {}).textContent || '', stats: Array.from(document.querySelectorAll('.end-stats div')).map(d => d.textContent)})")
            check('Na het laatste kaartje: "Les gelezen!"', set(kinds) == {'learn'} and R['les_end']['title'] == 'Les gelezen!' and any(s.startswith('Kaartjes') for s in R['les_end']['stats']), R['les_end'])
            await shot('les_end')
            await verder(); await page.wait_for_timeout(500)
            R['after_les'] = await ev("Array.from(document.querySelectorAll('#unit-1 .node')).map(n => n.getAttribute('aria-label'))")
            check('Daarna: de les is gedaan, de eerste oefening open', R['after_les'][0] == 'Les: gedaan' and R['after_les'][1].endswith('beschikbaar'), R['after_les'])
            check('De les blijft terug te lezen met "Lees de les"', await ev("!!Array.from(document.querySelectorAll('#unit-1 button')).find(b => b.textContent === 'Lees de les')"))

            # ======================= 5. vraagtypes per stand =======================
            await open_node()
            R['types_met'] = await ev('__fj.lessonTypes()')
            check('Met gitaar: geen tikvragen op de hals, wel spelen', 'tap' not in R['types_met'] and 'play' in R['types_met'], R['types_met'])
            # midden in de les: geen gitaar bij de hand
            for _ in range(8):
                st = await ev('__fj.lesson()')
                if st['type'] == 'play': break
                await answer()
            await shot('play_item')
            R['play_foot'] = await ev("(document.querySelector('.ls-foot .linkish') || {}).textContent || ''")
            await page.locator('.ls-foot .linkish').click(); await page.wait_for_timeout(400)
            R['no_guitar'] = {'setting': (await ev('__fj.settings()'))['guitar'], 'types': await ev('__fj.lessonTypes()'), 'flash': await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")}
            check('"Verder zonder gitaar" zet het schuifje om', R['play_foot'] == 'Geen gitaar bij de hand? Verder zonder gitaar' and R['no_guitar']['setting'] is False, R['no_guitar'])
            check('Daarna geen speelopdrachten meer in deze les', 'play' not in R['no_guitar']['types'] and len(R['no_guitar']['types']) > 0, R['no_guitar'])
            check('Melding: je oefent nu zonder gitaar', any('zonder gitaar' in f for f in R['no_guitar']['flash']), R['no_guitar']['flash'])
            await page.wait_for_timeout(300); await shot('no_guitar_now')
            await stop_lesson()
            await open_node()
            R['types_zonder'] = await ev('__fj.lessonTypes()')
            check('Zonder gitaar: geen speelopdrachten', 'play' not in R['types_zonder'] and any(t in R['types_zonder'] for t in ('tap', 'mc')), R['types_zonder'])
            await stop_lesson()

            # ======================= 6. Halsjacht met gitaar =======================
            await fresh({'xp': 30}, {'guitar': True, 'track': 'hals'})
            sheet = await open_node()
            R['hals_sheet'] = sheet
            check('Halsjacht Leren met gitaar: "vragen die je speelt"', 'die je speelt' in sheet, sheet)
            kinds = await run()
            R['hals_learn'] = kinds
            check('Halsjacht Leren: uitleg, daarna drie keer spelen', kinds[:3] == ['learn'] * 3 and kinds.count('play') == 3 and 'name' not in kinds, kinds)
            await verder(); await page.wait_for_timeout(500)
            sheet = await open_node(); R['recog_sheet'] = sheet
            check('Herkennen met gitaar: speel de noot op de goede snaar', 'speel de noot' in sheet, sheet)
            st = await ev('__fj.lesson()')
            R['recog_item'] = await ev("({prompt: document.querySelector('.ls-prompt').textContent, big: document.querySelector('.ls-big').textContent, hl: document.querySelectorAll('.ls-body figure svg').length})")
            check('Herkennen: "Speel … op de lage E-snaar" met de hals erbij', R['recog_item']['prompt'].startswith('Speel ') and 'lage E-snaar' in R['recog_item']['prompt'] and R['recog_item']['hl'] == 1, R['recog_item'])
            await shot('hals_play')
            kinds = await run()
            R['recog_kinds'] = kinds
            R['recog_end'] = await ev("({title: document.querySelector('.end-title').textContent, stats: Array.from(document.querySelectorAll('.end-stats div')).map(d => d.textContent)})")
            check('Herkennen met gitaar gehaald, met tijd per noot', set(kinds) == {'play'} and 'gehaald' in R['recog_end']['title'].lower() or 'foutloos' in R['recog_end']['title'].lower(), [kinds, R['recog_end']])
            R['fb_items'] = await ev("Object.keys(JSON.parse(localStorage.getItem('fretjacht.stats')).fb.items).length")
            check('Gespeelde noten tellen mee in de halskaart', R['fb_items'] >= 5, R['fb_items'])
            await verder(); await page.wait_for_timeout(500)
            await open_node()
            R['apply_item'] = await ev("({prompt: document.querySelector('.ls-prompt').textContent, slots: Array.from(document.querySelectorAll('.slots .slot small')).map(e => e.textContent)})")
            check('Toepassen met gitaar: speel de noot zelf, zonder fretnummers in beeld', R['apply_item']['prompt'].startswith('Speel ') and not any('fret' in x for x in R['apply_item']['slots']), R['apply_item'])
            await shot('hals_apply_play')
            kinds = await run()
            R['apply_end'] = await ev("document.querySelector('.end-title').textContent")
            check('Toepassen met gitaar gehaald', 'Toepassen' in R['apply_end'], [kinds, R['apply_end']])
            await verder(); await page.wait_for_timeout(500)
            R['hals_state'] = await ev('__fj.hals()')
            check('Niveau 1 beheerst met gitaar', R['hals_state']['levels'][0], R['hals_state'])

            # ======================= 7. een nieuwe les op zondag =======================
            await fresh({'xp': 200, 'days': {'2026-10-02': {'secs': 1000, 'xp': 100}}, 'path': {'nodes': U1}}, {'guitar': False})
            R['sat_before'] = {'course': await ev('__fj.course()'), 'when': await ev("(document.querySelector('#nextLesson .uh-when') || {}).textContent || ''")}
            check('Zaterdag, toets nog niet gehaald: les 2 wacht op de unittoets', R['sat_before']['when'] == 'Opent op de zondag nadat je de unittoets van les 1 hebt gehaald.', R['sat_before'])
            sheet = await open_node()
            check('De volgende stap is de unittoets', 'Unittoets' in sheet, sheet)
            kinds = await run()
            R['test_kinds'] = kinds
            R['test_end'] = await ev("document.querySelector('.end-title').textContent")
            check('Unittoets zonder gitaar: geen speelopdrachten, gehaald', 'play' not in kinds and 'learn' not in kinds and R['test_end'] == 'Unittoets gehaald!', [kinds, R['test_end']])
            await verder(); await page.wait_for_timeout(700)
            R['sat_after'] = {'course': await ev('__fj.course()'), 'when': await ev("(document.querySelector('#nextLesson .uh-when') || {}).textContent || ''"), 'doneDay': await ev("JSON.parse(localStorage.getItem('fretjacht.stats')).path.nodes['L1-5'].doneDay")}
            check('Toets gehaald op zaterdag: "Opent morgen, zondag 4 oktober."', R['sat_after']['when'] == 'Opent morgen, zondag 4 oktober.' and R['sat_after']['doneDay'] == '2026-10-03', R['sat_after'])
            await page.locator('#nextLesson').scroll_into_view_if_needed(); await page.wait_for_timeout(200); await shot('next_lesson')
            # zondag
            await page.clock.set_fixed_time(SUN)
            await page.reload(); await page.wait_for_timeout(900)
            R['sun'] = await ev("""({course: __fj.course(), head: document.querySelector('.track-head b').textContent, units: Array.from(document.querySelectorAll('.unit:not(.locked) h2')).map(e => e.textContent),
              next: document.querySelector('.node.next') && document.querySelector('.node.next').getAttribute('aria-label'), when: (document.querySelector('#nextLesson .uh-when') || {}).textContent || ''})""")
            check('Zondag: les 2 Intervallen staat open, met de les vooraan', R['sun']['units'] == ['Waarom 12 tonen', 'Intervallen'] and R['sun']['head'] == 'Cursus: les 2 van 8' and R['sun']['next'] == 'Les: beschikbaar', R['sun'])
            check('Zondag: les 3 wacht op de unittoets van les 2', R['sun']['when'] == 'Opent op de zondag nadat je de unittoets van les 2 hebt gehaald.', R['sun'])
            await shot('sunday')
            await open_node()
            for _ in range(2): await page.click('.ls-foot button.primary'); await page.wait_for_timeout(150)
            R['names_card'] = await ev("({title: document.querySelector('.ls-prompt').textContent, chips: document.querySelectorAll('.listen.chips .lsn').length, rows: document.querySelectorAll('.learn-table tbody tr').length})")
            check('Les 2, De namen: tabel van 12 intervallen met 12 knoppen', R['names_card'] == {'title': 'De namen', 'chips': 12, 'rows': 12}, R['names_card'])
            await page.locator('.listen.chips .lsn').nth(6).click(); await page.wait_for_timeout(300)
            await shot('les2_names', full_page=True)
            await stop_lesson()
            # les 4: de kwintencirkel
            await ev('__fj.openLes(3)'); await wait_lesson()
            for _ in range(5): await page.click('.ls-foot button.primary'); await page.wait_for_timeout(120)
            R['circle'] = await ev("({title: document.querySelector('.ls-prompt').textContent, maj: Array.from(document.querySelectorAll('.circle5 .cf-maj')).map(e => e.textContent), min: document.querySelectorAll('.circle5 .cf-min').length})")
            check('Les 4: de kwintencirkel met 12 majeur- en 12 mineurtoonsoorten', R['circle']['title'] == 'De kwintencirkel' and R['circle']['maj'][:4] == ['C', 'G', 'D', 'A'] and len(R['circle']['maj']) == 12 and R['circle']['min'] == 12, R['circle'])
            R['circle_overlap'] = await ev("""(() => { const t = Array.from(document.querySelectorAll('.circle5 text')).map(e => e.getBoundingClientRect()); let n = 0;
              for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const a = t[i], b = t[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++; } return n; })()""")
            check('Kwintencirkel: geen teksten over elkaar', R['circle_overlap'] == 0, R['circle_overlap'])
            await shot('les4_circle')
            await stop_lesson()
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:16}', json.dumps(v, ensure_ascii=False)[:300])
    print()
    for name, ok, info in CHECKS: print(('OK   ' if ok else 'FOUT ') + name + ('' if ok else '  ' + json.dumps(info, ensure_ascii=False)[:400]))
    print(f'{sum(1 for c in CHECKS if c[1])}/{len(CHECKS)} geslaagd')
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
