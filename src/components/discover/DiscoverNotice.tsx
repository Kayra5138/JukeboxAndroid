import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBatch } from '../downloads/useBatch';
import { AlertIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { useDiscoverNotice } from './hooks';
import { useDiscoverActions, type DiscoverNotice as Notice } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { laid, makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { useDownloadsButtonWanted } from '../../lib/ui/downloadsButton';
import { useLandscape } from '../../lib/ui/layout';
import { motionReduced } from '../../lib/ui/motion';

/** How far it keeps from the edges of the list, and from what is under it. The floating button's own margin. */
const MARGIN = 14;
/**
 * The room the floating downloads button takes at the bottom right when it
 * is there: its width and the gap this keeps from it. See `DownloadsButton`,
 * whose `SIZE` this is; it is drawn over the navigator and cannot be asked.
 */
const BUTTON_ROOM = 48 + 10;

/**
 * The last thing done to the list, said at the foot of it: a song kept, a
 * song turned away and the way to take that back, a keep that failed.
 *
 * At the foot because that is where it does not move anything. It used to be
 * a line in the header, which grew by it and pushed the list down under the
 * finger that had just pressed — and the header is the one place somebody
 * pressing a button on the tenth row is not looking.
 *
 * Drawn in the screen, over the list, so it is above the tab bar already:
 * the scene ends where the bar begins. It takes itself down; the notice
 * runs out by its own clock, ten seconds for one that can be undone.
 *
 * Nothing here is listened to while there is no notice.
 */
export function DiscoverNotice() {
  const notice = useDiscoverNotice();
  if (!notice) return null;
  return <Beside notice={notice} />;
}

/**
 * Finds out whether the floating downloads button is in the corner this
 * would lie across, and keeps to the left of it if so. In two parts for the
 * reason the button is: with the button switched off, the downloads are not
 * read at all.
 */
function Beside({ notice }: { notice: Notice }) {
  return useDownloadsButtonWanted() ? <BesideButton notice={notice} /> : <Snack notice={notice} room={0} />;
}

function BesideButton({ notice }: { notice: Notice }) {
  // The button is there for as long as there is a recent download to speak of, and a Discover song is one.
  const batch = useBatch();
  return <Snack notice={notice} room={batch.total > 0 ? BUTTON_ROOM : 0} />;
}

function Snack({ notice, room }: { notice: Notice; room: number }) {
  const { undo } = useDiscoverActions();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const rise = useRise();
  const bad = notice.kind === 'keepFailed';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.spot,
        {
          right: MARGIN + room,
          // Upright the tab bar keeps the scene off the strip the phone has for its gestures. On its side nothing does.
          bottom: MARGIN + (landscape ? insets.bottom : 0),
        },
      ]}>
      <Animated.View
        // Said when it appears, without taking the reader from where it is.
        accessibilityLiveRegion="polite"
        accessibilityRole={bad ? 'alert' : undefined}
        style={[styles.snack, rise]}>
        {bad ? <AlertIcon size={16} color={c.danger} /> : null}
        <Text style={styles.text} numberOfLines={3}>
          {notice.text}
        </Text>
        {notice.canUndo ? (
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.undo} onPress={undo}>
            <Text style={styles.undoLabel}>{t.discover.notice.undo}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Comes up a few points as it fades in, once, when it is first drawn. Run
 * by the phone; and not run at all where Settings has asked for things to
 * hold still, when it is simply there.
 */
function useRise() {
  const [along] = useState(() => new Animated.Value(motionReduced() ? 1 : 0));
  const [style] = useState(() => ({
    opacity: along,
    transform: [{ translateY: along.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  }));
  useEffect(() => {
    Animated.timing(along, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [along]);
  return style;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // Across the foot of the list, and as tall as what it says. Touches beside the bar itself go to the list.
  spot: { position: 'absolute', left: MARGIN },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    maxWidth: 560,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 12,
    /*
      A flat colour, whatever the theme writes its surfaces in. This lies
      over rows that go on scrolling underneath, and through a fill of glass
      their titles would be read through its own words.
    */
    backgroundColor: laid(c.surfaceRaised, c.bg),
    ...outlined(c, c.borderStrong),
  },
  text: { flexShrink: 1, color: c.text, fontSize: 13.5, lineHeight: 19, paddingRight: 10 },
  undo: { minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  undoLabel: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
}));
