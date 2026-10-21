import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { track } from '../../__tests__/support.ts';
import {
  folderPath,
  folderRows,
  hidingRule,
  isLeftOut,
  isShort,
  isUnder,
  leftOutUnder,
  leftOutWith,
  parseLeftOut,
  parseShortest,
  shownTracks,
  withLeftOut,
} from '../hiding.ts';

describe('a folder and what is under it', () => {
  it('is one folder whatever was done to its slashes', () => {
    assert.equal(folderPath('/Music//WhatsApp/'), 'Music/WhatsApp');
    assert.equal(folderPath('Music\\WhatsApp'), 'Music/WhatsApp');
    assert.equal(folderPath('///'), '');
  });

  it('holds itself and everything inside it, in any case', () => {
    assert.ok(isUnder('Music/WhatsApp/', 'Music/WhatsApp'));
    assert.ok(isUnder('Music/WhatsApp/Voice Notes/', 'music/whatsapp'));
    assert.ok(isUnder('MUSIC/WHATSAPP', '/Music/WhatsApp/'));
  });

  it('goes by whole steps, so a folder does not take its longer-named neighbour', () => {
    assert.ok(!isUnder('Music/Records/', 'Music/Rec'));
    assert.ok(!isUnder('Music/', 'Music/Rec'));
  });

  it('holds nothing when it is no folder at all, and nothing holds a track with no folder', () => {
    assert.ok(!isUnder('Music/', ''));
    assert.ok(!isUnder('Music/', '/'));
    assert.ok(!isUnder(null, 'Music'));
    assert.ok(!isUnder(undefined, 'Music'));
  });
});

describe('the folders left out', () => {
  it('count only inside the library folder, and only the outermost of them', () => {
    const kept = ['Music/WhatsApp', 'Music/WhatsApp/Voice Notes', 'Download/Calls', 'Music', 'Music/Rings/'];
    assert.deepEqual(leftOutUnder(kept, 'Music'), ['Music/Rings', 'Music/WhatsApp']);
  });

  it('do not count where the library folder is inside one of them', () => {
    assert.deepEqual(leftOutUnder(['Music', 'music/rock'], 'Music/Rock'), []);
  });

  it('are read back as written, and as none where the words are not a list of paths', () => {
    assert.deepEqual(parseLeftOut('["Music/WhatsApp","",3,"/"]'), ['Music/WhatsApp']);
    assert.deepEqual(parseLeftOut(null), []);
    assert.deepEqual(parseLeftOut('{'), []);
    assert.deepEqual(parseLeftOut('"Music"'), []);
  });

  it('are switched by any spelling, and switching one in leaves those inside it as they were', () => {
    const out = withLeftOut(['Music/WhatsApp/Voice Notes'], '/Music/WhatsApp/', true);
    assert.deepEqual(out, ['Music/WhatsApp/Voice Notes', 'Music/WhatsApp']);
    assert.deepEqual(withLeftOut(out, 'music/whatsapp', false), ['Music/WhatsApp/Voice Notes']);
    assert.ok(isLeftOut(out, 'MUSIC/WhatsApp'));
    assert.ok(leftOutWith(out, 'Music/WhatsApp/Voice Notes'));
    assert.ok(!leftOutWith(out, 'Music/WhatsApp'));
  });
});

describe('short files', () => {
  it('are shorter than the choice, and none are short with the choice off', () => {
    assert.ok(isShort(12, 30));
    assert.ok(!isShort(30, 30));
    assert.ok(!isShort(12, 0));
  });

  it('are not taken to include a file whose length was not known', () => {
    assert.ok(!isShort(0, 30));
    assert.ok(!isShort(-1, 60));
  });

  it('read the choice back only where it is one on offer', () => {
    assert.equal(parseShortest('30'), 30);
    assert.equal(parseShortest('0'), 0);
    assert.equal(parseShortest('45'), null);
    assert.equal(parseShortest(''), null);
    assert.equal(parseShortest(null), null);
  });
});

describe('the rule the settings make', () => {
  const tracks = [
    track({ id: '1', folder: 'Music/Albums/', durationSec: 240 }),
    track({ id: '2', folder: 'Music/WhatsApp/Voice Notes/', durationSec: 240 }),
    track({ id: '3', folder: 'Music/Rings/', durationSec: 8 }),
    track({ id: '4', folder: null, durationSec: 0 }),
  ];

  it('is none where nothing is left out, and the very list goes through', () => {
    assert.equal(hidingRule({ root: 'Music', leftOut: [], shortest: 0 }), null);
    assert.equal(hidingRule({ root: 'Music/Rock', leftOut: ['Music'], shortest: 0 }), null);
    assert.equal(shownTracks(tracks, null), tracks);
  });

  it('leaves out the folders and the short files, and lets in what it cannot judge', () => {
    const rule = hidingRule({ root: 'Music', leftOut: ['music/whatsapp'], shortest: 10 });
    assert.deepEqual(shownTracks(tracks, rule).map((entry) => entry.id), ['1', '4']);
  });

  it('hands back the very list where it leaves out nothing that is there', () => {
    const rule = hidingRule({ root: 'Music', leftOut: ['Music/Elsewhere'], shortest: 0 });
    assert.ok(rule);
    assert.equal(shownTracks(tracks, rule), tracks);
  });

  it('has one key for one rule, however it was spelled', () => {
    const one = hidingRule({ root: 'Music', leftOut: ['Music/A', 'Music/B'], shortest: 30 });
    const same = hidingRule({ root: 'Music/', leftOut: ['/music/b/', 'Music/A'], shortest: 30 });
    const other = hidingRule({ root: 'Music', leftOut: ['Music/A', 'Music/B'], shortest: 60 });
    assert.equal(one?.key, same?.key);
    assert.notEqual(one?.key, other?.key);
  });
});

describe('the folders the screen lists', () => {
  it('puts in the folders between, counts each with what is inside it, and lists them in order', () => {
    const rows = folderRows(
      [
        { path: 'Music/WhatsApp/Voice Notes', trackCount: 900 },
        { path: 'Music', trackCount: 3 },
        { path: 'Music/Albums/Nirvana', trackCount: 12 },
        { path: 'Music/albums', trackCount: 2 },
        { path: 'Download', trackCount: 5 },
      ],
      'Music'
    );
    assert.deepEqual(
      rows.map((row) => [row.path, row.relative, row.depth, row.trackCount]),
      [
        ['Music/Albums', 'Albums', 1, 14],
        ['Music/Albums/Nirvana', 'Albums/Nirvana', 2, 12],
        ['Music/WhatsApp', 'WhatsApp', 1, 900],
        ['Music/WhatsApp/Voice Notes', 'WhatsApp/Voice Notes', 2, 900],
      ]
    );
  });

  it('is empty where the library folder holds no folders of its own', () => {
    assert.deepEqual(folderRows([{ path: 'Music/', trackCount: 4 }], 'Music'), []);
  });
});
