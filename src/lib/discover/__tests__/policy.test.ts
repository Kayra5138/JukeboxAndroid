import { test } from 'node:test';
import assert from 'node:assert/strict';
import {DAY, NO_MATCH, popularityOf, isNoMatch, isWaitingWifi, selectSongs, settingsFrom, songKey, tagFit, tagMix, tasteProfile, type RankedSong } from '../policy.ts';
const song = (i: number, familiar = i % 2 === 0): RankedSong => ({ recordingMbid: `recording-${i}`, title: `Song ${i}`, artist: `Artist ${Math.floor(i/2)}`, artistMbid: `artist-${Math.floor(i/2)}`, familiar, score: 100-i });
test('fills exact familiar/new quotas without recommending an owned or rejected recording', () => {
  const pool = Array.from({ length: 60 }, (_, i) => song(i));
  const excluded = new Set([pool[0].recordingMbid, songKey(pool[1])]);
  const result = selectSongs(pool, [], 20, excluded);
  assert.equal(result.length,20);
  assert.equal(result.filter(s => s.familiar).length,10);
  assert.ok(result.every(s => !excluded.has(s.recordingMbid) && !excluded.has(songKey(s))));
  assert.equal(result[0].familiar,true); assert.equal(result[1].familiar,false);
});
test('saving or excluding a song refills its half while keeping the other recommendations', () => {
  const pool = Array.from({ length: 80 }, (_, i) => song(i));
  const before = selectSongs(pool, [], 20, new Set());
  const removed = before[0];
  const after = selectSongs(pool, before.slice(1),20,new Set([removed.recordingMbid]));
  assert.equal(after.length,20);
  assert.equal(after.filter(s => s.familiar).length,10);
  before.slice(1).forEach(s => assert.ok(after.some(a => a.recordingMbid === s.recordingMbid)));
  assert.ok(!after.some(s => s.recordingMbid === removed.recordingMbid));
});
test('the half-and-half split is aimed at, and a half that runs short gives its places to the other', () => {
  const allFamiliar = selectSongs(Array.from({ length: 25 }, (_, i) => song(i, true)),[],20,new Set());
  assert.equal(allFamiliar.length,20);
  // Three new songs is all there is: they are all taken, and the rest of the twenty is familiar.
  const fewNew = selectSongs([...Array.from({ length: 40 }, (_, i) => song(i, true)), ...Array.from({ length: 3 }, (_, i) => song(100 + i, false))],[],20,new Set());
  assert.equal(fewNew.length,20);
  assert.equal(fewNew.filter(s => !s.familiar).length,3);
});
test('duplicate recordings and differently spelled duplicate titles get only one place', () => {
  const original = song(0);
  const duplicate = { ...original, recordingMbid: 'alternate-upload', title: original.title.toUpperCase() };
  const result = selectSongs([original, duplicate, ...Array.from({ length: 30 }, (_,i) => song(i+1))], [],20,new Set());
  assert.equal(result.filter(s => songKey(s) === songKey(original)).length,1);
});
test('artist diversity is preferred, relaxed only when the half cannot otherwise fill', () => {
  const pool = Array.from({ length: 40 }, (_, i) => ({ ...song(i), artistMbid: `artist-${i % 10}`, artist: `Artist ${i % 10}` }));
  const result = selectSongs(pool, [],20,new Set());
  for (const artist of new Set(result.map(s => s.artistMbid))) assert.ok(result.filter(s => s.artistMbid === artist).length <= 2);
  const onlyOne = Array.from({ length: 15 }, (_,i) => ({ ...song(i,true), artistMbid: 'one', artist: 'One' }));
  // Fifteen songs by one artist and nothing else: a list of them beats an empty one.
  assert.equal(selectSongs(onlyOne,[],20,new Set()).length,15);
});
test('taste uses rolling thirty days, recency, completion and deliberate early skips', () => {
  const now = 100 * DAY;
  const play = (artist: string, age: number, completed = 0) => ({ artist, track_id: artist, started_at: now - age * DAY, seconds_played: 200, completed });
  const profile = tasteProfile([play('Recent',1),play('Old',25),play('Outside',31),play('Complete',1,1),play('Skipped',1)],
    [{ artist:'Skipped', started_at:now, seconds_played:5, duration_sec:200 }],new Map([['Recent',['rock']]]),now);
  assert.equal(profile.artists[0].name,'Complete');
  assert.ok(profile.artists.find(a => a.name === 'Recent')!.score > profile.artists.find(a => a.name === 'Old')!.score);
  assert.ok(profile.artists.find(a => a.name === 'Recent')!.score > profile.artists.find(a => a.name === 'Skipped')!.score);
  assert.ok(!profile.artists.some(a => a.name === 'Outside'));
  assert.deepEqual(profile.tags,['rock']);
});
test('corrupt settings cannot create enormous downloads or invalid refresh intervals', () => {
  assert.deepEqual(settingsFrom({ count: 50000, refreshDays: -1, ready: 400, wifiOnly: 0 }), { count:20,refreshDays:0,ready:3,wifiOnly:true });
  assert.deepEqual(settingsFrom('nonsense'), settingsFrom(null));
  assert.deepEqual(settingsFrom([1, 2]), settingsFrom(null));
});

