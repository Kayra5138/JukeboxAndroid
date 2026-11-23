import type { ReactNode } from 'react';

import { HeadNote, type HeadLink } from './MediaPage';
import { useT } from '../lib/i18n/index';
import type { Album } from '../lib/media/albums';
import { lookUpRecord } from '../lib/metadata/albumActions';
import { stopBulkLookup, useBulkLookup } from '../lib/metadata/bulk';
import { useLibraryTracks } from '../lib/library/useLibrary';

/**
 * Looking a record up, from the record's own page. Choosing its cover is
 * in the record's menu (held in the list, or in the rack) and not here: a
 * page of links had more of them than anybody reads.
 *
 * A link among those under a record's buttons (`MediaHead`), beside "Find the
 * rest of this album", and a line under them while the record is being looked
 * up and once it has been (`HeadNote`). The run itself is the app's
 * (`metadata/bulk.ts`): it carries on with the page closed, and is shown under
 * the library's count and on the Tags screen as well. Null for a page that is
 * no record's: asked for on every page, as a hook has to be.
 */
export function useAlbumTools(album: Album | null): { link: HeadLink | null; status: ReactNode } {
  const t = useT();
  const bulk = useBulkLookup();
  const library = useLibraryTracks();
  const said = t.library.albumTools;
  if (!album) return { link: null, status: null };

  const busy = bulk.progress !== null;
  const ours = bulk.album?.key === album.key;

  let status: string | null = null;
  let bad = false;
  if (busy && ours && bulk.progress) {
    status = said.lookingUp(bulk.progress.done, bulk.progress.total);
  } else if (!busy && ours && bulk.last) {
    // A run for lyrics is never one record's, so `ours` already rules it out;
    // the test is for the type, which cannot know that.
    if ('error' in bulk.last) {
      status = said.failed;
      bad = true;
    } else if ('result' in bulk.last) {
      if (bulk.last.result.stopped === 'offline') status = said.offline;
      else if (!bulk.last.result.cancelled) {
        status = said.lookedUp(bulk.last.result.matched, bulk.last.result.coversSaved);
      }
    }
  }

  return {
    link:
      busy && ours
        ? { label: said.stop, onPress: stopBulkLookup }
        : {
            label: t.library.albumActions.lookUp.label,
            hint: t.library.albumActions.lookUp.hint,
            // One lookup at a time, for the reason `bulk.ts` gives.
            disabled: busy,
            onPress: () => void lookUpRecord(album, library),
          },
    status: status ? <HeadNote bad={bad}>{status}</HeadNote> : null,
  };
}
