import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, batchReady, retirementIds, selectSongs, settingsFrom, songKey, tasteProfile, type RankedSong } from '../policy.ts';
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
  assert.deepEqual(settingsFrom({ count: 50000, refreshDays: -1, autoDownload: 'yes', wifiOnly: 0 }), { count:20,refreshDays:7,autoDownload:true,wifiOnly:true });
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
