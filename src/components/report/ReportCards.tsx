import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../lib/i18n/index';
import { formatDuration, formatHour } from '../../lib/stats/period';
import { creditsOn, photoFor, pictureFor } from '../../lib/stats/photos';
import type { Covers, Photos } from '../../lib/stats/photos';
import type { RankedEntry, ReportCard } from '../../lib/stats/report';
import { ThemeScope } from '../../lib/theme/index';

export type { Covers, Photos };

/**
 * A palette per card, and they are meant to clash.
 *
 * A recap read one card at a time has nothing but colour to tell the reader
 * they have moved on; a single house palette across seven cards reads as one
 * long card. Each is three stops rather than two so the corner the heading
 * sits in is darker than the middle, which is what keeps white text legible
 * over the bright end without laying a scrim over the whole thing.
 */
const PALETTES: Record<string, readonly [string, string, string]> = {
  opening: ['#1B1040', '#4C1D95', '#A855F7'],
  tracks: ['#052E2B', '#0F766E', '#2DD4BF'],
  artists: ['#3B0A2A', '#9D174D', '#F472B6'],
  genres: ['#2A1403', '#B45309', '#FBBF24'],
  clock: ['#07182E', '#1D4ED8', '#60A5FA'],
  numbers: ['#170B2E', '#5B21B6', '#8B5CF6'],
  closing: ['#2B0A3D', '#7209B7', '#F72585'],
};

export type Tints = ReadonlyMap<string, readonly [string, string, string]>;

/**
 * The colours a card is drawn in.
 *
 * Taken from the cover it is about where one could be read, so a card wears
 * the record it is describing. The fixed palettes stay as the answer for a
 * cover with no picture or none worth reading — and they are still what keeps
 * two cover-less cards from looking alike.
 */
function paletteFor(card: ReportCard, tints: Tints): readonly [string, string, string] {
  const fromCover = card.tint ? tints.get(card.tint) : undefined;
  if (fromCover) return fromCover;
  if (card.kind === 'ranking') return PALETTES[card.of];
  return PALETTES[card.kind];
}

/**
 * One card of the report, drawn at whatever size it is given.
 *
 * Sized by the caller rather than by itself: the same card is both the thing
 * on screen and the thing written to a file, and those are not the same number
 * of points.
 *
 * Its colours are its own, written out at the foot of this file, and are the
 * same in every theme: a card is a designed thing that ends up as a picture in
 * somebody's gallery, and it should not come out pale because the app was. The
 * scope around it says so to anything inside that might ask. Its words do
 * follow the language, since they are read by whoever it is shared with.
 */
export function ReportCardView({
  card,
  width,
  height,
  stamp,
  covers,
  photos,
  tints,
}: {
  card: ReportCard;
  width: number;
  height: number;
  /** The period, said once in the corner, the way a recap signs its cards. */
  stamp: string;
  /** Cover for a track id, for the rows and walls that borrow one. */
  covers: Covers;
  /** Photograph for an artist, where one has been found for them. */
  photos: Photos;
  /** Colours read out of those covers, for the card to be drawn in. */
  tints: Tints;
}) {
  // Everything scales off the card's width so a card written out at twice the
  // size is the same design rather than the same design with bigger margins.
  const t = useT();
  const unit = width / 360;
  const pad = 26 * unit;

  /*
    The photographs come from Wikimedia Commons under licences that ask to be
    acknowledged, and this card is about to become a file in somebody's gallery
    and then a post. So the acknowledgement is drawn onto the picture itself
    rather than left to whatever the app could say around it, which does not
    survive being shared. Empty on every card that shows only album covers.
  */
  const credits = creditsOn(card, photos, t);

  return (
    <ThemeScope theme="dark">
      <LinearGradient
        colors={paletteFor(card, tints)}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.55, 1]}
        style={[styles.card, { width, height, borderRadius: 26 * unit, padding: pad }]}>
        <View style={styles.header}>
          <Text style={[styles.wordmark, { fontSize: 11 * unit, letterSpacing: 2 * unit }]}>
            JUKEBOX
          </Text>
          <Text style={[styles.stamp, { fontSize: 11 * unit, letterSpacing: 1 * unit }]}>
            {t.format.upper(stamp)}
          </Text>
        </View>

        {/*
          The wall sits inside the gradient rather than under it, so the colour
          still carries the card and the covers only give it texture.
        */}
        {(card.kind === 'opening' || card.kind === 'numbers') && card.wall.length > 0 ? (
          <>
            <Wall ids={card.wall} covers={covers} radius={26 * unit} />
            {/*
              A band of shade across the middle, where the number sits. Without
              it the covers read straight through the type — white on a busy
              wall is legible but never crisp, and this card is mostly one word.
            */}
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)', 'transparent']}
              locations={[0.18, 0.4, 0.62, 0.86]}
              style={styles.shade}
            />
          </>
        ) : null}
        <View style={styles.body}>{body(card, unit, covers, photos)}</View>
        {/*
          In the flow of the card rather than laid over it, so the line can never
          land on top of a name: the body gives up the few points it takes.
        */}
        {credits.length > 0 ? (
          <Text style={[styles.credit, { fontSize: 8.5 * unit, lineHeight: 11.5 * unit, marginTop: 10 * unit }]}>
            {credits.join('   ·   ')}
          </Text>
        ) : null}
      </LinearGradient>
    </ThemeScope>
  );
}

