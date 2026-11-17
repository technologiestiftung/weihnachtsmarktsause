/**
 * Interface language: German by default, English on request.
 *
 * t('key', { name: value }) looks a string up in the current language and
 * fills in its {name} placeholders; {n|Baum|Bäume} picks the singular when
 * n is 1. Static text in index.html carries a
 * data-i18n (text), data-i18n-html (markup), data-i18n-placeholder or
 * data-i18n-title attribute naming its key and is filled in by applyStatic().
 * The choice comes from ?lang=, else what this browser chose last, else
 * German. Names from the datasets (a market, a street) stay as published.
 */

export type Lang = 'de' | 'en';

const de = {
  'page.title': 'Weihnachtsmarkt-Sause',
  'boot.sub': 'aus offenen Geodaten gebaut',
  'boot.manifest': 'lese Manifest…',
  'boot.textures': 'Bodentexturen',
  'boot.sky': 'Himmelslicht',
  'boot.tile': 'lade Kachel {k}',
  'boot.ready': 'bereit',
  'boot.failed': 'Laden fehlgeschlagen: {e}',
  'credits': 'Gebäude, Straßen © OpenStreetMap-Mitwirkende (ODbL), modelliert mit OSM2World · '
    + 'Gelände: ALS Berlin · Luftbilder: TrueDOP 2024 · Bäume: Baumbestand Berlin · Bezirke: Geoportal Berlin (dl-de/zero-2.0)',
  'credits.short': '© OpenStreetMap-Mitwirkende (ODbL) · Geodaten Berlin (dl-de/zero-2.0)',
  'hud.fps': 'fps', 'hud.draws': 'Draws', 'hud.tris': 'Mio. Dreiecke',
  'hud.buildings': 'Gebäude', 'hud.trees': 'Bäume', 'hud.tiles': 'Kacheln',
  'hud.zoom': 'M — {n}', 'hud.zoomAll': 'ganz Berlin',
  'hud.near': 'bei {name} · {d}',
  'hint.cam0': 'Verfolgerkamera', 'hint.cam1': 'nah dran', 'hint.cam2': 'Ego-Perspektive',
  'hint.labelsOn': 'Beschriftung an', 'hint.labelsOff': 'Beschriftung aus',
  'hint.shadowsOn': 'Schatten an', 'hint.shadowsOff': 'Schatten aus',
  'load.play': 'Los geht’s', 'load.back': 'Zurück zum Menü (Esc)',
  'load.ready': 'Alles bereit – Enter oder Leertaste startet', 'load.readyTouch': 'Alles bereit',
  'load.keys.markets': 'S=bremsen|A D=lenken|mouse=lenken, steigen und sinken|Leertaste Strg=steigen, sinken',
  'load.keys.common': 'C=Kamera|P Esc=Pause',
  'load.touch.markets': 'links ziehen=lenken, bremsen|rechts wischen=steigen und sinken|⏸=Pause',
  'load.markets': 'Rentiere werden angeschirrt…|Geschenke werden eingepackt…|Glühwein wird vorgewärmt…|Schlittenkufen werden gewachst…',
  'hint.noFair': 'In diesem Build gibt es keinen fairen Start – gespielt wird hier, ohne Wertung',
  'hint.cantStart': 'Start fehlgeschlagen: {e}',
  'menu.notPlayed': 'heutiger Startpunkt: noch nicht gespielt',
  'menu.todayBest': 'heute bestes: {n} Punkte',
  'menu.note': 'Ziele kurz hintereinander bauen eine Combo bis ×5 auf und bringen Extrasekunden · '
    + '✨ goldene Ziele zählen dreifach<br>'
    + 'Start beginnt am Startpunkt des Tages – derselbe für alle, also vergleichbare Punkte',
  'menu.play': 'Start',
  'menu.settings': 'Einstellungen',
  'settings.title': 'Einstellungen',
  'settings.general': 'Allgemein', 'settings.controls': 'Steuerung',
  'settings.lang': 'Sprache', 'settings.sound': 'Ton',
  'settings.master': 'Gesamt', 'settings.music': 'Musik', 'settings.sfx': 'Effekte',
  'menu.challenge': '{emoji} Herausforderung: {title}',
  'menu.challengeText': 'Jemand hat dich herausgefordert. Gleicher Startpunkt, gleiche Ziele – schlag die Punktzahl.',
  'menu.start': 'Los',
  'menu.unranked': 'dort gespielt, wo du standest – ohne Wertung',
  'menu.today': 'Startpunkt des Tages · Bestwert {best}',
  'menu.course': 'Startpunkt {seed} · Bestwert {best}',
  'menu.newBest': '★ neuer Bestwert! ({course})',
  'menu.data': 'Daten: {src}',
  'menu.again': 'Nochmal',
  'menu.share': 'Startpunkt teilen', 'menu.copied': 'Link kopiert',
  'menu.abandoned': 'Spiel abgebrochen.',
  'scores.title': 'Bestenliste',
  'scores.unranked': 'ohne Wertung',
  'board.close': 'Schließen',
  'board.today': 'Startpunkt des Tages · {date}',
  'board.loading': 'lädt…',
  'board.offline': 'Die gemeinsame Bestenliste ist gerade nicht erreichbar.',
  'board.empty': 'Heute noch keine Einträge – hol dir Platz 1!',
  'board.players': '{n} {n|Person|Personen} an diesem Startpunkt',
  'board.joinHint': 'Gib oben einen Spitznamen ein, um mitzuspielen.',
  'board.mine': 'Deine Spiele',
  'board.notPlayed': 'Noch nicht gespielt.',
  'board.record': 'Rekord {n}', 'board.todayMine': 'heute {n}',
  'board.played': '{n} {n|Spiel|Spiele}',
  'board.course': 'Startpunkt {seed}',
  'board.name': 'Dein Name in der Bestenliste',
  'board.namePh': 'Spitzname',
  'board.save': 'Speichern',
  'board.ok': 'Gespeichert – deine Spiele kommen jetzt in die Bestenliste.',
  'board.taken': 'Diesen Namen hat schon jemand.',
  'board.invalid': '2–20 Zeichen: Buchstaben, Ziffern, Leerzeichen, - _ .',
  'board.privacy': 'Bitte einen Spitznamen, nicht deinen echten Namen. Gespeichert werden nur Name und Punkte – '
    + 'kein Konto, keine IP-Adresse. Ohne Namen bleiben deine Spiele in diesem Browser.',
  'board.rank': '🏆 Platz {rank} von {n} an diesem Startpunkt',
  'board.localRank': '🏆 Platz {rank} von {n} in diesem Browser',
  'board.local': 'In diesem Browser gespeichert – die gemeinsame Bestenliste ist gerade nicht erreichbar.',
  'board.localNote': 'Die gemeinsame Bestenliste ist gerade nicht erreichbar – das sind die Spiele in diesem Browser.',
  'board.noName': '(ohne Namen)',
  'board.join': 'Mit Spitznamen in die Bestenliste:',
  'board.joinBtn': 'Eintragen',
  'menu.short': 'Nur {n} Punkte am Rekord vorbei – nochmal?',
  'menu.stats': 'beste Combo ×{c}',
  'menu.golds': '✨ {g} {g|goldenes Ziel|goldene Ziele}',
  'game.go': 'LOS!',
  'pause.title': 'Pause',
  'pause.info': 'noch {time} · {n} Punkte',
  'pause.resume': 'Weiter',
  'pause.restart': 'Neu starten',
  'pause.exit': 'Spiel beenden',
  'pause.note': '<kbd>Esc</kbd> oder <kbd>P</kbd> spielt weiter',
  'dur.s': '{n} Sekunden',
  'dur.m': '{n} {n|Minute|Minuten}',
  'game.none': 'in der Nähe ist nichts mehr',
  'game.noTargets': 'hier im gebauten Gebiet gibt es keine Ziele',
  'game.points': '{n} Punkte',
  'game.combo': 'COMBO ×{n}',
  'game.comboEnd': 'Combo vorbei',
  'game.time': '+{n} s',
  'game.gold': '✨ GOLD ×{n}',
  'game.medal': '{m} Medaille!',
  'game.record': '🏆 NEUER REKORD!',
  'game.best': '🏆 Rekord {n}',
  'game.beaten': '🏆 Rekord geknackt!',
  'game.chase': '🏆 Zu schlagen: {n} Punkte',
  'game.next': '{m} noch {n}',
  'game.allMedals': '🥇 geschafft!',
  'mode.markets.title': 'Weihnachtsmarkt-Sause',
  'mode.markets.blurb': 'Flieg mit Santas Schlitten über die Stadt und wirf über möglichst vielen Weihnachtsmärkten Geschenke ab – in {dur}.',
  'mode.markets.controls': 'S bremsen · A D lenken · Maus oder R F steigen',
  'mode.markets.source': 'Weihnachtsmärkte 2025 · SenWEB, kuratiert von ODIS',
  'mode.markets.score': '<b>{n}</b> {n|Weihnachtsmarkt|Weihnachtsmärkte} beschenkt',
  'mode.markets.unit': '{n} {n|Markt|Märkte}',
  'mode.markets.hit': '🎁 Ho ho ho! {name}',
  'mode.markets.won': 'Frohe Weihnachten, Berlin!', 'mode.markets.lost': 'Feierabend, Santa',
  'mode.markets.line': '{n} von {of} Weihnachtsmärkten haben Geschenke bekommen.',
};

