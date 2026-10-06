import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from './FormScroll';

import { canonicalLabel, foldForMatch } from '../lib/metadata/text';
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
      <Text style={styles.label}>Tags</Text>

      {tags.map((entry, index) => (
        <View key={entry.tag} style={styles.row}>
          <Text style={styles.position}>{index + 1}</Text>
          <Text style={styles.tag} numberOfLines={1}>
            {entry.tag}
          </Text>
          <Pressable style={styles.action} onPress={() => move(index, -1)} disabled={index === 0}>
            <Text style={index === 0 ? styles.actionOff : styles.actionLabel}>↑</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => move(index, 1)}
            disabled={index === tags.length - 1}>
            <Text style={index === tags.length - 1 ? styles.actionOff : styles.actionLabel}>↓</Text>
          </Pressable>
          <Pressable
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
        placeholder="Add a tag"
        placeholderTextColor="#5a5a5a"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
      />

      {offered.length > 0 ? (
        <View style={styles.suggestions}>
          {offered.map((tag) => (
            <Pressable key={tag} style={styles.suggestion} onPress={() => add(tag)}>
              <Text style={styles.suggestionLabel}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: '#9a9a9a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
  },
  position: { color: '#5a5a5a', fontSize: 12, width: 14, fontVariant: ['tabular-nums'] },
  tag: { color: '#f2f2f2', fontSize: 15, flex: 1 },
  action: { paddingHorizontal: 10, paddingVertical: 6 },
  actionLabel: { color: '#f2f2f2', fontSize: 16 },
  actionOff: { color: '#3a3a3a', fontSize: 16 },
  input: {
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    color: '#f2f2f2',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestion: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionLabel: { color: '#c8c8c8', fontSize: 13 },
});
