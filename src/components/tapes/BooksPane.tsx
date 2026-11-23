import { useEffect, useRef, useState } from 'react';
import { LEADING, SPACE, TYPE, PAGE, RADIUS } from '../../lib/theme/measures';
import { Note } from '../Note';
import { SectionLabel } from '../settings/rows';
import { useRouter } from 'expo-router';
import { FlatList, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Busy } from '../Busy';

import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { Segmented } from '../Segmented';
import { SearchField } from '../SearchField';
import { bookLanguageOf, bookLanguagesFor, identifierOf, searchBooks, type BookHit } from '../../lib/books/archive';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import { useLanguage, useT } from '../../lib/i18n/index';
import { makeStyles, useColours, usePressed } from '../../lib/theme/index';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../lib/ui/lists';
import { usePageRoom } from '../Page';

/**
 * The books of the Add tapes screen: LibriVox's recordings of books out of
 * copyright, as the Internet Archive keeps them, the most listened to first
 * until something is searched for — by title or by author — or an Archive
 * address pasted, which opens whatever is there to listen to. A book opens a
 * screen of its own, where it is fetched, whole or a part at a time. Books
 * are searched for in one language, or any: the app's own to begin with,
 * where there are books in it, and after that the one last chosen.
 */
/**
 * [query] and [onQuery], where given, are the words typed kept by the screen
 * round it, so that they are still there when another source is chosen and
 * this one again: the same words looked for in each.
 */
export function BooksPane({ query: shared, onQuery }: { query?: string; onQuery?: (query: string) => void } = {}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // The tab bar and the bar of what is playing, in a theme of glass laid over the foot of the list.
  // The page's room, under the choice of where tapes come from, which stands over it (see `PageScroll`'s [head]).
  const room = usePageRoom();
  const router = useRouter();
  const said = t.search.tapes.books;
  const appLanguage = useLanguage();
  const [language, setLanguage] = useState(() => bookLanguageOf(readSetting(SETTINGS.bookLanguage), appLanguage));
  const [own, setOwn] = useState('');
  const query = shared ?? own;
  const setQuery = onQuery ?? setOwn;
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
      windowSize={LIST_WINDOW}
      data={found ?? []}
      keyExtractor={(hit) => hit.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ ...room, paddingTop: PAGE.top }}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          <SearchField
            accessibilityLabel={said.placeholder}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (!text.trim()) void look('');
            }}
            placeholder={said.placeholder}
            maxLength={300}
            go={{ label: t.common.search, onPress: search }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipsOut} contentContainerStyle={styles.chips}>
            {/* One row of chips, run along rather than wrapped: there are more languages than a screen is wide. */}
            <Segmented
              variant="chips"
              wrap={false}
              options={[{ value: '', label: said.anyLanguage }, ...bookLanguagesFor(appLanguage).map(({ code, name }) => ({ value: code, label: name }))]}
              value={language ?? ''}
              onChange={(code) => choose(code || null)}
            />
          </ScrollView>
          {searching ? <Busy style={styles.searching} color={c.text} /> : null}
          {message ? <Note style={styles.note}>{message}</Note> : null}
          {!searching && !query.trim() && found && found.length > 0 ? (
            <SectionLabel>{said.popular}</SectionLabel>
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
  intro: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small, marginBottom: SPACE.l },
  searching: { marginVertical: SPACE.l },
  chipsOut: { marginHorizontal: -SPACE.l, marginTop: SPACE.m },
  chips: { gap: SPACE.s, paddingHorizontal: SPACE.l, paddingVertical: SPACE.xs },
  note: { marginTop: SPACE.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.s },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 56, height: 56, borderRadius: RADIUS.cover },
  rowText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.body, fontWeight: '500' },
  muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
}));
