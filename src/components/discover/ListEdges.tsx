import { StyleSheet, Text, View } from 'react-native';
import { LEADING, RADIUS, SPACE, TYPE } from '../../lib/theme/measures';
import { Busy } from '../Busy';

import { DISCOVER_ROW_HEIGHT } from './DiscoverRow';
import { useDiscoverIds, useDiscoverStatus } from './hooks';
import { emptyShows, listFoot } from './show';
import { useDiscoverActions } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, useColours } from '../../lib/theme/index';
import { Button } from '../Button';

/** How many rows that are not there yet are drawn while a list is made. Enough to say "a list", on any phone. */
const SKELETON = [0, 1, 2, 3, 4, 5];

/**
 * What is drawn where the list would be while it has no songs.
 *
 * While one is being made: the shapes of a few rows, at the height rows
 * are, so that the songs arrive into places that were already there. They
 * are shapes and nothing else. Each of them used to be a grey row saying it
 * was waiting to be found, with a Retry of its own that could not be
 * pressed, twenty times down the screen; what is being done is said once,
 * in the line over the list.
 *
 * Otherwise why there is none, in words meant for whoever is reading them,
 * with the way out of it where there is one.
 */
export function ListEmpty() {
  const status = useDiscoverStatus();
  const { refresh, findMore } = useDiscoverActions();
  const t = useT();
  const styles = useStyles();
  const shows = emptyShows(status);

  if (shows.kind === 'skeleton') {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={t.discover.empty.building}>
        {SKELETON.map((place) => (
          // Each a little fainter than the one above, so the column trails off and does not stop.
          <View key={place} style={[styles.ghost, { opacity: 1 - place * 0.15 }]}>
            <View style={styles.ghostArt} />
            <View style={styles.ghostText}>
              <View style={[styles.ghostLine, styles.ghostTitle]} />
              <View style={[styles.ghostLine, styles.ghostReason]} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  const action = shows.kind === 'problem' ? shows.action : 'refresh';
  return (
    <View style={styles.empty}>
      <Text accessibilityRole={shows.kind === 'problem' ? 'alert' : undefined} style={styles.emptyText}>
        {shows.kind === 'problem' ? shows.text : t.discover.empty.none}
      </Text>
      {/* No button where pressing one would only be told the same again: there the words say what would help. */}
      {action ? (
        <Button
          label={shows.kind === 'problem' ? t.common.retry : t.discover.panel.refresh}
          kind="secondary"
          shape="pill"
          size="small"
          onPress={action === 'findMore' ? findMore : refresh}
        />
      ) : null}
    </View>
  );
}

/**
 * What stands under a list that is short of its number: that more songs are
 * being looked for, or the way to ask for them. One quiet line, where there
 * used to be a placeholder for each empty place.
 */
export function ListFoot() {
  const status = useDiscoverStatus();
  const shown = useDiscoverIds().length;
  const { findMore } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const foot = listFoot(status, shown);
  if (foot === 'none') return null;

  if (foot === 'finding') {
    return (
      <View style={styles.foot}>
        <Busy size={14} color={c.textMuted} />
        <Text style={styles.footText}>{t.discover.empty.findingMore}</Text>
      </View>
    );
  }
  return (
    <View style={styles.foot}>
      <Text style={[styles.footText, styles.grow]} numberOfLines={2}>
        {t.discover.empty.short(status.vacancies)}
      </Text>
      <Button
        label={t.discover.header.findMore}
        kind="secondary"
        shape="pill"
        size="small"
        onPress={findMore}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    height: DISCOVER_ROW_HEIGHT,
    paddingHorizontal: SPACE.l,
  },
  ghostArt: { width: 46, height: 46, borderRadius: RADIUS.cover, backgroundColor: c.surface, ...outlined(c) },
  ghostText: { flex: 1, gap: SPACE.s },
  ghostLine: { height: 9, borderRadius: RADIUS.check, backgroundColor: c.surfaceRaised },
  ghostTitle: { width: '58%' },
  ghostReason: { width: '36%' },

  empty: { alignItems: 'center', gap: SPACE.l, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl, paddingBottom: SPACE.s },
  emptyText: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.body, textAlign: 'center' },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    minHeight: DISCOVER_ROW_HEIGHT,
    paddingHorizontal: SPACE.l,
  },
  footText: { color: c.textMuted, fontSize: TYPE.small },
  grow: { flex: 1, minWidth: 0 },
}));
