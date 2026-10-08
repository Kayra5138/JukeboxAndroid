import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DEFAULT_SLEEP_MINUTES,
  MAX_SLEEP_MINUTES,
  SLEEP_OFF,
  describeTimer,
  formatRemaining,
  isPreset,
  minutesFrom,
  preferencesFrom,
  preferencesToSetting,
  remainingMs,
} from '../sleep.ts';
import { stringsFor } from '../../i18n/languages.ts';

const NOW = 1_800_000_000_000;

const duration = (leftMs: number, part: object = {}) => ({
  kind: 'duration' as const,
  endsAt: NOW + leftMs,
  finishTrack: false,
  fade: true,
  finishing: false,
  ...part,
});

describe('the minutes a typed line means', () => {
  it('takes a whole number of minutes', () => {
    assert.equal(minutesFrom('20'), 20);
    assert.equal(minutesFrom(' 75 '), 75);
    assert.equal(minutesFrom('1'), 1);
    assert.equal(minutesFrom(String(MAX_SLEEP_MINUTES)), MAX_SLEEP_MINUTES);
  });

  it('reads a number the way it was typed, leading noughts and all', () => {
    assert.equal(minutesFrom('045'), 45);
  });

  it('refuses what is not a number of minutes', () => {
    assert.equal(minutesFrom(''), null);
    assert.equal(minutesFrom('   '), null);
    assert.equal(minutesFrom('soon'), null);
    assert.equal(minutesFrom('20 min'), null);
    assert.equal(minutesFrom('-20'), null);
    // Half a minute could be honoured, but it was never offered, and a number
    // pad that slipped a comma in was not asking for it.
    assert.equal(minutesFrom('1.5'), null);
    assert.equal(minutesFrom('1,5'), null);
    // `Number` would take both of these.
    assert.equal(minutesFrom('1e2'), null);
    assert.equal(minutesFrom('0x10'), null);
  });

  it('refuses no time at all, and more than a night', () => {
    assert.equal(minutesFrom('0'), null);
    assert.equal(minutesFrom('000'), null);
    assert.equal(minutesFrom(String(MAX_SLEEP_MINUTES + 1)), null);
    // Thirty, with a finger left on the nought.
    assert.equal(minutesFrom('3000'), null);
    assert.equal(minutesFrom('99999'), null);
  });
});

describe('what is remembered between nights', () => {
  it('comes back as it was stored', () => {
    const kept = { minutes: 20, finishTrack: true };
    assert.deepEqual(preferencesFrom(preferencesToSetting(kept)), kept);
  });

  it('is the defaults before anything was stored', () => {
    const fresh = { minutes: DEFAULT_SLEEP_MINUTES, finishTrack: false };
    assert.deepEqual(preferencesFrom(null), fresh);
    assert.deepEqual(preferencesFrom(''), fresh);
    assert.deepEqual(preferencesFrom('nonsense'), fresh);
    assert.deepEqual(preferencesFrom('[]'), fresh);
    assert.deepEqual(preferencesFrom('30'), fresh);
  });

  it('keeps the switch when the figure cannot be used', () => {
    assert.deepEqual(preferencesFrom('{"minutes":0,"finishTrack":true}'), {
      minutes: DEFAULT_SLEEP_MINUTES,
      finishTrack: true,
    });
    assert.deepEqual(preferencesFrom('{"minutes":"45","finishTrack":true}'), {
      minutes: DEFAULT_SLEEP_MINUTES,
      finishTrack: true,
    });
  });

  it('takes the switch for off unless it plainly says on', () => {
    assert.equal(preferencesFrom('{"minutes":45,"finishTrack":"yes"}').finishTrack, false);
    assert.equal(preferencesFrom('{"minutes":45}').finishTrack, false);
    assert.equal(preferencesFrom('{"minutes":45}').minutes, 45);
  });
});

describe('which durations are the offered ones', () => {
  it('knows its own presets from a typed figure', () => {
    assert.equal(isPreset(45), true);
    assert.equal(isPreset(20), false);
  });
});

