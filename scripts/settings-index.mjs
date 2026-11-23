// Writes src/lib/settings/searchIndex.ts: for each page of Settings, which of
// the app's words it draws, by their place in the strings (`settings.look.x`).
//
//   node scripts/settings-index.mjs          writes it
//   node scripts/settings-index.mjs --check  says whether it is up to date
//
// Found in the pages' own code and the setting rows each draws, by every
// `t.a.b` it reads (and `said.b`, where `const said = t.a`): what Settings
// shows in any language, without a list of it kept by hand that would go
// out of date the first time a row was added. A test runs `--check`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = 'src/app/(tabs)/(library,lists,search,stats,settings)';
const OUT = 'src/lib/settings/searchIndex.ts';

/**
 * The pages, the one each is opened from, the words of its name, its file,
 * and the rows it draws that are components of their own. `also` is for
 * words a page draws that its code names only by a key worked out as it
 * runs (a theme's name, `t.themes[key]`): a place, or with `.*` every word
 * under it. A place found in the code that is not one word but many
 * (`t.nav`, read as `t.nav[tab]`) stands for nothing: see `search.ts`.
 */
export const PAGES = [
  { page: 'settings', parent: null, title: 'nav.settings', file: 'src/app/(tabs)/(settings)/settings.tsx', rows: ['src/components/support/UpdateRows.tsx'] },
  {
    page: 'settings-look',
    parent: 'settings',
    title: 'settings.sections.look',
    file: `${SHARED}/settings-look.tsx`,
    rows: [],
    // The library's views by name (`t.library.views[view]`), and the tabs that can be taken off the bar (`t.nav[tab]`).
    also: ['library.views.*', 'nav.lists', 'nav.search', 'nav.stats'],
  },
  { page: 'settings-haptics', parent: 'settings-look', title: 'settings.haptics.title', file: `${SHARED}/settings-haptics.tsx`, rows: [] },
  { page: 'themes', parent: 'settings-look', title: 'nav.themes', file: `${SHARED}/themes.tsx`, rows: [], also: ['themes.*'] },
  { page: 'theme', parent: 'themes', title: 'nav.customTheme', file: `${SHARED}/theme.tsx`, rows: ['src/components/theme/ColourEditor.tsx'] },
  { page: 'player-look', parent: 'settings-look', title: 'nav.playerLook', file: `${SHARED}/player-look.tsx`, rows: ['src/components/CoverLookSettings.tsx'] },
  { page: 'settings-sound', parent: 'settings', title: 'settings.sections.sound', file: `${SHARED}/settings-sound.tsx`, rows: [] },
  { page: 'playback', parent: 'settings-sound', title: 'settings.playback.title', file: `${SHARED}/playback.tsx`, rows: ['src/components/PlayerSettings.tsx'] },
  { page: 'equalizer', parent: 'settings-sound', title: 'nav.equalizer', file: `${SHARED}/equalizer.tsx`, rows: ['src/components/sound/EqualizerPage.tsx'] },
  { page: 'transitions', parent: 'settings-sound', title: 'nav.crossfade', file: `${SHARED}/transitions.tsx`, rows: ['src/components/sound/TransitionsPage.tsx'] },
  { page: 'effects', parent: 'settings-sound', title: 'nav.effects', file: `${SHARED}/effects.tsx`, rows: ['src/components/sound/EffectsPage.tsx'] },
  {
    page: 'settings-player',
    parent: 'settings',
    title: 'settings.sections.player',
    file: `${SHARED}/settings-player.tsx`,
    rows: [
      'src/components/AutoplaySetting.tsx',
      'src/components/AutoplaySizes.tsx',
      'src/components/TapSetting.tsx',
      'src/components/HeartSetting.tsx',
      'src/components/ListButtonSetting.tsx',
      'src/components/LyricsFolderSetting.tsx',
    ],
  },
  { page: 'settings-miniplayer', parent: 'settings', title: 'settings.sections.miniPlayer', file: `${SHARED}/settings-miniplayer.tsx`, rows: [] },
  { page: 'settings-tapes', parent: 'settings', title: 'settings.sections.tapes', file: `${SHARED}/settings-tapes.tsx`, rows: [] },
  { page: 'settings-library', parent: 'settings', title: 'settings.sections.library', file: `${SHARED}/settings-library.tsx`, rows: ['src/components/ShuffleSettings.tsx'] },
  { page: 'settings-downloads', parent: 'settings', title: 'settings.sections.downloads', file: `${SHARED}/settings-downloads.tsx`, rows: ['src/components/downloads/SettingsRows.tsx'] },
  { page: 'discover-settings', parent: 'settings-downloads', title: 'discover.settings.title', file: `${SHARED}/discover-settings.tsx`, rows: ['src/components/DiscoverSettings.tsx'] },
  {
    page: 'settings-data',
    parent: 'settings',
    title: 'settings.sections.data',
    file: `${SHARED}/settings-data.tsx`,
    rows: ['src/components/AutoBackupSettings.tsx', 'src/components/ListenBrainzSettings.tsx', 'src/components/support/UpdateRows.tsx'],
  },
];

/** Words every page has, and so no page's in particular: Cancel, a date; and the search's own. */
const EVERYWHERE = ['common.', 'format.', 'settings.search.'];

const CHAIN = /\bt\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
const ALIAS = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*t\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/g;

/** Every place in the strings that [source] reads. */
export function keysOf(source) {
  const keys = new Set();
  const aliases = new Map();
  for (const [, name, place] of source.matchAll(ALIAS)) aliases.set(name, place);
  // Not the places the shorthands stand for themselves: those are whole branches, and what is read from them is below.
  const named = new Set(aliases.values());
  for (const [, place] of source.matchAll(CHAIN)) if (!named.has(place)) keys.add(place);
  for (const [name, place] of aliases) {
    const used = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\.([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)`, 'g');
    for (const [, rest] of source.matchAll(used)) keys.add(`${place}.${rest}`);
  }
  return [...keys].filter((key) => !EVERYWHERE.some((start) => key.startsWith(start))).sort();
}

export function build() {
  const pages = PAGES.map(({ page, parent, title, file, rows, also = [] }) => {
    const keys = new Set(also);
    for (const one of [file, ...rows]) for (const key of keysOf(fs.readFileSync(path.join(root, one), 'utf8'))) keys.add(key);
    return { page, parent, title, keys: [...keys].sort() };
  });
  return [
    '// Written by scripts/settings-index.mjs: run it again after changing what a page of Settings says. Not by hand.',
    '',
    'export type SettingsPageEntry = { page: string; parent: string | null; title: string; keys: readonly string[] };',
    '',
    `export const SETTINGS_PAGES: readonly SettingsPageEntry[] = ${JSON.stringify(pages, null, 2)};`,
    '',
  ].join('\n');
}

const run = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (run) {
  const written = build();
  const target = path.join(root, OUT);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (now !== written) {
      console.error(`${OUT} is out of date: run node scripts/settings-index.mjs`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, written);
    console.log(`wrote ${OUT}`);
  }
}