function body(card: ReportCard, unit: number, covers: Covers, photos: Photos) {
  switch (card.kind) {
    case 'opening':
      return <Opening card={card} unit={unit} />;
    case 'ranking':
      return <Ranking card={card} unit={unit} covers={covers} photos={photos} />;
    case 'clock':
      return <Clock card={card} unit={unit} art={card.tint ? covers.get(card.tint) : undefined} />;
    case 'numbers':
      return <Numbers card={card} unit={unit} />;
    case 'closing':
      return <Closing card={card} unit={unit} covers={covers} photos={photos} />;
  }
}

/**
 * Nine covers behind the opening card.
 *
 * Faint on purpose: it is texture, not a picture. Repeated where there are
 * fewer than nine, because a wall with holes in it reads as a loading state.
 */
function Wall({ ids, covers, radius }: { ids: string[]; covers: Covers; radius: number }) {
  const known = ids.map((id) => covers.get(id)).filter((uri): uri is string => !!uri);
  if (known.length === 0) return null;

  /*
    Three across and five down, which on a card this shape leaves the tiles
    very nearly square. Built as rows of three sharing the width rather than
    as a wrapping list of thirds: a third written as a percentage is either
    slightly over — and then only two fit on a line — or slightly under, and
    then there is a seam down the wall.
  */
  const rows = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) => known[(row * 3 + column) % known.length])
  );

  return (
    <View style={[styles.wall, { borderRadius: radius }]} pointerEvents="none">
      {rows.map((row, index) => (
        <View key={index} style={styles.wallRow}>
          {row.map((uri, column) => (
            <Image key={column} source={{ uri }} style={styles.tileArt} contentFit="cover" />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A row's cover, square for a track or a genre and round for a person. */
function Cover({ uri, size, round }: { uri: string | undefined; size: number; round: boolean }) {
  const shape = { width: size, height: size, borderRadius: round ? size / 2 : size * 0.16 };
  return uri ? (
    <Image source={{ uri }} style={[styles.cover, shape]} contentFit="cover" />
  ) : (
    <View style={[styles.cover, styles.coverEmpty, shape]} />
  );
}

function Opening({ card, unit }: { card: Extract<ReportCard, { kind: 'opening' }>; unit: number }) {
  const t = useT();
  return (
    <View style={styles.centred}>
      <Text style={[styles.lead, { fontSize: 15 * unit }]}>{t.stats.cards.listenedFor}</Text>
      {/*
        The one number the card exists for. Left to shrink rather than wrap,
        because "1h 20m" and "132h" want the same line and not the same size.
      */}
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[styles.hero, { fontSize: 64 * unit, lineHeight: 74 * unit }]}>
        {formatDuration(card.seconds, t)}
      </Text>
      {card.change == null ? null : (
        <View style={[styles.chip, { paddingHorizontal: 12 * unit, paddingVertical: 6 * unit, borderRadius: 999 }]}>
          <Text style={[styles.chipText, { fontSize: 13 * unit }]}>
            {t.stats.cards.change(card.change, card.comparison)}
          </Text>
        </View>
      )}
    </View>
  );
}

function Ranking({
  card,
  unit,
  covers,
  photos,
}: {
  card: Extract<ReportCard, { kind: 'ranking' }>;
  unit: number;
  covers: Covers;
  photos: Photos;
}) {
  /*
    A row about a person would rather be a person than one of their records,
    and falls back to the record where there is no photograph of them — which
    for most of a personal library is every row, so the two cannot be allowed
    to look like different things.
  */
  const art = (entry: RankedEntry) =>
    pictureFor(entry.sample, covers, photoFor(card.of, entry.key, photos));

  return (
    <View style={styles.fill}>
      <Heading heading={card.heading} lead={card.lead} unit={unit} />
      {/*
        The one at the top is the whole point of the card, so it is drawn as
        one rather than as the first of five identical lines. The rest follow
        underneath as a list, which is what makes the card read as a result
        instead of a table.
      */}
      {card.entries[0] ? (
        <Leader
          entry={card.entries[0]}
          unit={unit}
          art={art(card.entries[0])}
          round={card.of === 'artists'}
        />
      ) : null}
      <View style={[styles.rows, { gap: 11 * unit, marginTop: 18 * unit }]}>
        {card.entries.slice(1).map((entry, index) => (
          <Rank
            key={entry.key}
            entry={entry}
            place={index + 2}
            unit={unit}
            art={art(entry)}
            round={card.of === 'artists'}
          />
        ))}
      </View>
    </View>
  );
}

/** The card's winner: a big cover, its name large, and what it did. */
function Leader({
  entry,
  unit,
  art,
  round,
}: {
  entry: RankedEntry;
  unit: number;
  art: string | undefined;
  round: boolean;
}) {
  const t = useT();
  return (
    <View style={[styles.leader, { gap: 14 * unit }]}>
      <Cover uri={art} size={108 * unit} round={round} />
      <View style={styles.fill}>
        <Text style={[styles.leaderPlace, { fontSize: 11 * unit, letterSpacing: 1.4 * unit }]}>
          {t.stats.cards.numberOne}
        </Text>
        <Text numberOfLines={2} style={[styles.leaderLabel, { fontSize: 25 * unit, lineHeight: 29 * unit }]}>
          {entry.label}
        </Text>
        {entry.detail ? (
          <Text numberOfLines={1} style={[styles.rankDetail, { fontSize: 13.5 * unit, marginTop: 2 * unit }]}>
            {entry.detail}
          </Text>
        ) : null}
        <Text style={[styles.leaderPlays, { fontSize: 13 * unit, marginTop: 6 * unit }]}>
          {t.stats.cards.plays(entry.plays)}
        </Text>
      </View>
    </View>
  );
}

function Rank({
  entry,
  place,
  unit,
  art,
  round,
}: {
  entry: RankedEntry;
  place: number;
  unit: number;
  art: string | undefined;
  round: boolean;
}) {
  return (
    <View style={[styles.rank, { gap: 10 * unit }]}>
      <Text style={[styles.place, { fontSize: 19 * unit, width: 16 * unit }]}>{place}</Text>
      <Cover uri={art} size={38 * unit} round={round} />
      <View style={styles.fill}>
        <Text numberOfLines={1} style={[styles.rankLabel, { fontSize: 17 * unit }]}>
          {entry.label}
        </Text>
        {entry.detail ? (
          <Text numberOfLines={1} style={[styles.rankDetail, { fontSize: 12.5 * unit }]}>
            {entry.detail}
          </Text>
        ) : null}
        {/*
          The bar is the share of the leader, which is what turns an ordered
          list into a shape: whether the top one is a habit or merely first.
        */}
        {/* Further off a lone label than off a pair: with no second line the
            bar sits under the descenders of the first one. */}
        <View style={[styles.track, { height: 3 * unit, marginTop: (entry.detail ? 6 : 9) * unit }]}>
          <View style={[styles.trackFill, { width: `${Math.max(4, entry.share * 100)}%` }]} />
        </View>
      </View>
      <Text style={[styles.plays, { fontSize: 13 * unit }]}>{entry.plays}×</Text>
    </View>
  );
}

/**
 * The day as a dial rather than as a row of columns.
 *
 * A day is a circle — midnight is next to midnight — and a bar chart cuts it
 * at an arbitrary place and asks the reader to join the ends up again. Drawn
 * round, the shape of somebody's day is a thing you recognise at a glance:
 * one lobe for an evening, two for a commute.
 */
function Clock({
  card,
  unit,
  art,
}: {
  card: Extract<ReportCard, { kind: 'clock' }>;
  unit: number;
  art: string | undefined;
}) {
  const most = Math.max(...card.hours, 1);

  /*
    Every measurement is from the middle of the box, and every spoke is placed
    so that its own middle starts there before it is turned. Anchored anywhere
    else, each spoke pivots about a point that moves with its own length and
    the ring comes apart — which is exactly what it did.
  */
  const box = 300 * unit;
  const centre = box / 2;
  const face = 46 * unit;
  const inner = 62 * unit;
  const reach = 66 * unit;
  const labelAt = 141 * unit;
  const thick = 8 * unit;
  const markWidth = 46 * unit;
  const markHeight = 15 * unit;

  return (
    <View style={styles.fill}>
      <Heading heading={card.heading} lead={card.lead} unit={unit} />
      <View style={styles.dialWrap}>
        <View style={{ width: box, height: box }}>
          {card.hours.map((seconds, hour) => {
            // A stub for the empty hours, so the ring stays a ring rather
            // than breaking into islands of spokes.
            const length = Math.max(4 * unit, (seconds / most) * reach);
            return (
              <View
                key={hour}
                style={[
                  styles.spoke,
                  {
                    width: thick,
                    height: length,
                    borderRadius: thick / 2,
                    left: centre - thick / 2,
                    top: centre - length / 2,
                    // Turned to the hour, then pushed out along that turn.
                    transform: [
                      { rotate: `${hour * 15}deg` },
                      { translateY: -(inner + length / 2) },
                    ],
                  },
                  hour === card.peak && styles.spokePeak,
                ]}
              />
            );
          })}

          {/* The cover in the middle, so the dial has a face. */}
          {art ? (
            <Image
              source={{ uri: art }}
              style={[
                styles.dialFace,
                { width: face * 2, height: face * 2, borderRadius: face, left: centre - face, top: centre - face },
              ]}
              contentFit="cover"
            />
          ) : null}

          {[0, 6, 12, 18].map((hour) => (
            <Text
              key={hour}
              style={[
                styles.dialMark,
                {
                  fontSize: 10.5 * unit,
                  lineHeight: markHeight,
                  width: markWidth,
                  height: markHeight,
                  left: centre - markWidth / 2,
                  top: centre - markHeight / 2,
                  // Out to the hour's place, then turned back so the writing
                  // is level wherever on the dial it ends up.
                  transform: [
                    { rotate: `${hour * 15}deg` },
                    { translateY: -labelAt },
                    { rotate: `${-hour * 15}deg` },
                  ],
                },
              ]}>
              {formatHour(hour)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Numbers({ card, unit }: { card: Extract<ReportCard, { kind: 'numbers' }>; unit: number }) {
  const [first, ...rest] = card.items;
  return (
    <View style={styles.fill}>
      <Heading heading={card.heading} lead="" unit={unit} />
      {/* The first figure taken out of the grid and made the headline, so the
          card has somewhere for the eye to land before it starts reading. */}
      {first ? (
        <View style={{ marginBottom: 16 * unit }}>
          <Text style={[styles.bigValue, { fontSize: 54 * unit, lineHeight: 60 * unit }]}>
            {first.value}
          </Text>
          <Text style={[styles.tileLabel, { fontSize: 13 * unit }]}>{first.label}</Text>
        </View>
      ) : null}
      <View style={[styles.tiles, { gap: 9 * unit }]}>
        {rest.map((item) => (
          <View
            key={item.label}
            style={[styles.tile, { borderRadius: 14 * unit, padding: 13 * unit }]}>
            <Text numberOfLines={1} style={[styles.tileValue, { fontSize: 23 * unit }]}>
              {item.value}
            </Text>
            <Text style={[styles.tileLabel, { fontSize: 11.5 * unit }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Closing({
  card,
  unit,
  covers,
  photos,
}: {
  card: Extract<ReportCard, { kind: 'closing' }>;
  unit: number;
  covers: Covers;
  photos: Photos;
}) {
  const art = card.sample ? covers.get(card.sample) : undefined;
  /*
    A photograph makes the round half a picture of somebody rather than a
    second record, so it is preferred and it also revives the pair in the case
    the model collapses: `artistSample` is deliberately null when the artist's
    best track is the period's best track, since the same cover twice is not a
    pair — but a photograph of them never was that cover.
  */
  const second = pictureFor(
    card.artistSample,
    covers,
    card.artist ? photos.get(card.artist) : undefined
  );
  const big = 148 * unit;
  const t = useT();

  return (
    <View style={styles.centred}>
      {/*
        The track's cover and the artist's, overlapped like two records set
        down one on the other. Where they are the same picture the model sends
        only one, and one is what is drawn — a pair of identical covers is not
        a pair.
      */}
      {art ? (
        <View style={[styles.pair, { marginBottom: 26 * unit }]}>
          <Image
            source={{ uri: art }}
            style={[styles.heroFlat, { width: big, height: big, borderRadius: 20 * unit }]}
            contentFit="cover"
          />
          {/*
            Drawn after the square and overlapping it only at the edge, which
            is what makes them read as two records set down one beside the
            other. Tucked behind it, as it was, the artist all but vanished.
          */}
          {second ? (
            <Image
              source={{ uri: second }}
              style={[
                styles.heroRound,
                {
                  width: big * 0.64,
                  height: big * 0.64,
                  borderRadius: big * 0.32,
                  marginLeft: -big * 0.15,
                  borderWidth: 3 * unit,
                },
              ]}
              contentFit="cover"
            />
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.lead, { fontSize: 15 * unit }]}>{card.title}</Text>
      <Text style={[styles.closingTime, { fontSize: 44 * unit, lineHeight: 52 * unit }]}>
        {formatDuration(card.seconds, t)}
      </Text>
      {card.track ? (
        <Named label={t.stats.cards.mostPlayed} value={card.track} unit={unit} />
      ) : null}
      {card.artist ? (
        <Named label={t.stats.cards.mostPlayedArtist} value={card.artist} unit={unit} />
      ) : null}
    </View>
  );
}

function Named({ label, value, unit }: { label: string; value: string; unit: number }) {
  const t = useT();
  return (
    <View style={{ marginTop: 22 * unit, alignItems: 'center' }}>
      <Text style={[styles.namedLabel, { fontSize: 11 * unit, letterSpacing: 1.4 * unit }]}>
        {t.format.upper(label)}
      </Text>
      <Text numberOfLines={2} style={[styles.namedValue, { fontSize: 20 * unit }]}>
        {value}
      </Text>
    </View>
  );
}

function Heading({ heading, lead, unit }: { heading: string; lead: string; unit: number }) {
  return (
    <View style={{ marginBottom: 22 * unit }}>
      <Text style={[styles.heading, { fontSize: 27 * unit, lineHeight: 32 * unit }]}>{heading}</Text>
      {lead ? <Text style={[styles.lead, { fontSize: 14 * unit, marginTop: 4 * unit }]}>{lead}</Text> : null}
    </View>
  );
}

const WHITE = '#ffffff';
const SOFT = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.28)';

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  wall: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.18,
  },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  wallRow: { flex: 1, flexDirection: 'row' },
  tileArt: { flex: 1 },
  cover: { backgroundColor: 'rgba(255,255,255,0.12)' },
  coverEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { color: WHITE, fontWeight: '800' },
  stamp: { color: SOFT, fontWeight: '600' },

  body: { flex: 1, justifyContent: 'center' },
  fill: { flex: 1, justifyContent: 'center' },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  lead: { color: SOFT, fontWeight: '500', textAlign: 'center' },
  hero: { color: WHITE, fontWeight: '800', textAlign: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 18 },
  chipText: { color: WHITE, fontWeight: '600' },

  heading: { color: WHITE, fontWeight: '800' },

  rows: { justifyContent: 'center' },
  rank: { flexDirection: 'row', alignItems: 'center' },
  place: { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankLabel: { color: WHITE, fontWeight: '600' },
  rankDetail: { color: SOFT, marginTop: 1 },
  track: { backgroundColor: FAINT, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: WHITE, borderRadius: 2 },
  plays: { color: SOFT, fontWeight: '600', fontVariant: ['tabular-nums'] },

  dialWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spoke: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.5)' },
  spokePeak: { backgroundColor: WHITE },
  dialFace: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.14)' },
  dialMark: { position: 'absolute', color: SOFT, textAlign: 'center' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexGrow: 1,
    flexBasis: '44%',
    minWidth: 0,
  },
  tileValue: { color: WHITE, fontWeight: '800' },
  tileLabel: { color: SOFT, marginTop: 2 },

  closingTime: { color: WHITE, fontWeight: '800', textAlign: 'center' },

  leader: { flexDirection: 'row', alignItems: 'center' },
  leaderPlace: { color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  leaderLabel: { color: WHITE, fontWeight: '800', marginTop: 3 },
  leaderPlays: { color: SOFT, fontWeight: '600' },
  bigValue: { color: WHITE, fontWeight: '800' },

  /*
    The artist's cover is round and set behind and to the side of the track's,
    which is square — two squares of the same size read as a mistake, and the
    overlap is what makes them a pair rather than a row.
  */
  // Bottoms aligned, so the round one sits into the corner of the square.
  pair: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  heroFlat: { backgroundColor: 'rgba(255,255,255,0.12)' },
  heroRound: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.45)' },
  /*
    Bottom left, under everything, quiet enough to read past and dark enough to
    read. Wraps rather than truncating: an attribution cut off in the middle of
    a name is not an attribution.
  */
  credit: { color: 'rgba(255,255,255,0.58)', fontWeight: '500' },
  namedLabel: { color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  namedValue: { color: WHITE, fontWeight: '700', textAlign: 'center', marginTop: 4 },
});
