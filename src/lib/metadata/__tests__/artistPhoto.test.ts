import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  commonsFileOf,
  commonsQuery,
  confidentArtistId,
  lookupArtistPhoto,
  photoFrom,
  stripMarkup,
} from '../artistPhoto.ts';
import { queryOf, stubFetch, withoutWaiting } from './support.ts';

/** What Commons answers for a file that exists, trimmed to what is read. */
const commonsAnswer = (extmetadata: Record<string, { value: string }>) => ({
  query: {
    pages: {
      '12345': {
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
            thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo.jpg/640px-Photo.jpg',
            extmetadata,
          },
        ],
      },
    },
  },
});

const LICENSED = commonsAnswer({
  LicenseShortName: { value: 'CC BY-SA 3.0' },
  Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jd" title="User:Jd">Jane Doe</a>' },
  AttributionRequired: { value: 'true' },
});

/** The chain as it runs when everything answers: search, relations, Commons. */
function chain(answers: { search?: unknown; relations?: unknown; commons?: unknown } = {}) {
  return stubFetch((url) => {
    if (url.includes('/ws/2/artist/?')) {
      return { body: answers.search ?? { artists: [{ id: 'mbid-1', name: 'Şebnem Ferah', score: 100 }] } };
    }
    if (url.includes('/ws/2/artist/')) {
      return {
        body:
          answers.relations ?? {
            relations: [
              { type: 'image', url: { resource: 'https://commons.wikimedia.org/wiki/File:Aurora_WBW_(2).jpg' } },
            ],
          },
      };
    }
    return { body: answers.commons ?? LICENSED };
  });
}

describe('confidentArtistId', () => {
  it('believes the top hit once it reaches the bar', () => {
    assert.equal(confidentArtistId({ artists: [{ id: 'a', name: 'X', score: 90 }] }), 'a');
    assert.equal(confidentArtistId({ artists: [{ id: 'a', name: 'X', score: 100 }] }), 'a');
  });

  it('refuses anything below it, and an empty search', () => {
    // A picture of the wrong person is far worse than no picture: the card
    // names the artist beside it, so a near-miss is a visible lie.
    assert.equal(confidentArtistId({ artists: [{ id: 'a', name: 'X', score: 89 }] }), null);
    assert.equal(confidentArtistId({ artists: [] }), null);
    assert.equal(confidentArtistId({}), null);
  });
});

describe('commonsFileOf', () => {
  it('takes the file a picture relation points at', () => {
    assert.equal(
      commonsFileOf({
        relations: [
          { type: 'official homepage', url: { resource: 'https://example.com' } },
          { type: 'image', url: { resource: 'https://commons.wikimedia.org/wiki/File:Aurora_WBW_(2).jpg' } },
        ],
      }),
      'Aurora WBW (2).jpg'
    );
  });

  it('reads a name that travelled through the url escaped', () => {
    assert.equal(
      commonsFileOf({
        relations: [
          { type: 'image', url: { resource: 'https://commons.wikimedia.org/wiki/File:%C5%9Eebnem_Ferah.jpg' } },
        ],
      }),
      'Şebnem Ferah.jpg'
    );
  });

  it('will not follow a picture that is not on Commons', () => {
    // Nothing else states a licence this app could honour, so an image
    // relation pointing at a band's own site is no picture at all.
    assert.equal(
      commonsFileOf({ relations: [{ type: 'image', url: { resource: 'https://band.example/press.jpg' } }] }),
      null
    );
    assert.equal(commonsFileOf({ relations: [] }), null);
    assert.equal(commonsFileOf({}), null);
  });
});

describe('stripMarkup', () => {
  it('reduces the photographer Commons stores as a link to their name', () => {
    assert.equal(
      stripMarkup('<a href="//commons.wikimedia.org/wiki/User:Jd" title="User:Jd">Jane Doe</a>'),
      'Jane Doe'
    );
  });

  it('decodes the entities the tags leave behind', () => {
    assert.equal(stripMarkup('Foo &amp; Bar'), 'Foo & Bar');
    assert.equal(stripMarkup('Jos&#233; &quot;Pepe&quot;'), 'José "Pepe"');
    assert.equal(stripMarkup('A&nbsp;B'), 'A B');
  });

  it('collapses what is left of a nest of templates into one line', () => {
    assert.equal(
      stripMarkup('<div class="fn">\n  <span>Jane\n  Doe</span>\n</div>'),
      'Jane Doe'
    );
  });
});

