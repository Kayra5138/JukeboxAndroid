import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ProgressBar } from '../ProgressBar';
import { Busy } from '../Busy';

import { AlertIcon, CrossIcon, InfoIcon, RefreshIcon, SettingsIcon } from '../Icons';
import { Button } from '../Button';
import { Pressable } from '../Pressable';
import { SlideToRefresh } from './SlideToRefresh';
import { useDiscoverStatus } from './hooks';
import { statusLine, type StatusLine } from './show';
import { useDiscoverActions } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, useColours, usePressed } from '../../lib/theme/index';
import { ICON, ICON_SMALL, LEADING, SPACE, TYPE } from '../../lib/theme/measures';

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
 * of status is there only while it has something to say ([saying]), and
 * grows with the size of writing the phone is set to, up to half as large
 * again, since it is the one part that is a sentence; past that its two
 * lines shorten instead.
 */
export function discoverHeaderHeight(width: number, fontScale: number, saying: boolean): number {
  const heading = width >= ONE_LINE_FROM ? TITLE : TITLE + UPDATED;
  return PADDING + heading + statusHeight(fontScale, saying);
}

const statusHeight = (fontScale: number, saying: boolean) =>
  saying ? Math.round(12 + 34 * Math.min(Math.max(fontScale, 1), 1.5)) : 0;

/**
 * What stands over the list: what it is, when it was made, the three things
 * that can be asked of it, and one line for whatever it is doing.
 *
 * That line is there only while it says something. Kept empty the rest of
 * the time, so that the list never moved under the finger as a status came
 * and went, it was a band of nothing between the heading and the songs for
 * most of the time the screen was open; the list now moves down a line when
 * there is something to say, which is mostly as a new one is begun.
 *
 * It listens for the list's state and nothing else, and is not the list's
 * parent, so a status changing draws this again and no row.
 */
export function DiscoverHeader({ onAbout, onSettings, hasList }: { onAbout: () => void; onSettings: () => void; hasList: boolean }) {
  const status = useDiscoverStatus();
  const { refresh } = useDiscoverActions();
  const { width, fontScale } = useWindowDimensions();
  const t = useT();
  const styles = useStyles();
  const said = t.discover;
  const oneLine = width >= ONE_LINE_FROM;
  const building = status.building !== null;
  /*
    While a new list is being got ready the track is not to be slid: what
    sliding it would do then is show what is ready of it, and the track
    saying "refresh" for that read as a second refresh. Once some of it is
    ready, the track is that instead, at a touch ("Show it now").
  */
  const preparing = status.preparing !== null;
  const showable = (status.preparing?.ready ?? 0) > 0;
  const line = statusLine(status);
  const updated = status.updatedAt
    ? said.panel.updated(t.format.date(new Date(status.updatedAt)))
    : said.header.notYet;

  // Round marks, as the tabs' titles have them (`TabTitle`).
  const about = (
    <Button kind="secondary" label={said.header.about} mark={(ink) => <InfoIcon size={ICON} color={ink} />} onPress={onAbout} />
  );
  const settings = (
    <Button kind="secondary" label={said.header.settings} mark={(ink) => <SettingsIcon size={ICON} color={ink} />} onPress={onSettings} />
  );
  /*
    A button that looks like one. It was the word "Refresh" in the corner,
    which is how a link is drawn, for the one thing on the screen that sets
    half a minute of work going.

    Only while there is no list to lose. With one, a touch that was a slip
    took the whole of it away: a new one then comes by sliding a knob along
    a track where the button was (`SlideToRefresh`).
  */
  const again = hasList ? (
    <SlideToRefresh
      onRefresh={refresh}
      disabled={building || (preparing && !showable)}
      ready={preparing && showable ? said.status.showNow : null}
      style={oneLine ? styles.slideBeside : styles.slide}
    />
  ) : (
    <Button
      kind="secondary"
      size="small"
      shape="pill"
      label={said.panel.refresh}
      icon={<RefreshIcon size={ICON_SMALL} />}
      busy={building}
      disabled={building}
      onPress={refresh}
      style={styles.refresh}
    />
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
            <Text style={[styles.updated, hasList ? styles.shrink : styles.grow]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {updated}
            </Text>
            {again}
          </View>
        </>
      )}
      <View style={[styles.status, { height: statusHeight(fontScale, line.kind !== 'none') }]}>
        <Status line={line} />
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
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.problem} numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {line.text}
        </Text>
        {line.action ? (
          <Button
            kind="secondary"
            size="small"
            shape="pill"
            label={line.action === 'findMore' ? t.discover.header.findMore : t.common.retry}
            onPress={line.action === 'findMore' ? findMore : refresh}
          />
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
        {line.kind === 'building' && fraction === null ? <Busy size={14} color={c.textMuted} /> : null}
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
        <ProgressBar value={fraction} />
      ) : null}
    </View>
  );
}

/* How much further than it is drawn the cross that puts a problem away takes a touch: the 48 a finger is owed. */
const DISMISS_SLOP = { top: 10, bottom: 10, left: 8, right: 12 };

const useStyles = makeStyles((c) => StyleSheet.create({
  header: { paddingTop: PADDING, paddingHorizontal: SPACE.l },
  titleRow: { height: TITLE, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  updatedRow: { height: UPDATED, flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
  names: { flex: 1, minWidth: 0, gap: 1, marginRight: SPACE.s },
  grow: { flex: 1, minWidth: 0 },
  // The date as long as it is, beside the track, which has what is left.
  shrink: { flexShrink: 1, minWidth: 0 },
  heading: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  updated: { color: c.textMuted, fontSize: TYPE.hint },
  refresh: { marginLeft: SPACE.xs },
  // The track on the right of the line it is in, taking what the date leaves, up to a width that reads as a control.
  slide: { flexGrow: 1, minWidth: 150, maxWidth: 240, marginLeft: 'auto' },
  slideBeside: { width: 220, marginLeft: SPACE.xs },

  status: { justifyContent: 'center' },
  statusColumn: { gap: SPACE.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  statusText: { flex: 1, minWidth: 0, color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  problem: { flex: 1, minWidth: 0, color: c.danger, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  dismiss: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
}));
