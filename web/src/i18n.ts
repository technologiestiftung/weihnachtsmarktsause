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
  'page.title': 'Berliner Weihnachtsmarkt-Sause',
  'boot.sub': 'basierend auf Berlins offenen <a href="https://daten.berlin.de/datensaetze/simple_search_wwwberlindesenwebservicemaerktefesteweihnachtsmaerkte" target="_blank" rel="noopener">Weihnachtsmarktdaten</a>',
  'boot.manifest': 'lese Manifest…',
  'boot.textures': 'Bodentexturen',
  'boot.sky': 'Himmelslicht',
  'boot.ready': 'bereit',
  'credits': 'Gebäude, Straßen: © OpenStreetMap-Mitwirkende (ODbL), modelliert mit OSM2World · '
    + 'Gelände: Airborne Laserscanning (SenSBW) · Bäume: Baumbestand Berlin (SenMVKU) · Bezirke: ALKIS Berlin Bezirke (SenSBW) · Geodaten Berlin unter dl-de/zero-2.0',
  'credits.short': '© OpenStreetMap-Mitwirkende (ODbL) · Geodaten Berlin (dl-de/zero-2.0)',
  'hud.fps': 'fps', 'hud.draws': 'Draws', 'hud.tris': 'Mio. Dreiecke',
  'hud.buildings': 'Gebäude', 'hud.trees': 'Bäume', 'hud.tiles': 'Kacheln',
  'hud.zoom': 'M — {n}', 'hud.zoomAll': 'ganz Berlin',
  'hint.cam0': 'Verfolgerkamera', 'hint.cam1': 'nah dran', 'hint.cam2': 'Ego-Perspektive',
  'hint.labelsOn': 'Beschriftung an', 'hint.labelsOff': 'Beschriftung aus',
  'load.back': 'Zurück zum Menü',
  'load.later': 'Der Weihnachtsmann ist noch mit Geschenkepacken beschäftigt. Versuche es später noch einmal!',
  'load.keys.markets': 'mouse=mit Maus oder Touchpad lenken, steigen und sinken|A D=lenken|Leertaste Strg=steigen, sinken',
  'load.keys.common': 'C=Kamera|Esc=Pause',
  'load.touch.markets': 'finger=mit dem Finger über den Bildschirm ziehen: lenken, steigen und sinken|pause=Pause',
  'load.markets': 'Rentiere werden angeschirrt…|Geschenke werden eingepackt…|Glühwein wird vorgewärmt…|Schlittenkufen werden gewachst…',
  'hint.noFair': 'Der Start am Bahnhof Friedrichstraße fehlt in diesem Build – gespielt wird hier, ohne Wertung',
  'hint.cantStart': 'Start fehlgeschlagen: {e}',
  'hint.clickToSteer': 'Klick ins Bild, um mit der Maus zu lenken',
  'menu.play': 'Start',
  'menu.lang': 'Sprache wechseln', 'menu.musicOn': 'Musik einschalten', 'menu.musicOff': 'Musik ausschalten',
  'menu.snowOn': 'Schnee einschalten', 'menu.snowOff': 'Schnee ausschalten',
  'menu.finder': 'Zum Weihnachtsmarkt-Finder',
  'menu.finderTitle': 'Öffnet den Weihnachtsmarkt-Finder in einem neuen Tab',
  'menu.sources': 'Datenquellen: <a href="https://daten.berlin.de/datensaetze/simple_search_wwwberlindesenwebservicemaerktefesteweihnachtsmaerkte" target="_blank" rel="noopener">{markets}</a> · {rest}',
  'menu.contact': 'Den Quellcode der Weihnachtsmarkt-Sause findest du auf <a href="https://github.com/technologiestiftung/weihnachtsmarktsause" target="_blank" rel="noopener">GitHub</a>.<br>'
    + 'Eine Frage oder Feedback? Schreib uns an <a href="mailto:odis@ts.berlin">odis@ts.berlin</a>',
  'menu.madeBy': 'Umgesetzt von', 'menu.projectBy': 'Ein Projekt der',
  'menu.openData': 'Dieses Spiel basiert komplett auf Berlins <a href="https://daten.berlin.de" target="_blank" rel="noopener">Open Data</a>.',
  'menu.odisAbout': 'Die Open Data Informationsstelle ist ein Projekt der Technologiestiftung Berlin, '
    + 'gefördert durch die Senatskanzlei Berlin.',
  'menu.imprint': 'Impressum', 'menu.privacy': 'Datenschutz',
  'menu.unranked': 'dort gespielt, wo du standest – ohne Wertung',
  'menu.best': 'Dein Bestwert: {best}',
  'menu.abandoned': 'Spiel abgebrochen.',
  'scores.title': 'Bestenliste',
  'board.close': 'Schließen',
  'board.loading': 'lädt…',
  'board.offline': 'Die gemeinsame Bestenliste ist gerade nicht erreichbar.',
  'board.empty': 'Noch keine Einträge – hol dir Platz 1!',
  'board.players': '{n} {n|Person|Personen} in der Bestenliste',
  'board.mine': 'Deine Spiele',
  'board.notPlayed': 'Noch nicht gespielt.',
  'board.record': 'Rekord {n}',
  'board.played': '{n} {n|Spiel|Spiele}',
  'board.course': 'Start am Bahnhof Friedrichstraße',
  'board.namePh': 'Name',
  'board.taken': 'Diesen Namen hat schon jemand.',
  'board.blocked': 'Dieser Name ist nicht erlaubt, bitte nimm einen anderen.',
  'board.invalid': '2–20 Zeichen: Buchstaben, Ziffern, Leerzeichen, - _ .',
  'board.privacy': 'Gespeichert werden nur Name und Ergebnisse, kein Konto, keine IP-Adresse. '
    + 'Der Name ist in der Bestenliste für alle sichtbar. Ohne Namen wird kein Ergebnis gespeichert.',
  'board.rank': 'Platz {rank} von {n}',
  'board.localRank': 'Platz {rank} von {n} in diesem Browser',
  'board.local': 'In diesem Browser gespeichert – die gemeinsame Bestenliste ist gerade nicht erreichbar.',
  'board.localNote': 'Die gemeinsame Bestenliste ist gerade nicht erreichbar – das sind die Spiele in diesem Browser.',
  'board.noName': '(ohne Namen)',
  'board.join': 'Gib einen Namen ein, um dein Ergebnis in der Bestenliste zu speichern:',
  'board.joinBtn': 'Speichern',
  'menu.short': 'Nur {n} {n|Markt|Märkte} am Bestwert vorbei – nochmal?',
  'game.go': 'LOS!',
  'pause.title': 'Pause',
  'pause.info': 'noch {time} · {n}',
  'pause.resume': 'Weiter',
  'pause.restart': 'Neu starten',
  'pause.exit': 'Spiel beenden',
  'dur.s': '{n}\u00a0Sekunden',
  'dur.m': '{n}\u00a0{n|Minute|Minuten}',
  'game.time': '+{n} s',
  'game.boost': 'Turbo!',
  'game.record': 'NEUER REKORD!',
  'game.best': 'Dein Bestwert: {n}',
  'game.beaten': 'Bestwert geknackt!',
  'mode.markets.title': 'Weihnachtsmarkt-Sause',
  'mode.markets.blurb': 'Flieg mit Santas Schlitten über die Stadt und wirf über möglichst vielen Weihnachtsmärkten Geschenke ab – in {dur}.',
  'mode.markets.intro': 'Entdecke Berlins Weihnachtsmärkte aus luftiger Perspektive. Mit unserem neuen 3D-Spiel kannst du '
    + 'über die Berliner Weihnachtsmärkte fliegen und so viele Märkte wie möglich beschenken. '
    + 'Wer schafft es, in {dur} die meisten Märkte zu beschenken?',
  'mode.markets.source': 'Weihnachtsmärkte 2026: SenWEB (CC BY)',
  'mode.markets.score': 'Weihnachtsmärkte beschenkt',
  'mode.markets.unit': '{n} {n|Markt|Märkte}',
  'mode.markets.hit': 'Ho ho ho! {name}',
  'mode.markets.won': 'Frohe Weihnachten, Berlin!', 'mode.markets.lost': 'Feierabend, Santa',
};

