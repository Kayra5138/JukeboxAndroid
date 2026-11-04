import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScroll, TextField } from '../components/FormScroll';
import { CrossIcon, PlusIcon } from '../components/Icons';
import { NumberStepper } from '../components/NumberStepper';
import { OptionSheet } from '../components/OptionSheet';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';
import { useUnderBars } from '../components/UnderBars';
import { useRows } from '../components/settings/rows';
import { createSmartList, playlist, renamePlaylist, setSmartRules } from '../lib/db/playlists';
import { tagCounts } from '../lib/db/tags';
import { useT } from '../lib/i18n/index';
import { libraryState, refreshLibrary } from '../lib/library/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
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
} from '../lib/lists/smart';
import { readSmartStats } from '../lib/lists/smartLive';
import { isTape } from '../lib/tapes/tape';
import { makeStyles, outlined, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

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
  const insets = useSafeAreaInsets();
  const under = useUnderBars();
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
    setTried(true);
    if (problem) {
      haptic('results', 'reject');
      return;
    }
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
      <FormScroll
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 12 + under.top,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
          },
        ]}>
        <Text accessibilityRole="header" style={rows.section}>{t.format.upper(said.editor.name)}</Text>
        <View style={rows.card}>
          <View style={rows.row}>
            <TextField
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={said.editor.namePlaceholder}
              placeholderTextColor={c.textFaint}
              accessibilityLabel={said.editor.name}
              returnKeyType="done"
            />
          </View>
        </View>
        {tried && !name.trim() ? <Text style={rows.noteBad}>{said.editor.problems.name}</Text> : null}

        <Text accessibilityRole="header" style={[rows.section, rows.sectionAfter]}>{t.format.upper(said.editor.match)}</Text>
        <Segmented
          options={[
            { value: 'all', label: said.editor.all },
            { value: 'any', label: said.editor.any },
          ]}
          value={match}
          onChange={setMatch}
        />

        <Text accessibilityRole="header" style={[rows.section, rows.sectionAfter]}>{t.format.upper(said.editor.rules)}</Text>
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
                  <Text style={rows.chevron} importantForAccessibility="no">›</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={said.editor.removeRule(at + 1)}
                  android_ripple={pressed}
                  hitSlop={6}
                  style={styles.remove}
                  onPress={() => remove(key)}>
                  <CrossIcon size={14} color={c.textMuted} />
                </Pressable>
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
                  <TextField
                    style={[styles.input, styles.grow]}
                    value={rule.text}
                    onChangeText={(text) => change(key, (was) => ({ ...was, text }))}
                    placeholder={rule.field === 'tag' ? said.editor.tagPlaceholder : said.editor.textPlaceholder}
                    placeholderTextColor={c.textFaint}
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

        <Text accessibilityRole="header" style={[rows.section, rows.sectionAfter]}>{t.format.upper(said.editor.limit)}</Text>
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

        <Text accessibilityRole="header" style={[rows.section, rows.sectionAfter]}>{t.format.upper(said.editor.order)}</Text>
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
      <View style={[styles.foot, { paddingBottom: 12 + insets.bottom, paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]}>
        <View style={styles.footText}>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {limit != null && kept < count ? said.editor.matchingKept(count, kept) : said.editor.matching(count)}
          </Text>
          {tried && problem ? <Text style={styles.wrong}>{problem}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          android_ripple={pressed}
          style={[styles.save, problem != null && styles.saveOff]}
          onPress={save}>
          <Text style={styles.saveLabel}>{listId != null ? said.editor.save : said.editor.create}</Text>
        </Pressable>
      </View>

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
  content: { paddingBottom: 24 },
  input: {
    color: c.text,
    fontSize: 15,
    backgroundColor: c.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...outlined(c),
  },
  grow: { flex: 1, minWidth: 0 },
  none: { color: c.textFaint, fontSize: 13, lineHeight: 20, marginLeft: 4 },

  rule: { padding: 14, gap: 12, marginBottom: 10 },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  fieldLabel: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  words: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choose: { paddingHorizontal: 10, minHeight: 40, justifyContent: 'center', borderRadius: 8, overflow: 'hidden' },
  chooseLabel: { color: c.accent, fontSize: 14 },
  between: { gap: 8 },
  and: { color: c.textMuted, fontSize: 13 },
  wrong: { color: c.danger, fontSize: 12.5, lineHeight: 18 },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  addLabel: { color: c.accent, fontSize: 14.5, fontWeight: '600' },
  limit: { gap: 12 },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  footText: { flex: 1, minWidth: 0, gap: 2 },
  count: { color: c.text, fontSize: 14.5, fontWeight: '600' },
  save: { paddingHorizontal: 20, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: c.primary },
  saveOff: { opacity: 0.45 },
  saveLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
}));