type Key = keyof typeof de;

const en: Record<Key, string> = {
  'page.title': 'Weihnachtsmarkt-Sause',
  'boot.sub': 'built from open geodata',
  'boot.manifest': 'reading manifest…',
  'boot.textures': 'ground textures',
  'boot.sky': 'sky lighting',
  'boot.tile': 'loading tile {k}',
  'boot.ready': 'ready',
  'boot.failed': 'failed to load: {e}',
  'credits': 'Buildings, streets © OpenStreetMap contributors (ODbL), modelled by OSM2World · '
    + 'terrain: ALS Berlin · photos: TrueDOP 2024 · trees: Baumbestand Berlin · districts: Geoportal Berlin (dl-de/zero-2.0)',
  'credits.short': '© OpenStreetMap contributors (ODbL) · Berlin geodata (dl-de/zero-2.0)',
  'hud.fps': 'fps', 'hud.draws': 'draws', 'hud.tris': 'M tris',
  'hud.buildings': 'buildings', 'hud.trees': 'trees', 'hud.tiles': 'tiles',
  'hud.zoom': 'M — {n}', 'hud.zoomAll': 'all of Berlin',
  'hud.near': 'near {name} · {d}',
  'hint.cam0': 'third person', 'hint.cam1': 'close', 'hint.cam2': 'first person',
  'hint.labelsOn': 'labels on', 'hint.labelsOff': 'labels off',
  'hint.shadowsOn': 'shadows on', 'hint.shadowsOff': 'shadows off',
  'load.play': 'Let’s go', 'load.back': 'Back to menu (Esc)',
  'load.ready': 'All set – Enter or Space starts', 'load.readyTouch': 'All set',
  'load.keys.markets': 'S=brake|A D=steer|mouse=steer, climb and dive|Space Ctrl=climb, dive',
  'load.keys.common': 'C=camera|P Esc=pause',
  'load.touch.markets': 'drag left=steer, brake|swipe right=climb and dive|⏸=pause',
  'load.markets': 'Harnessing the reindeer…|Wrapping presents…|Warming the Glühwein…|Waxing the sleigh runners…',
  'hint.noFair': 'no fair start in this build — playing where you stand, unranked',
  'hint.cantStart': 'could not start: {e}',
  'menu.notPlayed': "today's start: not played yet",
  'menu.todayBest': "today's best: {n} points",
  'menu.note': 'targets in quick succession build a combo up to ×5 and win back seconds · '
    + '✨ golden targets count triple<br>'
    + "Start begins at today's starting point — the same for everyone, so scores compare",
  'menu.play': 'Start',
  'menu.settings': 'Settings',
  'settings.title': 'Settings',
  'settings.general': 'General', 'settings.controls': 'Controls',
  'settings.lang': 'Language', 'settings.sound': 'Sound',
  'settings.master': 'Master', 'settings.music': 'Music', 'settings.sfx': 'Effects',
  'menu.challenge': '{emoji} Challenge: {title}',
  'menu.challengeText': 'Someone challenged you. Same start, same targets — beat their score.',
  'menu.start': 'Start',
  'menu.unranked': 'played where you stood — unranked',
  'menu.today': "today's start · best {best}",
  'menu.course': 'start {seed} · best {best}',
  'menu.newBest': '★ new best! ({course})',
  'menu.data': 'Data: {src}',
  'menu.again': 'Again',
  'menu.share': 'Share start', 'menu.copied': 'link copied',
  'menu.abandoned': 'Game abandoned.',
  'scores.title': 'High scores',
  'scores.unranked': 'unranked',
  'board.close': 'Close',
  'board.today': "Today's start · {date}",
  'board.loading': 'loading…',
  'board.offline': "The shared board can't be reached right now.",
  'board.empty': 'No entries today yet — take first place!',
  'board.players': '{n} {n|player|players} from this start',
  'board.joinHint': 'Enter a nickname above to join in.',
  'board.mine': 'Your games',
  'board.notPlayed': 'Not played yet.',
  'board.record': 'record {n}', 'board.todayMine': 'today {n}',
  'board.played': '{n} {n|game|games}',
  'board.course': 'start {seed}',
  'board.name': 'Your name on the board',
  'board.namePh': 'nickname',
  'board.save': 'Save',
  'board.ok': 'Saved — your games now go on the board.',
  'board.taken': 'Someone already has that name.',
  'board.invalid': '2–20 characters: letters, digits, spaces, - _ .',
  'board.privacy': 'Please use a nickname, not your real name. Only the name and points are stored — '
    + 'no account, no IP address. Without a name your games stay in this browser.',
  'board.rank': '🏆 #{rank} of {n} from this start',
  'board.localRank': '🏆 #{rank} of {n} in this browser',
  'board.local': "Saved in this browser — the shared board can't be reached right now.",
  'board.localNote': "The shared board can't be reached right now — these are the games in this browser.",
  'board.noName': '(no name)',
  'board.join': 'Join the board with a nickname:',
  'board.joinBtn': 'Join',
  'menu.short': 'Just {n} points short of the record — again?',
  'menu.stats': 'best combo ×{c}',
  'menu.golds': '✨ {g} golden {g|target|targets}',
  'game.go': 'GO!',
  'pause.title': 'Paused',
  'pause.info': '{time} left · {n} points',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.exit': 'Quit game',
  'pause.note': '<kbd>Esc</kbd> or <kbd>P</kbd> resumes',
  'dur.s': '{n} seconds',
  'dur.m': '{n} {n|minute|minutes}',
  'game.none': 'nothing left nearby',
  'game.noTargets': 'no targets in the built area here',
  'game.points': '{n} points',
  'game.combo': 'COMBO ×{n}',
  'game.comboEnd': 'combo over',
  'game.time': '+{n} s',
  'game.gold': '✨ GOLD ×{n}',
  'game.medal': '{m} medal!',
  'game.record': '🏆 NEW RECORD!',
  'game.best': '🏆 record {n}',
  'game.beaten': '🏆 record broken!',
  'game.chase': '🏆 To beat: {n} points',
  'game.next': '{m} {n} to go',
  'game.allMedals': '🥇 done!',
  'mode.markets.title': 'Christmas Market Dash',
  'mode.markets.blurb': "Fly Santa's sleigh over the city and drop presents on as many Christmas markets as you can in {dur}.",
  'mode.markets.controls': 'S brake · A D steer · mouse or R F climb',
  'mode.markets.source': 'Weihnachtsmärkte 2025 · SenWEB, curated by ODIS',
  'mode.markets.score': '<b>{n}</b> {n|Christmas market|Christmas markets} visited',
  'mode.markets.unit': '{n} {n|market|markets}',
  'mode.markets.hit': '🎁 Ho ho ho! {name}',
  'mode.markets.won': 'Merry Christmas, Berlin!', 'mode.markets.lost': 'Clocking off, Santa',
  'mode.markets.line': '{n} of {of} Christmas markets got presents.',
};