test('a song with no recording to be found is recognised, in either wording, and nothing else is', () => {
  assert.ok(isNoMatch(NO_MATCH));
  assert.ok(isNoMatch('A matching studio recording could not be found. Tap to retry later.'));
  assert.ok(!isNoMatch('Download stopped. Tap to retry.'));
  assert.ok(!isNoMatch('Waiting for Wi-Fi'));
  assert.ok(!isNoMatch(undefined));
  assert.ok(!isNoMatch(''));
});
test('the tag mix counts what is played together, not only what is played most', () => {
  const mix = tagMix([
    [['j-pop', 'rock'], 300], [['rock', 'j-pop', 'anime'], 200],
    [['hip hop'], 400], [['video game music', 'electronic'], 250],
    [['rock'], 50], [['ignored'], 0],
  ]);
  assert.deepEqual(mix.tags, ['rock', 'j-pop', 'hip hop', 'electronic']);
  assert.equal(mix.weights.get('rock'), 1);
  assert.equal(mix.weights.get('hip hop'), 400 / 550);
  assert.ok(!mix.weights.has('ignored'));
  // Hip hop is played more than anything it is paired with, and is in no pair: nothing was played with it.
  assert.deepEqual(mix.pairs, [['j-pop', 'rock'], ['electronic', 'video game music'], ['anime', 'j-pop']]);
});
test('a pair is the same pair whichever way round a song lists it, and a repeated tag is one tag', () => {
  const mix = tagMix([[['a', 'b', 'a'], 1], [['b', 'a'], 1]]);
  assert.deepEqual(mix.pairs, [['a', 'b']]);
  assert.equal(mix.weights.get('a'), 1);
});
test('only the first four tags of a song count, and nothing at all is an empty mix', () => {
  assert.ok(!tagMix([[['1', '2', '3', '4', '5'], 1]]).weights.has('5'));
  assert.deepEqual(tagMix([]), { tags: [], weights: new Map(), pairs: [] });
});
test('a song fits by every tag it shares with the mix, up to a cap', () => {
  const weights = new Map([['rock', 1], ['j-pop', 0.5], ['anime', 0.25]]);
  assert.equal(tagFit(['rock', 'j-pop', 'jazz'], weights), 1.5);
  assert.equal(tagFit(['rock', 'rock'], weights), 1);
  assert.equal(tagFit(['jazz'], weights), 0);
  assert.equal(tagFit(['a', 'b', 'c', 'd'], new Map([['a', 1], ['b', 1], ['c', 1], ['d', 1]])), 3);
});
test('nothing saved means a manual refresh and the next three songs kept ready on Wi-Fi', () => {
  assert.deepEqual(settingsFrom(null), { count: 20, refreshDays: 0, ready: 3, wifiOnly: true });
  assert.deepEqual(settingsFrom({}), settingsFrom(null));
  // What somebody chose is kept, whatever the defaults have become.
  assert.deepEqual(settingsFrom({ count: 30, refreshDays: 7, ready: 0, wifiOnly: false }), { count: 30, refreshDays: 7, ready: 0, wifiOnly: false });
});
test('the switch that came before is read as the nearest thing to what it meant', () => {
  // Everything ahead becomes the most there is to choose; off, which a fresh install also said, the default.
  assert.deepEqual(settingsFrom({ count: 20, refreshDays: 0, autoDownload: true, wifiOnly: true }), { count: 20, refreshDays: 0, ready: 10, wifiOnly: true });
  assert.deepEqual(settingsFrom({ count: 20, refreshDays: 0, autoDownload: false, wifiOnly: false }), { count: 20, refreshDays: 0, ready: 3, wifiOnly: false });
  // Once chosen anew, the old switch says nothing.
  assert.deepEqual(settingsFrom({ autoDownload: true, ready: 5 }), { count: 20, refreshDays: 0, ready: 5, wifiOnly: true });
});
test('a choice kept here by another part of Discover is carried through untouched', () => {
  const kept = settingsFrom({ ready: 5, popularity: 'deep' }) as unknown as Record<string, unknown>;
  assert.equal(kept.popularity, 'deep');
  assert.equal(kept.ready, 5);
});