type Key = keyof typeof de;

const en: Record<Key, string> = {
  'page.title': 'Berliner Weihnachtsmarkt-Sause',
  'boot.sub': 'based on Berlin’s open <a href="https://daten.berlin.de/datensaetze/simple_search_wwwberlindesenwebservicemaerktefesteweihnachtsmaerkte" target="_blank" rel="noopener">Christmas market data</a>',
  'boot.manifest': 'reading manifest…',
  'boot.textures': 'ground textures',
  'boot.sky': 'sky lighting',
  'boot.ready': 'ready',
  'credits': 'buildings, streets: © OpenStreetMap contributors (ODbL), modelled by OSM2World · '
    + 'terrain: Airborne Laserscanning (SenSBW) · trees: Baumbestand Berlin (SenMVKU) · districts: ALKIS Berlin Bezirke (SenSBW) · Berlin geodata under dl-de/zero-2.0',
  'credits.short': '© OpenStreetMap contributors (ODbL) · Berlin geodata (dl-de/zero-2.0)',
  'hud.fps': 'fps', 'hud.draws': 'draws', 'hud.tris': 'M tris',
  'hud.buildings': 'buildings', 'hud.trees': 'trees', 'hud.tiles': 'tiles',
  'hud.zoom': 'M — {n}', 'hud.zoomAll': 'all of Berlin',
  'hint.cam0': 'third person', 'hint.cam1': 'close', 'hint.cam2': 'first person',
  'hint.labelsOn': 'labels on', 'hint.labelsOff': 'labels off',
  'load.back': 'Back to menu',
  'load.later': 'Santa is still busy wrapping presents. Please try again later!',
  'load.keys.markets': 'mouse=steer, climb and dive with the mouse or touchpad|A D=steer|Space Ctrl=climb, dive',
  'load.keys.common': 'C=camera|Esc=pause',
  'load.touch.markets': 'finger=drag your finger across the screen to steer, climb and dive|pause=pause',
  'load.markets': 'Harnessing the reindeer…|Wrapping presents…|Warming the Glühwein…|Waxing the sleigh runners…',
  'hint.noFair': 'the start at Friedrichstraße station is missing from this build — playing where you stand, unranked',
  'hint.cantStart': 'could not start: {e}',
  'hint.clickToSteer': 'click the view to steer with the mouse',
  'menu.play': 'Start',
  'menu.lang': 'Change language', 'menu.musicOn': 'Turn music on', 'menu.musicOff': 'Turn music off',
  'menu.snowOn': 'Turn snow on', 'menu.snowOff': 'Turn snow off',
  'menu.finder': 'To the Christmas Market Finder',
  'menu.finderTitle': 'Opens the Christmas Market Finder in a new tab',
  'menu.sources': 'Data sources: <a href="https://daten.berlin.de/datensaetze/simple_search_wwwberlindesenwebservicemaerktefesteweihnachtsmaerkte" target="_blank" rel="noopener">{markets}</a> · {rest}',
  'menu.contact': 'The source code of the Weihnachtsmarkt-Sause is on <a href="https://github.com/technologiestiftung/weihnachtsmarktsause" target="_blank" rel="noopener">GitHub</a>.<br>'
    + 'A question or feedback? Write to us at <a href="mailto:odis@ts.berlin">odis@ts.berlin</a>',
  'menu.madeBy': 'Made by', 'menu.projectBy': 'A project by',
  'menu.openData': 'This game is built entirely on Berlin’s <a href="https://daten.berlin.de" target="_blank" rel="noopener">open data</a>.',
  'menu.odisAbout': 'The Open Data Informationsstelle is a project of the Technologiestiftung Berlin, '
    + 'funded by the Senatskanzlei Berlin.',
  'menu.imprint': 'Imprint', 'menu.privacy': 'Privacy',
  'menu.unranked': 'played where you stood — unranked',
  'menu.best': 'Your best: {best}',
  'menu.abandoned': 'Game abandoned.',
  'scores.title': 'High scores',
  'board.close': 'Close',
  'board.loading': 'loading…',
  'board.offline': "The shared board can't be reached right now.",
  'board.empty': 'No entries yet — take first place!',
  'board.players': '{n} {n|player|players} on the board',
  'board.mine': 'Your games',
  'board.notPlayed': 'Not played yet.',
  'board.record': 'record {n}',
  'board.played': '{n} {n|game|games}',
  'board.course': 'Starting at Friedrichstraße station',
  'board.namePh': 'name',
  'board.taken': 'Someone already has that name.',
  'board.blocked': "That name isn't allowed, please pick another.",
  'board.invalid': '2–20 characters: letters, digits, spaces, - _ .',
  'board.privacy': 'Only the name and results are stored, no account, no IP address. '
    + 'The name is visible to everyone on the board. Without a name no result is saved.',
  'board.rank': '#{rank} of {n}',
  'board.localRank': '#{rank} of {n} in this browser',
  'board.local': "Saved in this browser — the shared board can't be reached right now.",
  'board.localNote': "The shared board can't be reached right now — these are the games in this browser.",
  'board.noName': '(no name)',
  'board.join': 'Enter a name to save your result on the board:',
  'board.joinBtn': 'Save',
  'menu.short': 'Just {n} {n|market|markets} short of your best — again?',
  'game.go': 'GO!',
  'pause.title': 'Paused',
  'pause.info': '{time} left · {n}',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.exit': 'Quit game',
  'dur.s': '{n}\u00a0seconds',
  'dur.m': '{n}\u00a0{n|minute|minutes}',
  'game.time': '+{n} s',
  'game.boost': 'Boost!',
  'game.record': 'NEW RECORD!',
  'game.best': 'Your best: {n}',
  'game.beaten': 'best beaten!',
  'mode.markets.title': 'Christmas Market Dash',
  'mode.markets.blurb': "Fly Santa's sleigh over the city and drop presents on as many Christmas markets as you can in {dur}.",
  'mode.markets.intro': "Discover Berlin's Christmas markets from above. In our new 3D game you fly over Berlin's "
    + 'Christmas markets and bring presents to as many of them as you can. '
    + 'Who can reach the most markets in {dur}?',
  'mode.markets.source': 'Weihnachtsmärkte 2026: SenWEB (CC BY)',
  'mode.markets.score': 'Christmas markets visited',
  'mode.markets.unit': '{n} {n|market|markets}',
  'mode.markets.hit': 'Ho ho ho! {name}',
  'mode.markets.won': 'Merry Christmas, Berlin!', 'mode.markets.lost': 'Clocking off, Santa',
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