describe('how long is left', () => {
  it('counts down to the moment the service gave', () => {
    assert.equal(remainingMs(duration(90_000), NOW), 90_000);
    assert.equal(remainingMs(duration(90_000), NOW + 30_000), 60_000);
  });

  it('is nothing, not less than nothing, once the moment has passed', () => {
    // The news that it fired has not arrived yet.
    assert.equal(remainingMs(duration(-400), NOW), 0);
  });

  it('has no figure where there is nothing to count', () => {
    assert.equal(remainingMs(SLEEP_OFF, NOW), null);
    assert.equal(remainingMs({ ...SLEEP_OFF, kind: 'endOfTrack' }, NOW), null);
    assert.equal(
      remainingMs(duration(0, { endsAt: null, finishTrack: true, finishing: true }), NOW),
      null
    );
  });
});

describe('a time left, written down', () => {
  it('is minutes and seconds under an hour', () => {
    assert.equal(formatRemaining(15 * 60_000), '15:00');
    assert.equal(formatRemaining(65_000), '1:05');
    assert.equal(formatRemaining(9_000), '0:09');
  });

  it('grows hours when it needs them', () => {
    assert.equal(formatRemaining(90 * 60_000), '1:30:00');
    assert.equal(formatRemaining(3_723_000), '1:02:03');
    assert.equal(formatRemaining(60 * 60_000), '1:00:00');
  });

  it('rounds up, so the last second is shown as one', () => {
    assert.equal(formatRemaining(400), '0:01');
    assert.equal(formatRemaining(59_001), '1:00');
    assert.equal(formatRemaining(3_599_500), '1:00:00');
  });

  it('is nought for nothing, and for nonsense', () => {
    assert.equal(formatRemaining(0), '0:00');
    assert.equal(formatRemaining(-5_000), '0:00');
    assert.equal(formatRemaining(Number.NaN), '0:00');
  });
});

describe('the line that says what the timer is doing', () => {
  it('says nothing with no timer', () => {
    assert.equal(describeTimer(SLEEP_OFF, NOW), null);
  });

  it('counts a duration down', () => {
    assert.equal(describeTimer(duration(12 * 60_000 + 34_000), NOW), 'Pauses in 12:34');
  });

  it('says so once the music has begun to go quiet', () => {
    assert.equal(describeTimer(duration(30_000), NOW), 'Fading out, 0:30 left');
    assert.equal(describeTimer(duration(30_001), NOW), 'Pauses in 0:31');
    // Asked for without a fade, there is none to announce.
    assert.equal(describeTimer(duration(12_000, { fade: false }), NOW), 'Pauses in 0:12');
  });

  it('does not promise a pause at a time when the track is to be let finish', () => {
    assert.equal(
      describeTimer(duration(5 * 60_000, { finishTrack: true, fade: false }), NOW),
      '5:00 left, then to the end of the track'
    );
    // Not a fade either, however little is left.
    assert.equal(
      describeTimer(duration(10_000, { finishTrack: true }), NOW),
      '0:10 left, then to the end of the track'
    );
  });

  it('waits for the track, whether asked to from the start or after the time ran out', () => {
    assert.equal(
      describeTimer({ ...SLEEP_OFF, kind: 'endOfTrack' }, NOW),
      'Pauses when this track ends'
    );
    assert.equal(
      describeTimer(duration(0, { endsAt: null, finishTrack: true, finishing: true }), NOW),
      'Pauses when this track ends'
    );
  });

  /*
    The cases above pass no language and get English, which is what anything
    gets that has not been told otherwise. One of each wording in a second
    language is enough to show the words come from the table and the figures
    do not: the countdown is the same digits wherever it lands in the sentence.
  */
  it('says each of them in the language it is handed', () => {
    const tr = stringsFor('tr');
    assert.equal(describeTimer(duration(12 * 60_000 + 34_000), NOW, tr), '12:34 sonra duraklar');
    assert.equal(describeTimer(duration(30_000), NOW, tr), 'Ses kısılıyor, 0:30 kaldı');
    assert.equal(
      describeTimer(duration(5 * 60_000, { finishTrack: true, fade: false }), NOW, tr),
      '5:00 kaldı, ardından parçanın sonuna kadar'
    );
    assert.equal(
      describeTimer({ ...SLEEP_OFF, kind: 'endOfTrack' }, NOW, tr),
      'Bu parça bitince duraklar'
    );
    assert.equal(describeTimer(SLEEP_OFF, NOW, tr), null);
  });
});