test('a download waiting for Wi-Fi is known by its code, whatever language its words are in', () => {
  assert.ok(isWaitingWifi({ error: 'Wi-Fi bekleniyor. Otomatik indirme daha sonra sürecek.', errorCode: 'ERR_DOWNLOAD_WAITING_WIFI' }));
  assert.ok(!isWaitingWifi({ error: 'İndirme başarısız oldu.', errorCode: 'ERR_YOUTUBE_NETWORK' }));
  // The code is believed over words that only happen to mention it.
  assert.ok(!isWaitingWifi({ error: 'Waiting for Wi-Fi', errorCode: 'ERR_DOWNLOAD_FAILED' }));
  // A failure that has been cleared is not waiting for anything, whatever code was left.
  assert.ok(!isWaitingWifi({ errorCode: 'ERR_DOWNLOAD_WAITING_WIFI' }));
});
test('an entry stored before codes were kept is still known by its English', () => {
  assert.ok(isWaitingWifi({ error: 'Waiting for Wi-Fi. Automatic download will resume later.' }));
  assert.ok(isWaitingWifi({ error: 'Waiting for Wi-Fi. Automatic download will resume later.', errorCode: null }));
  assert.ok(!isWaitingWifi({ error: 'Download failed. Please retry.' }));
  assert.ok(!isWaitingWifi({}));
});
/** A pool of [n] songs, best first: each by an artist of its own and led to by a seed of its own, every other one familiar. Stamped with [edition] where one is given. */
const pooled = (n: number, edition?: number) => Array.from({ length: n }, (_, i) => ({
  recordingMbid: `pooled-${String(i).padStart(4, '0')}`, title: `Pooled ${i}`, artist: `Pooled Artist ${i}`, artistMbid: `pooled-artist-${i}`,
  familiar: i % 2 === 0, score: 1000 - i, because: `Seed ${i}`, ...(edition == null ? {} : { edition }),
}));
test('the same edition of the same pool is the same list, and another edition is another list', () => {
  const pool = pooled(200);
  const first = selectSongs(pool, [], 20, new Set(), { edition: 1 });
  assert.deepEqual(selectSongs([...pool].reverse(), [], 20, new Set(), { edition: 1 }), first);
  const second = selectSongs(pool, [], 20, new Set(), { edition: 2 });
  assert.equal(second.length, 20);
  assert.ok(second.filter(s => !first.includes(s)).length >= 5);
});
test('a pool that says which build it came from needs nothing passed to be drawn from by chance', () => {
  const stamped = selectSongs(pooled(200, 7), [], 20, new Set());
  assert.deepEqual(stamped.map(s => s.recordingMbid), selectSongs(pooled(200), [], 20, new Set(), { edition: 7 }).map(s => s.recordingMbid));
  // And one that does not is taken in order of score, as it always was.
  assert.deepEqual(selectSongs(pooled(200), [], 20, new Set()).map(s => s.recordingMbid).sort(), pooled(20).map(s => s.recordingMbid).sort());
});
test('chance moves a song about among its equals and never lifts the weakest over the strongest', () => {
  const strong = pooled(40).map(s => ({ ...s, score: 10 }));
  const weak = pooled(200).slice(40).map(s => ({ ...s, score: 1 }));
  for (const edition of [1, 2, 3, 4, 5]) {
    const list = selectSongs([...weak, ...strong], [], 20, new Set(), { edition });
    assert.ok(list.every(s => s.score === 10));
  }
});
test('no one of somebody\u2019s artists fills more than a quarter of the list with its neighbourhood', () => {
  const pool = pooled(200).map((s, i) => ({ ...s, familiar: false, because: i < 100 ? 'Favourite · Other' : `Seed ${i % 5}` }));
  const list = selectSongs(pool, [], 20, new Set(), { edition: 3 });
  assert.equal(list.length, 20);
  assert.ok(list.filter(s => s.because.startsWith('Favourite')).length <= 5);
  // With nothing else to choose from, the cap gives way before the list goes short.
  assert.equal(selectSongs(pool.slice(0, 100), [], 20, new Set(), { edition: 3 }).length, 20);
});
test('a list of ten has one song an artist, and a longer one two', () => {
  const pool = Array.from({ length: 80 }, (_, i) => ({ ...song(i), artistMbid: `artist-${i % 20}`, artist: `Artist ${i % 20}` }));
  const ten = selectSongs(pool, [], 10, new Set(), { edition: 1 });
  assert.equal(new Set(ten.map(s => s.artistMbid)).size, 10);
  const twenty = selectSongs(pool, [], 20, new Set(), { edition: 1 });
  assert.equal(twenty.length, 20);
  const most = (list: typeof pool) => Math.max(...[...new Set(list.map(s => s.artistMbid))].map(a => list.filter(s => s.artistMbid === a).length));
  assert.equal(most(twenty), 2);
});
test('the limit on one artist is kept while the other half still has artists to offer, and given up only when nothing else is left', () => {
  // Two artists somebody plays, with ten songs each; thirty new artists with a song each.
  const familiar = Array.from({ length: 20 }, (_, i) => ({ ...song(i * 2), artistMbid: `own-${i % 2}`, artist: `Own ${i % 2}`, title: `Own song ${i}` }));
  const fresh = Array.from({ length: 30 }, (_, i) => ({ ...song(i * 2 + 1), artistMbid: `new-${i}`, artist: `New ${i}`, title: `New song ${i}`, because: `Seed ${i}` }));
  const list = selectSongs([...familiar, ...fresh], [], 20, new Set());
  assert.equal(list.length, 20);
  // Two each of the two, and the places the familiar half could not fill politely go to new artists.
  assert.equal(list.filter(s => s.familiar).length, 4);
  for (const artist of ['own-0', 'own-1']) assert.equal(list.filter(s => s.artistMbid === artist).length, 2);
  // With nothing else to choose from, the limit gives way before the list goes short.
  const only = selectSongs(familiar, [], 20, new Set());
  assert.equal(only.length, 20);
});
test('a song is kept away under a looser reading of its title, and its remaster with it', () => {
  const owned = new Set([songKey({ artist: 'Linkin Park', title: 'Numb (2011 Remaster)' }), songKey({ artist: 'Mew', title: 'Comforting Sounds (feat. Somebody)' })]);
  const pool = [
    { ...song(1), artist: 'Linkin Park', title: 'Numb' },
    { ...song(3), artist: 'Mew', title: 'Comforting Sounds' },
    { ...song(5), artist: 'Mew', title: 'Snow Brigade' },
  ];
  assert.deepEqual(selectSongs(pool, [], 20, owned).map(s => s.title), ['Snow Brigade']);
  // And two spellings in the pool are one place on the list.
  const twice = [{ ...song(1), title: 'Numb' }, { ...song(1), recordingMbid: 'other', title: 'Numb - Remastered' }];
  assert.equal(selectSongs(twice, [], 20, new Set()).length, 1);
});
test('a blocked artist is kept away by the row that blocks them, by name or by id', () => {
  const pool = [{ ...song(1), artist: 'Sigur Rós feat. Somebody', artistMbid: 'a' }, { ...song(3), artist: 'Spelled Otherwise', artistMbid: 'b' }, { ...song(5), artist: 'Fine', artistMbid: 'c' }];
  const away = new Set(['artist:sigur ros', 'artist-mbid:b']);
  assert.deepEqual(selectSongs(pool, [], 20, away).map(s => s.artist), ['Fine']);
});
test('the popularity choice is read from whatever was stored, and is no preference unless it says otherwise', () => {
  assert.equal(popularityOf({ popularity: 'deep' }), 'deep');
  assert.equal(popularityOf({ popularity: 'known' }), 'known');
  assert.equal(popularityOf({ popularity: 'obscure' }), 'any');
  assert.equal(popularityOf({}), 'any');
  assert.equal(popularityOf(null), 'any');
  assert.equal(popularityOf(settingsFrom({ popularity: 'deep' })), 'deep');
});

