import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { LEADING, RADIUS, SPACE, TYPE, TOUCH } from '../../../lib/theme/measures';
import { Note } from '../../../components/Note';
import { RowControl } from '../../../components/MediaRow';
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Field, FormScroll } from '../../../components/FormScroll';
import { CrossIcon, PlusIcon } from '../../../components/Icons';
import { NumberStepper } from '../../../components/NumberStepper';
import { OptionSheet } from '../../../components/OptionSheet';
import { Pressable } from '../../../components/Pressable';
import { Segmented } from '../../../components/Segmented';
import { useRows, SectionLabel, Chevron } from '../../../components/settings/rows';
import { createSmartList, playlist, renamePlaylist, setSmartRules } from '../../../lib/db/playlists';
import { tagCounts } from '../../../lib/db/tags';
import { useT } from '../../../lib/i18n/index';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import {
  LIMIT_RANGE,
  LIMIT_START,
  SMART_FIELDS,
  SMART_ORDERS,
  asksWords,
  newRule,
  opsFor,
  rangeOf,
  readSmartRules,
  ruleProblem,
  smartListMatches,
  withField,
  writeSmartRules,
  type SmartField,
  type SmartOp,
  type SmartOrder,
  type SmartRule,
} from '../../../lib/lists/smart';
import { readSmartStats } from '../../../lib/lists/smartLive';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles, outlinedClip, scene, useColours, usePressed } from '../../../lib/theme/index';
import { haptic } from '../../../lib/ui/haptics';
import { FootBar, useFootBar } from '../../../components/FootBar';
import { usePageRoom } from '../../../components/Page';

/** Enough tags to pick from without the sheet becoming the tag screen, as the Lists tab offers. */
const TAG_CHOICES = 60;

/** A rule as the editor holds it: the rule, and a key that stays with it as the others come and go. */
type Row = { key: number; rule: SmartRule };

/**
 * Writing a smart list's rules: a new list's, opened from the Lists tab, or
 * one already made (`?id=`), from its page.
 *
 * Each rule is a card of its own: what it asks about, which opens the list of
 * fields; how it asks, as a row of choices; and what it asks for, as words or
 * a number by the field. Under them, whether a song must meet all of them or
 * one, how many songs the list keeps and in which order, and at the foot how
 * many songs the rules let in as they stand, counted again with each change.
 * A rule that is not finished is said to be, and the list is not saved until
 * it is.
 */
