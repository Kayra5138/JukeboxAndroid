import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import type { Album } from '../lib/media/albums';
import { lookUpRecord } from '../lib/metadata/albumActions';
import { stopBulkLookup, useBulkLookup } from '../lib/metadata/bulk';
import { useLibraryTracks } from '../lib/library/useLibrary';
import { makeStyles } from '../lib/theme/index';
import { useAnnounce } from '../lib/ui/announce';

/**
 * Looking a record up, from the record's own page. Choosing its cover is
 * in the record's menu (held in the list, or in the rack) and not here: a
 * page of links had more of them than anybody reads.
 *
 * Links, drawn to sit in the row of quiet links under a record's buttons
 * beside "Find the rest of this album", with a line under them while the
 * record is being looked up and once it has been. The run itself is the
 * app's (`metadata/bulk.ts`): it carries on with the page closed, and is
 * shown under the library's count and on the Tags screen as well.
 */
export function AlbumTools({ album }: { album: Album }) {
  const t = useT();
  const styles = useStyles();
  const bulk = useBulkLookup();
  const library = useLibraryTracks();
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  useAnnounce(note?.text);
  const said = t.library.albumTools;

  const busy = bulk.progress !== null;
  const ours = bulk.album?.key === album.key;

  const lookUp = () => {
    setNote(null);
    void lookUpRecord(album, library);
  };

  let status: string | null = null;
  if (busy && ours && bulk.progress) {
    status = said.lookingUp(bulk.progress.done, bulk.progress.total);
  } else if (!busy && ours && bulk.last) {
    // A run for lyrics is never one record's, so `ours` already rules it out;
    // the test is for the type, which cannot know that.
    if ('error' in bulk.last) status = said.failed;
    else if ('result' in bulk.last) {
      if (bulk.last.result.stopped === 'offline') status = said.offline;
      else if (!bulk.last.result.cancelled) {
        status = said.lookedUp(bulk.last.result.matched, bulk.last.result.coversSaved);
      }
    }
  }

  return (
    <>
      {busy && ours ? (
        <Pressable style={styles.linkHit} accessibilityRole="button" onPress={stopBulkLookup}>
          <Text style={styles.link}>{said.stop}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.linkHit}
          accessibilityRole="button"
          accessibilityHint={t.library.albumActions.lookUp.hint}
          // One lookup at a time, for the reason `bulk.ts` gives.
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          onPress={lookUp}>
          <Text style={[styles.link, busy && styles.off]}>{t.library.albumActions.lookUp.label}</Text>
        </Pressable>
      )}
      {status || note ? (
        <Text
          style={[styles.status, note?.bad && styles.bad]}
          accessibilityLiveRegion="polite">
          {note?.text ?? status}
        </Text>
      ) : null}
    </>
  );
}

// The links' own look, as the record's pages draw theirs.
const useStyles = makeStyles((c) => StyleSheet.create({
  linkHit: { minHeight: 48, justifyContent: 'center' },
  link: { color: c.accent, fontSize: 13.5 },
  off: { color: c.textFaint },
  // A line of its own under the links, which wrap in a row.
  status: { flexBasis: '100%', color: c.textMuted, fontSize: 12.5, paddingBottom: 6 },
  bad: { color: c.danger },
}));