describe('photoFrom', () => {
  it('prefers the rendered copy over the original', () => {
    // The originals are full-resolution photographs; the card draws them a
    // hundred points across.
    const photo = photoFrom(LICENSED);
    assert.equal(photo?.url.includes('640px-'), true);
    assert.deepEqual(
      { credit: photo?.credit, licence: photo?.licence },
      { credit: 'Jane Doe', licence: 'CC BY-SA 3.0' }
    );
  });

  it('keeps the licence when Commons names no photographer', () => {
    const photo = photoFrom(commonsAnswer({ LicenseShortName: { value: 'CC BY 4.0' } }));
    assert.deepEqual(photo?.credit, null);
    assert.equal(photo?.licence, 'CC BY 4.0');
  });

  it('refuses a picture whose terms are not stated', () => {
    // It is about to be redistributed, and terms that are not known cannot be
    // printed beside it.
    assert.equal(photoFrom(commonsAnswer({ Artist: { value: 'Jane Doe' } })), null);
  });

  it('answers nothing for a file that is not there', () => {
    assert.equal(photoFrom({ query: { pages: { '-1': {} } } }), null);
    assert.equal(photoFrom({}), null);
  });
});

describe('commonsQuery', () => {
  it('asks for the url and the licence of one file, at a drawable width', () => {
    const asked = new URL(commonsQuery('Aurora WBW (2).jpg'));
    assert.equal(asked.searchParams.get('titles'), 'File:Aurora WBW (2).jpg');
    assert.equal(asked.searchParams.get('iiprop'), 'url|extmetadata');
    assert.equal(asked.searchParams.get('prop'), 'imageinfo');
    assert.equal(Number(asked.searchParams.get('iiurlwidth')) > 0, true);
  });
});

describe('lookupArtistPhoto', () => {
  it('searches on the plain name, not on the fielded form', async () => {
    // Lucene splits a field's value at the first space, so `artist:Şebnem
    // Ferah` asks after an artist called `Şebnem` and finds nobody; the same
    // name unfielded scores 100.
    const asked = chain();
    await withoutWaiting(() => lookupArtistPhoto('Şebnem Ferah'));

    const search = queryOf(asked.find((url) => url.includes('/ws/2/artist/?'))!);
    assert.ok(search.includes('query=Şebnem Ferah'), search);
    assert.ok(!search.includes('artist:'), search);
  });

  it('follows the chain to a picture and its terms', async () => {
    const asked = chain();
    const photo = await withoutWaiting(() => lookupArtistPhoto('Şebnem Ferah'));

    assert.deepEqual(photo, {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo.jpg/640px-Photo.jpg',
      credit: 'Jane Doe',
      licence: 'CC BY-SA 3.0',
    });
    assert.ok(asked.some((url) => url.includes('inc=url-rels')));
  });

  it('stops at the search when nothing scores well enough', async () => {
    const asked = chain({ search: { artists: [{ id: 'mbid-1', name: 'Someone else', score: 89 }] } });
    assert.equal(await withoutWaiting(() => lookupArtistPhoto('Nobody At All')), null);

    // And costs one request rather than three, which over a library of
    // artists nobody has photographed is the difference that matters.
    assert.equal(asked.length, 1);
  });

  it('stops at the relations when the artist has no picture', async () => {
    const asked = chain({ relations: { relations: [{ type: 'wikidata', url: { resource: 'https://wikidata.org/x' } }] } });
    assert.equal(await withoutWaiting(() => lookupArtistPhoto('Someone')), null);
    assert.equal(asked.length, 2);
  });

  it('asks nothing at all about a blank name', async () => {
    const asked = chain();
    assert.equal(await withoutWaiting(() => lookupArtistPhoto('   ')), null);
    assert.deepEqual(asked, []);
  });

  it('raises a refusal rather than reporting no picture', async () => {
    // The caller writes a miss down for good, so it has to be able to tell
    // "there is none" from "nobody answered".
    stubFetch(() => ({ fail: 'network' }));
    await assert.rejects(() => withoutWaiting(() => lookupArtistPhoto('Şebnem Ferah')));
  });
});
