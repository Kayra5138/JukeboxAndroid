import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { footOf, LIST_HEADER, LIST_ROW, listPlace, rowAt, scrollStep, wholeHeight } from '../pressList.ts';

const phone = { width: 400, height: 900, top: 40, bottom: 20 };
const rows = (count: number) => Array.from({ length: count }, (_, at) => ({ key: String(at), label: `Row ${at}` }));
/** [count] rows and one kept at the foot. */
const footed = (count: number) => [...rows(count), { key: 'change', label: 'Change', apart: true }];

describe('the list a held button opens', () => {
  it('opens below the finger where it fits, kept off the sides', () => {
    const place = listPlace(380, 200, 5, phone);
    assert.equal(place.y, 214);
    assert.equal(place.height, wholeHeight(5));
    assert.equal(place.x + place.width, 390, 'its right edge kept off the side of the screen');
  });

  it('opens above the finger near the foot of the screen, and is no taller than the room there', () => {
    const place = listPlace(200, 800, 30, phone);
    assert.ok(place.y + place.height <= 800 - 14);
    assert.ok(place.y >= phone.top + 10);
    assert.ok(place.height < wholeHeight(30));
  });

  it('chooses the row the finger is level with, a little either side as well, and nothing on its name or past its ends', () => {
    const menu = { x: 50, y: 100, width: 300, height: wholeHeight(4), rows: rows(4), scroll: 0 };
    assert.equal(rowAt(200, 100 + LIST_HEADER + 5, menu), 0);
    assert.equal(rowAt(20, 100 + LIST_HEADER + LIST_ROW * 2 + 5, menu), 2, 'just beside the list');
    assert.equal(rowAt(200, 110, menu), null, 'on the name');
    assert.equal(rowAt(200, 100 + wholeHeight(4) + 5, menu), null, 'below it');
    assert.equal(rowAt(390, 100 + LIST_HEADER + 5, menu), null, 'far beside it');
    assert.equal(rowAt(200, 100 + LIST_HEADER + 5, { ...menu, scroll: LIST_ROW * 2 }), 2, 'the rows moved up under it');
  });

  it('moves a list longer than its room under a finger held near its foot, never past its end', () => {
    const menu = { y: 100, height: 300, rows: rows(20), scroll: 0 };
    assert.equal(scrollStep(250, menu), 0, 'in the middle');
    assert.ok(scrollStep(395, menu) > 0, 'near the foot');
    assert.equal(scrollStep(140, menu), 0, 'near the top, already at the top');
    const most = wholeHeight(20) - 300;
    assert.equal(scrollStep(399, { ...menu, scroll: most }), 0, 'at the end');
    assert.equal(scrollStep(395, { ...menu, rows: rows(3) }), 0, 'a list that fits');
  });

  it('keeps the rows apart at the foot where they are, chosen there whatever the rest has moved', () => {
    assert.equal(footOf(footed(20)), 1);
    assert.equal(footOf(rows(20)), 0);
    const menu = { x: 50, y: 100, width: 300, height: 300, rows: footed(20), scroll: LIST_ROW * 5 };
    assert.equal(rowAt(200, 400 - 5, menu), 20, 'on the row at the foot');
    assert.equal(rowAt(200, 400 - LIST_ROW - 5, menu), 5 + Math.floor((300 - LIST_ROW - LIST_HEADER - 5) / LIST_ROW), 'just above it, a moved row');
    assert.equal(rowAt(200, 400 - 5, { ...menu, scroll: 0 }), 20, 'the same, the rest not moved');
  });

  it('moves the rest under a finger just above the foot, not on it, and to their very end', () => {
    const menu = { y: 100, height: 300, rows: footed(20), scroll: 0 };
    assert.ok(scrollStep(400 - LIST_ROW - 5, menu) > 0, 'just above the row at the foot');
    assert.equal(scrollStep(400 - 5, menu), 0, 'on it');
    assert.ok(scrollStep(420, { ...menu, rows: rows(20) }) > 0, 'below a list with nothing at its foot');
    const most = wholeHeight(21) - 300;
    assert.equal(scrollStep(400 - LIST_ROW - 5, { ...menu, scroll: most }), 0, 'the last of the rest shown above the foot');
  });
});
