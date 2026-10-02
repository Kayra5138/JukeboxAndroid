import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSynced, lineAt, parseLrc } from '../lrc.ts';

describe('parseLrc', () => {
  it('reads a timestamp and its words', () => {
    assert.deepEqual(parseLrc('[00:12.34]Tsuyoku nareru riyuu wo shitta'), [
      { at: 12.34, text: 'Tsuyoku nareru riyuu wo shitta' },
    ]);
  });

  it('repeats a line for each of its timestamps', () => {
    assert.deepEqual(parseLrc('[00:15.50][01:20.10]Boku wo tsurete susume'), [
      { at: 15.5, text: 'Boku wo tsurete susume' },
      { at: 80.1, text: 'Boku wo tsurete susume' },
    ]);
  });

  it('ignores the headers describing the file', () => {
    const lrc = ['[ar:LiSA]', '[length:03:55]', '[00:01.00]Words'].join('\n');
    assert.deepEqual(parseLrc(lrc), [{ at: 1, text: 'Words' }]);
  });

  it('keeps the silence between verses', () => {
    const lrc = ['[00:01.00]First', '[00:05.00]', '[00:09.00]Second'].join('\n');
    assert.deepEqual(
      parseLrc(lrc).map((line) => line.text),
      ['First', '', 'Second']
    );
  });

  it('leaves a bracketed time inside the words alone', () => {
    assert.deepEqual(parseLrc('[00:03.00]meet me at [12:00] sharp'), [
      { at: 3, text: 'meet me at [12:00] sharp' },
    ]);
  });

  it('reads both hundredths and thousandths', () => {
    assert.deepEqual(
      parseLrc(['[00:10.5]a', '[00:11.25]b', '[00:12.125]c'].join('\n')).map((l) => l.at),
      [10.5, 11.25, 12.125]
    );
  });

  it('accepts a colon before the fraction', () => {
    assert.deepEqual(parseLrc('[01:02:50]Words'), [{ at: 62.5, text: 'Words' }]);
  });

  it('puts the lines in playing order', () => {
    const lrc = ['[00:30.00]late', '[00:10.00]early', '[00:20.00]middle'].join('\n');
    assert.deepEqual(
      parseLrc(lrc).map((line) => line.text),
      ['early', 'middle', 'late']
    );
  });

  it('returns nothing for plain text', () => {
    assert.deepEqual(parseLrc('Just some words\nwith no timings'), []);
  });
});

describe('lineAt', () => {
  const lines = parseLrc(
    ['[00:10.00]one', '[00:20.00]two', '[00:30.00]three'].join('\n')
  );

  it('reports nothing before the first line', () => {
    assert.equal(lineAt(lines, 0), -1);
    assert.equal(lineAt(lines, 9.99), -1);
  });

  it('holds a line until the next one starts', () => {
    assert.equal(lineAt(lines, 10), 0);
    assert.equal(lineAt(lines, 19.99), 0);
    assert.equal(lineAt(lines, 20), 1);
  });

  it('stays on the last line to the end', () => {
    assert.equal(lineAt(lines, 30), 2);
    assert.equal(lineAt(lines, 9999), 2);
  });

  it('agrees with a plain scan at every point', () => {
    for (let t = 0; t <= 40; t += 0.25) {
      let expected = -1;
      lines.forEach((line, index) => {
        if (line.at <= t) expected = index;
      });
      assert.equal(lineAt(lines, t), expected, `at ${t}s`);
    }
  });

  it('copes with no lyrics at all', () => {
    assert.equal(lineAt([], 12), -1);
  });
});

describe('isSynced', () => {
  it('tells timed lyrics from plain ones', () => {
    assert.equal(isSynced('[00:01.00]Words'), true);
    assert.equal(isSynced('Words'), false);
    assert.equal(isSynced(null), false);
  });
});
