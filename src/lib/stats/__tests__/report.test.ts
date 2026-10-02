import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildReport, hoursOf, RANKED, worthReporting, type ReportInput } from '../report.ts';
import type { ListeningSummary, TopEntry } from '../../db/history.ts';
import type { Listen } from '../period.ts';

const AT = Date.UTC(2026, 5, 15, 12, 0, 0);

function summary(over: Partial<ListeningSummary> = {}): ListeningSummary {
  return {
    playCount: 40,
    totalSeconds: 7200,
    distinctTracks: 22,
    distinctArtists: 9,
    completedCount: 30,
    ...over,
  };
}

function entries(count: number, prefix: string): TopEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}-${index}`,
    label: `${prefix} ${index}`,
    detail: null,
    playCount: 20 - index,
    totalSeconds: 600 - index * 10,
  }));
}

/** Two listens a day for a fortnight, at a predictable hour. */
function listens(days = 14, hour = 21): Listen[] {
  const rows: Listen[] = [];
  for (let day = 0; day < days; day += 1) {
    const at = new Date(2026, 5, 1 + day, hour, 0, 0).getTime();
    rows.push({ at, seconds: 300, completed: 1 });
    rows.push({ at: at + 60_000, seconds: 200, completed: 0 });
  }
  return rows;
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    period: 'year',
    at: AT,
    summary: summary(),
    before: summary({ totalSeconds: 3600 }),
    listens: listens(),
    tracks: entries(8, 'Track'),
    artists: entries(8, 'Artist'),
    genres: entries(4, 'Genre'),
    days: 14,
    ...over,
  };
}

const kinds = (cards: ReturnType<typeof buildReport>) => cards.map((card) => card.kind);

describe('worthReporting', () => {
  it('offers nothing for one or two plays', () => {
    assert.equal(worthReporting(summary({ playCount: 0 })), false);
    assert.equal(worthReporting(summary({ playCount: 2 })), false);
    assert.equal(worthReporting(summary({ playCount: 3 })), true);
  });
});

describe('hoursOf', () => {
  it('sums the seconds into the hour each listen began in', () => {
    const hours = hoursOf(listens(2, 9));
    assert.equal(hours.length, 24);
    assert.equal(hours[9], (300 + 200) * 2);
    assert.equal(
      hours.reduce((total, value) => total + value, 0),
      (300 + 200) * 2
    );
  });
});

describe('buildReport', () => {
  it('opens and closes the same way however much there is in between', () => {
    const cards = buildReport(input());
    assert.equal(cards[0].kind, 'opening');
    assert.equal(cards[cards.length - 1].kind, 'closing');
  });

  it('leaves out a chart there is nothing to put in', () => {
    // Genres only exist for tracks that have been looked up, so a report with
    // none is ordinary rather than broken.
    const cards = buildReport(input({ genres: [] }));
    assert.ok(!kinds(cards).includes('ranking') || !cards.some((card) => card.kind === 'ranking' && card.of === 'genres'));
    assert.ok(cards.some((card) => card.kind === 'ranking' && card.of === 'tracks'));
  });

  it('says nothing about the clock when nothing was listened to', () => {
    const cards = buildReport(input({ listens: [] }));
    assert.ok(!kinds(cards).includes('clock'));
  });

  it('keeps a chart to five however many were handed in', () => {
    const cards = buildReport(input());
    for (const card of cards) {
      if (card.kind === 'ranking') assert.ok(card.entries.length <= RANKED);
    }
  });

  it('measures each entry against the leader', () => {
    const cards = buildReport(input());
    const tracks = cards.find((card) => card.kind === 'ranking' && card.of === 'tracks');
    assert.ok(tracks && tracks.kind === 'ranking');
    assert.equal(tracks.entries[0].share, 1);
    assert.ok(tracks.entries[1].share < 1 && tracks.entries[1].share > 0);
  });

  it('carries the change against the period before, and drops it where there is none', () => {
    const withBefore = buildReport(input())[0];
    assert.ok(withBefore.kind === 'opening' && withBefore.change === 100);

    const without = buildReport(input({ before: null }))[0];
    assert.ok(without.kind === 'opening' && without.change === null);
  });

  it('prints a streak only once it is longer than the day any listening makes', () => {
    const many = buildReport(input()).find((card) => card.kind === 'numbers');
    assert.ok(many && many.kind === 'numbers');
    assert.ok(many.items.some((item) => item.label === 'Streak'));

    const one = buildReport(input({ listens: listens(1) })).find((card) => card.kind === 'numbers');
    assert.ok(one && one.kind === 'numbers');
    assert.ok(!one.items.some((item) => item.label === 'Streak'));
  });

  it('does not divide by a period that has covered no days', () => {
    const cards = buildReport(input({ days: 0 })).find((card) => card.kind === 'numbers');
    assert.ok(cards && cards.kind === 'numbers');
    assert.ok(!cards.items.some((item) => item.label === 'A day'));
  });

  it('names the leader on the closing card', () => {
    const last = buildReport(input()).at(-1);
    assert.ok(last && last.kind === 'closing');
    assert.equal(last.track, 'Track 0');
    assert.equal(last.artist, 'Artist 0');
  });

  it('closes without a leader when there was nothing to lead', () => {
    const last = buildReport(input({ tracks: [], artists: [], genres: [] })).at(-1);
    assert.ok(last && last.kind === 'closing');
    assert.equal(last.track, null);
    assert.equal(last.artist, null);
  });
});
