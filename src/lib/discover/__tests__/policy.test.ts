import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, NO_MATCH, batchReady, isNoMatch, isWaitingWifi, retirementIds, selectSongs, settingsFrom, songKey, tagFit, tagMix, tasteProfile, type RankedSong } from '../policy.ts';
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
test('a shortage leaves a vacancy, never substitutes the wrong artist group', () => {
  const result = selectSongs(Array.from({ length: 25 }, (_, i) => song(i, true)),[],20,new Set());
  assert.equal(result.length,10);
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
  assert.equal(selectSongs(onlyOne,[],20,new Set()).length,10);
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
  assert.deepEqual(settingsFrom({ count: 50000, refreshDays: -1, autoDownload: 'yes', wifiOnly: 0 }), { count:20,refreshDays:0,autoDownload:false,wifiOnly:true });
});

test('refresh never replaces a playable list with an empty, short or unfinished batch', () => {
  assert.equal(batchReady(undefined,20),false);
  assert.equal(batchReady([],20),false);
  assert.equal(batchReady(Array.from({length:19},()=>({track:{id:'ready'}})),20),false);
  assert.equal(batchReady([...Array.from({length:19},()=>({track:{id:'ready'}})),{}],20),false);
  assert.equal(batchReady(Array.from({length:20},()=>({track:{id:'ready'}})),20),true);
});
test('cleanup protects both current and staged jobs, including a reused retired file', () => {
  assert.deepEqual(retirementIds(['reused','expired'],[{id:'old'},{id:'current'},{id:'staged'}],['reused','current','staged',undefined]).sort(),['expired','old']);
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
test('nothing saved means nothing happens unasked: manual refresh, no downloading ahead', () => {
  assert.deepEqual(settingsFrom(null), { count: 20, refreshDays: 0, autoDownload: false, wifiOnly: true });
  assert.deepEqual(settingsFrom({}), settingsFrom(null));
  // What somebody chose is kept, whatever the defaults have become.
  assert.deepEqual(settingsFrom({ count: 30, refreshDays: 7, autoDownload: true, wifiOnly: false }), { count: 30, refreshDays: 7, autoDownload: true, wifiOnly: false });
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
