import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyTables } from '../../backup/format.ts';
import { remapTables, mergeTables } from '../../backup/apply.ts';
test('a permanent Discover rejection survives backup remapping without a local audio file', () => {
  const source = emptyTables();
  source.discover_exclusions.push({ id:'recording-mbid', song_key:'artist|song', title:'Song', artist:'Artist', reason:'blocked', until_at:null });
  const mapped = remapTables(source,new Map(),[],'/covers/');
  assert.deepEqual(mapped.tables.discover_exclusions,source.discover_exclusions);
  assert.equal(mapped.dropped,0);
});
test('merging a temporary cooldown cannot undo a permanent rejection', () => {
  const here = emptyTables(), there = emptyTables();
  const song = { id:'recording-mbid', song_key:'artist|song', title:'Song', artist:'Artist' };
  here.discover_exclusions = [{ ...song,reason:'blocked',until_at:null }];
  there.discover_exclusions = [{ ...song,reason:'expired',until_at:1234567 }];
  assert.equal(mergeTables(here,there).discover_exclusions[0].reason,'blocked');
  assert.equal(mergeTables(there,here).discover_exclusions[0].reason,'blocked');
});