const DICTS: Record<Lang, Record<Key, string>> = { de, en };

function initial(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'de' || q === 'en') return q;
  try {
    const s = localStorage.getItem('berlin.lang');
    if (s === 'de' || s === 'en') return s;
  } catch { /* storage blocked */ }
  return 'de';
}

export let lang: Lang = initial();
const listeners: (() => void)[] = [];

/** A string in the current language, with {name} placeholders filled in. */
export function t(key: Key | string, vars: Record<string, string | number> = {}): string {
  const s = DICTS[lang][key as Key] ?? de[key as Key] ?? key;
  return s
    .replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_m, k: string, one: string, many: string) =>
      (Number(vars[k]) === 1 ? one : many))
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}


/** Numbers the way the language writes them: 1,5 kg or 1.5 kg. */
export function num(n: number, digits = 1): string {
  return n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB',
                          { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function setLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem('berlin.lang', l); } catch { /* storage blocked */ }
  applyStatic();
  for (const f of listeners) f();
}

/** Run f whenever the language changes. */
export function onLang(f: () => void): void {
  listeners.push(f);
}

/** Fill in every element in index.html that names a key. */
export function applyStatic(): void {
  document.documentElement.lang = lang;
  document.title = t('page.title');
  for (const e of document.querySelectorAll<HTMLElement>('[data-i18n]')) e.textContent = t(e.dataset.i18n!);
  for (const e of document.querySelectorAll<HTMLElement>('[data-i18n-html]')) e.innerHTML = t(e.dataset.i18nHtml!);
  for (const e of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    e.placeholder = t(e.dataset.i18nPlaceholder!);
  }
  for (const e of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) e.title = t(e.dataset.i18nTitle!);
  for (const b of document.querySelectorAll<HTMLElement>('[data-lang]')) {
    b.classList.toggle('on', b.dataset.lang === lang);
  }
}
