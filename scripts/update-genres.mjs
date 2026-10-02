// Regenerates the bundled MusicBrainz genre vocabulary. Data is CC0.
import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'Jukebox/0.1 ( https://github.com/Kayra5138/JukeboxAndroid )';
const TARGET = 'src/lib/metadata/data/genre-vocabulary.ts';
const URL = 'https://musicbrainz.org/ws/2/genre/all?fmt=txt';

const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;

/**
 * How much of the current vocabulary a new one has to keep.
 *
 * A truncated response is still a valid list of genres, just a shorter one, and
 * writing it looks like a success while quietly making `isGenre` reject things
 * it used to accept. MusicBrainz's vocabulary grows; it does not lose a tenth
 * of itself.
 */
const MIN_RETAINED = 0.95;

function parse(text) {
  return [
    ...new Set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    ),
  ].sort();
}

/** The vocabulary as it stands, so the new one can be held against it. */
function current() {
  try {
    const source = readFileSync(TARGET, 'utf8');
    return new Set(
      [...source.matchAll(/^ {2}(?:'([^']*)'|("(?:[^"\\]|\\.)*")),$/gm)].map((match) =>
        match[1] !== undefined ? match[1] : JSON.parse(match[2])
      )
    );
  } catch {
    return new Set();
  }
}

async function download() {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(URL, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`MusicBrainz responded ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      // A 503 here is the rate limiter, and it clears in seconds.
      if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw last;
}

const names = parse(await download());
const before = current();

const added = names.filter((name) => !before.has(name));
const removed = [...before].filter((name) => !new Set(names).has(name));

if (before.size > 0 && names.length < before.size * MIN_RETAINED) {
  throw new Error(
    `refusing to write: ${names.length} genres against ${before.size} currently bundled, ` +
      `which is more loss than this vocabulary has ever had. Response was probably truncated.`
  );
}

const body = names.map((n) => (n.includes("'") ? JSON.stringify(n) : `'${n}'`)).join(',\n  ');

writeFileSync(
  TARGET,
  `/**
 * MusicBrainz's controlled genre vocabulary, from \`/ws/2/genre/all\`.
 *
 * Bundled rather than fetched so genre filtering works offline and costs no
 * requests. It is what separates a genre from a folksonomy tag: MusicBrainz
 * \`tags\` are free text and carry things like \`female vocals\`, \`japanese\` and
 * \`seen live\`, none of which are genres and none of which appear here.
 *
 * Regenerate with \`npm run genres:update\`. Data is CC0.
 */
export const MUSICBRAINZ_GENRES: readonly string[] = [
  ${body},
];
`
);

console.log(`wrote ${names.length} genres (was ${before.size})`);
console.log(`  +${added.length} added${added.length ? `: ${added.join(', ')}` : ''}`);
console.log(`  -${removed.length} removed${removed.length ? `: ${removed.join(', ')}` : ''}`);
