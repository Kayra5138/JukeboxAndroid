import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { footGlass, useLaidOver, useUnderBars } from '../components/UnderBars';

import { useTrackMenu } from '../components/useTrackMenu';
import { useT } from '../lib/i18n/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
import { answerPairs, keepApart, mergeSongs, sameSongs, type Side, type Suggestion } from '../lib/identity/index';
import { makeStyles, outlined, outlinedClip, scene, switchColours, useColours, usePressed } from '../lib/theme/index';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';

/** Where the file is, as much of it as is known. One lost long ago has only a name. */
const whereabouts = (side: Side) => `${side.folder ?? ''}${side.filename ?? ''}`;

/** What a pair is known by on this screen, and chosen by. */
const keyOf = (pair: Suggestion) => `${pair.from.id}\u0000${pair.to.id}`;

function File({ caption, side, boxed = false }: { caption: string; side: Side; boxed?: boolean }) {
  const t = useT();
  const styles = useStyles();
  return (
    <View style={[styles.side, boxed && styles.sideBoxed]}>
      <Text style={styles.caption}>{t.format.upper(caption)}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {side.title ?? side.filename ?? t.details.same.unknown}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {side.artist ?? t.common.unknownArtist}
      </Text>
      <Text style={styles.path} numberOfLines={2}>
        {whereabouts(side) || t.details.same.noFileName}
      </Text>
      <Text style={styles.holds}>{t.details.same.holds(side)}</Text>
    </View>
  );
}

/**
 * The pairs of files that might be one song, for somebody to say.
 *
 * Only the ones the app would not decide for itself. A file that is the same
 * to the byte as one that has gone is taken for it without a word; what is
 * listed here is everything short of that -- the same name at a different
 * size, a copy with a history of its own -- where being wrong would mix two
 * songs' listens together and there would be no telling them apart again.
 */
