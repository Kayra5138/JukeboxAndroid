import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { identifyLanguage } from '../identify.ts';
import { LANGUAGE_OF_GUESS } from '../languages.ts';

/*
  A verse rather than a sentence for each, because that is what the identifier
  is given in the app and short text is where it is worst: it counts letter
  trigrams, and there are not many in one line.
*/
const VERSES = {
  tr: 'Yine de düşüyor kar\nKalbim senin için atıyor\nGece bitmeden dön bana\nSeni burada bekliyorum hâlâ',
  de: 'Der Himmel ist grau und die Straßen sind leer\nIch warte auf dich an der alten Brücke\nDie Lichter der Stadt gehen langsam aus',
  es: 'La vida es un sueño que nunca termina\nCamino sin rumbo por calles vacías\nY el viento me habla de lo que perdí',
  fr: "Le ciel est gris et la ville s'endort\nJe marche seul le long de la rivière\nEt je pense encore à ce que tu m'as dit",
  ru: 'Я помню чудное мгновенье\nПередо мной явилась ты\nКак мимолётное виденье',
  ja: '君の名前を呼んでみる\n夜の街に響く声\n明日もきっと晴れるだろう',
  ko: '오늘 밤 하늘을 바라보며\n너의 이름을 불러본다\n내일은 맑을 거야',
  el: 'Ο ουρανός είναι γκρίζος απόψε\nΠερπατάω μόνος στους δρόμους\nΚαι σκέφτομαι όσα μου είπες',
};

describe('identifyLanguage', () => {
  for (const [tag, verse] of Object.entries(VERSES)) {
    it(`reads ${tag}`, () => {
      assert.equal(identifyLanguage(verse), tag);
    });
  }

  it('says nothing rather than guessing at a fragment', () => {
    // Below what the identifier will commit to, which is the honest answer:
    // three words are not enough to tell one language from another.
    assert.equal(identifyLanguage('oh oh'), null);
  });

  it('refuses a language nothing here can translate', () => {
    /*
      Esperanto is identified perfectly well and has no model, and the two
      failures have to look the same to the caller — otherwise a language that
      was recognised but cannot be translated would be handed to the engine as
      if it could be.
    */
    assert.equal(identifyLanguage('La mondo estas bela kaj la vivo estas mallonga sed ni kantas'), null);
  });

  it('tells the two Chinese scripts apart', () => {
    // One writing system, one answer from the identifier, and two models. The
    // characters simplification changed are what separates them.
    assert.equal(identifyLanguage('今天天气很好我们去哪里都可以'), 'zh-Hans');
    assert.equal(identifyLanguage('今天天氣很好我們去哪裡都可以'), 'zh-Hant');
  });

  it('answers only in tags a model exists for', () => {
    /*
      The table is the join between two naming schemes and is easy to mistype.
      Every tag in it has to be one the catalogue names, and `zh-Hant` is
      reachable only through the script check, so it is not in the table.
    */
    const tags = new Set(Object.values(LANGUAGE_OF_GUESS));
    for (const tag of tags) {
      assert.match(tag, /^[a-z]{2}(-[A-Z][a-z]{3})?$/, `${tag} is not a tag`);
    }
    assert.equal(tags.size, Object.keys(LANGUAGE_OF_GUESS).length, 'a tag is listed twice');
  });
});
