import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { TextButton } from './Button';
import { useBatch } from './downloads/useBatch';
import { laid, makeStyles, outlined } from '../lib/theme/index';
import { RADIUS, SPACE, TOUCH, TYPE } from '../lib/theme/measures';
import { useDownloadsButtonWanted } from '../lib/ui/downloadsButton';
import { motionReduced } from '../lib/ui/motion';

/**
 * What was just done, said for a moment along the foot of the screen, with
 * the way to take it back where there is one ([action]): a song taken out of
 * a list or let go (`UndoNotice`), a song of Discover's turned away
 * (`DiscoverNotice`). Each was the other's copy.
 *
 * As wide as the room it is put in, on one line: what is too long for it is
 * cut at its end, which is where every such sentence puts the song's name,
 * and what can be done is always at the right. [bad] where it says
 * something went wrong, in the colour of a failure and at once to a screen
 * reader; [icon] before the words.
 */
export function Snack({
  text,
  bad = false,
  icon,
  action,
}: {
  text: string;
  bad?: boolean;
  icon?: ReactNode;
  action?: { label: string; accessibilityLabel?: string; onPress: () => void };
}) {
  const styles = useStyles();
  const rise = useRise();
  return (
    <Animated.View
      // Said when it appears, without taking the reader from where it is; a failure at once.
      accessibilityLiveRegion={bad ? 'assertive' : 'polite'}
      accessibilityRole={bad ? 'alert' : undefined}
      style={[styles.snack, rise]}>
      {icon}
      <Text style={[styles.text, bad && styles.bad]} numberOfLines={1}>
        {text}
      </Text>
      {action ? (
        <TextButton label={action.label} accessibilityLabel={action.accessibilityLabel} strong onPress={action.onPress} style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

/**
 * The room at the right the floating downloads button takes, for what lies
 * along the foot beside it, handed to [children]: the button's, while it is
 * there, and none otherwise. In two parts for the reason the button is: with
 * the button switched off, the downloads are not read at all.
 */
export function BesideDownloads({ children }: { children: (room: number) => ReactNode }) {
  return useDownloadsButtonWanted() ? <Counted>{children}</Counted> : <>{children(0)}</>;
}

function Counted({ children }: { children: (room: number) => ReactNode }) {
  // The button is there for as long as there is a recent download to speak of.
  const batch = useBatch();
  return <>{children(batch.total > 0 ? DOWNLOADS_ROOM : 0)}</>;
}

/** The floating downloads button and the space beside it. */
const DOWNLOADS_ROOM = TOUCH.normal + SPACE.m;

/**
 * Comes up a few points as it fades in, once, when it is first drawn. Run
 * by the phone; and not run at all where Settings has asked for things to
 * hold still, when it is simply there.
 */
function useRise() {
  const [along] = useState(() => new Animated.Value(motionReduced() ? 1 : 0));
  const [style] = useState(() => ({
    opacity: along,
    transform: [{ translateY: along.interpolate({ inputRange: [0, 1], outputRange: [SPACE.s, 0] }) }],
  }));
  useEffect(() => {
    Animated.timing(along, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [along]);
  return style;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    snack: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.s,
      minHeight: TOUCH.normal,
      paddingHorizontal: SPACE.l,
      borderRadius: RADIUS.control,
      /*
        A flat colour, whatever the theme writes its surfaces in. This lies
        over rows that go on scrolling underneath, and through a fill of glass
        their titles would be read through its own words.
      */
      backgroundColor: laid(c.surfaceRaised, c.bg),
      ...outlined(c, c.borderStrong),
    },
    text: { flex: 1, color: c.text, fontSize: TYPE.small },
    bad: { color: c.danger },
    // In the middle of the card's height, at its right edge, as far in from it as the words are from the left.
    action: { alignSelf: 'center' },
  })
);
