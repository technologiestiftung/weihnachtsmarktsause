![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

# Weihnachtsmarkt-Sause

DISCLAIMER: THIS APP WAS PURELY VIBECODED

Fly Santa's sleigh over as many of Berlin's Christmas markets as you can in
90 seconds, through a 3D Berlin built entirely from open data.

**Play it:** [weihnachtsmarktsause.vercel.app](https://weihnachtsmarktsause.vercel.app/)

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
```

The client is TypeScript on three.js. Nothing of the city is in this
repository: it streams the tiles from object storage at `VITE_TILE_BASE`,
read at build time.

## Controls

| | |
|---|---|
| `S` | brake (the sleigh always flies at full boost) |
| `A` `D`, mouse | steer; the mouse also climbs and dives |
| `Space` `Ctrl` | climb, dive |
| `C` | camera: third person · close · first person |
| `T` | labels · `M` map: all of Berlin, 10 km, 3 km |
| `Esc` | pause, with resume, restart and quit |

On a phone or tablet: a virtual joystick on the left half, drag on the
right half to look, and buttons for pause and camera. A phone runs a lower
quality tier (`web/src/quality.ts`; `?quality=low|high` to choose).

## The game

* **One start.** Every game starts at Friedrichstraße station, so runs
  compare for the whole season and the high scores stay put.
* **Markets reached is the score.** Each market gives a few seconds back on
  the clock; the board ranks by markets reached.
* **Start menu.** Start, high scores and settings over falling snow. The
  settings (also reachable from the pause screen) hold the language, sound
  on/off with master, music and effects volume, and a tab with the
  controls. Music and effects are synthesised (`web/src/sfx.ts`).
* **German first**, with English in the settings (or `?lang=en`). Strings
  live in `web/src/i18n.ts`.
* **The map** is of all of Berlin: district outlines, S/U/main-line
  stations, landmarks, and under it the district you are over and the
  nearest landmark or station. `npm run data:overview` rebuilds
  `web/src/data/overview.json` (Bezirksgrenzen from Geoportal Berlin via
  ODIS; stations and landmarks from OpenStreetMap via Overpass).

## Data

`web/public/data/games/markets.json` holds the markets and is served with
the app (it is small and fixed for the season): `[x, z, name, dates]` per
market, in world metres. Only markets inside the 3D city are listed; the
eleven in Brandenburg (Potsdam, Königs Wusterhausen, Prenzlau) are left out.

## Scores

The high scores live in a Postgres database (schema`weihnachtsmarktsause`), 
reached only by the small API in `api/`, which holds the
credentials and checks each run. This API accepts runs for the Sause only.

## Performance

`npm run bench:games` plays a round in headless Chrome as a phone
(`--desktop`, `--landscape`, `--seconds`, `--shots`), with `npm run dev`
running in another terminal. `--cpu 4` slows the CPU down and `--net 4g` or
`--net 3g` the connection, e.g. `--desktop --cpu 4 --net 4g` for an older
laptop on mobile data. It reports the loading time, what was downloaded and
the memory peak.

The game only ever shows the city from the sleigh at night, so it loads
less than the tile build holds: terrain, land cover, water, shorelines,
bridge decks, buildings and trees. Street furniture, the navigation grid,
street names and places, bridge railings, aerial photos and shadows are left
out. While the start page is up, the tiles around the start load behind it;
a game starts once the two nearest are in, and while one tile is built the
next one downloads (not on a phone, where memory is tighter).

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/malte-b"><img src="https://avatars.githubusercontent.com/u/27922183?v=4&size=64" width="64px" height="64px" alt="Malte Barth"/><br /><sub><b>Malte Barth</b></sub></a><br /><a href="https://github.com/technologiestiftung/template-default/commits?author=malte-b" title="Code">💻</a> <a href="#ideas-malte-b" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lisa-Stubert"><img src="https://avatars.githubusercontent.com/u/61182572?v=4&size=64" width="64px" height="64px" alt="Lisa-Stubert"/><br /><sub><b>Lisa-Stubert</b></sub></a><br /><a href="#content-Lisa-Stubert" title="Content">🖋</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/KlemensM"><img src="https://avatars.githubusercontent.com/u/98896505?v=4&size=64" width="64px" height="64px" alt="Klemens"/><br /><sub><b>Klemens</b></sub></a><br /><a href="#content-KlemensM" title="Content">🖋</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Content Licensing

Texts and content available as [CC BY](https://creativecommons.org/licenses/by/3.0/de/).

The Christmas market data used is under CC-BY license. We have processed and enriched the data for this application. If you use this dataset processed by us, you must indicate that the original raw data came from the Senatsverwaltung für Wirtschaft, Energie und Betriebe (Senate Department for Economics, Energy and Public Enterprises).

## Credits

<table>
  <tr>
    <td>
      Made by <a href="https://odis-berlin.de">
        <br />
        <br />
        <img width="200" src="https://logos.citylab-berlin.org/logo-odis-berlin-coloured.svg" alt="Link to the ODIS website" />
      </a>
    </td>
    <td>
      A project by <a href="https://www.technologiestiftung-berlin.de/">
        <br />
        <br />
        <img width="150" src="https://logos.citylab-berlin.org/logo-technologiestiftung-berlin-de.svg" alt="Link to the Technologiestiftung Berlin website" />
      </a>
    </td>
    <td>
      Supported by <a href="https://www.berlin.de/rbmskzl/">
        <br />
        <br />
        <img width="80" src="https://logos.citylab-berlin.org/logo-berlin-senatskanzelei-de.svg" alt="Link to the Senate Chancellery of Berlin"/>
      </a>
    </td>
  </tr>
</table>
