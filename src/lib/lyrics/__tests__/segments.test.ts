import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { looksLikeRomaji, ROMAJI, segmentsOf } from '../segments.ts';

const JAPANESE = [
  '君の名前を呼んでみる',
  '夜の街に響く声',
  '明日もきっと晴れるだろう',
  '遠く離れていても',
];
const ENGLISH = [
  'I keep on running through the night',
  'Nobody told me it would be this hard',
  'But I will find my way back home to you',
  'Hold on to every word you said to me',
  'The city lights are fading out behind us now',
];
const ROMAJI_VERSE = [
  'Kimi no namae wo yonde miru',
  'Yoru no machi ni hibiku koe',
  'Ashita mo kitto hareru darou',
  'Tooku hanarete ite mo',
  'Boku wa koko de matte iru yo',
];

describe('segmentsOf', () => {
  it('reads a song in one language as one pile', () => {
    const segments = segmentsOf(JAPANESE);
    assert.equal(segments.length, 1);
    assert.equal(segments[0]!.language, 'ja');
    assert.deepEqual(segments[0]!.indexes, [0, 1, 2, 3]);
  });

  it('gives each half of a two-language song its own answer', () => {
    // Verse, hook, verse: the order they are sung in, which is not the order
    // the piles come back in.
    const lines = [JAPANESE[0]!, JAPANESE[1]!, ...ENGLISH, JAPANESE[2]!, JAPANESE[3]!];
    const byLanguage = new Map(segmentsOf(lines).map((entry) => [entry.language, entry.indexes]));

    assert.deepEqual(byLanguage.get('ja'), [0, 1, 7, 8]);
    assert.deepEqual(byLanguage.get('en'), [2, 3, 4, 5, 6]);
  });

  it('does not depend on which language the song opens with', () => {
    // The old rule asked the first dozen lines and believed them for the rest.
    const lines = [...ENGLISH, ...ENGLISH, ...ENGLISH, ...JAPANESE];
    const languages = segmentsOf(lines).map((entry) => entry.language);
    assert.deepEqual(languages.sort(), ['en', 'ja']);
  });

  it('files a line of two scripts under the one that is not Latin', () => {
    const lines = [...JAPANESE, '愛してる baby tonight'];
    const segments = segmentsOf(lines);
    assert.equal(segments.length, 1);
    assert.deepEqual(segments[0]!.indexes, [0, 1, 2, 3, 4]);
  });

  it('leaves a few words of a second language as they were sung', () => {
    // Too little to be asked about. Whatever the identifier made of `oh baby`
    // would be acted on, and it is not worth a model to find out.
    const lines = [...JAPANESE, 'Oh baby', 'La la la'];
    const segments = segmentsOf(lines);
    assert.equal(segments[0]!.language, 'ja');
    assert.equal(segments[1]!.language, null);
    assert.deepEqual(segments[1]!.indexes, [4, 5]);
  });

  it('belongs no line without letters to anything', () => {
    const lines = ['', '♪', JAPANESE[0]!, '...', JAPANESE[1]!, JAPANESE[2]!];
    assert.deepEqual(segmentsOf(lines)[0]!.indexes, [2, 4, 5]);
  });

  it('knows romanised Japanese for what it is', () => {
    const segments = segmentsOf(ROMAJI_VERSE);
    assert.equal(segments[0]!.language, ROMAJI);
  });

  it('still knows it with an English hook in the same letters', () => {
    const lines = [...ROMAJI_VERSE, ...ROMAJI_VERSE, 'Hold on to me tonight', ...ROMAJI_VERSE];
    assert.equal(segmentsOf(lines)[0]!.language, ROMAJI);
  });
});

describe('looksLikeRomaji', () => {
  const not: Record<string, string> = {
    english: ENGLISH.join('\n'),
    spanish:
      'La vida es un sueño que nunca termina\nCamino sin rumbo por calles vacías\nY el viento me habla de lo que perdí\nNo me digas que no te quiero yo',
    indonesian:
      'Aku ingin kamu tahu apa yang aku rasa\nSetiap malam aku selalu memikirkan dirimu\nJangan pergi dari sisiku untuk selamanya\nKarena hanya kamu yang ada di hatiku',
    turkish:
      'Yine de düşüyor kar\nKalbim senin için atıyor\nGece bitmeden dön bana\nSeni burada bekliyorum hâlâ ne de olsa',
    italian:
      'Il cielo è grigio e la città dorme\nCammino da solo lungo il fiume\nE penso ancora a quello che mi hai detto\nNon so se tu mi ami come ti amo io',
    syllables: 'La la la la na na na na\nOh oh oh oh yeah yeah\nNa na na hey hey hey\nDa da da di di da',
  };

  for (const [name, verse] of Object.entries(not)) {
    it(`does not take ${name} for it`, () => {
      assert.equal(looksLikeRomaji(verse), false);
    });
  }

  it('wants more than a line before it will say', () => {
    assert.equal(looksLikeRomaji('Kimi no namae wa'), false);
  });
});
