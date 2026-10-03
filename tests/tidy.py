"""Opgeruimd: één Herhalen (geen foutenbak of opfrissen meer), één overzicht van wat je verdiende aan het
eind van een les of sessie, een reservekopie van je voortgang, en een hals met grote tikvakjes op de
telefoon. Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR). Eindigt met een lijst geslaagd/mislukt."""
import os, asyncio, subprocess, sys, time, json, re, tempfile
from datetime import date, timedelta
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
PORT = 8803
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'TD_' if SCHEME == 'dark' else 'T_'
TMP = tempfile.mkdtemp()
R, CHECKS = {}, []
def check(name, ok, info=''): CHECKS.append((name, bool(ok), info))
def day(n): return (date.today() + timedelta(days=n)).isoformat()
Q = {'type': 'mc', 'prompt': 'Hoeveel halve tonen zitten er in een octaaf?', 'options': ['12', '7', '8'], 'answer': 0, 'explain': 'Een octaaf is twaalf halve tonen.'}
Q2 = {'type': 'mc', 'prompt': 'Welke verhouding hoort bij de kwint?', 'options': ['3:2', '2:1', '4:3'], 'answer': 0, 'explain': 'De kwint is 3:2.'}
OLD_WORDS = re.compile(r'foutenbak|opfris|herstel', re.I)
# een tikvraag uit de theorie: A op de lage E (fret 5), tik het octaaf
TAP = {'type': 'tap', 'skill': 'tap-octave', 'prompt': 'Tik dezelfde noot een octaaf hoger', 'sub': 'De A is gemarkeerd.', 'from': 0, 'to': 12,
       'marks': [{'s': 5, 'f': 5, 'kind': 'todo root', 'label': 'A'}], 'valid': [{'s': 3, 'f': 7}, {'s': 2, 'f': 2}, {'s': 4, 'f': 12}], 'explain': 'Twee snaren hoger, twee frets verder.'}

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errors = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 760}, is_mobile=True, has_touch=True, color_scheme=SCHEME, accept_downloads=True)
            await use_local_fonts(ctx)
            page = await ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
            await page.add_init_script(FAKE)
            ev = page.evaluate
            shot = lambda name, **kw: page.screenshot(path=SP + PFX + name + '.png', **kw)
            async def fresh(stats=None, settings=None):
                await page.goto(f'http://localhost:{PORT}/index.html'); await ev('localStorage.clear()')
                if stats is not None: await ev(f"localStorage.setItem('fretjacht.stats', {json.dumps(json.dumps(stats))})")
                if settings is not None: await ev(f"localStorage.setItem('fretjacht.settings', {json.dumps(json.dumps(settings))})")
                await page.reload(); await page.wait_for_timeout(700)
            async def go(h): await ev(f"location.hash = '{h}'"); await page.wait_for_timeout(450)
            async def wait_lesson(timeout=6):
                t0 = time.time()
                while time.time() - t0 < timeout:
                    if not await ev('__fj.loading()'):
                        st = await ev('__fj.lesson()')
                        if st: return st
                    await page.wait_for_timeout(60)
                return None
            async def answer_mc(right=True):
                st = await ev('__fj.lesson()')
                idx = st['answer'] if right else (st['answer'] + 1) % len(st['options'])
                await page.locator('.ls-opts .opt').nth(idx).click()
                await page.click('.ls-foot button.primary'); await page.wait_for_timeout(350)
                fb = await ev("({title: (document.querySelector('.fb-title') || {}).textContent, note: (document.querySelector('.fb-note') || {}).textContent || '', kind: (document.querySelector('.ls-kind') || {}).textContent || ''})")
                await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(150)
                return fb
            async def finish(right=True):
                for _ in range(20):
                    st = await ev('__fj.lesson()')
                    if not st or st.get('finished'): break
                    await answer_mc(right)
                await page.wait_for_timeout(500)
                return await ev("({title: (document.querySelector('.end-title') || {}).textContent, sub: (document.querySelector('.ls-end > .help') || {}).textContent || '', moments: Array.from(document.querySelectorAll('.ls-end .moments li b')).map(e => e.textContent), fix: (document.querySelector('.fix-btn') || {}).textContent || ''})")
            async def page_text(): return await ev("document.body.innerText")
            async def flashes(): return await ev("Array.from(document.querySelectorAll('.flash')).map(e => e.textContent)")
            async def wait_flash(pat, t=6):
                seen = []
                for _ in range(int(t / 0.1)):
                    f = await flashes()
                    for x in f:
                        if x not in seen: seen.append(x)
                    if any(re.search(pat, x) for x in seen): return seen
                    await page.wait_for_timeout(100)
                return seen

            # ======================= 1. één Herhalen =======================
            await fresh({'xp': 30, 'days': {day(-1): {'secs': 1000, 'xp': 30}}})
            await ev(f"__fj.lessonWith({json.dumps([Q, Q2])}, {{title: 'Les 1: Proef'}})"); await wait_lesson()
            fb = await answer_mc(False)
            R['wrong_note'] = fb['note']
            check('Fout in een les: "komt terug bij Herhalen"', 'Herhalen' in fb['note'] and not OLD_WORDS.search(fb['note']), fb)
            end = await finish(True)
            R['lesson_end'] = end
            check('Eindscherm: knop "Herhaal je fout"', end['fix'].startswith('Herhaal je fout') and 'XP' in end['fix'], end['fix'])
            await page.wait_for_timeout(400); await shot('lesson_end_fix')
            await page.click('.fix-btn'); st = await wait_lesson()
            R['fix_kind'] = await ev("document.querySelector('.ls-kind').textContent")
            R['fix_head'] = await ev("({title: document.querySelector('.ls-bin').getAttribute('title'), n: document.querySelector('.ls-bin b').textContent})")
            check('Herhaalronde: label "eerder fout" en teller "Nog te herhalen"', 'eerder fout' in R['fix_kind'] and R['fix_head']['title'] == 'Nog te herhalen' and R['fix_head']['n'] == '1', [R['fix_kind'], R['fix_head']])
            fb = await answer_mc(True)
            check('Goed herhaald: komt morgen nog één keer terug', 'Morgen komt hij nog één keer terug' in fb['note'], fb)
            end = await finish(True); R['fix_end'] = end
            check('Na herhalen: "Alles herhaald!" met 10 XP extra', end['title'] == 'Alles herhaald!' and '10 XP extra' in end['sub'], end)
            await page.wait_for_timeout(400); await shot('fix_end')
            await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(600)
            R['badges_after_fix'] = list((await ev('__fj.progress()'))['badges'].keys())
            check('Plectrum "Pleister erop" na alles herhaald', 'bin' in R['badges_after_fix'], R['badges_after_fix'])
            # Oefenen: de kaart heet Herhalen, het eerste vakje "Nu"
            await go('#oefenen')
            R['card'] = await ev("({labels: Array.from(document.querySelectorAll('.lb-l')).map(e => e.textContent), h: document.querySelector('.srs-card h2').textContent, eyebrow: document.querySelector('.srs-eyebrow').textContent})")
            check('Herhaalkaart: vakjes Nu, 1 dag, 3 dagen, 7 dagen, Onder de knie', R['card']['labels'] == ['Nu', '1 dag', '3 dagen', '7 dagen', 'Onder de knie'], R['card'])
            # niets klaar, wel lessen gedaan: "Herhaal eerdere lessen"
            await fresh({'xp': 60, 'days': {day(-1): {'secs': 1000, 'xp': 60}}, 'path': {'nodes': {'L1-0': {'done': True, 'runs': 1, 'mistakes': 2, 'last': 1}, 'L1-1': {'done': True, 'runs': 1, 'mistakes': 0, 'last': 1}}}})
            await go('#oefenen')
            R['old_btn'] = await ev("(document.querySelector('.srs-old') || {}).textContent || ''")
            check('Niets klaar: knop "Herhaal eerdere lessen"', R['old_btn'] == 'Herhaal eerdere lessen', R['old_btn'])
            await shot('srs_old')
            await page.click('.srs-old'); st = await wait_lesson()
            check('Eerdere lessen herhalen start een les', bool(st and st.get('type')), st)
            for _ in range(12):
                st = await ev('__fj.lesson()')
                if not st or st.get('finished'): break
                if st['type'] == 'mc': await answer_mc(True)
                elif st['type'] == 'play': await page.locator('.ls-foot .linkish').click(); await page.wait_for_timeout(200)
                elif st['type'] == 'multi':
                    await ev(f"(() => {{ const want = {json.dumps(st['correct'])}; document.querySelectorAll('.chip-btn').forEach(b => {{ if (want.includes(b.textContent)) b.click(); }}); }})()")
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(200); await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(150)
                elif st['type'] == 'tap':
                    v = await ev('__fj.tapVisible()'); await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').click(force=True)
                    await page.click('.ls-foot button.primary'); await page.wait_for_timeout(200); await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(150)
                else: break
            await page.wait_for_timeout(500)
            R['old_end'] = await ev("(document.querySelector('.end-title') || {}).textContent || ''")
            check('Eerdere lessen: eindscherm "Herhalen klaar!" of "Herhalen: foutloos!"', R['old_end'] in ('Herhalen klaar!', 'Herhalen: foutloos!'), R['old_end'])
            await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(500)
            # Oefen vandaag: de stap heet Herhalen, niet Opfrissen
            await go('#'); await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan'] = await ev("Array.from(document.querySelectorAll('.plan li b')).map(e => e.textContent)")
            check('Oefen vandaag: stap "Herhalen" (geen Opfrissen)', 'Herhalen' in R['plan'] and 'Opfrissen' not in R['plan'], R['plan'])
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            # nergens meer de oude woorden
            seen = {}
            for hsh in ('#', '#oefenen', '#voortgang', '#instellingen'):
                await go(hsh); t = await page_text()
                seen[hsh] = sorted(set(m.lower() for m in OLD_WORDS.findall(t))) + (['null'] if re.search(r'\bnull\b|\bundefined\b', t) else [])
            check('Geen foutenbak, opfrissen, herstel, null of undefined op de schermen', not any(seen.values()), seen)

            # ======================= 2. één overzicht =======================
            await fresh({'xp': 140, 'days': {day(-1): {'secs': 1000, 'xp': 55}}, 'badges': {'goal': day(-1), 'xp100': day(-1)}})
            await ev(f"__fj.lessonWith({json.dumps([Q, Q2, Q])}, {{title: 'Les 1: Proef'}})"); await wait_lesson()
            await answer_mc(True)
            # midden in de les: niveau omhoog, opdrachten af, dagdoel gehaald
            quests = await ev('__fj.quests()')
            await ev('__fj.addXP(10)')
            for q in quests:
                if q['id'] == 'pedals': await ev("__fj.markPlayed(['notes', 'scales', 'ear'])")
                else: await ev(f"__fj.questBump('{ {'node': 'nodes', 'herhaal': 'herhaal', 'combo': 'combo', 'fix': 'fixed', 'srs': 'srs'}.get(q['id'], q['id']) }', {q['target']})")
            await ev('__fj.addSecs(15 * 60 - __fj.progress().secs - 2)')
            await page.wait_for_timeout(3500)
            R['mid_flashes'] = await flashes(); R['mid_pending'] = await ev('__fj.moments()')
            check('Tijdens een les: geen meldingen over je vraag heen', not R['mid_flashes'], R['mid_flashes'])
            check('Tijdens een les: momenten wachten op het eindscherm', any('Niveau 3' in x for x in R['mid_pending']) and any('Opdracht' in x for x in R['mid_pending']), R['mid_pending'])
            end = await finish(True); R['moment_end'] = end
            m = end['moments']
            check('Eindscherm: één lijst met niveau, opdrachten (samen één regel), bevriezer en dagdoel', any(x.startswith('Niveau 3') for x in m) and (f'{len(quests)} opdrachten gedaan!' in m if len(quests) > 1 else 'Opdracht gedaan!' in m) and any('bevriezer' in x for x in m) and 'Dagdoel gehaald!' in m, m)
            check('Eindscherm: niveau bovenaan', bool(m) and m[0].startswith('Niveau 3'), m)
            await page.wait_for_timeout(300)
            check('Eindscherm: geen losse meldingen', not await flashes(), await flashes())
            await page.wait_for_timeout(500); await shot('moments_end'); await shot('moments_end_full', full_page=True)
            await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(1200)
            check('Na de les: niets meer na te komen', not await flashes(), await flashes())
            # buiten een les: momenten die tegelijk komen, worden één melding
            await fresh({'xp': 140, 'days': {day(-1): {'secs': 1000, 'xp': 30}}, 'badges': {'goal': day(-1), 'xp100': day(-1)}})
            await page.wait_for_timeout(2200)
            check('Opstarten zonder iets nieuws: geen melding', not await flashes(), await flashes())
            quests = await ev('__fj.quests()')
            await ev('__fj.addXP(15)')
            for q in quests:
                if q['id'] == 'pedals': await ev("__fj.markPlayed(['notes', 'scales', 'ear'])")
                else: await ev(f"__fj.questBump('{ {'node': 'nodes', 'herhaal': 'herhaal', 'combo': 'combo', 'fix': 'fixed', 'srs': 'srs'}.get(q['id'], q['id']) }', {q['target']})")
            await page.wait_for_timeout(700)
            R['one_flash'] = await ev("Array.from(document.querySelectorAll('.flash')).map(e => ({title: e.querySelector('.fl-txt > b').textContent, more: Array.from(e.querySelectorAll('.fl-more li b')).map(x => x.textContent)}))")
            check('Buiten een les: één melding met de rest eronder', len(R['one_flash']) == 1 and R['one_flash'][0]['title'].startswith('Niveau') and len(R['one_flash'][0]['more']) >= 1, R['one_flash'])
            await page.wait_for_timeout(300); await shot('one_flash')
            await page.click('.flash'); await page.wait_for_timeout(600)
            check('Melding verdwijnt als je erop tikt', not await flashes(), await flashes())

            # ======================= 3. reservekopie =======================
            await fresh({'xp': 230, 'days': {day(-2): {'secs': 1000, 'xp': 100}, day(-1): {'secs': 950, 'xp': 130}}, 'badges': {'first': day(-2)}, 'bin': [{'k': 'mc|' + Q['prompt'] + '||12', 'it': Q, 'n': 1, 't': 1, 'box': 0}]},
                        {'goal': 20, 'gateDb': -40, 'noteq': {'kind': 'find', 'strings': [5], 'nat': True, 'to': 7}})
            await go('#voortgang')
            R['bk_card'] = await ev("({h: document.querySelector('#backupCard h2').textContent, status: document.querySelector('#backupCard .bk-status').textContent, old: document.querySelector('#backupCard .bk-status').classList.contains('old')})")
            check('Voortgang: kaart Reservekopie, nog nooit gemaakt', R['bk_card']['h'] == 'Reservekopie' and 'nog geen reservekopie' in R['bk_card']['status'] and R['bk_card']['old'], R['bk_card'])
            await page.locator('#backupCard').scroll_into_view_if_needed(); await page.wait_for_timeout(200); await shot('backup_card')
            async with page.expect_download() as dl:
                await page.click('#backupCard #bkSave')
            d = await dl.value
            path = os.path.join(TMP, d.suggested_filename); await d.save_as(path)
            data = json.load(open(path))
            R['bk_file'] = {'name': d.suggested_filename, 'app': data.get('app'), 'xp': data['stats'].get('xp'), 'goal': data['settings'].get('goal'), 'backupAt': bool(data['stats'].get('backupAt'))}
            check('Reservekopie: bestand fretjacht-<datum>.json met je voortgang', d.suggested_filename == f'fretjacht-{date.today().isoformat()}.json' and data.get('app') == 'fretjacht' and data['stats']['xp'] == 230 and data['settings']['goal'] == 20, R['bk_file'])
            R['bk_after'] = {'flash': await wait_flash('Reservekopie gemaakt'), 'status': await ev("document.querySelector('#backupCard .bk-status').textContent")}
            check('Na het maken: "Laatste reservekopie: vandaag" en een melding', R['bk_after']['status'] == 'Laatste reservekopie: vandaag.' and any('Reservekopie gemaakt' in f for f in R['bk_after']['flash']), R['bk_after'])
            # verder oefenen, dan de kopie terugzetten
            await ev('__fj.addXP(100)'); await page.wait_for_timeout(300)
            await ev("document.querySelectorAll('.flash').forEach(x => x.remove())")
            await go('#instellingen'); await go('#voortgang')
            async with page.expect_file_chooser() as fc:
                await page.click('#backupCard #bkPick')
            await (await fc.value).set_files(path); await page.wait_for_timeout(500)
            R['bk_sheet'] = await ev("({h: document.querySelector('.backup-sheet h3').textContent, rows: Array.from(document.querySelectorAll('.bk-table tbody tr')).map(r => Array.from(r.children).map(c => c.textContent)), warn: !!document.querySelector('.bk-warn')})")
            check('Terugzetten: eerst een vergelijking nu en in de kopie', R['bk_sheet']['rows'][1] == ['XP', '330', '230'] and R['bk_sheet']['warn'], R['bk_sheet'])
            await shot('backup_sheet')
            await page.click('#bkRestore'); await page.wait_for_timeout(300)
            pr = await ev('__fj.progress()'); stg = await ev('__fj.settings()')
            R['bk_restored'] = {'xp': pr['xp'], 'bin': pr['bin'], 'goal': stg['goal'], 'noteq': stg['noteq'], 'flash': await wait_flash('Voortgang teruggezet')}
            check('Teruggezet: XP, herhaalvragen en instellingen uit de kopie', pr['xp'] == 230 and pr['bin'] == 1 and stg['goal'] == 20 and stg['noteq']['to'] == 7, R['bk_restored'])
            check('Teruggezet: melding "Voortgang teruggezet"', any('Voortgang teruggezet' in f for f in R['bk_restored']['flash']), R['bk_restored']['flash'])
            await page.wait_for_timeout(300); await shot('backup_restored')
            # geen geldig bestand
            bad = os.path.join(TMP, 'iets.json'); open(bad, 'w').write('{"hallo": 1}')
            await ev("document.querySelectorAll('.flash').forEach(x => x.remove())")
            async with page.expect_file_chooser() as fc:
                await page.click('#backupCard #bkPick')
            await (await fc.value).set_files(bad)
            R['bk_bad'] = {'flash': await wait_flash('geen reservekopie'), 'sheet': await ev("!!document.querySelector('.backup-sheet')")}
            check('Ander bestand: "Dit is geen reservekopie", niets veranderd', any('geen reservekopie' in f for f in R['bk_bad']['flash']) and not R['bk_bad']['sheet'] and (await ev('__fj.progress()'))['xp'] == 230, R['bk_bad'])
            # browser gewist: lege Voortgang biedt terugzetten aan
            await fresh()
            await go('#voortgang')
            R['bk_empty'] = await ev("({card: (document.querySelector('.backup-card.restore h2') || {}).textContent, btn: (document.querySelector('.backup-card.restore button') || {}).textContent})")
            check('Lege Voortgang: "Al eerder geoefend?" met terugzetten', R['bk_empty']['card'] == 'Al eerder geoefend?' and 'terugzetten' in (R['bk_empty']['btn'] or ''), R['bk_empty'])
            await shot('backup_empty')
            async with page.expect_file_chooser() as fc:
                await page.click('.backup-card.restore button')
            await (await fc.value).set_files(path); await page.wait_for_timeout(500)
            await page.click('#bkRestore'); await page.wait_for_timeout(700)
            R['bk_empty_after'] = {'xp': (await ev('__fj.progress()'))['xp'], 'streak': bool(await ev("!!document.querySelector('.streak-card')"))}
            check('Na terugzetten in de lege staat: voortgang is terug', R['bk_empty_after']['xp'] == 230 and R['bk_empty_after']['streak'], R['bk_empty_after'])
            await go('#instellingen')
            R['bk_settings'] = await ev("({save: !!document.querySelector('.settings-view #bkSave'), pick: !!document.querySelector('.settings-view #bkPick'), status: (document.querySelector('.settings-view .bk-status') || {}).textContent})")
            check('Instellingen: reservekopie maken en terugzetten', R['bk_settings']['save'] and R['bk_settings']['pick'] and 'vandaag' in (R['bk_settings']['status'] or ''), R['bk_settings'])

            # ======================= 4. hals om op te tikken =======================
            MEAS = """sel => { const cs = Array.from(document.querySelectorAll(sel)).map(c => c.getBoundingClientRect()); const svg = document.querySelector(sel).closest('svg');
              return { n: cs.length, minW: Math.min(...cs.map(c => c.width)), minH: Math.min(...cs.map(c => c.height)), rows: svg.classList.contains('two-rows'), svgH: Math.round(svg.getBoundingClientRect().height) }; }"""
            await fresh({'xp': 50, 'path': {'nodes': {'LH1-0': {'done': True, 'runs': 1, 'mistakes': 0}, 'LH1-1': {'done': True, 'runs': 1, 'mistakes': 0}}}}, {'track': 'hals'})
            await page.locator('.node.next').first.click(); await page.wait_for_timeout(250); await page.click('.sheet button.primary'); st = await wait_lesson()
            R['tapall'] = await ev(MEAS, '.tapneck .cell')
            check('Toepassen op de telefoon: twee rijen, vakjes minstens 30 px breed', R['tapall']['rows'] and R['tapall']['minW'] >= 30, R['tapall'])
            check('Toepassen op één snaar: hele kolom is raak (minstens 100 px hoog)', R['tapall']['n'] == 13 and R['tapall']['minH'] >= 100, R['tapall'])
            # tik bovenin de kolom, ver van de lage E: telt als de lage E
            v = st['valid'][0]
            box = await page.locator(f'.tapneck .cell[data-s="{v["s"]}"][data-f="{v["f"]}"]').bounding_box()
            await page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + 12); await page.wait_for_timeout(400)
            R['tap_top'] = await ev("({found: document.querySelectorAll('.tapneck .mk.found').length, ok: document.querySelector('.ls-foot').classList.contains('ok')})")
            check('Tik bovenin de kolom telt als de gevraagde snaar', R['tap_top']['found'] >= 1, R['tap_top'])
            await shot('tapall_rows')
            # Welke noot? Zoek de noot op alle snaren tot fret 12
            await fresh({'xp': 50}, {'noteq': {'kind': 'find', 'strings': [5, 4, 3, 2, 1, 0], 'nat': True, 'to': 12}})
            await go('#m-noteq')
            R['noteq'] = await ev(MEAS, '.nq-neck .cell')
            check('Zoek de noot (hele hals): twee rijen, vakjes minstens 30 × 25 px', R['noteq']['rows'] and R['noteq']['minW'] >= 30 and R['noteq']['minH'] >= 25 and R['noteq']['n'] == 78, R['noteq'])
            q = await ev('__fj.noteq()')
            for pnt in q['valid']: await page.locator(f'.nq-neck .cell[data-s="{pnt["s"]}"][data-f="{pnt["f"]}"]').click(force=True); await page.wait_for_timeout(80)
            await page.wait_for_timeout(300)
            R['noteq_done'] = await ev("({ok: document.querySelector('.eq-fb').classList.contains('ok'), text: document.querySelector('.eq-fb').textContent})")
            check('Zoek de noot: alle plekken aantikken werkt in twee rijen', R['noteq_done']['ok'], R['noteq_done'])
            await shot('noteq_rows', full_page=True)
            await go('#m-noteq')
            check('Halskaart zonder "null"', 'null' not in await ev("document.querySelector('.nq-stats').textContent"))
            # tikvraag uit de theorie: ingezoomd op 9 frets rond de A
            await ev(f"__fj.lessonWith({json.dumps([TAP])}, {{title: 'Les 1: Proef'}})"); await wait_lesson()
            R['tapzoom'] = await ev(MEAS, '.tapneck .cell')
            R['tapzoom']['frets'] = await ev("Array.from(new Set(Array.from(document.querySelectorAll('.tapneck .cell')).map(c => +c.dataset.f))).sort((a, b) => a - b)")
            check('Tikvraag: ingezoomd op fret 3 tot 9, vakjes minstens 28 px breed', R['tapzoom']['frets'] == list(range(3, 10)) and R['tapzoom']['minW'] >= 28 and not R['tapzoom']['rows'], R['tapzoom'])
            await page.locator('.tapneck .cell[data-s="3"][data-f="7"]').click(force=True); await page.click('.ls-foot button.primary'); await page.wait_for_timeout(300)
            check('Tikvraag: goed antwoord in het ingezoomde stuk', await ev("document.querySelector('.ls-foot').classList.contains('ok')"))
            await shot('tap_zoom')
            # groot scherm: gewoon de hele hals in één rij
            desk = await b.new_context(viewport={'width': 1200, 'height': 900}, color_scheme=SCHEME)
            dp = await desk.new_page(); await dp.goto(f'http://localhost:{PORT}/index.html'); await dp.wait_for_timeout(600)
            await dp.evaluate("__fj.lessonWith(__fj.halsGen(0, 2).slice(0, 1), {title: 'Halsjacht'})"); await dp.wait_for_timeout(500)
            R['desk'] = await dp.evaluate(MEAS, '.tapneck .cell')
            check('Groot scherm: één rij met de hele hals', not R['desk']['rows'] and R['desk']['n'] == 13, R['desk'])
            await desk.close()
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:16}', json.dumps(v, ensure_ascii=False)[:300])
    print()
    for name, ok, info in CHECKS: print(('OK   ' if ok else 'FOUT ') + name + ('' if ok else '  ' + json.dumps(info, ensure_ascii=False)[:400]))
    print(f'{sum(1 for c in CHECKS if c[1])}/{len(CHECKS)} geslaagd')
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
