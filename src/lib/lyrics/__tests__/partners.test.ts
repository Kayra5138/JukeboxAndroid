import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { partnersByOrder, partnersByTime } from '../partners.ts';

const ROMAJI = ['Kimi no namae wo yonde miru', 'Yoru no machi ni hibiku koe', '', 'Ashita mo kitto hareru darou'];
const TIMES = [12.3, 15.6, 19, 22.4];

describe('partnersByTime', () => {
  it('gives each line the other entry\'s line for the same moment', () => {
    const other = [
      { at: 12.1, text: '君の名前を呼んでみる' },
      { at: 15.9, text: '夜の街に響く声' },
      { at: 22.0, text: '明日もきっと晴れるだろう' },
    ];
    assert.deepEqual(partnersByTime(ROMAJI, TIMES, other), [
      '君の名前を呼んでみる',
      '夜の街に響く声',
      '',
      '明日もきっと晴れるだろう',
    ]);
  });

  it('leaves a line with nobody near it without a partner', () => {
    const lines = [...ROMAJI, 'Tooku hanarete ite mo'];
    const other = [
      { at: 12.1, text: '君の名前を呼んでみる' },
      { at: 15.9, text: '夜の街に響く声' },
      { at: 22.0, text: '明日もきっと晴れるだろう' },
    ];
    const partners = partnersByTime(lines, [...TIMES, 40], other);
    assert.ok(partners);
    assert.equal(partners[4], '');
  });

  it('takes the nearer of two candidates', () => {
    const other = [
      { at: 11.2, text: '遠い' },
      { at: 12.4, text: '近い' },
      { at: 15.6, text: '夜の街に響く声' },
      { at: 22.4, text: '明日もきっと晴れるだろう' },
    ];
    assert.equal(partnersByTime(ROMAJI, TIMES, other)?.[0], '近い');
  });

  it('believes none of it when most of the song does not pair', () => {
    // The same length and a different edit: one line happens to coincide.
    const other = [
      { at: 12.3, text: '君の名前を呼んでみる' },
      { at: 60, text: '夜の街に響く声' },
      { at: 90, text: '明日もきっと晴れるだろう' },
    ];
    assert.equal(partnersByTime(ROMAJI, TIMES, other), null);
  });
});

describe('partnersByOrder', () => {
  it('pairs line for line and keeps the blanks where they were', () => {
    const other = ['君の名前を呼んでみる', '夜の街に響く声', '', '', '明日もきっと晴れるだろう'];
    assert.deepEqual(partnersByOrder(ROMAJI, other), [
      '君の名前を呼んでみる',
      '夜の街に響く声',
      '',
      '明日もきっと晴れるだろう',
    ]);
  });

  it('refuses when one has a line the other has not', () => {
    assert.equal(partnersByOrder(ROMAJI, ['君の名前を呼んでみる', '夜の街に響く声']), null);
  });
});
