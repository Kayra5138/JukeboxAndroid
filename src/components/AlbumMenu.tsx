import { Modal, ScrollView, StyleSheet } from 'react-native';
import { AsideIcon, BroughtBackIcon, DiscIcon, PictureIcon, SearchIcon, SelectIcon } from './Icons';
import { MenuEntry, MenuHeader, type MenuIcon } from './MenuSheet';
import { ArtistLinks, LeaveFirst } from './NameLinks';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { useAlbumArtwork } from '../lib/media/artwork';
import type { Track } from '../lib/types';
import { makeStyles, outlined } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';

export type AlbumAction = 'select' | 'rest' | 'lookUp' | 'cover' | 'setAside' | 'bringBack';

/**
 * In the order the sheet shows them; `library.albumActions` says what each is.
 * Of setting it aside and bringing it back, the screen shows the one that
 * applies (`library/setAside.ts`).
 */
const ACTIONS: readonly AlbumAction[] = ['select', 'rest', 'lookUp', 'cover', 'setAside', 'bringBack'];

/** For the rack, which has no boxes to tick and so nothing for "Select" to start. */
export const WITHOUT_SELECT: readonly AlbumAction[] = ['select'];

/**
 * What can be done to one album, from a long press on it.
 *
 * `TrackMenu` for a record, and drawn as that is on purpose: the same sheet,
 * the same rows of a name over a line saying what it does, so holding a row
 * down means one thing whichever kind of row it is.
 *
 * Holding an album used to start choosing tracks with it, straight away.
 * That is the first entry here now, one tap further on, because a long press
 * can only do one thing and there is more than one thing to do to an album.
 */
const ICONS: Record<AlbumAction, MenuIcon> = {
  select: SelectIcon,
  // The rest of the record: the tracks on it not had yet.
  rest: DiscIcon,
  lookUp: SearchIcon,
  cover: PictureIcon,
  setAside: AsideIcon,
  bringBack: BroughtBackIcon,
};

export function AlbumMenu({
  album,
  hidden,
  onSelect,
  onClose,
}: {
  /** [covers] are what its one cover is found among, as the rack and the list of albums find it. */
  album: { name: string; by?: string | null; detail: string; covers?: readonly Track[] } | null;
  hidden?: readonly AlbumAction[];
  onSelect: (action: AlbumAction) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const cover = useAlbumArtwork(album?.covers ?? null);
  useWindowVeil(album !== null);
  return (
    <Modal visible={album !== null} transparent animationType="fade" onRequestClose={onClose}>
      {/* Not a stop for a screen reader, which would otherwise read the whole
          heading as one button that closes the menu. The back gesture closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {album ? (
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            {/* Whoever it is by leads to them, the menu put away first. */}
            <LeaveFirst value={onClose}>
              <MenuHeader
                title={album.name}
                detail={
                  album.by ? (
                    <>
                      <ArtistLinks credit={album.by} />
                      {album.detail ? ` · ${album.detail}` : ''}
                    </>
                  ) : (
                    album.detail
                  )
                }
                picture={cover}
              />
            </LeaveFirst>
            {ACTIONS.filter((action) => !hidden?.includes(action)).map((action) => (
              <MenuEntry
                key={action}
                icon={ICONS[action]}
                label={t.library.albumActions[action].label}
                hint={t.library.albumActions[action].hint}
                onPress={() => onSelect(action)}
              />
            ))}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
    ...outlined(c),
  },
  sheetBody: { paddingTop: 4, paddingBottom: 28 },
}));
