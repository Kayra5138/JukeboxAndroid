import assert from 'node:assert/strict';
import { test } from 'node:test';

import { USED_AFTER } from '../tips.ts';
import {
  createWelcome,
  languageForLocale,
  seenFrom,
  SETUP_STEPS,
  SETUP_VERSION,
  stepsFor,
  type WelcomeDeps,
} from '../welcome.ts';

/** Every screen of the setup but the language, which is what somebody updating is shown. */
const SINCE_LANGUAGE = SETUP_STEPS.filter((step) => step.id !== 'language').map((step) => step.id);

/**
 * A settings row, the setup version seen, a language chosen or not, and a
 * history of [listened] plays and skips.
 */
const place = ({
  words = null,
  seen = null,
  chosen = false,
  listened = 0,
}: { words?: string | null; seen?: string | null; chosen?: boolean; listened?: number | (() => number) } = {}) => {
  const kept = { words, seen, writes: 0, counted: 0 };
  const deps: WelcomeDeps = {
    read: () => kept.words,
    write: (next) => {
      kept.words = next;
      kept.writes += 1;
    },
    readSeen: () => kept.seen,
    writeSeen: (version) => {
      kept.seen = String(version);
    },
    languageChosen: () => chosen,
    listened: () => {
      kept.counted += 1;
      return typeof listened === 'function' ? listened() : listened;
    },
  };
  return { kept, welcome: createWelcome(deps) };
};

test('a new install is shown the whole setup, and nothing is written until it is finished', () => {
  const { kept, welcome } = place();
  assert.equal(welcome.shown(), true);
  assert.equal(welcome.again(), false);
  assert.equal(welcome.kind(), 'new');
  assert.deepEqual(welcome.steps(), SETUP_STEPS.map((step) => step.id));
  assert.equal(kept.writes, 0);
  welcome.finish();
  assert.equal(welcome.shown(), false);
  assert.equal(welcome.kind(), null);
  assert.deepEqual(welcome.steps(), []);
  assert.equal(kept.words, 'done');
  assert.equal(kept.seen, String(SETUP_VERSION));
  assert.equal(createWelcome(depsOf(kept)).shown(), false);
});

test('closed on the language screen, the next start welcomes again', () => {
  const { kept } = place();
  assert.equal(createWelcome({ ...depsOf(kept) }).shown(), true);
});

const depsOf = (kept: { words: string | null; seen: string | null }): WelcomeDeps => ({
  read: () => kept.words,
  write: (next) => {
    kept.words = next;
  },
  readSeen: () => kept.seen,
  writeSeen: (version) => {
    kept.seen = String(version);
  },
  languageChosen: () => false,
  listened: () => 0,
});

test('somebody who chose a language, or has listened, is not asked the language again, and it is written down', () => {
  const chose = place({ chosen: true });
  assert.equal(chose.welcome.kind(), 'update');
  assert.deepEqual(chose.welcome.steps(), SINCE_LANGUAGE);
  assert.equal(chose.kept.words, 'done');

  const heard = place({ listened: USED_AFTER });
  assert.equal(heard.welcome.kind(), 'update');
  assert.equal(heard.kept.words, 'done');
  // Counted the once, and read from what was written after that.
  heard.welcome.shown();
  assert.equal(heard.kept.counted, 1);

  assert.equal(place({ listened: USED_AFTER - 1 }).welcome.kind(), 'new');
});

test('somebody updating sees the newer screens once, and not again once they are finished', () => {
  const { kept, welcome } = place({ words: 'done' });
  assert.equal(welcome.shown(), true);
  assert.equal(welcome.again(), false);
  assert.deepEqual(welcome.steps(), SINCE_LANGUAGE);
  welcome.finish();
  assert.equal(kept.seen, String(SETUP_VERSION));
  assert.equal(createWelcome(depsOf(kept)).shown(), false);
  // Neither is the history counted for it: the welcome was had already.
  assert.equal(kept.counted, 0);
});

