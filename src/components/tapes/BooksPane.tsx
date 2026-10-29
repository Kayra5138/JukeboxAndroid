import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { SearchField } from '../SearchField';
import { bookLanguageOf, bookLanguagesFor, identifierOf, searchBooks, type BookHit } from '../../lib/books/archive';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import { useLanguage, useT } from '../../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
import { CLIP_SUBVIEWS } from '../../lib/ui/lists';

/**
 * The books of the Add tapes screen: LibriVox's recordings of books out of
 * copyright, as the Internet Archive keeps them, the most listened to first
 * until something is searched for — by title or by author — or an Archive
 * address pasted, which opens whatever is there to listen to. A book opens a
 * screen of its own, where it is fetched, whole or a part at a time. Books
 * are searched for in one language, or any: the app's own to begin with,
 * where there are books in it, and after that the one last chosen.
 */
export function BooksPane() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const said = t.search.tapes.books;
  const appLanguage = useLanguage();
  const [language, setLanguage] = useState(() => bookLanguageOf(readSetting(SETTINGS.bookLanguage), appLanguage));
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<BookHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Which search is the latest, so an earlier one answering late is not shown over it. */
  const asked = useRef(0);

  const open = (id: string) => router.push({ pathname: '/book', params: { id } });

  const look = async (text: string, inLanguage = language) => {
    const turn = ++asked.current;
    setSearching(true);
    setMessage(null);
    try {
      const hits = await searchBooks(text, inLanguage);
      if (turn !== asked.current) return;
      setFound(hits);
      if (hits.length === 0) setMessage(said.nothingFound);
    } catch {
      if (turn === asked.current) setMessage(said.searchFailed);
    }
    if (turn === asked.current) setSearching(false);
  };

  // The most listened to, to begin with: once, as the pane opens.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void look('');
  });

  const search = () => {
    const text = query.trim();
    if (!text) return;
    Keyboard.dismiss();
    const item = identifierOf(text);
    if (item) return open(item);
    void look(text);
  };

  const choose = (code: string | null) => {
    if (code === language) return;
    setLanguage(code);
    writeSetting(SETTINGS.bookLanguage, code ?? 'all');
    // What is in the field, an address aside, asked again in it; or the most listened to in it.
    const text = query.trim();
    void look(text && !identifierOf(text) ? text : '', code);
  };

  return (
    <FlatList
      removeClippedSubviews={CLIP_SUBVIEWS}
      data={found ?? []}
      keyExtractor={(hit) => hit.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          <View style={styles.searchRow}>
            <SearchField
              style={styles.input}
              accessibilityLabel={said.placeholder}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text.trim()) void look('');
              }}
              placeholder={said.placeholder}
              maxLength={300}
              onSubmitEditing={search}
            />
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={[styles.searchButton, !query.trim() && styles.searchButtonOff]}
              disabled={!query.trim()}
              onPress={search}>
              <Text style={!query.trim() ? styles.darkTextOff : styles.darkText}>{t.common.search}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipsOut} contentContainerStyle={styles.chips}>
            {[{ code: null, name: said.anyLanguage }, ...bookLanguagesFor(appLanguage)].map(({ code, name }) => (
              <Pressable
                key={code ?? 'all'}
                android_ripple={pressed}
                accessibilityRole="radio"
                accessibilityState={{ checked: language === code }}
                style={[styles.chip, language === code && styles.chipOn]}
                onPress={() => choose(code)}>
                <Text style={language === code ? styles.chipLabelOn : styles.chipLabel}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {searching ? <ActivityIndicator style={styles.searching} color={c.text} /> : null}
          {message ? <Text accessibilityRole="alert" style={styles.note}>{message}</Text> : null}
          {!searching && !query.trim() && found && found.length > 0 ? (
            <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.popular)}</Text>
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={() => open(item.id)}>
          <Image source={{ uri: item.cover }} style={styles.cover} contentFit="cover" />
          <View style={styles.rowText}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {item.author ? <Text style={styles.muted} numberOfLines={1}>{item.author}</Text> : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  content: { padding: 20 },
  intro: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, borderRadius: 12, minHeight: 48 },
  searchButton: { backgroundColor: c.primary, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', minHeight: 48, ...outlined(c, c.primary) },
  searchButtonOff: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  darkTextOff: { color: c.textDisabled, fontWeight: '600' },
  darkText: { color: c.onPrimary, fontWeight: '600' },
  searching: { marginVertical: 16 },
  chipsOut: { marginHorizontal: -20, marginTop: 12 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  chip: { backgroundColor: c.surfaceRaised, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, overflow: 'hidden', ...outlinedClip(c) },
  chipOn: { backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
  chipLabel: { color: c.textSecondary, fontSize: 13 },
  chipLabelOn: { color: c.onPrimary, fontSize: 13 },
  note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 56, height: 56, borderRadius: 8 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 14.5, fontWeight: '500' },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
}));