/* Places shared out by how hard each of somebody's artists pulls, where the pool says. */
const planned = (artist: string, n: number, familiar: boolean, because: string, share: number, score = 1): RankedSong => ({
  recordingMbid: `shop-${artist}-${n}`, title: `${artist} song ${n}`, artist, artistMbid: `id-${artist}`, familiar, score, because, share, edition: 'e',
});
const SHARES: [string, number][] = [['Aurora', 1], ['Billie', 0.72], ['Metallica', 0.69], ['Dragons', 0.57], ['Ellie', 0.54], ['Eminem', 0.47]];
const plannedPool = () => [
  // Each of somebody's artists has eight songs of their own, and four neighbours with three songs each.
  ...SHARES.flatMap(([seed, share]) => Array.from({ length: 8 }, (_, n) => planned(seed, n, true, seed, share, share))),
  ...SHARES.flatMap(([seed, share]) =>
    [0, 1, 2, 3].flatMap((k) => Array.from({ length: 3 }, (_, n) => planned(`${seed} neighbour ${k}`, n, false, seed, share, share * (1 - k / 10))))
  ),
];
const countBy = (songs: RankedSong[], familiar: boolean) => {
  const counts: Record<string, number> = {};
  for (const song of songs.filter((entry) => entry.familiar === familiar)) {
    const owner = (song.because ?? '').split(' · ')[0]!;
    counts[owner] = (counts[owner] ?? 0) + 1;
  }
  return counts;
};
test('shares the places of each half out between somebody’s artists by how hard each pulls', () => {
  const list = selectSongs(plannedPool(), [], 20, new Set());
  assert.equal(list.length, 20);
  const want = { Aurora: 3, Billie: 2, Metallica: 2, Dragons: 1, Ellie: 1, Eminem: 1 };
  assert.deepEqual(countBy(list, false), want);
  assert.deepEqual(countBy(list, true), want);
});
test('meets a new artist by one song, and gives the artist played most three of their own', () => {
  const list = selectSongs(plannedPool(), [], 20, new Set());
  const perArtist = new Map<string, number>();
  for (const song of list) perArtist.set(song.artist, (perArtist.get(song.artist) ?? 0) + 1);
  for (const song of list.filter((entry) => !entry.familiar)) assert.equal(perArtist.get(song.artist), 1, song.artist);
  assert.equal(perArtist.get('Aurora'), 3);
  assert.equal(perArtist.get('Billie'), 2);
});
test('the same edition shares them out the same way, and another edition chooses other songs', () => {
  const ids = (edition: string) => selectSongs(plannedPool(), [], 20, new Set(), { edition }).map((song) => song.recordingMbid);
  assert.deepEqual(ids('one'), ids('one'));
  assert.notDeepEqual(ids('one'), ids('two'));
  assert.deepEqual(countBy(selectSongs(plannedPool(), [], 20, new Set(), { edition: 'two' }), false), countBy(selectSongs(plannedPool(), [], 20, new Set(), { edition: 'one' }), false));
});
test('an artist with fewer neighbours than places gives the places it cannot fill to the others', () => {
  const pool = plannedPool().filter((song) => song.familiar || !song.artist.startsWith('Aurora neighbour') || song.artist.endsWith(' 0'));
  const list = selectSongs(pool, [], 20, new Set());
  assert.equal(list.length, 20);
  assert.equal(list.filter((song) => !song.familiar).length, 10);
  // One neighbour is all she has, and it may now be heard twice before the list is left short.
  assert.ok(countBy(list, false).Aurora! <= 3);
});
test('a place that falls empty is refilled from the artist it belonged to', () => {
  const pool = plannedPool();
  const before = selectSongs(pool, [], 20, new Set());
  const removed = before.find((song) => !song.familiar && song.because === 'Aurora')!;
  const after = selectSongs(pool, before.filter((song) => song !== removed), 20, new Set([removed.recordingMbid, songKey(removed)]));
  assert.equal(after.length, 20);
  assert.equal(countBy(after, false).Aurora, 3);
  assert.ok(!after.some((song) => song.recordingMbid === removed.recordingMbid));
});
test('a song turned away under one catalogue’s id and spelling stays away under the other’s', () => {
  const fromDeezer = planned('Halsey', 0, false, 'Billie', 0.72, 5);
  fromDeezer.title = 'Lilith (Diablo IV Anthem)';
  const pool = [fromDeezer, ...plannedPool()];
  assert.ok(selectSongs(pool, [], 20, new Set()).includes(fromDeezer));
  // It was shown before as ListenBrainz had it: another id, a guest in the credit, a note on the title.
  for (const shown of [
    { title: 'Lilith (Diablo IV anthem) (Official Audio)', artist: 'Halsey feat. SUGA of BTS' },
    { title: 'Lilith (Diablo IV anthem)', artist: 'Halsey featuring SUGA' },
    { title: 'LILITH (DIABLO IV ANTHEM)', artist: 'halsey' },
  ]) {
    assert.ok(!selectSongs(pool, [], 20, new Set(['some-recording-mbid', songKey(shown)])).includes(fromDeezer), songKey(shown));
  }
  // And the other way about: turned away as Deezer had it, offered again by ListenBrainz with the guest written in
  // — by a word, or by an ampersand that a fold would have lost.
  for (const artist of ['Halsey feat. SUGA', 'Halsey & SUGA']) {
    const listened = { ...fromDeezer, recordingMbid: '0e1c3a52-0000-4000-8000-000000000000', artist };
    const away = new Set([fromDeezer.recordingMbid, songKey(fromDeezer)]);
    assert.ok(!selectSongs([listened, ...plannedPool()], [], 20, away).includes(listened), artist);
  }
  // By its own id, as ever.
  assert.ok(!selectSongs(pool, [], 20, new Set([fromDeezer.recordingMbid])).includes(fromDeezer));
});
test('one song from two catalogues gets one place on a list', () => {
  const a = planned('Halsey', 0, false, 'Billie', 0.72, 5);
  const b = { ...a, recordingMbid: 'mbid-of-the-same', artist: 'Halsey feat. SUGA' };
  const list = selectSongs([a, b, ...plannedPool()], [], 20, new Set());
  assert.equal(list.filter((song) => song.title === a.title).length, 1);
});
test('a pool gathered before places were shared out is chosen from the way it always was', () => {
  const pool = Array.from({ length: 60 }, (_, i) => song(i));
  const list = selectSongs(pool, [], 20, new Set());
  assert.deepEqual(list.map((entry) => entry.recordingMbid).slice(0, 4), ['recording-0', 'recording-1', 'recording-2', 'recording-3']);
});