test('somebody who has seen this setup is not shown it', () => {
  const { welcome } = place({ words: 'done', seen: String(SETUP_VERSION) });
  assert.equal(welcome.shown(), false);
  assert.equal(welcome.kind(), null);
});

test('a setup version that cannot be read is taken as seen', () => {
  const kept = { words: 'done' as string | null, seen: null as string | null };
  const welcome = createWelcome({
    ...depsOf(kept),
    readSeen: () => {
      throw new Error('no table');
    },
  });
  assert.equal(welcome.shown(), false);
});

test('a history that cannot be read is somebody who has used the app', () => {
  const { welcome } = place({
    listened: () => {
      throw new Error('no table');
    },
  });
  assert.equal(welcome.kind(), 'update');
});

test('an updater is shown only what is newer than what they saw', () => {
  const all = SETUP_STEPS.map((step) => step.id);
  assert.deepEqual(stepsFor('new', 0), all);
  assert.deepEqual(stepsFor('again', SETUP_VERSION), all);
  assert.deepEqual(stepsFor('update', 0), SINCE_LANGUAGE);
  assert.deepEqual(stepsFor('update', SETUP_VERSION), []);
  // Each screen is shown to those who saw the version before it, and to nobody who saw its own.
  for (const step of SETUP_STEPS) {
    if (step.since === 0) continue;
    assert.ok(stepsFor('update', step.since - 1).includes(step.id), step.id);
    assert.ok(!stepsFor('update', step.since).includes(step.id), step.id);
  }
});

test('the setup version seen is read as a whole number, and anything else as nought', () => {
  assert.equal(seenFrom(null), 0);
  assert.equal(seenFrom(''), 0);
  assert.equal(seenFrom('1'), 1);
  assert.equal(seenFrom('3'), 3);
  assert.equal(seenFrom('1.5'), 0);
  assert.equal(seenFrom('-1'), 0);
  assert.equal(seenFrom('yes'), 0);
});

test('asked for again, it shows the whole setup until finished, on every start', () => {
  const { kept, welcome } = place({ words: 'done', seen: String(SETUP_VERSION) });
  assert.equal(welcome.shown(), false);
  let told = 0;
  welcome.subscribe(() => {
    told += 1;
  });
  welcome.startOver();
  assert.equal(welcome.shown(), true);
  assert.equal(welcome.again(), true);
  assert.equal(welcome.kind(), 'again');
  assert.deepEqual(welcome.steps(), SETUP_STEPS.map((step) => step.id));
  assert.equal(kept.words, 'again');
  assert.equal(createWelcome(depsOf(kept)).shown(), true);
  welcome.finish();
  assert.equal(welcome.shown(), false);
  assert.equal(told, 2);
});

test('what waits for the welcome goes on once it is finished, and at once when there is none', async () => {
  const { welcome } = place();
  let through = false;
  const waiting = welcome.passed().then(() => {
    through = true;
  });
  await Promise.resolve();
  assert.equal(through, false);
  welcome.finish();
  await waiting;
  assert.equal(through, true);
  await place({ chosen: true, seen: String(SETUP_VERSION) }).welcome.passed();
});

test('a locale is matched to a language by tag, then by language alone', () => {
  const ids = ['en', 'tr', 'de', 'pt-BR', 'zh-Hans'] as const;
  assert.equal(languageForLocale('tr-TR', ids), 'tr');
  assert.equal(languageForLocale('de_AT', ids), 'de');
  assert.equal(languageForLocale('pt-BR', ids), 'pt-BR');
  assert.equal(languageForLocale('pt-PT', ids), 'pt-BR');
  assert.equal(languageForLocale('zh-Hans-CN', ids), 'zh-Hans');
  assert.equal(languageForLocale('zh-TW', ids), 'zh-Hans');
  assert.equal(languageForLocale('ko-KR', ids), null);
  assert.equal(languageForLocale('', ids), null);
  assert.equal(languageForLocale(undefined, ids), null);
});