export default function SameSongsScreen() {
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  /*
    In a theme of glass the screen's bar is over the top of the list and the
    bar of what is ticked, while there is one, over its foot; the list runs
    on under both and keeps clear of them by this much.
  */
  const under = useUnderBars();
  const foot = useLaidOver();
  const [pairs, setPairs] = useState<Suggestion[] | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  /** The pairs ticked for one answer to all of them, by `keyOf`. */
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  /** Whether the merge of the chosen is waiting for a yes: it cannot be undone. */
  const [asking, setAsking] = useState(false);
  /** How the last answer to many went, said until the next. */
  const [result, setResult] = useState<string | null>(null);
  /** Whether a merge of the chosen takes the first file of each pair off the phone as well. */
  const [deleteToo, setDeleteToo] = useState(false);
  /*
    Erasing the way the menu does, queue and all. Android asks first, and
    says what it was told; the merge has been made by then, so a refusal
    leaves the history together and both files where they were.
  */
  const { erase } = useTrackMenu();
  /*
    Only a file still on the phone can be erased. The first of a pair may be
    one that went long ago and left its history behind; asked to erase it
    along with the rest, Android would refuse the lot.
  */
  const present = useLibraryTracks();
  const onPhone = (ids: readonly string[]) => {
    const here = new Set(present.map((track) => track.id));
    return ids.filter((id) => here.has(id));
  };
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const said = t.details.same;

  const load = useCallback(() => {
    try {
      const fresh = sameSongs();
      setPairs(fresh);
      // A pair answered, or settled by another answer, is no longer there to be chosen.
      const open = new Set(fresh.map(keyOf));
      setChosen((before) => new Set([...before].filter((key) => open.has(key))));
    } catch (error) {
      setPairs([]);
      setTrouble(String(error));
    }
  }, []);

  useFocusEffect(load);

  /*
    Either answer is read back from the database rather than taken off the
    list by hand. Joining one pair can settle another -- the same old file
    asked about against two new ones -- and the list should say what is still
    in question, not what was a moment ago.
  */
  const answer = useCallback(
    async (pair: Suggestion, join: boolean, remove = false) => {
      setTrouble(null);
      setResult(null);
      let merged = false;
      try {
        if (join) mergeSongs(pair.from.id, pair.to.id);
        else keepApart(pair.from.id, pair.to.id);
        merged = join;
      } catch (error) {
        // The write is all or nothing, so a failure here has changed nothing.
        setTrouble(said.failed(String(error)));
      }
      load();
      // The file goes only after its history has: erasing first would take its listens and tags with it.
      if (merged && remove && onPhone([pair.from.id]).length > 0) {
        const gone = await erase([pair.from.id]).catch(() => false);
        setResult(gone ? said.bulk.deleted(1) : said.bulk.notDeleted);
        load();
      }
    },
    [erase, load, onPhone, said]
  );

  const toggle = (pair: Suggestion) => {
    setAsking(false);
    setChosen((before) => {
      const next = new Set(before);
      const key = keyOf(pair);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** The one answer to every pair ticked, in the order they are listed. */
  const answerChosen = async (join: boolean) => {
    setAsking(false);
    setTrouble(null);
    const picked = (pairs ?? []).filter((pair) => chosen.has(keyOf(pair)));
    const { done, skipped, failed, joined } = answerPairs(picked, join);
    const said1 = said.bulk.done(done, skipped);
    setResult(said1);
    if (failed) setTrouble(said.failed(failed));
    setChosen(new Set());
    load();
    // One request for all of them, so Android asks once.
    const erasable = join && deleteToo ? onPhone(joined) : [];
    if (erasable.length > 0) {
      const gone = await erase(erasable).catch(() => false);
      setResult(`${said1} ${gone ? said.bulk.deleted(erasable.length) : said.bulk.notDeleted}`);
      load();
    }
  };

  if (pairs == null) return <View style={styles.screen} />;

  return (
    <View style={[styles.screen, sides]}>
      <FlatList
              removeClippedSubviews={CLIP_SUBVIEWS}
        data={pairs}
        keyExtractor={(pair) => `${pair.from.id}\u0000${pair.to.id}`}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16 + under.top, paddingBottom: 32 + (chosen.size > 0 ? foot.height : 0) },
        ]}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>{said.note}</Text>
            {pairs.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                style={styles.all}
                onPress={() => {
                  setAsking(false);
                  setChosen(chosen.size === pairs.length ? new Set() : new Set(pairs.map(keyOf)));
                }}>
                <Text style={styles.allLabel}>
                  {chosen.size === pairs.length ? t.common.clear : t.common.selectAll}
                </Text>
              </Pressable>
            ) : null}
            {result ? (
              <Text accessibilityLiveRegion="polite" style={styles.result}>
                {result}
              </Text>
            ) : null}
            {trouble ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.trouble}>
                {trouble}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>{said.empty}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, chosen.has(keyOf(item)) && styles.cardChosen]}>
            {/*
              The box to tick for an answer to many, over the pair: the two
              buttons under it still answer this one pair alone.
            */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen.has(keyOf(item)) }}
              accessibilityLabel={said.bulk.choose}
              style={styles.tick}
              onPress={() => toggle(item)}>
              <View style={[styles.checkbox, chosen.has(keyOf(item)) && styles.checkboxOn]}>
                {chosen.has(keyOf(item)) ? (
                  <Text style={styles.checkMark} importantForAccessibility="no">✓</Text>
                ) : null}
              </View>
            </Pressable>
            <File caption={said.from} side={item.from} boxed />
            <View style={styles.rule} />
            <File caption={said.into} side={item.to} />
            <View style={styles.rule} />
            <View style={styles.actions}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.button}
                onPress={() => void answer(item, false)}>
                <Text style={styles.buttonLabel}>{said.keepApart}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={[styles.button, styles.buttonOn]}
                onPress={() => void answer(item, true)}>
                <Text style={[styles.buttonLabel, styles.buttonLabelOn]}>{said.merge}</Text>
              </Pressable>
            </View>
            {/* For the copy that is only a copy: the history moves, and then the file goes. */}
            <Pressable
              accessibilityRole="button"
              accessibilityHint={said.bulk.deleteNote}
              hitSlop={6}
              style={styles.mergeDelete}
              onPress={() => void answer(item, true, true)}>
              <Text style={styles.mergeDeleteLabel}>{said.bulk.mergeDelete}</Text>
            </Pressable>
          </View>
        )}
      />
      {/*
        Under the list while anything is ticked. A merge of several is asked
        about first, in the bar itself: it moves listens that cannot be told
        apart again. Keeping apart is only ever a note, and is not asked.
      */}
      {chosen.size > 0 ? (
        <View
          style={[
            styles.bar,
            { paddingBottom: insets.bottom + 12 },
            foot.laid && [styles.barOver, { left: insets.left, right: insets.right }],
          ]}
          onLayout={foot.onLayout}>
          <Text style={styles.barText} accessibilityLiveRegion="polite">
            {asking ? said.bulk.confirm(chosen.size) : said.bulk.chosen(chosen.size)}
          </Text>
          {asking ? (
            <View style={styles.deleteRow}>
              <Text style={styles.deleteText}>{said.bulk.deleteToo}</Text>
              <Switch
                accessibilityLabel={said.bulk.deleteToo}
                accessibilityHint={said.bulk.deleteNote}
                value={deleteToo}
                onValueChange={setDeleteToo}
                {...switchColours(c, deleteToo)}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.button}
              onPress={() => (asking ? setAsking(false) : void answerChosen(false))}>
              <Text style={styles.buttonLabel} numberOfLines={1}>
                {asking ? t.common.cancel : said.bulk.keepApart(chosen.size)}
              </Text>
            </Pressable>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={[styles.button, styles.buttonOn]}
              onPress={() => (asking ? void answerChosen(true) : setAsking(true))}>
              <Text style={[styles.buttonLabel, styles.buttonLabelOn]} numberOfLines={1}>
                {asking ? said.merge : said.bulk.merge(chosen.size)}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  trouble: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', paddingVertical: 32 },

  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  cardChosen: { backgroundColor: c.accentSoft },
  // Over the corner of the first file's details, a finger's size.
  tick: { position: 'absolute', top: 0, right: 0, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 14, fontWeight: '700', lineHeight: 16 },
  all: { alignSelf: 'flex-end', marginTop: 10 },
  allLabel: { color: c.accent, fontSize: 14, fontWeight: '600' },
  result: { color: c.success, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  bar: {
    paddingTop: 12,
    paddingHorizontal: 4,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  // Over the foot of the list in a theme of glass, which runs on under it.
  barOver: footGlass(c),
  barText: { color: c.text, fontSize: 13.5, lineHeight: 19, paddingHorizontal: 12 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingTop: 8 },
  deleteText: { flex: 1, color: c.text, fontSize: 13.5 },
  mergeDelete: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingBottom: 12, marginTop: -4 },
  mergeDeleteLabel: { color: c.danger, fontSize: 13.5, fontWeight: '600' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  side: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  // Clear of the box in its corner.
  sideBoxed: { paddingRight: 52 },
  caption: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  name: { color: c.text, fontSize: 15.5 },
  artist: { color: c.textSecondary, fontSize: 13.5 },
  path: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  holds: { color: c.accent, fontSize: 12.5, marginTop: 2, fontVariant: ['tabular-nums'] },

  actions: { flexDirection: 'row', gap: 10, padding: 12 },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 18,
    ...outlined(c),
  },
  buttonOn: { backgroundColor: c.primary, ...outlined(c, c.primary) },
  buttonLabel: { color: c.text, fontSize: 15 },
  buttonLabelOn: { color: c.onPrimary, fontWeight: '600' },
}));
