import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { TextField } from './FormScroll';

import { useT } from '../lib/i18n/index';
import { canonicalLabel, foldForMatch } from '../lib/metadata/text';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import type { TagEdit } from '../lib/db/tags';

/**
 * Edits an ordered list of tags.
 *
 * Order is meaningful rather than cosmetic — the first tag is the one counted
 * as the track's genre — so tags move with explicit arrows instead of a drag.
 * A drag would fight the surrounding scroll view, and there are rarely more
 * than a handful of tags to arrange.
 *
 * Each tag carries the source it came from and keeps it through a move or a
 * deletion. Only a tag typed here is the user's own, and only that one is
 * allowed to become permanent by being marked `manual`.
 */
export function TagEditor({
  tags,
  suggestions,
  draft,
  onDraft,
  onChange,
}: {
  tags: TagEdit[];
  /** Tags already used elsewhere in the library, offered to keep spelling consistent. */
  suggestions: string[];
  draft: string;
  onDraft: (value: string) => void;
  onChange: (tags: TagEdit[]) => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();

  const add = (raw: string) => {
    // The one spelling tags are kept in, so holding shift is not a decision.
    // The plain rule turned `İ` into a letter with a mark after it, which
    // matched nothing — including the same word typed in lower case.
    const tag = canonicalLabel(raw);
    if (!tag || tags.some((entry) => entry.tag === tag)) {
      onDraft('');
      return;
    }
    onChange([...tags, { tag, source: 'manual' }]);
    onDraft('');
  };

  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= tags.length) return;
    const next = [...tags];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  /*
    Folded on both sides, the way every other match in this app is. Comparing
    the raw strings meant `sarki` never offered `şarkı`, and lowercasing the
    typing with the plain rule turned `İ` into a letter with a mark after it
    that matches nothing at all.
  */
  const needle = foldForMatch(draft);
  const offered = needle
    ? suggestions
        .filter(
          (tag) =>
            foldForMatch(tag).includes(needle) &&
            // Canonical on both sides, or a suggestion differing from a tag
            // already on the track only by its case is offered as if it were
            // a different tag — and adding it silently does nothing.
            !tags.some((entry) => entry.tag === canonicalLabel(tag))
        )
        .slice(0, 6)
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.format.upper(t.details.editor.label)}</Text>

      {tags.map((entry, index) => (
        <View key={entry.tag} style={styles.row}>
          <Text style={styles.position}>{index + 1}</Text>
          <Text style={styles.tag} numberOfLines={1}>
            {entry.tag}
          </Text>
          <Pressable android_ripple={pressed} style={styles.action} onPress={() => move(index, -1)} disabled={index === 0}>
            <Text style={index === 0 ? styles.actionOff : styles.actionLabel}>↑</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={styles.action}
            onPress={() => move(index, 1)}
            disabled={index === tags.length - 1}>
            <Text style={index === tags.length - 1 ? styles.actionOff : styles.actionLabel}>↓</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={styles.action}
            onPress={() => onChange(tags.filter((candidate) => candidate.tag !== entry.tag))}>
            <Text style={styles.actionLabel}>×</Text>
          </Pressable>
        </View>
      ))}

      <TextField
        style={styles.input}
        value={draft}
        onChangeText={onDraft}
        onSubmitEditing={() => add(draft)}
        placeholder={t.details.editor.add}
        placeholderTextColor={c.textDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
      />

      {offered.length > 0 ? (
        <View style={styles.suggestions}>
          {offered.map((tag) => (
            <Pressable android_ripple={pressed} key={tag} style={styles.suggestion} onPress={() => add(tag)}>
              <Text style={styles.suggestionLabel}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  container: { gap: 8 },
  label: { color: c.textSecondary, fontSize: 12, letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    ...outlined(c),
  },
  position: { color: c.textFaint, fontSize: 12, width: 14, fontVariant: ['tabular-nums'] },
  tag: { color: c.text, fontSize: 15, flex: 1 },
  action: { paddingHorizontal: 10, paddingVertical: 6 },
  actionLabel: { color: c.text, fontSize: 16 },
  actionOff: { color: c.textDisabled, fontSize: 16 },
  input: {
    backgroundColor: c.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...outlined(c),
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestion: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionLabel: { color: c.textSecondary, fontSize: 13 },
}));