export default function SmartListScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const listId = id ? Number(id) : null;
  const router = useRouter();
  const t = useT();
  const c = useColours();
  const rows = useRows();
  const styles = useStyles();
  const pressed = usePressed();
  // The bar along the foot, always there, and the form's room clear of it (`FootBar`, `usePageRoom`).
  const foot = useFootBar(true);
  const room = usePageRoom({ foot: foot.height });
  const said = t.smart;

  // What was there to begin with, read once: the list, and what has been listened to, which the count is made from.
  const [start] = useState(() => {
    const details = listId != null ? playlist(listId) : null;
    const kept = details?.kind === 'smart' ? readSmartRules(details.rules) : readSmartRules(null);
    return { name: details?.name ?? '', rules: kept };
  });
  const [stats] = useState(() => readSmartStats());
  const [now] = useState(() => Date.now());
  const [tags] = useState(() => tagCounts().slice(0, TAG_CHOICES));

  const [name, setName] = useState(start.name);
  const [match, setMatch] = useState(start.rules.match);
  const [list, setList] = useState<Row[]>(() => start.rules.rules.map((rule, key) => ({ key, rule })));
  const [limit, setLimit] = useState<number | null>(start.rules.limit);
  const [order, setOrder] = useState<SmartOrder>(start.rules.order);
  /** The rule whose field, or whose tag, is being chosen from a sheet. */
  const [choosingField, setChoosingField] = useState<number | null>(null);
  const [choosingTag, setChoosingTag] = useState<number | null>(null);
  /** Set once Save has been pressed, from when what is wrong is said as well as kept from saving. */
  const [tried, setTried] = useState(false);

  // Opened before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);
  const library = useLibraryTracks();
  const songs = library.filter((track) => !isTape(track));

  const rules = { match, rules: list.map((row) => row.rule), limit, order };
  const count = smartListMatches(songs, rules, stats, now);

  /*
    Rules changed and not saved, asked about before the page goes, as the
    details ask: Back used to drop them without a word. Not once saved,
    which goes as it is.
  */
  const changed = name !== start.name || writeSmartRules(rules) !== writeSmartRules(start.rules);
  /** Saved once: a second tap while the page goes would make a second list. */
  const saved = useRef(false);
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState<{ action: Parameters<typeof navigation.dispatch>[0] } | null>(null);
  usePreventRemove(changed, ({ data }) => {
    if (saved.current) navigation.dispatch(data.action);
    else setLeaving({ action: data.action });
  });
  const kept = limit != null ? Math.min(limit, count) : count;

  const problemAt = list.findIndex((row) => ruleProblem(row.rule) != null);
  const problem = !name.trim() ? said.editor.problems.name : problemAt >= 0 ? said.editor.problems.rule(problemAt + 1) : null;

  const change = (key: number, next: (rule: SmartRule) => SmartRule) =>
    setList((held) => held.map((row) => (row.key === key ? { key, rule: next(row.rule) } : row)));
  const add = () => {
    haptic('choices', 'click');
    setList((held) => [...held, { key: held.reduce((most, row) => Math.max(most, row.key), -1) + 1, rule: newRule() }]);
  };
  const remove = (key: number) => {
    haptic('choices', 'toggleOff');
    setList((held) => held.filter((row) => row.key !== key));
  };

  const save = () => {
    if (saved.current) return;
    setTried(true);
    if (problem) {
      haptic('results', 'reject');
      return;
    }
    saved.current = true;
    const written = writeSmartRules(rules);
    const at = Date.now();
    haptic('results', 'confirm');
    if (listId != null) {
      setSmartRules(listId, written, at);
      if (name.trim() !== start.name) renamePlaylist(listId, name, at);
      router.back();
    } else {
      const made = createSmartList(name, written, at);
      // To the list itself, in place of this: back from it is the Lists tab, not the editor again.
      router.replace({ pathname: '/playlist', params: { id: String(made) } });
    }
  };

  /** How [op] reads for [field]: the words for more and less depend on what is counted. */
  const opLabel = (field: SmartField, op: SmartOp) => {
    if (op === 'more' || op === 'less') {
      if (field === 'year') return said.ops.year[op];
      if (field === 'length') return said.ops.length[op];
      return said.ops.count[op];
    }
    return said.ops[op];
  };
  /** A rule's number, said with what it counts. A year is said as it is written, without a thousands mark. */
  const unitOf = (field: SmartField) => {
    if (field === 'year') return (value: number) => String(value);
    if (field === 'length') return said.units.minutes;
    if (field === 'added' || field === 'lastPlayed') return said.units.days;
    return said.units.times;
  };
  const problemText = (rule: SmartRule) => {
    const found = ruleProblem(rule);
    if (found === 'text') return said.editor.problems.text;
    if (found === 'range') return said.editor.problems.range;
    if (found === 'value' || found === 'op') return said.editor.problems.value;
    return null;
  };

  const fieldRule = list.find((row) => row.key === choosingField)?.rule;
  const tagRule = list.find((row) => row.key === choosingTag)?.rule;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: listId != null ? said.editor.editTitle : said.editor.newTitle }} />
      <ConfirmSheet
        visible={leaving != null}
        title={t.details.unsaved.title}
        body={t.details.unsaved.body}
        cancelLabel={t.details.unsaved.keep}
        confirmLabel={t.details.unsaved.discard}
        danger
        onCancel={() => setLeaving(null)}
        onConfirm={() => {
          const going = leaving;
          if (going) navigation.dispatch(going.action);
        }}
      />
      <FormScroll contentContainerStyle={room}>
        <SectionLabel after={false}>{said.editor.name}</SectionLabel>
        <Field
          value={name}
          onChangeText={setName}
          placeholder={said.editor.namePlaceholder}
          accessibilityLabel={said.editor.name}
          returnKeyType="done"
        />
        {tried && !name.trim() ? <Note tone="bad" style={rows.noteRoom}>{said.editor.problems.name}</Note> : null}

        <SectionLabel>{said.editor.match}</SectionLabel>
        <Segmented
          options={[
            { value: 'all', label: said.editor.all },
            { value: 'any', label: said.editor.any },
          ]}
          value={match}
          onChange={setMatch}
        />

        <SectionLabel>{said.editor.rules}</SectionLabel>
        {list.length === 0 ? <Text style={styles.none}>{said.editor.noRules}</Text> : null}
        {list.map(({ key, rule }, at) => {
          const range = rangeOf(rule.field);
          // Fewer than nought is nothing, so the least a `less` can ask is one.
          const least = rule.op === 'less' ? { min: Math.max(1, range.min), max: range.max } : { min: range.min, max: range.max };
          const unit = unitOf(rule.field);
          const wrong = tried ? problemText(rule) : null;
          return (
            <View key={key} style={[rows.card, styles.rule]}>
              <View style={styles.ruleHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={said.editor.asksAbout(said.fields[rule.field])}
                  android_ripple={pressed}
                  style={styles.field}
                  onPress={() => setChoosingField(key)}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>{said.fields[rule.field]}</Text>
                  <Chevron />
                </Pressable>
                <RowControl accessibilityLabel={said.editor.removeRule(at + 1)} onPress={() => remove(key)}>
                  <CrossIcon size={14} color={c.textMuted} />
                </RowControl>
              </View>
              <Segmented
                variant="chips"
                size="compact"
                layout="fit"
                wrap
                options={opsFor(rule.field).map((op) => ({ value: op, label: opLabel(rule.field, op) }))}
                value={rule.op}
                onChange={(op) => change(key, (was) => ({ ...was, op }))}
              />
              {asksWords(rule.field) ? (
                <View style={styles.words}>
                  <Field
                    style={styles.grow}
                    value={rule.text}
                    onChangeText={(text) => change(key, (was) => ({ ...was, text }))}
                    placeholder={rule.field === 'tag' ? said.editor.tagPlaceholder : said.editor.textPlaceholder}
                    accessibilityLabel={said.editor.valueOf(said.fields[rule.field], opLabel(rule.field, rule.op))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  {rule.field === 'tag' ? (
                    <Pressable
                      accessibilityRole="button"
                      android_ripple={pressed}
                      style={styles.choose}
                      onPress={() => setChoosingTag(key)}>
                      <Text style={styles.chooseLabel}>{said.editor.chooseTag}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : rule.op === 'never' ? null : rule.op === 'between' ? (
                <View style={styles.between}>
                  <NumberStepper
                    name={said.editor.fromOf(said.fields[rule.field])}
                    range={least}
                    value={rule.value}
                    label={unit}
                    onChange={(value) => change(key, (was) => ({ ...was, value }))}
                  />
                  <Text style={styles.and}>{said.editor.and}</Text>
                  <NumberStepper
                    name={said.editor.toOf(said.fields[rule.field])}
                    range={least}
                    value={rule.to}
                    label={unit}
                    onChange={(to) => change(key, (was) => ({ ...was, to }))}
                  />
                </View>
              ) : (
                <NumberStepper
                  name={said.editor.valueOf(said.fields[rule.field], opLabel(rule.field, rule.op))}
                  range={least}
                  value={rule.value}
                  label={unit}
                  onChange={(value) => change(key, (was) => ({ ...was, value }))}
                />
              )}
              {wrong ? <Text style={styles.wrong}>{wrong}</Text> : null}
            </View>
          );
        })}
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.add} onPress={add}>
          <PlusIcon size={16} color={c.accent} />
          <Text style={styles.addLabel}>{said.editor.addRule}</Text>
        </Pressable>

        <SectionLabel>{said.editor.limit}</SectionLabel>
        <View style={styles.limit}>
          <Segmented
            options={[
              { value: 'off', label: said.editor.limitOff },
              { value: 'on', label: said.editor.limitOn },
            ]}
            value={limit == null ? 'off' : 'on'}
            onChange={(kind) => setLimit(kind === 'off' ? null : (limit ?? LIMIT_START))}
          />
          {limit != null ? (
            <NumberStepper name={said.editor.limitOn} range={LIMIT_RANGE} value={limit} label={said.units.songs} onChange={setLimit} />
          ) : null}
        </View>

        <SectionLabel>{said.editor.order}</SectionLabel>
        <Segmented
          variant="chips"
          tone="quiet"
          layout="fit"
          wrap
          options={SMART_ORDERS.map((value) => ({ value, label: said.orders[value] }))}
          value={order}
          onChange={setOrder}
        />
      </FormScroll>

      {/* The count and the button, held under the form rather than at the end of it, so the count can be watched while a rule is changed. */}
      <FootBar
        foot={foot}
        bar={{
          text: limit != null && kept < count ? said.editor.matchingKept(count, kept) : said.editor.matching(count),
          // Said once Save has been pressed, not while a rule is still being written; Save stays to be pressed and say it.
          note: tried ? problem : null,
          actions: [{ label: listId != null ? said.editor.save : said.editor.create, kind: 'primary', onPress: save }],
        }}
      />

      <OptionSheet<SmartField>
        visible={choosingField != null}
        heading={said.editor.chooseField}
        options={SMART_FIELDS.map((value) => ({ value, label: said.fields[value] }))}
        chosen={fieldRule?.field ?? 'tag'}
        onChoose={(field) => {
          if (choosingField != null) change(choosingField, (was) => withField(was, field));
        }}
        onClose={() => setChoosingField(null)}
      />
      <OptionSheet<string>
        visible={choosingTag != null}
        heading={said.editor.tagSheet}
        note={tags.length === 0 ? said.editor.noTags : undefined}
        options={tags.map((entry) => ({ value: entry.tag, label: entry.tag, detail: t.common.songs(entry.trackCount) }))}
        chosen={tagRule?.text ?? ''}
        onChoose={(tag) => {
          if (choosingTag != null) change(choosingTag, (was) => ({ ...was, text: tag }));
        }}
        onClose={() => setChoosingTag(null)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  grow: { flex: 1, minWidth: 0 },
  none: { color: c.textFaint, fontSize: TYPE.small, lineHeight: LEADING.small, marginLeft: SPACE.xs },

  rule: { padding: SPACE.m, gap: SPACE.m, marginBottom: SPACE.xl },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  field: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.s,
    minHeight: TOUCH.normal,
    paddingHorizontal: SPACE.m,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  fieldLabel: { color: c.text, fontSize: TYPE.body, fontWeight: '600', flexShrink: 1 },
  words: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  choose: { paddingHorizontal: SPACE.s, minHeight: TOUCH.normal, justifyContent: 'center', borderRadius: RADIUS.cover, overflow: 'hidden' },
  chooseLabel: { color: c.accent, fontSize: TYPE.small },
  between: { gap: SPACE.s },
  and: { color: c.textMuted, fontSize: TYPE.small },
  wrong: { color: c.danger, fontSize: TYPE.hint, lineHeight: LEADING.hint },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.s,
    minHeight: TOUCH.normal,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  addLabel: { color: c.accent, fontSize: TYPE.body, fontWeight: '600' },
  limit: { gap: SPACE.m },
}));
