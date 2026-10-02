import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { ReportCardView, type Covers, type Photos, type Tints } from './ReportCards';
import { artistPhotoFor } from '../../lib/media/artistPhotos';
import { artworkFor } from '../../lib/media/artwork';
import JukeboxAudio from '../../../modules/jukebox-audio';
import type { ReportCard } from '../../lib/stats/report';

/**
 * How much bigger the written-out card is than the one on screen.
 *
 * The card is drawn again off to the side at this scale and that copy is what
 * gets captured, so what lands in the gallery is a poster rather than a
 * screenshot of a phone-sized card. Three is about a thousand points across,
 * which is enough for anywhere it is likely to be posted.
 */
const POSTER = 3;

/** Nine by sixteen, because that is the shape everything else shares. */
const SHAPE = 16 / 9;

export function ReportViewer({
  cards,
  stamp,
  visible,
  onClose,
}: {
  cards: ReportCard[];
  stamp: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [covers, setCovers] = useState<Covers>(() => new Map());
  const [photos, setPhotos] = useState<Photos>(() => new Map());
  const [tints, setTints] = useState<Tints>(() => new Map());

  /*
    Every cover the cards ask for, found once when the recap opens rather than
    a lookup per row. Reading a picture out of an audio file means opening it,
    and the same track turns up on the wall, in a chart and on the closing card.
  */
  useEffect(() => {
    if (!visible) return;
    const wanted = new Set<string>();
    for (const card of cards) {
      if (card.kind === 'opening') card.wall.forEach((id) => wanted.add(id));
      if (card.kind === 'ranking') {
        card.entries.forEach((entry) => entry.sample && wanted.add(entry.sample));
      }
      if (card.kind === 'closing' && card.sample) wanted.add(card.sample);
    }

    let gone = false;
    void Promise.all(
      [...wanted].map(async (id) => [id, await artworkFor(id)] as const)
    ).then((found) => {
      if (gone) return;
      setCovers(new Map(found.filter((pair): pair is [string, string] => pair[1] != null)));
    });
    return () => {
      gone = true;
    };
  }, [visible, cards]);

  /*
    And a photograph of each artist the recap names, where the encyclopaedias
    have one. Only the artists actually drawn — the chart's five and whoever
    the closing card ends on — because the first one costs three requests to a
    service that asks for a second between them.

    One after another rather than all at once: that pause is counted in a
    single clock inside the MusicBrainz client, and firing five lookups
    together would have them all read it before any of them had moved it on.

    Each answer is published as it lands instead of waiting for the set, which
    is what makes the gap invisible — a row shows its album cover until its
    photograph arrives, and never a blank.
  */
  useEffect(() => {
    if (!visible) return;
    const named: string[] = [];
    for (const card of cards) {
      if (card.kind === 'ranking' && card.of === 'artists') {
        card.entries.forEach((entry) => named.push(entry.key));
      }
      if (card.kind === 'closing' && card.artist) named.push(card.artist);
    }
    const wanted = [...new Set(named)];
    if (wanted.length === 0) return;

    let gone = false;
    void (async () => {
      for (const name of wanted) {
        const photo = await artistPhotoFor(name).catch(() => null);
        if (gone) return;
        if (photo) setPhotos((have) => new Map(have).set(name, photo));
      }
    })();
    return () => {
      gone = true;
    };
  }, [visible, cards]);

  /*
    And the colours those covers are made of, once the covers themselves are
    in. Only for the ones a card is actually dressed in, which is a handful
    rather than every cover on the wall.
  */
  useEffect(() => {
    if (!visible || covers.size === 0 || !JukeboxAudio.coverColoursAsync) return;
    const wanted = [...new Set(cards.map((card) => card.tint).filter((id): id is string => !!id))]
      .map((id) => [id, covers.get(id)] as const)
      .filter((pair): pair is readonly [string, string] => !!pair[1]);

    let gone = false;
    void Promise.all(
      wanted.map(async ([id, uri]) => {
        const stops = await JukeboxAudio.coverColoursAsync!(uri).catch(() => null);
        return [id, stops] as const;
      })
    ).then((found) => {
      if (gone) return;
      const read = new Map<string, readonly [string, string, string]>();
      for (const [id, stops] of found) {
        if (stops && stops.length === 3) read.set(id, [stops[0], stops[1], stops[2]] as const);
      }
      setTints(read);
    });
    return () => {
      gone = true;
    };
  }, [visible, cards, covers]);

  /*
    The copy that gets captured, drawn at poster size behind everything and
    never seen. Capturing what is on screen instead would write out whatever
    the card happened to measure on this phone, and a card mid-swipe at that.
  */
  const poster = useRef<View>(null);

  const cardWidth = Math.min(width - 56, 380);
  const room = height - insets.top - insets.bottom - 172;
  const cardHeight = Math.min(cardWidth * SHAPE, room);

  const showing = cards[Math.min(at, cards.length - 1)];

  const settle = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    setAt(page);
    // "Saved to your gallery" belongs to the card it was said about; carried
    // onto the next one it reads as a claim about that one instead.
    setNote(null);
  }, []);

  const write = useCallback(async (how: 'save' | 'share') => {
    if (busy || !poster.current) return;
    setBusy(how);
    setNote(null);
    try {
      /*
        PNG rather than JPEG: these are flat colour and large type, which is
        exactly what a photographic codec smears.
      */
      const file = await captureRef(poster, { format: 'png', quality: 1, result: 'tmpfile' });
      // Both arrive with the native module, so an older APK under a newer
      // bundle says so rather than failing as though the picture were at fault.
      if (how === 'save') {
        if (!JukeboxAudio.saveImageAsync) throw new Error('Install the updated Android build to save pictures.');
        await JukeboxAudio.saveImageAsync(file);
        setNote('Saved to your gallery.');
      } else {
        if (!JukeboxAudio.shareImageAsync) throw new Error('Install the updated Android build to share pictures.');
        await JukeboxAudio.shareImageAsync(file);
      }
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : 'That did not work. Please try again.');
    } finally {
      setBusy(null);
    }
  }, [busy]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Text style={styles.closeMark}>×</Text>
          </Pressable>
          <View style={styles.dots}>
            {cards.map((card, index) => (
              <View key={`${card.kind}-${index}`} style={[styles.dot, index === at && styles.dotOn]} />
            ))}
          </View>
          {/* Balances the close button so the dots sit in the middle. */}
          <View style={styles.close} />
        </View>

        <FlatList
          data={cards}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={settle}
          keyExtractor={(card, index) => `${card.kind}-${index}`}
          renderItem={({ item }) => (
            <View style={[styles.page, { width }]}>
              <ReportCardView card={item} width={cardWidth} height={cardHeight} stamp={stamp} covers={covers} photos={photos} tints={tints} />
            </View>
          )}
        />

        <View style={styles.footer}>
          <Text style={styles.note} numberOfLines={2}>
            {note ?? ''}
          </Text>
          <View style={styles.actions}>
            <Action
              label="Save"
              busy={busy === 'save'}
              disabled={busy !== null}
              onPress={() => void write('save')}
            />
            <Action
              label="Share"
              primary
              busy={busy === 'share'}
              disabled={busy !== null}
              onPress={() => void write('share')}
            />
          </View>
        </View>

        {/*
          Off the side of the screen rather than hidden: a view with no size,
          or one the platform has decided not to draw, captures blank.
        */}
        <View style={styles.offstage} pointerEvents="none">
          <View ref={poster} collapsable={false}>
            <ReportCardView
              card={showing}
              width={cardWidth * POSTER}
              height={cardHeight * POSTER}
              stamp={stamp}
              covers={covers}
              photos={photos}
              tints={tints}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Action({
  label,
  onPress,
  busy,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, primary && styles.actionPrimary, disabled && styles.actionOff]}>
      {busy ? (
        <ActivityIndicator color={primary ? '#121212' : '#ededed'} size="small" />
      ) : (
        <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0b0b' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeMark: { color: '#ededed', fontSize: 28, lineHeight: 30 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3a3a3a' },
  dotOn: { backgroundColor: '#ededed', width: 18 },

  page: { alignItems: 'center', justifyContent: 'center' },

  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 10 },
  note: { color: '#8a8a8a', fontSize: 12.5, lineHeight: 17, minHeight: 34 },
  // Bottom right, where a thumb already is.
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  action: {
    minWidth: 104,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f1f1f',
  },
  actionPrimary: { backgroundColor: '#ededed' },
  actionOff: { opacity: 0.5 },
  actionLabel: { color: '#ededed', fontSize: 14.5, fontWeight: '600' },
  actionLabelPrimary: { color: '#121212' },

  offstage: { position: 'absolute', left: -10000, top: 0 },
});
