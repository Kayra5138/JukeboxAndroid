import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { TipCard } from './TipCard';
import { barWashOf } from '../../lib/theme/effects';
import { glassOf } from '../../lib/theme/Veil';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import { metadataSummary } from '../../lib/db/metadata';
import { useT } from '../../lib/i18n/index';
import { useCopies } from '../../lib/library/copiesStore';
import { lookUpWholeLibrary, useBulkLookup } from '../../lib/metadata/bulk';
import { answered, parseOffer, shouldOffer } from '../../lib/metadata/offer';
import { makeStyles, outlined, usePressed } from '../../lib/theme/index';
import { useTip } from '../../lib/ui/tipsStore';
import { useWelcomeShown } from '../../lib/ui/welcomeStore';

/**
 * What the library says to a newcomer, under the line that counts its tracks:
 * at most one thing at a time, and usually nothing.
 *
 *  - while a lookup is running, wherever it was begun, a line saying how far
 *    it has got, which opens the Tags screen where it can be stopped;
 *  - on the first start with music worth looking up, the offer to look it up
 *    (`metadata/offer.ts` has when, and when not again);
 *  - once that is answered, the tip about held and pulled rows;
 *  - and after all of those, a quiet line when some songs are in the library
 *    twice, which opens the screen where the copies can be cleaned up.
 *
 * [tracks] is how many the library holds, and [confirmed] whether the device
 * has said so in this run of the app: a library remembered from the last run
 * is not asked about, since the offer counts what is still to be done.
 */
export function LibraryWelcome({ tracks, confirmed }: { tracks: number; confirmed: boolean }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const router = useRouter();
  const bulk = useBulkLookup();
  const tip = useTip('library');
  const running = bulk.progress !== null;
  /** How many tracks the offer is about, while it stands; null when there is none. */
  const [offer, setOffer] = useState<number | null>(null);

  /*
    Not while the first start's screen is up, and read again once it is put
    away: asked for from Settings, it has just made the offer stand again.
  */
  const welcoming = useWelcomeShown();
  /** How many songs the library holds more than once. Kept with the library, so nothing is counted here. */
  const copies = useCopies().length;

  // Read in an effect and not while drawing: it is the database, twice.
  useEffect(() => {
    setOffer(confirmed && tracks > 0 && !running && !welcoming ? offerNow(tracks) : null);
  }, [confirmed, running, tracks, welcoming]);

  const answer = (accepted: boolean) => {
    setOffer(null);
    keepAnswer(accepted, tracks);
    if (accepted) void lookUpWholeLibrary();
  };

  if (bulk.progress) {
    const { done, total } = bulk.progress;
    /*
      Said aloud as it moves, for somebody who started the lookup and cannot
      see the bar fill: but in tenths of the way, not track by track. The count
      changes every second or so, and a reader told each time would talk over
      everything else for as long as the run lasted.
    */
    const heard = total === 0 ? 0 : Math.floor((Math.floor((done / total) * 10) * total) / 10);
    const counted = done >= total ? total : Math.min(heard, done);
    // What the run is finding, in so many words: covers alone and lyrics
    // are runs somebody started on purpose, and are named for what they are.
    const said = (count: number) =>
      total === 0
        ? t.welcome.progress.starting
        : bulk.album != null
          ? t.welcome.progress.album(bulk.album.name, count, total)
          : bulk.kind === 'covers'
            ? t.welcome.progress.covers(count, total)
            : bulk.kind === 'lyrics'
              ? t.welcome.progress.lyrics(count, total)
              : t.welcome.progress.counting(count, total);
    const spoken = said(counted);
    return (
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={t.welcome.progress.hint}
        accessibilityLiveRegion="polite"
        // A line of small writing over a thin bar; this is a finger's height to press.
        hitSlop={PROGRESS_SLOP}
        style={styles.progress}
        onPress={() => router.push('/metadata')}>
        <Text style={styles.progressText} numberOfLines={1}>
          {said(done)}
        </Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }]} />
        </View>
      </Pressable>
    );
  }

  if (offer !== null) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t.welcome.offer.heading}
        </Text>
        <Text style={styles.body}>{t.welcome.offer.body(offer)}</Text>
        <Text style={styles.small}>{t.welcome.offer.privacy}</Text>
        <View style={styles.actions}>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            hitSlop={4}
            style={styles.secondary}
            onPress={() => answer(false)}>
            <Text style={styles.secondaryLabel}>{t.welcome.offer.decline}</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            hitSlop={4}
            style={styles.primary}
            onPress={() => answer(true)}>
            <Text style={styles.primaryLabel}>{t.welcome.offer.accept}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (tip.shown) return <TipCard text={t.welcome.tips.library} onDismiss={tip.dismiss} />;
  /*
    The last thing, and the quietest: a line of small writing and not a
    card, since nothing is wrong and nothing has to be done today. Only
    once the device has said what the library holds, so that a song
    deleted on a computer since the last run is not counted.
  */
  if (confirmed && !welcoming && copies > 0) {
    return (
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={t.library.copies.some(copies)}
        accessibilityHint={t.library.copies.reviewHint}
        hitSlop={PROGRESS_SLOP}
        style={styles.copies}
        onPress={() => router.push('/duplicates')}>
        <Text style={styles.copiesText} numberOfLines={2}>
          {t.library.copies.some(copies)}
          {' · '}
          <Text style={styles.copiesLink}>{t.library.copies.review}</Text>
        </Text>
      </Pressable>
    );
  }
  return null;
}

/**
 * How many tracks the offer would be about, if it is to be made now; null if
 * it is not. Out here, apart from the component, for the try: the compiler
 * will not take a component with one in it.
 */
function offerNow(tracks: number): number | null {
  try {
    const kept = parseOffer(readSetting(SETTINGS.lookupOffer));
    const summary = metadataSummary();
    // Rows of files since gone can count more than there are; see the Tags screen.
    const untried = Math.max(0, tracks - summary.matched - summary.notFound - summary.manual);
    return shouldOffer({ kept, now: Date.now(), tracks, untried, running: false }) ? untried : null;
  } catch {
    // Not asked this time. The library is on screen either way.
    return null;
  }
}

function keepAnswer(accepted: boolean, tracks: number): void {
  try {
    const kept = parseOffer(readSetting(SETTINGS.lookupOffer));
    writeSetting(SETTINGS.lookupOffer, JSON.stringify(answered(kept, accepted, Date.now(), tracks)));
  } catch {
    // Unwritten, it may be asked again on the next start; nothing worse.
  }
}

const PROGRESS_SLOP = { top: 12, bottom: 12 };

const useStyles = makeStyles((c) => StyleSheet.create({
  card: {
    // Dense in a theme of glass, as the tips are: see `TipCard`.
    backgroundColor: glassOf(c) > 0 ? barWashOf(c) : c.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600' },
  body: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  small: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  secondary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
  },
  secondaryLabel: { color: c.textSecondary, fontSize: 14 },
  primary: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: c.primary,
    ...outlined(c, c.primary),
  },
  primaryLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },

  progress: { gap: 5, paddingVertical: 2, borderRadius: 6 },
  progressText: { color: c.textMuted, fontSize: 12 },
  bar: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: c.accent },

  copies: { paddingVertical: 2, borderRadius: 6 },
  copiesText: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  copiesLink: { color: c.accent, fontWeight: '600' },
}));
