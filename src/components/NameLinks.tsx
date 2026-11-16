import { createContext, Fragment, use, useEffect } from 'react';
import { Text } from 'react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';

import { creditReader } from '../lib/db/credits';
import { useT } from '../lib/i18n/index';
import { subscribeLibrary } from '../lib/library/index';
import { albumKey } from '../lib/media/albums';
import { foldForMatch } from '../lib/metadata/text';
import { leftFor, startTrail, type PageParams } from '../lib/ui/pageTrail';

/**
 * Names that lead where they name: an artist's to the artist, a record's to
 * the record. Drawn inside a line of words as part of it, in its colour and
 * size and with nothing to set them apart, as the player has drawn its own
 * since it first had them; a row they are in still answers a touch anywhere
 * else on it.
 *
 * Wherever one is drawn over the screens -- the player, a menu -- what it is
 * drawn in says how to get out of the way first ({@link LeaveFirst}), or the
 * page would open under it.
 */
export const LeaveFirst = createContext<(() => void) | null>(null);

/**
 * How a name goes to its page. From the page it names, nowhere: it is there.
 * From another list's page, in place of that one, remembered for Back (see
 * `ui/pageTrail.ts`), so that one name after another does not pile page on
 * page. From anywhere else, as a page opened over it.
 */
function useGoTo(): (params: PageParams, same: (here: PageParams) => boolean) => void {
  const router = useRouter();
  const leave = use(LeaveFirst);
  return (params, same) => {
    leave?.();
    const { path, here } = where;
    const onPage = path.endsWith('/playlist');
    if (onPage && same(here)) return;
    if (onPage) {
      leftFor(here);
      router.replace({ pathname: '/playlist', params });
      return;
    }
    startTrail();
    router.push({ pathname: '/playlist', params });
  };
}

/*
  Where the app is, for a name pressed to ask: kept up by
  {@link KeepWhereWeAre}, once for the whole app, and read only when a name
  is pressed. Asked for by every name drawn, as it was, every row with an
  artist in it was drawn again whenever anything was opened or left -- a
  tab changed, a page opened -- some hundreds of rows in the library alone,
  and changing tab waited on them.
*/
const where: { path: string; here: PageParams } = { path: '', here: {} };

/** Keeps {@link where} up to date with where the app is. Drawn once, at the root. */
export function KeepWhereWeAre() {
  const path = usePathname();
  const here = useGlobalSearchParams() as PageParams;
  useEffect(() => {
    where.path = path;
    where.here = here;
  }, [here, path]);
  return null;
}

/*
  Who a credit names, read the way the artist pages read it: a reader of the
  catalogues' verdicts, made once and made again when the library is read
  again, since a row asks for one at every drawing.
*/
let reader: ReturnType<typeof creditReader> | null = null;
subscribeLibrary(() => {
  reader = null;
});
function namesIn(credit: string): string[] {
  try {
    reader ??= creditReader();
    const names = reader({ artist: credit, title: null }).filter((name) => foldForMatch(name).length > 0);
    return names.length > 0 ? names : [credit];
  } catch {
    return [credit];
  }
}

/**
 * Each artist [credit] names, each leading to their page, between commas;
 * nobody's, as the app says it, where it names nobody. Plain words where
 * [off] says a touch means something else here (rows being chosen).
 */
export function ArtistLinks({
  credit,
  off = false,
  whole = false,
}: {
  credit: string | null | undefined;
  off?: boolean;
  /** One artist's name already, as the stats count them: not to be read as several. */
  whole?: boolean;
}) {
  const t = useT();
  const goTo = useGoTo();
  const said = credit?.trim();
  if (!said) return <>{t.common.unknownArtist}</>;
  const names = whole ? [said] : namesIn(said);
  if (off) return <>{names.join(', ')}</>;
  return (
    <>
      {names.map((name, place) => (
        <Fragment key={`${place}:${name}`}>
          {place > 0 ? ', ' : ''}
          <Text
            accessibilityRole="link"
            suppressHighlighting
            onPress={() => {
              const artist = foldForMatch(name);
              goTo({ artist }, (here) => here.artist === artist);
            }}>
            {name}
          </Text>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Whoever a record is by, leading to them, and the year it came out: the line
 * under a record's name. Null where it has neither.
 */
export function AlbumBy({ artist, year }: { artist: string | null | undefined; year?: number | string | null }) {
  if (!artist && !year) return null;
  return (
    <>
      {artist ? <ArtistLinks credit={artist} /> : null}
      {artist && year ? ' · ' : ''}
      {year ? String(year) : ''}
    </>
  );
}

/**
 * A record's name, leading to the record: by its key where it is known, or
 * by its name and, where there is one, a song on it, which says which record
 * of the name it is.
 */
export function AlbumLink({
  name,
  albumKey: key,
  albumArtist,
  trackId,
  off = false,
}: {
  name: string;
  albumKey?: string;
  albumArtist?: string | null;
  trackId?: string;
  off?: boolean;
}) {
  const goTo = useGoTo();
  if (off) return <>{name}</>;
  return (
    <Text
      accessibilityRole="link"
      suppressHighlighting
      onPress={() => {
        const album = key ?? albumKey(name, albumArtist);
        goTo(trackId ? { album, track: trackId } : { album }, (here) => here.album === album);
      }}>
      {name}
    </Text>
  );
}
