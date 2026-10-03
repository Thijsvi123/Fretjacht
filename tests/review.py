"""Herhalen na 1, 3 en 7 dagen, feedback bij goed en fout (trillen, animatie, bericht) en de lege staten
van Oefenen en Voortgang. Zelfde opties als learn.py (SCHEME, SHOTS, FONTS_DIR). Eindigt met een lijst
geslaagd/mislukt per controle."""
import os, asyncio, subprocess, sys, time, json
from datetime import date, timedelta
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from localfonts import use_local_fonts
FAKE = open('tests/fake.js').read()
# navigator.vibrate opnemen in plaats van trillen
VIB = "window.__vib = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vib.push(p); return true; } });"
PORT = 8799
SP = os.environ.get('SHOTS', '/tmp/fretjacht-shots/'); os.makedirs(SP, exist_ok=True)
SCHEME = os.environ.get('SCHEME', 'light'); PFX = 'RD_' if SCHEME == 'dark' else 'R_'
R, CHECKS = {}, []
def check(name, ok, info=''):
    CHECKS.append((name, bool(ok), info))
TODAY = date.today()
def day(n): return (TODAY + timedelta(days=n)).isoformat()
Q = {'type': 'mc', 'prompt': 'Hoeveel halve tonen zitten er in een octaaf?', 'options': ['12', '7', '8'], 'answer': 0, 'explain': 'Een octaaf is twaalf halve tonen.'}
KEY = 'mc|' + Q['prompt'] + '||12'

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
            await page.add_init_script(FAKE); await page.add_init_script(VIB)
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
            async def answer_mc(right=True, shot_name=None):
                st = await ev('__fj.lesson()')
                idx = st['answer'] if right else (st['answer'] + 1) % len(st['options'])
                vib0 = len(await ev('window.__vib'))
                await page.locator('.ls-opts .opt').nth(idx).click()
                await page.click('.ls-foot button.primary'); await page.wait_for_timeout(60)
                fx = await ev("({notes: document.querySelectorAll('.fx-notes i').length, edge: (document.getElementById('fxEdge') || {}).className || '', marks: Array.from(document.querySelectorAll('.opt-mark')).map(m => m.className), reveal: !!document.querySelector('.opt.reveal')})")
                await page.wait_for_timeout(380)
                if shot_name: await shot(shot_name)
                fb = await ev("({title: (document.querySelector('.fb-title') || {}).textContent, note: (document.querySelector('.fb-note') || {}).textContent || '', lift: (document.querySelector('.fb-lift') || {}).textContent || '', kind: (document.querySelector('.ls-kind') || {}).textContent || ''})")
                fb['vib'] = (await ev('window.__vib'))[vib0:]; fb['fx'] = fx
                await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(150)
                return fb
            async def finish_session():
                for _ in range(20):
                    st = await ev('__fj.lesson()')
                    if not st or st.get('finished'): break
                    await answer_mc(True)
                await page.wait_for_timeout(500)
                end = await ev("({title: (document.querySelector('.end-title') || {}).textContent, deltas: Array.from(document.querySelectorAll('.end-srs .lb')).map(e => (e.querySelector('.lb-d') || {}).textContent || ''), help: Array.from(document.querySelectorAll('.ls-end .help')).map(e => e.textContent)})")
                return end
            async def leave_end():
                await page.locator('.ls-foot button', has_text='Verder').first.click(); await page.wait_for_timeout(500)
            async def start_review():
                await go('#voortgang'); await go('#oefenen')
                await page.click('.srs-card .srs-go')
                return await wait_lesson()
            srs = lambda: ev('__fj.srs()')

            # ---------- 1. lege staten: nog nooit geoefend ----------
            await fresh()
            await go('#oefenen')
            R['fresh_practice'] = await ev("({hero: (document.querySelector('.hero-empty.fresh h2') || {}).textContent, btn: (document.querySelector('.hero-empty .he-go') || {}).textContent, srs: (document.querySelector('.srs-card.none h2') || {}).textContent, badge: document.querySelector('.tb-badge').hidden})")
            check('Oefenen leeg: grote kaart met knop', R['fresh_practice']['hero'] == 'Nog geen oefensessies' and 'Start je eerste les' in (R['fresh_practice']['btn'] or ''), R['fresh_practice'])
            check('Oefenen leeg: herhaalkaart legt uit', R['fresh_practice']['srs'] == 'Nog niets te herhalen')
            await page.wait_for_timeout(400); await shot('fresh_practice')
            await go('#voortgang')
            R['fresh_progress'] = await ev("({hero: (document.querySelector('.hero-empty.fresh h2') || {}).textContent, preview: document.querySelectorAll('.pv-list li').length, streak: !!document.querySelector('.streak-card'), badges: document.querySelectorAll('.badge').length, help: Array.from(document.querySelectorAll('.card .help')).map(e => e.textContent).join(' | ')})")
            check('Voortgang leeg: uitnodiging in plaats van lege grafieken', R['fresh_progress']['hero'] == 'Hier groeit je voortgang' and R['fresh_progress']['preview'] == 5 and not R['fresh_progress']['streak'], R['fresh_progress'])
            await page.wait_for_timeout(300); await shot('fresh_progress'); await shot('fresh_progress_full', full_page=True)
            await page.click('.hero-empty .he-go')
            st = await wait_lesson()
            check('Voortgang leeg: knop start de eerste les', bool(st and st.get('type')), st)
            await page.click('.ls-close'); await page.wait_for_timeout(200); await page.locator('.sheet button', has_text='Stoppen').click(); await page.wait_for_timeout(400)

            # ---------- 2. vandaag nog niet geoefend (wel eerder) ----------
            await fresh({'xp': 40, 'days': {day(-1): {'secs': 1000, 'xp': 40}}})
            await go('#oefenen')
            R['today_practice'] = await ev("({hero: (document.querySelector('.hero-empty.today h2') || {}).textContent, text: (document.querySelector('.hero-empty.today p') || {}).textContent})")
            check('Oefenen vandaag leeg: "De fret slaapt nog" met reeks', R['today_practice']['hero'] == 'De fret slaapt nog' and 'reeks staat op 1 dag' in (R['today_practice']['text'] or ''), R['today_practice'])
            await page.wait_for_timeout(300); await shot('today_practice')
            await page.click('.hero-empty .he-go'); await page.wait_for_timeout(350)
            R['today_plan'] = await ev("Array.from(document.querySelectorAll('.plan li b')).map(e => e.textContent)")
            check('Oefenen vandaag leeg: knop opent Oefen vandaag', len(R['today_plan']) >= 2, R['today_plan'])
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            await go('#voortgang')
            R['today_progress'] = await ev("({go: !!document.querySelector('.streak-card.idle .sc-go'), msg: document.querySelector('.streak-card .help').textContent, empty: (document.querySelector('.chart-empty') || {}).textContent || ''})")
            check('Voortgang vandaag leeg: knop in de reekskaart', R['today_progress']['go'] and 'nog geen oefensessies' in R['today_progress']['msg'], R['today_progress'])
            await page.wait_for_timeout(300); await shot('today_progress')
            # alleen vorige week geoefend: lege weekgrafiek met uitleg
            await fresh({'xp': 40, 'days': {day(-8): {'secs': 1000, 'xp': 40}}})
            await go('#voortgang')
            R['week_empty'] = await ev("(document.querySelector('.chart-empty') || {}).textContent || ''")
            check('Voortgang: lege weekgrafiek met uitleg', 'Nog geen minuten deze week' in R['week_empty'], R['week_empty'])
            await page.locator('.week-wrap').scroll_into_view_if_needed(); await page.wait_for_timeout(200); await shot('week_empty')

            # ---------- 3. herhalen: 1, 3 en 7 dagen ----------
            seed = {'xp': 40, 'days': {day(-1): {'secs': 1000, 'xp': 40}}, 'bin': [{'k': KEY, 'it': Q, 'n': 1, 't': 1, 'from': 'Les 1', 'topic': 'twelve-tones', 'box': 0}]}
            await fresh(seed)
            R['badge_bin'] = await ev("({hidden: document.querySelector('.tb-badge').hidden, n: document.querySelector('.tb-badge').textContent})")
            check('Tabblad Oefenen toont teller', not R['badge_bin']['hidden'] and R['badge_bin']['n'] == '1', R['badge_bin'])
            await go('#oefenen'); await page.wait_for_timeout(200); await shot('srs_card_bin')
            st = await start_review()
            check('Herhaalronde start vanuit Oefenen', bool(st and st.get('review') and st.get('bin')), st)
            fb = await answer_mc(True, 'fb_fixed')
            R['fix_fb'] = fb
            check('Goed: één tikje trillen', fb['vib'] == [[18]], fb['vib'])
            check('Goed: noten uit de knop, groene rand, vinkje', fb['fx']['notes'] >= 5 and 'ok' in fb['fx']['edge'] and fb['fx']['marks'] == ['opt-mark'], fb['fx'])
            check('Goed: komt morgen nog één keer terug', 'Morgen komt hij nog één keer terug' in fb['note'], fb)
            end = await finish_session(); R['fix_end'] = end
            check('Alles herhaald na de eerste ronde', end['title'] == 'Alles herhaald!', end)
            check('Eindscherm toont verschuiving in de vakjes', end['deltas'][:2] == ['−1', '+1'], end['deltas'])
            await page.wait_for_timeout(700); await shot('fix_end_srs')
            await leave_end()
            s = await srs(); R['after_fix'] = s
            check('Na herhalen: vak 1, morgen aan de beurt', s['items'][0]['box'] == 1 and s['items'][0]['due'] == day(1) and s['todo'] == 0, s)
            # nog niet aan de beurt: melding wanneer hij terugkomt
            await go('#oefenen')
            R['card_wait'] = await ev("({h: document.querySelector('.srs-card h2').textContent, sub: document.querySelector('.srs-card .srs-sub').textContent, badge: document.querySelector('.tb-badge').hidden})")
            check('Niets te herhalen: zegt wanneer hij terugkomt', R['card_wait']['h'] == 'Vandaag niets te herhalen' and 'morgen' in R['card_wait']['sub'].lower() and R['card_wait']['badge'], R['card_wait'])
            await shot('srs_card_wait')
            # een dag later
            await ev('__fj.srsShift(1)'); await page.reload(); await page.wait_for_timeout(700)
            R['badge_due'] = await ev("document.querySelector('.tb-badge').textContent")
            await go('#oefenen')
            R['card_due'] = await ev("({h: document.querySelector('.srs-card h2').textContent, due: (document.querySelector('.lb.b1 .lb-due') || {}).textContent})")
            check('Dag later: vraag komt terug', R['badge_due'] == '1' and R['card_due']['due'] == '1 nu', [R['badge_due'], R['card_due']])
            await shot('srs_card_due')
            # plan van Oefen vandaag begint met herhalen
            await go('#'); await page.click('#todayBtn'); await page.wait_for_timeout(350)
            R['plan_due'] = await ev("Array.from(document.querySelectorAll('.plan li')).map(e => e.textContent)")
            check('Oefen vandaag neemt herhalen mee', any(x.startswith('2Herhalen') or 'Herhalen' in x for x in R['plan_due']), R['plan_due'])
            await ev("document.querySelectorAll('.sheet-wrap').forEach(x => x.remove())")
            st = await start_review()
            fb = await answer_mc(True, 'fb_recall1'); R['recall1'] = fb
            check('Herhaling na 1 dag: label en volgende over 3 dagen', 'herhaling na 1 dag' in fb['kind'] and 'over 3 dagen' in fb['note'], fb)
            end = await finish_session(); R['recall1_end'] = end
            check('Alles herhaald', end['title'] == 'Alles herhaald!', end)
            await leave_end()
            s = await srs(); check('Vak 2, over 3 dagen', s['items'][0]['box'] == 2 and s['items'][0]['due'] == day(3), s)
            await ev('__fj.srsShift(3)')
            st = await start_review(); fb = await answer_mc(True); end = await finish_session(); await leave_end()
            s = await srs(); check('Vak 3, over 7 dagen', 'over 7 dagen' in fb['note'] and s['items'][0]['box'] == 3 and s['items'][0]['due'] == day(7), [fb['note'], s])
            # na 7 dagen fout: terug naar het begin, zelfde ronde nog een keer
            await ev('__fj.srsShift(7)')
            st = await start_review()
            fb = await answer_mc(False, 'fb_wrong_review'); R['wrong_review'] = fb
            check('Fout: twee tikjes trillen', fb['vib'] == [[40, 70, 40]], fb['vib'])
            check('Fout: kruisje, goede antwoord licht op, rode rand', 'opt-mark bad' in fb['fx']['marks'] and fb['fx']['reveal'] and 'bad' in fb['fx']['edge'], fb['fx'])
            check('Fout: terug naar het begin, straks nog een keer', 'Terug naar het begin' in fb['note'] and 'nog een keer' in fb['note'], fb)
            check('Fout: motiverend bericht', len(fb['lift']) > 10, fb['lift'])
            s = await srs(); check('Fout: vak 0', s['items'][0]['box'] == 0, s)
            fb = await answer_mc(True)
            check('Tweede poging goed: morgen weer', 'Morgen komt hij' in fb['note'], fb)
            end = await finish_session(); R['wrong_end'] = end; await leave_end()
            s = await srs(); check('Na fout en tweede poging: weer vak 1', s['items'][0]['box'] == 1 and s['items'][0]['due'] == day(1), s)
            # nog drie keer goed: onder de knie
            for shift in (1, 3, 7):
                await ev(f'__fj.srsShift({shift})')
                st = await start_review(); fb = await answer_mc(True, 'fb_mastered' if shift == 7 else None); end = await finish_session()
                if shift == 7: R['mastered_fb'] = fb; R['mastered_end'] = end; await page.wait_for_timeout(600); await shot('mastered_end')
                await leave_end()
            s = await srs(); R['mastered'] = s
            check('Na 1, 3 en 7 dagen goed: onder de knie', s['done'] == 1 and not s['items'] and 'Onder de knie' in R['mastered_fb']['note'], [s, R['mastered_fb']['note']])
            await go('#voortgang'); await go('#oefenen'); R['card_done'] = await ev("({h: document.querySelector('.srs-card h2').textContent, known: document.querySelector('.lb.b4 .lb-n').textContent})")
            check('Kaart: 1 onder de knie', R['card_done']['known'] == '1', R['card_done'])
            await shot('srs_card_done')
            await go('#voortgang'); R['tile'] = await ev("Array.from(document.querySelectorAll('.tile')).map(e => e.textContent).join(' | ')")
            check('Voortgang-tegel Herhalen', 'Herhalen' in R['tile'] and 'onder de knie' in R['tile'], R['tile'])
            R['summary'] = await ev('__fj.summary()')
            check('Cursusvoortgang noemt herhalen', 'onder de knie' in R['summary'], R['summary'][-200:])

            # ---------- 4. trillen uit ----------
            await fresh(seed, {'haptics': False})
            st = await start_review(); fb = await answer_mc(True)
            check('Trillen uit: geen trilling', fb['vib'] == [], fb['vib'])

            # ---------- 5. oefening met de microfoon: reeks en "net ernaast" ----------
            await fresh({'xp': 40, 'days': {day(0): {'secs': 60, 'xp': 5}}})
            await go('#m-notes'); await page.click('.controls .mic-btn'); await page.wait_for_timeout(700)
            toasts = []
            for i in range(3):
                e = await ev('__fj.expected()')
                await ev(f'__fake.play({e[0]}, {{dur: 0.8}})'); await page.wait_for_timeout(450)
                toasts.append(await ev("document.querySelector('.pr-toast').textContent"))
                await page.wait_for_timeout(700)
                if i == 1: await page.wait_for_timeout(100)
            R['notes_toasts'] = toasts
            R['notes_streak'] = await ev("({show: !!document.querySelector('.pr-streak.show'), text: (document.querySelector('.pr-streak') || {}).textContent})")
            check('Noten zoeken: aanmoediging bij elke noot', all(t and t.split(' ')[0] not in ('Goed!',) for t in toasts) and 'Drie op rij!' in toasts[2], toasts)
            check('Noten zoeken: reeksteller na 3', R['notes_streak']['show'] and R['notes_streak']['text'] == '3 op rij', R['notes_streak'])
            await shot('notes_streak')
            vib_before = len(await ev('window.__vib'))
            e = await ev('__fj.expected()')
            await ev(f'__fake.play({e[0] + 1}, {{dur: 0.9}})'); await page.wait_for_timeout(560)
            R['notes_miss'] = await ev("({nope: document.querySelector('.prompt').classList.contains('nope'), toast: document.querySelector('.pr-toast').textContent, streak: !!document.querySelector('.pr-streak.show')})")
            check('Noten zoeken: foute noot schudt en helpt', R['notes_miss']['nope'] and 'Net ernaast: één fret te hoog' in R['notes_miss']['toast'] and not R['notes_miss']['streak'], R['notes_miss'])
            await shot('notes_miss')
            check('Microfoon: geen trilling tijdens het spelen', len(await ev('window.__vib')) == vib_before)
            await page.click('.controls .mic-btn')

            # ---------- 6. gehoortraining: tikjes, reeks ----------
            await go('#m-earq')
            vibs = []
            for i in range(3):
                k = await ev('__fj.earq()'); n0 = len(await ev('window.__vib'))
                await page.locator(f'.eq-opts .opt[data-k="{k}"]').click(); await page.wait_for_timeout(250)
                vibs.append((await ev('window.__vib'))[n0:])
                if i == 2: R['earq_fb'] = await ev("document.querySelector('.eq-fb b').textContent"); await shot('earq_streak')
                await page.wait_for_timeout(1700)
            R['earq_vibs'] = vibs
            check('Gehoortraining: tikje bij goed, drie bij een reeks', vibs[0] == [[18]] and vibs[2] == [[22, 60, 22, 60, 45]], vibs)
            check('Gehoortraining: reeksbericht', R['earq_fb'] == 'Drie op rij!', R['earq_fb'])
            k = await ev('__fj.earq()'); n0 = len(await ev('window.__vib'))
            wrong = await ev(f"Array.from(document.querySelectorAll('.eq-opts .opt')).map(b => b.dataset.k).find(x => x !== '{k}')")
            await page.locator(f'.eq-opts .opt[data-k="{wrong}"]').click(); await page.wait_for_timeout(300)
            R['earq_wrong'] = {'vib': (await ev('window.__vib'))[n0:], 'fb': await ev("document.querySelector('.eq-fb b').textContent")}
            check('Gehoortraining: twee tikjes bij fout', R['earq_wrong']['vib'] == [[40, 70, 40]] and 'Het was' in R['earq_wrong']['fb'], R['earq_wrong'])
            await shot('earq_wrong')

            # ---------- 7. instellingen ----------
            await go('#instellingen')
            R['setting'] = await ev("!!document.getElementById('haptics')")
            check('Instelling Trillen bestaat', R['setting'])
            await b.close()
    finally:
        srv.terminate()
    for k, v in R.items(): print(f'{k:16}', json.dumps(v, ensure_ascii=False)[:300])
    print()
    for name, ok, info in CHECKS: print(('OK   ' if ok else 'FOUT ') + name + ('' if ok else '  ' + json.dumps(info, ensure_ascii=False)[:300]))
    print(f'{sum(1 for c in CHECKS if c[1])}/{len(CHECKS)} geslaagd')
    print('ERRORS:', json.dumps(errors[:12], ensure_ascii=False))
asyncio.run(main())
