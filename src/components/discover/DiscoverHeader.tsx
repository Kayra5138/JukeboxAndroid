import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AlertIcon, CrossIcon, InfoIcon, RefreshIcon, SettingsIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { useDiscoverStatus } from './hooks';
import { statusLine, type StatusLine } from './show';
import { useDiscoverActions } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';

/** The two lines of the heading: what this is and the way to the rest, then when it was made and the way to a new one. */
const TITLE = 44;
const UPDATED = 44;
const PADDING = 8;

/** How wide the screen has to be for the two lines of the heading to be one. */
const ONE_LINE_FROM = 560;

/**
 * How tall the header is, which the list has to know to say where its rows
 * are without measuring them.
 *
 * Worked out and not measured, so it is right on the first draw. The line
 * of status grows with the size of writing the phone is set to, up to half
 * as large again, since it is the one part that is a sentence; past that
 * its two lines shorten instead.
 */
export function discoverHeaderHeight(width: number, fontScale: number): number {
  const heading = width >= ONE_LINE_FROM ? TITLE : TITLE + UPDATED;
  return PADDING + heading + statusHeight(fontScale);
}

const statusHeight = (fontScale: number) => Math.round(12 + 34 * Math.min(Math.max(fontScale, 1), 1.5));

/**
 * What stands over the list: what it is, when it was made, the three things
 * that can be asked of it, and one line for whatever it is doing.
 *
 * That line is always there, said or empty. A status that came and went
 * used to take its room with it, and the list under the finger moved down a
 * line and back up; now nothing that happens to the list changes how tall
 * this is.
 *
 * It listens for the list's state and nothing else, and is not the list's
 * parent, so a status changing draws this again and no row.
 */
export function DiscoverHeader({ onAbout, onSettings }: { onAbout: () => void; onSettings: () => void }) {
  const status = useDiscoverStatus();
  const { refresh } = useDiscoverActions();
  const { width, fontScale } = useWindowDimensions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover;
  const oneLine = width >= ONE_LINE_FROM;
  const building = status.building !== null;
  const updated = status.updatedAt
    ? said.panel.updated(t.format.date(new Date(status.updatedAt)))
    : said.header.notYet;

  const about = (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={said.header.about}
      style={styles.round}
      onPress={onAbout}>
      <InfoIcon size={20} color={c.textMuted} />
    </Pressable>
  );
  const settings = (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={said.header.settings}
      style={styles.round}
      onPress={onSettings}>
      <SettingsIcon size={20} color={c.textMuted} />
    </Pressable>
  );
  /*
    A button that looks like one. It was the word "Refresh" in the corner,
    which is how a link is drawn, for the one thing on the screen that sets
    half a minute of work going.
  */
  const again = (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityState={{ disabled: building, busy: building }}
      disabled={building}
      style={[styles.refresh, building && styles.off]}
      onPress={refresh}>
      <RefreshIcon size={16} />
      <Text style={styles.refreshLabel} maxFontSizeMultiplier={1.4}>{said.panel.refresh}</Text>
    </Pressable>
  );

  return (
    <View style={styles.header}>
      {oneLine ? (
        <View style={styles.titleRow}>
          <View style={styles.names}>
            <Text accessibilityRole="header" style={styles.heading} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {said.panel.heading}
            </Text>
            <Text style={styles.updated} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {updated}
            </Text>
          </View>
          {about}
          {settings}
          {again}
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={[styles.heading, styles.grow]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {said.panel.heading}
            </Text>
            {about}
            {settings}
          </View>
          <View style={styles.updatedRow}>
            <Text style={[styles.updated, styles.grow]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {updated}
            </Text>
            {again}
          </View>
        </>
      )}
      <View style={[styles.status, { height: statusHeight(fontScale) }]}>
        <Status line={statusLine(status)} />
      </View>
    </View>
  );
}

/** The one line of status: what is wrong, what is being done, or what is being waited for. */
function Status({ line }: { line: StatusLine }) {
  const { refresh, findMore, dismiss } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  if (line.kind === 'none') return null;

  if (line.kind === 'problem') {
    return (
      <View style={styles.statusRow}>
        {/* A shape as well as a colour: red writing alone says nothing to somebody who is not shown red. */}
        <AlertIcon size={16} color={c.danger} />
        <Text accessibilityRole="alert" style={styles.problem} numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {line.text}
        </Text>
        {line.action ? (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            style={styles.statusButton}
            onPress={line.action === 'findMore' ? findMore : refresh}>
            <Text style={styles.statusButtonLabel} maxFontSizeMultiplier={1.5}>
              {line.action === 'findMore' ? t.discover.header.findMore : t.common.retry}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={t.discover.header.dismiss}
          hitSlop={DISMISS_SLOP}
          style={styles.dismiss}
          onPress={() => dismiss('problem')}>
          <CrossIcon size={14} color={c.textMuted} />
        </Pressable>
      </View>
    );
  }

  const fraction = line.kind === 'waiting' ? null : line.fraction;
  return (
    <View style={styles.statusColumn}>
      <View style={styles.statusRow}>
        {line.kind === 'building' && fraction === null ? <ActivityIndicator size={14} color={c.textMuted} /> : null}
        <Text
          // Said when it changes, and politely: it is news of work in hand, not an alarm.
          accessibilityLiveRegion={line.kind === 'waiting' ? 'none' : 'polite'}
          style={styles.statusText}
          numberOfLines={2}
          maxFontSizeMultiplier={1.5}>
          {line.text}
        </Text>
      </View>
      {/* How far along, where that is known: so many artists asked about of so many, so many songs in of so many. */}
      {fraction !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const DISMISS_SLOP = { top: 10, bottom: 10, left: 6, right: 10 };

const useStyles = makeStyles((c) => StyleSheet.create({
  header: { paddingTop: PADDING, paddingHorizontal: 16 },
  titleRow: { height: TITLE, flexDirection: 'row', alignItems: 'center', gap: 2 },
  updatedRow: { height: UPDATED, flexDirection: 'row', alignItems: 'center', gap: 12 },
  names: { flex: 1, minWidth: 0, gap: 1, marginRight: 8 },
  grow: { flex: 1, minWidth: 0 },
  heading: { color: c.text, fontSize: 18, fontWeight: '600' },
  updated: { color: c.textMuted, fontSize: 12.5 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 14,
    marginLeft: 6,
    borderRadius: 18,
    backgroundColor: c.surface,
    ...outlined(c),
  },
  refreshLabel: { color: c.text, fontSize: 13.5, fontWeight: '600' },
  off: { opacity: 0.45 },

  status: { justifyContent: 'center' },
  statusColumn: { gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, minWidth: 0, color: c.textMuted, fontSize: 12, lineHeight: 16 },
  problem: { flex: 1, minWidth: 0, color: c.danger, fontSize: 12, lineHeight: 16 },
  statusButton: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: c.surface,
    ...outlined(c),
  },
  statusButtonLabel: { color: c.text, fontSize: 12.5, fontWeight: '600' },
  dismiss: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  track: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: c.accent },
}));
