import { useEffect } from 'react';
import { LEADING, SPACE, TYPE } from '../../lib/theme/measures';
import { StyleSheet, Text, View } from 'react-native';

import { CrossIcon, MinusIcon, PlayOutlineIcon, PlusIcon } from '../Icons';
import { MenuEntry, MenuHeader } from '../MenuSheet';
import { Sheet } from './Sheet';
import { whyLines } from './show';
import { useDiscoverActions, useDiscoverEntry, type DiscoverEntryView } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles } from '../../lib/theme/index';
import { haptic, type Feel } from '../../lib/ui/haptics';

/**
 * Everything that can be done to one song of the list, from a long press on
 * its row, and everything there is to say about it.
 *
 * Not the track menu, though it is drawn to look like it. That one is for a
 * track of the library and most of what it offers goes by the library; a song
 * here may not even have a file yet. This has the four things that can be
 * done to a song of Discover's, and under its name what a row has no room
 * for: what it is doing, in a whole sentence, and why it was chosen, at
 * length.
 *
 * It follows the song while it is open, so a download that finishes behind
 * it is said as it happens, and it closes by itself if the song leaves the
 * list from under it.
 */
export function DiscoverMenu({ id, onClose }: { id: string | null; onClose: () => void }) {
  const entry = useDiscoverEntry(id ?? '');
  const gone = id !== null && !entry;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  return (
    <Sheet visible={entry !== null} title={entry?.title ?? ''} onClose={onClose}>
      {entry ? <Entries entry={entry} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Entries({ entry, onClose }: { entry: DiscoverEntryView; onClose: () => void }) {
  const { play, keep, exclude, excludeArtist } = useDiscoverActions();
  const t = useT();
  const styles = useStyles();
  const said = t.discover.menu;
  const { id } = entry;
  const bad = entry.state === 'failed';
  const then = (act: (id: string) => void, felt?: Feel) => () => {
    if (felt) haptic('results', felt);
    onClose();
    act(id);
  };

  return (
    <>
      <MenuHeader
        title={entry.title}
        detail={entry.artist}
        picture={entry.coverUrl ?? null}
        under={
          // The state in full: the row said it with a mark.
          <Text accessibilityRole={bad ? 'alert' : undefined} style={bad ? styles.stateBad : styles.state}>
            {entry.said}
          </Text>
        }
      />

      {entry.canPlay ? (
        <>
          <MenuEntry icon={PlayOutlineIcon} label={said.play.label} hint={said.play.hint} onPress={then(play)} />
          <MenuEntry
            icon={PlusIcon}
            label={entry.keeping ? t.discover.row.keeping : said.keep.label}
            hint={said.keep.hint}
            disabled={entry.keeping}
            onPress={then(keep, 'confirm')}
          />
          <MenuEntry icon={MinusIcon} label={said.exclude.label} hint={said.exclude.hint} onPress={then(exclude, 'reject')} />
          <MenuEntry
            icon={CrossIcon}
            label={said.neverArtist.label(entry.artist)}
            hint={said.neverArtist.hint}
            danger
            onPress={then(excludeArtist, 'reject')}
          />
        </>
      ) : null}

      <View style={styles.why}>
        <Text style={styles.whyHeading}>{t.format.upper(said.why)}</Text>
        {whyLines(entry, t).map((line) => (
          <Text key={line} style={styles.whyLine}>
            {line}
          </Text>
        ))}
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  state: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.xs },
  stateBad: { color: c.danger, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.xs },
  why: {
    gap: SPACE.xs,
    marginTop: SPACE.s,
    paddingHorizontal: SPACE.l,
    paddingTop: SPACE.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  whyHeading: { color: c.textFaint, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 0.8, marginBottom: SPACE.xxs },
  whyLine: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
}));
