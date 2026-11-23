import { requireNativeViewManager } from 'expo-modules-core';
import { RADIUS, SPACE, TYPE, ICON } from '../../lib/theme/measures';
import { memo, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDecay, withTiming, type SharedValue } from 'react-native-reanimated';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { Image } from '../Picture';
import { Covered } from '../Pages';
import { CrossIcon, LassoIcon, RefreshIcon, ShuffleIcon } from '../Icons';
import { artistPhotoUris } from '../../lib/db/artistPhotos';
import { readSetting, SETTINGS, writeSetting } from '../../lib/db/index';
import { useT } from '../../lib/i18n/index';
import { layoutArtistMap, mostNamed, nodesInside, pinOf, type ArtistMapLayout, type MapInput, type MapNode, type MapPin } from '../../lib/media/artistMap';
import { UNKNOWN_ARTIST, type Artist } from '../../lib/media/artists';
import { useAlbumArtwork, warmAlbumArtwork } from '../../lib/media/artwork';
import type { EnrichedTrack } from '../../lib/media/merge';
import { foldForMatch } from '../../lib/metadata/text';
import { glassOf } from '../../lib/theme/Veil';
import { makeStyles, useColours } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { Button } from '../Button';

/**
 * The artists as a map (`media/artistMap.ts`): a circle for each, as big as
 * their songs are many, a line to everyone they share a song with, and the
 * genres gathered each in a colour of its own with its name over it.
 *
 * Dragged about with a finger and pinched nearer or further, as a map is;
 * near enough, the circles carry the artists' pictures and names. A circle
 * touched is chosen: its lines lit, and a card at the foot with who they are,
 * the button to their page and to shuffle them, and the artists they share
 * songs with, each a touch away. Typed in the search box, a name dims
 * everybody else and the map goes to them.
 */

/**
 * Worked out once for a library and kept, here and in a setting: laying out a
 * few hundred artists takes a third of a second on a phone of today and a good
 * deal more on one of a few years ago, and is not done again for opening the
 * app again, only for a library that has changed since.
 */
let kept: { signature: string; layout: ArtistMapLayout } | null = null;
function keptFor(signature: string): ArtistMapLayout | null {
  /*
    Only one that says where its genres are: an artist let go is kept beside
    theirs, and one kept from before it said so had nothing to keep them
    beside -- they went back where they had been. Such a map is laid out
    once more.
  */
  if (kept?.signature === signature && kept.layout.discs) return kept.layout;
  try {
    const stored = JSON.parse(readSetting(SETTINGS.artistMapLayout) ?? 'null') as typeof kept;
    if (stored?.signature === signature && Array.isArray(stored.layout?.nodes) && stored.layout.discs) {
      kept = stored;
      return stored.layout;
    }
  } catch {
    // Laid out again, then.
  }
  return null;
}
/** The map as last laid out, whatever library it was of: what the next is laid out from, so that it changes no more than the library did. */
function lastKept(): ArtistMapLayout | null {
  if (kept) return kept.layout;
  try {
    const stored = JSON.parse(readSetting(SETTINGS.artistMapLayout) ?? 'null') as { layout?: ArtistMapLayout } | null;
    return stored?.layout && Array.isArray(stored.layout.nodes) ? stored.layout : null;
  } catch {
    return null;
  }
}
/** The artists put somewhere by hand: see `MapPin`. */
type Pins = Readonly<Record<string, MapPin>>;
function readPins(): Pins {
  try {
    const stored = JSON.parse(readSetting(SETTINGS.artistMapPins) ?? '{}') as Pins;
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}
/**
 * Where the map was left, moved with the map when it was laid out again: by
 * as much as everything on it moved (see `offset`), so that what was in the
 * middle of the screen still is.
 */
function followOffset(layout: ArtistMapLayout): void {
  if (!left || !layout.offset) return;
  left = { tx: left.tx - left.s * layout.offset.x, ty: left.ty - left.s * layout.offset.y, s: left.s };
}
/** What the map is laid out from, in a few characters: the artists, their genres, and which songs are whose. */
function signatureOf(inputs: readonly MapInput[]): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let at = 0; at < text.length; at++) {
      hash ^= text.charCodeAt(at);
      hash = Math.imul(hash, 0x01000193);
    }
  };
  for (const input of inputs) {
    feed(input.key);
    feed(input.genre ?? '');
    for (const id of input.trackIds) feed(id);
    feed('|');
  }
  return `${inputs.length}:${(hash >>> 0).toString(16)}`;
}
/** Where the map was left, to be found there again. */
let left: { tx: number; ty: number; s: number } | null = null;
function keep(signature: string, layout: ArtistMapLayout): void {
  kept = { signature, layout };
  writeSetting(SETTINGS.artistMapLayout, JSON.stringify(kept));
}
function leave(at: { tx: number; ty: number; s: number }): void {
  left = at;
}
/** The map no longer anywhere: shown whole, the next time it is drawn. */
function forgetWhere(): void {
  left = null;
}

const NO_NODES: MapNode[] = [];
const PALETTE = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#f06292', '#aed581', '#ffd54f', '#7986cb', '#4db6ac', '#ff8a65'];
const MIN_SCALE = 0.05;
const MAX_SCALE = 3;

/* Drawn again only for its own things changing: the library screen is drawn again for every little thing. */
export const ArtistMap = memo(function ArtistMap({
  artists,
  query,
  top,
  bottom,
  onOpen,
  onShuffle,
  register,
  inSight = true,
}: {
  /**
   * Whether it is the view in front, in the tab in front. Behind, a library
   * that changed is not laid out again and no covers are fetched for it:
   * that waits for it to be looked at.
   */
  inSight?: boolean;
  /** Handed, after every drawing, its step back for the tab pressed again: see `back`. */
  register?: (back: () => boolean) => void;
  artists: readonly Artist[];
  query: string;
  top: number;
  bottom: number;
  onOpen: (key: string) => void;
  onShuffle: (tracks: EnrichedTrack[]) => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();

  const inputs = useMemo(
    (): MapInput[] =>
      artists
        .filter((artist) => artist.key !== UNKNOWN_ARTIST)
        .map((artist) => ({
          key: artist.key,
          name: artist.name,
          trackIds: artist.tracks.map((track) => track.id),
          genre: mostNamed(artist.tracks.map((track) => track.genre ?? track.tags[0])),
        })),
    [artists]
  );
  const signature = useMemo(() => signatureOf(inputs), [inputs]);
  const [layout, setLayout] = useState<ArtistMapLayout | null>(() => keptFor(signature));
  const [pins, setPins] = useState<Pins>(readPins);
  useEffect(() => {
    const known = keptFor(signature);
    if (known) {
      setLayout(known);
      return;
    }
    // Nobody yet: the library is still being read. Or nobody looking.
    if (inputs.length === 0 || !inSight) return;
    /*
      A moment after the switch is drawn: laying out a few hundred artists
      from nothing is most of a second on a phone. From the map as it was,
      where there was one, with everybody where they were and only those new
      or changed found a place: see `previous`.
    */
    const timer = setTimeout(() => {
      const made = layoutArtistMap(inputs, { previous: lastKept(), pins: readPins() });
      followOffset(made);
      keep(signature, made);
      setLayout(made);
    }, 60);
    return () => clearTimeout(timer);
  }, [inSight, inputs, signature]);

  const byKey = useMemo(() => new Map(artists.map((artist) => [artist.key, artist])), [artists]);
  // Every cover the map wears found before it is wanted, one after another, so that it is whole by the time it is gone about in.
  useEffect(() => {
    if (!layout || !inSight) return;
    return warmAlbumArtwork(layout.nodes.map((node) => byKey.get(node.key)?.sleeve));
  }, [byKey, inSight, layout]);
  const photos = useMemo(() => {
    try {
      return artistPhotoUris();
    } catch {
      return new Map<string, string>();
    }
  }, []);
  const colourOf = useMemo(() => {
    const colours = new Map<string, string>();
    layout?.genres.forEach((genre, index) => colours.set(genre.name, PALETTE[index % PALETTE.length]!));
    return colours;
  }, [layout]);

  /*
    Round each genre's gathering, a faint bubble of its colour: as far out
    from the middle of its artists as the furthest of them reaches, and a
    little more. Not round a genre of one or two, which is no gathering, nor
    round the artists of no genre.
  */
  const bubbles = useMemo(() => {
    if (!layout) return [];
    /*
      Of those where the map put them: somebody moved by hand to the other
      side of the map is still of their genre, but drawing its bubble round
      them as well spread it over half the map.
    */
    const members = new Map<string, MapNode[]>();
    for (const node of layout.nodes) {
      if (!node.genre || pins[node.key]) continue;
      const held = members.get(node.genre);
      if (held) held.push(node);
      else members.set(node.genre, [node]);
    }
    return [...members.entries()]
      .filter(([, held]) => held.length >= 3)
      .map(([genre, held]) => {
        const x = held.reduce((sum, node) => sum + node.x, 0) / held.length;
        const y = held.reduce((sum, node) => sum + node.y, 0) / held.length;
        const r = Math.max(...held.map((node) => Math.hypot(node.x - x, node.y - y) + node.r)) + 14;
        return { genre, x, y, r };
      });
  }, [layout, pins]);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  // What the drawing knows of where the map is: told when a gesture ends, for which circles show their pictures and names.
  const [seen, setSeen] = useState({ tx: 0, ty: 0, s: 1 });
  // In front unless a page is open over it; another tab open is nothing to it (see `Covered`).
  const focused = !use(Covered);
  /*
    The map as a picture, taken as an artist's page is opened over it, and
    shown in its place for as long as the page is there: the page is glass,
    and draws what is behind it through its frost at every frame it moves.
    The map itself, a few hundred circles, faces and lines, made that a dozen
    frames a second; one picture costs what the page costs over anything.
    Let go of when the map is in front again.
  */
  const whole = useRef<View>(null);
  const [still, setStill] = useState<string | null>(null);
  /*
    Back in front, the map is drawn again under the picture, and the picture
    kept over it a moment more, until the map's faces are on it again, and
    then let fade: the two are the same, so nothing is seen to change. A
    finger on the map lets go of it at once, or the map would move under a
    picture standing still.
  */
  const stillShows = useSharedValue(1);
  const stillStyle = useAnimatedStyle(() => ({ opacity: stillShows.get() }));
  useEffect(() => {
    if (!focused) {
      stillShows.set(1);
      return;
    }
    if (!still) return;
    const fade = setTimeout(() => stillShows.set(withTiming(0, { duration: 250 })), 650);
    const gone = setTimeout(() => setStill(null), 950);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [focused, still, stillShows]);
  const dropStill = () => {
    if (still && focused) setStill(null);
  };
  const openPage = (key: string) => {
    const box = whole.current;
    if (!box || !JukeboxAudio.snapshotAsync) {
      onOpen(key);
      return;
    }
    box.measureInWindow((x, y, width, height) => {
      void JukeboxAudio.snapshotAsync!(x, y, width, height)
        .catch(() => null)
        .then((taken) => {
          setStill(taken);
          onOpen(key);
        });
    });
  };
  const [chosen, setChosen] = useState<number | null>(null);
  // The genre whose bubble was touched, for its card: see `bubbleAt`.
  const [genre, setGenre] = useState<string | null>(null);
  /*
    The lasso: with it on, a finger draws a ring round some of the map
    instead of moving it (see `LassoView.kt`), and those whose middle is
    inside are taken together -- a card says how many and shuffles them, and
    the lasso is put away. The ring stays drawn until it is shuffled, let go
    of, or another is drawn.
  */
  const [lassoOn, setLassoOn] = useState(false);
  /*
    An artist being moved by hand: held a moment and they come up off the
    map and go where the finger takes them, their lines with them, drawn on
    the thread that draws (see `Lifted`); let go, they are kept there, from
    the middle of their genre (see `MapPin`), and the rest settle round them.
  */
  const [dragging, setDragging] = useState<number | null>(null);
  const dragOn = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragFromX = useSharedValue(0);
  const dragFromY = useSharedValue(0);
  // Which, for the letting go: told by the gesture, which knows it when the screen may not have been drawn again yet.
  const dragIndex = useSharedValue(-1);
  // Asking whether everybody moved by hand is to be put back.
  const [askingBack, setAskingBack] = useState(false);
  const [lassoed, setLassoed] = useState<number[] | null>(null);
  const [ringClearedAt, setRingClearedAt] = useState(0);
  /*
    Who is chosen and who lassoed are held by their place on the map, and the
    map laid out again for a song downloaded or taken away puts people in new
    places: the card and its shuffle went to different artists, and with
    somebody gone, to nobody at all, and the map fell over. So they are
    carried over to the new map by who they are.
  */
  const [placedOn, setPlacedOn] = useState(layout);
  if (placedOn !== layout) {
    setPlacedOn(layout);
    const was = placedOn?.nodes ?? [];
    const now = new Map((layout?.nodes ?? []).map((node, index) => [node.key, index]));
    const carried = (index: number) => {
      const key = was[index]?.key;
      return key == null ? undefined : now.get(key);
    };
    if (chosen != null) setChosen(carried(chosen) ?? null);
    if (lassoed) {
      const still = lassoed.map(carried).filter((index) => index != null);
      setLassoed(still.length > 0 ? still : null);
    }
  }
  const lassoOff = () => {
    setLassoOn(false);
    setLassoed(null);
  };

  const settle = () => {
    const now = { tx: tx.get(), ty: ty.get(), s: sc.get() };
    leave(now);
    setSeen(now);
  };
  const fit = () => {
    if (!layout || size.width === 0) return { tx: 0, ty: 0, s: 1 };
    const room = Math.max(1, size.height - top - bottom);
    const s = Math.max(MIN_SCALE, Math.min(1, size.width / layout.width, room / layout.height));
    return { tx: (size.width - layout.width * s) / 2, ty: top + (room - layout.height * s) / 2, s };
  };
  /*
    How far it can be taken: no further off than the whole of it in sight,
    a little smaller, and never so far aside that its edge is more than a
    quarter of the way in from the edge of the screen -- dragged or thrown
    past its edge it was left in the dark with nothing to find the way back
    by, and pinched further off it went down to a speck.
  */
  const edges = useSharedValue<{ w: number; h: number; vw: number; top: number; room: number; minS: number } | null>(null);
  useEffect(() => {
    if (!layout || size.width === 0) return;
    const room = Math.max(1, size.height - top - bottom);
    edges.set({ w: layout.width, h: layout.height, vw: size.width, top, room, minS: fit().s * 0.8 });
  }, [layout, size.width, size.height, top, bottom]);
  // Put where it was left, or the whole of it in sight, once it and the screen are known.
  useEffect(() => {
    if (!layout || size.width === 0) return;
    const start = left ?? fit();
    tx.set(start.tx);
    ty.set(start.ty);
    sc.set(start.s);
    setSeen(start);
  }, [layout, size.width, size.height]);

  /** Brings [node] to the middle of what is clear of the bars, at least as near as [nearer]. */
  const goTo = (node: MapNode, nearer = 0.9) => {
    const s = Math.max(sc.get(), nearer);
    const room = Math.max(1, size.height - top - bottom);
    const to = { tx: size.width / 2 - node.x * s, ty: top + room * 0.4 - node.y * s, s };
    tx.set(withTiming(to.tx, { duration: 380 }));
    ty.set(withTiming(to.ty, { duration: 380 }));
    sc.set(withTiming(to.s, { duration: 380 }));
    leave(to);
    setSeen(to);
  };

  /*
    A genre's bubble brought whole into what is clear of the bars and of the
    card that opens under it, as near as fits: the genre and everybody in it
    at once, the rest of the map round it faint.
  */
  const CARD_ROOM = 150;
  const fitTo = (bubble: { x: number; y: number; r: number }) => {
    const room = Math.max(1, size.height - top - bottom - CARD_ROOM);
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((size.width * 0.92) / (bubble.r * 2), (room * 0.92) / (bubble.r * 2))));
    const to = { tx: size.width / 2 - bubble.x * s, ty: top + room / 2 - bubble.y * s, s };
    tx.set(withTiming(to.tx, { duration: 420 }));
    ty.set(withTiming(to.ty, { duration: 420 }));
    sc.set(withTiming(to.s, { duration: 420 }));
    leave(to);
    setSeen(to);
  };

  /*
    The tab pressed again: first whoever or whatever genre is chosen let go,
    then the whole map brought back into sight; false once it is both, for
    the tab to take its next step.
  */
  const back = () => {
    if (lassoOn) {
      haptic('choices', 'tick');
      lassoOff();
      return true;
    }
    if (chosen != null || genre != null) {
      haptic('choices', 'tick');
      setChosen(null);
      setGenre(null);
      return true;
    }
    if (!layout || size.width === 0) return false;
    const whole = fit();
    const near = Math.abs(tx.get() - whole.tx) < 4 && Math.abs(ty.get() - whole.ty) < 4 && Math.abs(sc.get() - whole.s) < 0.01;
    if (near) return false;
    haptic('choices', 'tick');
    tx.set(withTiming(whole.tx, { duration: 420 }));
    ty.set(withTiming(whole.ty, { duration: 420 }));
    sc.set(withTiming(whole.s, { duration: 420 }));
    leave(whole);
    setSeen(whole);
    return true;
  };
  useEffect(() => {
    register?.(back);
  });

  const nodeAt = (x: number, y: number): number | null => {
    if (!layout) return null;
    const s = sc.get();
    const wx = (x - tx.get()) / s;
    const wy = (y - ty.get()) / s;
    let best: number | null = null;
    let bestD = Infinity;
    layout.nodes.forEach((node, index) => {
      const d = Math.hypot(node.x - wx, node.y - wy) - node.r;
      // A small circle far off is hard to hit: a finger's width either side of it counts.
      if (d < 14 / s && d < bestD) {
        bestD = d;
        best = index;
      }
    });
    return best;
  };
  /** The genre whose bubble is under a point, the smallest where bubbles overlap; null for none. */
  const bubbleAt = (x: number, y: number): string | null => {
    const s = sc.get();
    const wx = (x - tx.get()) / s;
    const wy = (y - ty.get()) / s;
    let best: { genre: string; r: number } | null = null;
    for (const bubble of bubbles) {
      if (Math.hypot(bubble.x - wx, bubble.y - wy) <= bubble.r && (!best || bubble.r < best.r)) best = bubble;
    }
    return best?.genre ?? null;
  };
  const tapAt = (x: number, y: number) => {
    const hit = nodeAt(x, y);
    if (hit != null) {
      haptic('choices', 'click');
      setChosen(hit);
      setGenre(null);
      return;
    }
    // Not an artist but the bubble round a genre: the genre, and who is in it.
    const inside = bubbleAt(x, y);
    if (inside != null && inside !== genre) {
      haptic('choices', 'click');
      setChosen(null);
      setGenre(inside);
      const bubble = bubbles.find((one) => one.genre === inside);
      if (bubble) fitTo(bubble);
      return;
    }
    if (chosen != null || genre != null) haptic('choices', 'tick');
    setChosen(null);
    setGenre(null);
  };
  const zoomAt = (x: number, y: number) => {
    const s = sc.get();
    const next = Math.min(MAX_SCALE, s * 2.2);
    const wx = (x - tx.get()) / s;
    const wy = (y - ty.get()) / s;
    const to = { tx: keptIn(x - wx * next, acrossAt(next)), ty: keptIn(y - wy * next, downAt(next)), s: next };
    tx.set(withTiming(to.tx, { duration: 260 }));
    ty.set(withTiming(to.ty, { duration: 260 }));
    sc.set(withTiming(to.s, { duration: 260 }));
    leave(to);
    setSeen(to);
  };

  /** The furthest off it may be, and the bounds of where it may be put across and down at a nearness of [s]. */
  const leastScale = () => {
    'worklet';
    return Math.max(MIN_SCALE, edges.get()?.minS ?? MIN_SCALE);
  };
  const acrossAt = (s: number): [number, number] => {
    'worklet';
    const e = edges.get();
    if (!e) return [-1e9, 1e9];
    const pad = e.vw * 0.25;
    const a = pad;
    const b = e.vw - pad - e.w * s;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const downAt = (s: number): [number, number] => {
    'worklet';
    const e = edges.get();
    if (!e) return [-1e9, 1e9];
    const pad = e.room * 0.25;
    const a = e.top + pad;
    const b = e.top + e.room - pad - e.h * s;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const keptIn = (value: number, [low, high]: [number, number]) => {
    'worklet';
    return Math.min(high, Math.max(low, value));
  };

  const pickUp = (x: number, y: number) => {
    const hit = nodeAt(x, y);
    const node = hit != null ? layout?.nodes[hit] : null;
    if (hit == null || !node) return;
    haptic('choices', 'click');
    dragFromX.set(node.x);
    dragFromY.set(node.y);
    dragX.set(node.x);
    dragY.set(node.y);
    dragIndex.set(hit);
    dragOn.set(true);
    setChosen(null);
    setGenre(null);
    setDragging(hit);
  };
  // Let go of where it was let go: kept there, and the rest settled round it.
  const drop = (index: number, x: number, y: number) => {
    if (index < 0 || !layout) return;
    const node = layout.nodes[index];
    const pin = node ? pinOf(layout, { genre: node.genre, x, y }) : null;
    if (!node || !pin) return;
    haptic('choices', 'tick');
    const nextPins = { ...pins, [node.key]: pin };
    writeSetting(SETTINGS.artistMapPins, JSON.stringify(nextPins));
    setPins(nextPins);
    const there = { ...layout, nodes: layout.nodes.map((one, at) => (at === index ? { ...one, x, y } : one)) };
    const made = layoutArtistMap(inputs, { previous: there, pins: nextPins, iterations: 30 });
    // Where the map is on the screen, moved with it: see `offset`.
    const s = sc.get();
    const now = { tx: tx.get() - s * (made.offset?.x ?? 0), ty: ty.get() - s * (made.offset?.y ?? 0), s };
    leave(now);
    setSeen(now);
    keep(signature, made);
    setLayout(made);
    setDragging(null);
  };
  const letGo = () => setDragging(null);
  // Everybody moved by hand put back where the map would have them, laid out anew.
  const putBack = () => {
    haptic('choices', 'tick');
    writeSetting(SETTINGS.artistMapPins, '{}');
    setPins({});
    setAskingBack(false);
    const made = layoutArtistMap(inputs);
    forgetWhere();
    keep(signature, made);
    setLayout(made);
  };

  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromS = useSharedValue(1);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  /*
    One finger moves the map and two pinch it, and from the moment a second
    finger is down the touch is the pinch's to its end. The drag had often
    begun already, with the first finger, and went on meanwhile: it moved the
    map against the pinch, and as the fingers came off it threw the map on in
    the way they had been spreading or closing -- off to one corner after
    every pinch nearer and to the other after every pinch further.
  */
  const pinched = useSharedValue(false);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const pan = Gesture.Pan()
    // A finger on the map draws the lasso's ring while it is on, and moves nothing.
    .enabled(!lassoOn)
    .maxPointers(1)
    .onBegin(() => {
      'worklet';
      pinched.set(false);
      runOnJS(dropStill)();
    })
    .onStart(() => {
      'worklet';
      panX.set(tx.get());
      panY.set(ty.get());
    })
    .onUpdate((event) => {
      'worklet';
      if (pinched.get()) return;
      tx.set(keptIn(panX.get() + event.translationX, acrossAt(sc.get())));
      ty.set(keptIn(panY.get() + event.translationY, downAt(sc.get())));
    })
    .onEnd((event) => {
      'worklet';
      if (pinched.get()) return;
      tx.set(withDecay({ velocity: event.velocityX, deceleration: 0.994, clamp: acrossAt(sc.get()) }));
      ty.set(
        withDecay({ velocity: event.velocityY, deceleration: 0.994, clamp: downAt(sc.get()) }, (finished) => {
          'worklet';
          if (finished) runOnJS(settle)();
        })
      );
    });
  const pinch = Gesture.Pinch()
    .enabled(!lassoOn)
    .onStart((event) => {
      'worklet';
      pinched.set(true);
      // Where the map is now: a glide left from a drag stops here.
      cancelAnimation(tx);
      cancelAnimation(ty);
      fromX.set(tx.get());
      fromY.set(ty.get());
      fromS.set(sc.get());
      focusX.set(event.focalX);
      focusY.set(event.focalY);
    })
    .onUpdate((event) => {
      'worklet';
      // A finger already off: where the one left is, is not where the two were between them.
      if (event.numberOfPointers < 2) return;
      const next = Math.min(MAX_SCALE, Math.max(leastScale(), fromS.get() * event.scale));
      // The point of the map first under the fingers stays under them, wherever they go.
      const wx = (focusX.get() - fromX.get()) / fromS.get();
      const wy = (focusY.get() - fromY.get()) / fromS.get();
      sc.set(next);
      tx.set(keptIn(event.focalX - wx * next, acrossAt(next)));
      ty.set(keptIn(event.focalY - wy * next, downAt(next)));
    })
    .onEnd(() => {
      'worklet';
      runOnJS(settle)();
    });
  const tap = Gesture.Tap()
    .enabled(!lassoOn)
    .maxDuration(300)
    .onEnd((event, success) => {
      'worklet';
      if (success) runOnJS(tapAt)(event.x, event.y);
    });
  const doubleTap = Gesture.Tap()
    .enabled(!lassoOn)
    .numberOfTaps(2)
    .onEnd((event, success) => {
      'worklet';
      if (success) runOnJS(zoomAt)(event.x, event.y);
    });
  /*
    Nothing for a finger held on an artist: the list's hold, choosing their
    songs, took the map away for the list to choose them in, and there is
    nothing a hold says here that a tap does not.
  */
  const drag = Gesture.Pan()
    .enabled(!lassoOn)
    .maxPointers(1)
    .activateAfterLongPress(350)
    .onStart((event) => {
      'worklet';
      dragOn.set(false);
      runOnJS(pickUp)(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      if (!dragOn.get()) return;
      const s = sc.get();
      dragX.set(dragFromX.get() + event.translationX / s);
      dragY.set(dragFromY.get() + event.translationY / s);
    })
    .onEnd(() => {
      'worklet';
      if (dragOn.get()) runOnJS(drop)(dragIndex.get(), dragX.get(), dragY.get());
    })
    .onFinalize(() => {
      'worklet';
      dragOn.set(false);
      runOnJS(letGo)();
    });
  // A finger kept still on an artist picks them up; one that moves first moves the map.
  const gesture = Gesture.Race(drag, Gesture.Simultaneous(pan, pinch), Gesture.Exclusive(doubleTap, tap));

  /*
    A view grows from its middle: the map's own corner is put where it
    belongs by moving it as far as growing from the middle moved it the
    other way.
  */
  const halfWidth = layout ? layout.width / 2 : 0;
  const halfHeight = layout ? layout.height / 2 : 0;
  const world = useAnimatedStyle(() => {
    const s = sc.get();
    return {
      transform: [
        { translateX: tx.get() - (1 - s) * halfWidth },
        { translateY: ty.get() - (1 - s) * halfHeight },
        { scale: s },
      ],
    };
  });

  // Whom the search names: everybody else dimmed, and the map taken to the one with the most songs.
  const wanted = query.trim() ? foldForMatch(query) : '';
  const matches = useMemo(() => {
    if (!layout || !wanted) return null;
    const found = new Set<number>();
    layout.nodes.forEach((node, index) => {
      if (foldForMatch(node.name).includes(wanted)) found.add(index);
    });
    return found;
  }, [layout, wanted]);
  useEffect(() => {
    if (!layout || !matches || matches.size === 0) return;
    const timer = setTimeout(() => {
      const best = [...matches].sort((a, b) => layout.nodes[b]!.songs - layout.nodes[a]!.songs)[0];
      const node = best != null ? layout.nodes[best] : null;
      if (node) goTo(node, 0.6);
    }, 450);
    return () => clearTimeout(timer);
  }, [matches]);

  // The artists with the most songs, named however far off the map is: something to find one's way by.
  const big = useMemo(() => {
    const most = new Set<number>();
    if (!layout) return most;
    [...layout.nodes.keys()].sort((a, b) => layout.nodes[b]!.songs - layout.nodes[a]!.songs).slice(0, 12).forEach((index) => most.add(index));
    return most;
  }, [layout]);
  const lit = useMemo(() => {
    const near = new Set<number>();
    if (chosen == null || !layout) return near;
    near.add(chosen);
    for (const link of layout.links) {
      if (link.a === chosen) near.add(link.b);
      if (link.b === chosen) near.add(link.a);
    }
    return near;
  }, [chosen, layout]);

  if (!layout) {
    return (
      <View style={styles.box}>
        <Text style={[styles.waiting, { marginTop: top + 40 }]}>{t.library.screen.artistMap.drawing}</Text>
      </View>
    );
  }

  // What is in sight, in the map's own measure, with a margin: only there are pictures worth loading.
  const view = {
    left: (0 - seen.tx) / seen.s - 200,
    top: (0 - seen.ty) / seen.s - 200,
    right: (size.width - seen.tx) / seen.s + 200,
    bottom: (size.height - seen.ty) / seen.s + 200,
  };
  /*
    What is drawn at all: what is in sight with a screen's breadth all round
    it, for a drag to carry into before the map is drawn again where it came
    to rest. Every circle and line is a thing drawn at every frame the map
    moves, and on a phone a few years old a few hundred of each were more
    than a frame had time for; off the screen, they are drawn for nothing.
  */
  const spare = Math.max(size.width, size.height) / seen.s;
  const drawn = {
    left: view.left - spare,
    top: view.top - spare,
    right: view.right + spare,
    bottom: view.bottom + spare,
  };
  const within = (node: MapNode) => node.x + node.r > drawn.left && node.x - node.r < drawn.right && node.y + node.r > drawn.top && node.y - node.r < drawn.bottom;
  /*
    And the lines: from far off, where the whole map is in sight and a line
    is a hair across it, only those that say most -- two who share more than
    one song, or one of the artists named on the map -- and the chosen one's
    all; near, every line with an end in what is drawn.
  */
  const far = seen.s < 0.6;
  const linked = layout.links.filter((link) => {
    // The one being moved draws their own, as they go: see `Lifted`.
    if (dragging != null && (link.a === dragging || link.b === dragging)) return false;
    if (chosen != null && (link.a === chosen || link.b === chosen)) return true;
    const a = layout.nodes[link.a]!;
    const b = layout.nodes[link.b]!;
    if (!within(a) && !within(b)) return false;
    return !far || link.weight > 1 || big.has(link.a) || big.has(link.b);
  });
  /*
    How near the map is, in steps rather than exactly: what is drawn at a
    size of its own -- the names, the lines, the rings -- is drawn again only
    when the map has come a step nearer or further, and not for every pinch
    that ends a little way off from the last.
  */
  const lod = Math.pow(1.4, Math.round(Math.log(seen.s) / Math.log(1.4)));
  const chosenNode = chosen != null ? layout.nodes[chosen] : null;
  /*
    The genre touched: its name as words are written, its artists by how many
    songs they have, and their songs, each once, for shuffling the genre.
  */
  const genreCard = (() => {
    if (genre == null) return null;
    const members = layout.nodes.filter((node) => node.genre === genre).sort((a, b) => b.songs - a.songs);
    const seenIds = new Set<string>();
    const tracks: EnrichedTrack[] = [];
    for (const member of members) {
      for (const track of byKey.get(member.key)?.tracks ?? []) {
        if (seenIds.has(track.id)) continue;
        seenIds.add(track.id);
        tracks.push(track);
      }
    }
    const name = genre.replace(/(^|[\s-])(\p{L})/gu, (_all, before: string, letter: string) => before + letter.toUpperCase());
    return { name, members, tracks };
  })();
  const chosenArtist = chosenNode ? byKey.get(chosenNode.key) : undefined;
  // A ring drawn: its points from the screen onto the map, and who is inside it.
  const ringDrawn = (points: number[]) => {
    const s = sc.get();
    const x0 = tx.get();
    const y0 = ty.get();
    const ring = points.map((value, at) => (at % 2 === 0 ? (value - x0) / s : (value - y0) / s));
    const inside = nodesInside(layout.nodes, ring);
    if (inside.length === 0) {
      haptic('choices', 'tick');
      setLassoed(null);
      setRingClearedAt((at) => at + 1);
      return;
    }
    haptic('choices', 'click');
    setChosen(null);
    setGenre(null);
    setLassoed(inside);
  };
  const lassoSet = lassoed ? new Set(lassoed) : null;
  const lassoCard = (() => {
    if (!lassoed) return null;
    const members = lassoed.map((index) => layout.nodes[index]!).sort((a, b) => b.songs - a.songs);
    const seenIds = new Set<string>();
    const tracks: EnrichedTrack[] = [];
    for (const member of members) {
      for (const track of byKey.get(member.key)?.tracks ?? []) {
        if (seenIds.has(track.id)) continue;
        seenIds.add(track.id);
        tracks.push(track);
      }
    }
    return { members, tracks };
  })();
  const partners = chosen == null ? [] : [...lit].filter((index) => index !== chosen).map((index) => layout.nodes[index]!);

  return (
    <View
      ref={whole}
      collapsable={false}
      style={styles.box}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      {/*
        While a page is over it, a picture of the map as it was left, taken as
        the page was opened, and nothing else: see `openPage`. With no picture
        to show, the bubbles alone, below.
      */}
      {!focused && still ? null : (
      <>
      <GestureDetector gesture={gesture}>
        <View style={styles.box} collapsable={false}>
          <Animated.View
            pointerEvents="none"
            style={[styles.world, { width: layout.width, height: layout.height }, world]}>
            {bubbles.map((bubble) => {
              const colour = colourOf.get(bubble.genre) ?? '#9e9e9e';
              return (
                <View
                  key={`b:${bubble.genre}`}
                  style={[
                    styles.bubble,
                    {
                      left: bubble.x - bubble.r,
                      top: bubble.y - bubble.r,
                      width: bubble.r * 2,
                      height: bubble.r * 2,
                      borderRadius: bubble.r,
                      backgroundColor: `${colour}14`,
                      borderColor: `${colour}40`,
                      // Another genre's, while one is chosen: faint with the artists in it.
                      opacity: genre != null && bubble.genre !== genre ? 0.25 : 1,
                      borderWidth: 1.5 / Math.min(1, lod),
                    },
                  ]}
                />
              );
            })}
            {/*
              The artists and their lines only while the map is the page in
              front. A page opened over it is glass, and draws what is behind
              it again through its frost at every frame: with a few hundred
              circles, faces and lines under it, every page and menu opened
              from the map went at a dozen frames a second. Where no picture
              of the map could be taken, the bubbles stay, for the frost to
              have the map's colours to show.
            */}
            {(focused ? linked : []).map((link) => {
              const a = layout.nodes[link.a]!;
              const b = layout.nodes[link.b]!;
              const length = Math.hypot(b.x - a.x, b.y - a.y);
              const on = chosen != null && (link.a === chosen || link.b === chosen);
              const thick = (on ? 2.5 : 1) * Math.min(4, 0.8 + link.weight * 0.6) / Math.min(1, lod);
              return (
                <View
                  key={`${link.a}:${link.b}`}
                  style={[
                    styles.link,
                    {
                      left: (a.x + b.x) / 2 - length / 2,
                      top: (a.y + b.y) / 2 - thick / 2,
                      width: length,
                      height: thick,
                      backgroundColor: on ? c.accent : c.textMuted,
                      // The rest of the lines half as faint as they were: still there, behind the chosen.
                      opacity: on
                        ? 0.95
                        : genre != null && (a.genre !== genre || b.genre !== genre)
                          ? 0.06
                          : chosen != null || matches
                            ? 0.19
                            : 0.3,
                      transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
                    },
                  ]}
                />
              );
            })}
            {(focused ? layout.nodes : NO_NODES).map((node, index) => {
              /*
                How faint: well back outside a chosen genre, which is to be
                seen apart from the rest; half way, beside a chosen artist or
                a name searched for, where the rest still matters.
              */
              const fade =
                index === dragging
                  ? 0
                  : (lassoSet != null && !lassoSet.has(index)) || (genre != null && node.genre !== genre)
                  ? 0.2
                  : (matches != null && !matches.has(index)) || (chosen != null && !lit.has(index))
                    ? 0.59
                    : 1;
              return (
                <Dot
                  key={node.key}
                  node={node}
                  artist={byKey.get(node.key)}
                  photo={photos.get(node.key)}
                  colour={colourOf.get(node.genre ?? '') ?? '#9e9e9e'}
                  /*
                    Every one with their picture, near or far, in sight or
                    not: the map laid out whole, once, and gone about in.
                    Put on as they came into sight, the pictures were seen
                    arriving behind every drag. Named only when chosen.
                  */
                  picture
                  named={index === chosen}
                  scale={lod}
                  chosen={index === chosen}
                  fade={fade}
                />
              );
            })}
            {dragging != null && layout.nodes[dragging] ? (
              <Lifted
                node={layout.nodes[dragging]}
                others={layout.links
                  .filter((link) => link.a === dragging || link.b === dragging)
                  .map((link) => ({ node: layout.nodes[link.a === dragging ? link.b : link.a]!, weight: link.weight }))}
                x={dragX}
                y={dragY}
                colour={c.accent}
                scale={lod}>
                <Dot
                  node={layout.nodes[dragging]}
                  artist={byKey.get(layout.nodes[dragging].key)}
                  photo={photos.get(layout.nodes[dragging].key)}
                  colour={colourOf.get(layout.nodes[dragging].genre ?? '') ?? '#9e9e9e'}
                  picture
                  named
                  scale={lod}
                  chosen
                  fade={1}
                />
              </Lifted>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
      </>
      )}
      {still ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stillStyle]}>
          <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="fill" />
        </Animated.View>
      ) : null}

      {/* The lasso's ring, over the map while the lasso is on: see `LassoView.kt`. */}
      {lassoOn && focused ? (
        <NativeLasso
          style={StyleSheet.absoluteFill}
          colour={c.accent}
          clear={ringClearedAt}
          onLasso={(event) => ringDrawn(event.nativeEvent.points)}
        />
      ) : null}
      {lassoOn && !lassoed ? (
        <View pointerEvents="none" style={[styles.lassoHint, { top: top + 16 }]}>
          <Text style={styles.lassoHintText} numberOfLines={2}>
            {t.library.screen.artistMap.lassoHint}
          </Text>
        </View>
      ) : null}
      {/* The lasso, at the map's top right, over it and still as it moves. */}
      {focused ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.library.screen.artistMap.lasso}
          accessibilityState={{ selected: lassoOn }}
          hitSlop={6}
          style={[styles.lassoButton, { top: top + 10 }, lassoOn && styles.lassoButtonOn]}
          onPress={() => {
            haptic('choices', lassoOn ? 'toggleOff' : 'toggleOn');
            if (lassoOn) {
              lassoOff();
              return;
            }
            setChosen(null);
            setGenre(null);
            setLassoOn(true);
          }}>
          <LassoIcon size={22} color={lassoOn ? c.onPrimary : c.text} />
        </Pressable>
      ) : null}

      {/* Those moved by hand put back, where there are any: at the map's top left, across from the lasso. */}
      {focused && !lassoOn && Object.keys(pins).length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.library.screen.artistMap.putBackAll}
          hitSlop={6}
          style={[styles.lassoButton, styles.putBackButton, { top: top + 10 }]}
          onPress={() => {
            haptic('choices', 'tick');
            setChosen(null);
            setGenre(null);
            setAskingBack(true);
          }}>
          <RefreshIcon size={20} color={c.text} />
        </Pressable>
      ) : null}
      {askingBack ? (
        <View style={[styles.card, { bottom: bottom + 10 }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardWords}>
              <Text style={styles.cardName} numberOfLines={1}>
                {t.library.screen.artistMap.movedByHand}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {t.common.artists(Object.keys(pins).length)}
              </Text>
            </View>
            <Button
              kind="secondary"
              size="small"
              label={t.common.close}
              mark={(ink) => <CrossIcon size={ICON} color={ink} />}
              onPress={() => setAskingBack(false)}
            />
            <Button
              label={t.library.screen.artistMap.putBack}
              kind="primary"
              size="small"
              onPress={putBack}
            />
          </View>
        </View>
      ) : null}
      {lassoCard ? (
        <View style={[styles.card, { bottom: bottom + 10 }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardWords}>
              <Text style={styles.cardName} numberOfLines={1}>
                {t.library.screen.artistMap.lassoChosen}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {`${t.common.artists(lassoCard.members.length)} · ${t.common.tracks(lassoCard.tracks.length)}`}
              </Text>
            </View>
            <Button
              kind="secondary"
              size="small"
              label={t.common.close}
              mark={(ink) => <CrossIcon size={ICON} color={ink} />}
              onPress={() => {
                haptic('choices', 'tick');
                setLassoed(null);
                setRingClearedAt((at) => at + 1);
              }}
            />
            <Button
              kind="primary"
              size="small"
              label={t.library.screen.artistMap.shuffle}
              mark={(ink) => <ShuffleIcon size={ICON} color={ink} />}
              onPress={() => {
                onShuffle(lassoCard.tracks);
                lassoOff();
              }}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partners}>
            {lassoCard.members.map((member) => (
              <Pressable
                key={member.key}
                style={styles.partner}
                onPress={() => {
                  haptic('choices', 'click');
                  lassoOff();
                  setChosen(layout.nodes.indexOf(member));
                  goTo(member, Math.max(0.9, sc.get()));
                }}>
                <Text style={styles.partnerText} numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {genreCard ? (
        <View style={[styles.card, { bottom: bottom + 10 }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardWords}>
              <Text style={styles.cardName} numberOfLines={1}>
                {genreCard.name}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {`${t.common.artists(genreCard.members.length)} · ${t.common.tracks(genreCard.tracks.length)}`}
              </Text>
            </View>
            <Button
              kind="secondary"
              size="small"
              label={t.library.screen.artistMap.shuffle}
              mark={(ink) => <ShuffleIcon size={ICON} color={ink} />}
              onPress={() => onShuffle(genreCard.tracks)}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partners}>
            {genreCard.members.map((member) => (
              <Pressable
                key={member.key}
                style={styles.partner}
                onPress={() => {
                  haptic('choices', 'click');
                  setGenre(null);
                  setChosen(layout.nodes.indexOf(member));
                  goTo(member, Math.max(0.9, sc.get()));
                }}>
                <Text style={styles.partnerText} numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {chosenNode ? (
        <View style={[styles.card, { bottom: bottom + 10 }]}>
          <View style={styles.cardTop}>
            <Pressable style={styles.cardWords} onPress={() => openPage(chosenNode.key)}>
              <Text style={styles.cardName} numberOfLines={1}>
                {chosenNode.name}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {[
                  t.common.tracks(chosenNode.songs),
                  chosenArtist ? t.common.albums(chosenArtist.albums.length) : null,
                  chosenNode.genre,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
            <Button
              kind="secondary"
              size="small"
              label={t.library.screen.artistMap.shuffle}
              mark={(ink) => <ShuffleIcon size={ICON} color={ink} />}
              onPress={() => chosenArtist && onShuffle(chosenArtist.tracks)}
            />
            <Button
              label={t.library.screen.artistMap.open}
              kind="primary"
              size="small"
              onPress={() => openPage(chosenNode.key)}
            />
          </View>
          {partners.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partners}>
              <Text style={styles.with}>{t.library.screen.artistMap.with}</Text>
              {partners
                .sort((a, b) => b.songs - a.songs)
                .map((partner) => (
                  <Pressable
                    key={partner.key}
                    style={styles.partner}
                    onPress={() => {
                      haptic('choices', 'click');
                      setChosen(layout.nodes.indexOf(partner));
                      goTo(partner, Math.max(0.9, sc.get()));
                    }}>
                    <Text style={styles.partnerText} numberOfLines={1}>
                      {partner.name}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

/** One artist's circle: their genre's colour, and near enough their picture and name. */
const Dot = memo(function Dot({
  node,
  artist,
  photo,
  colour,
  picture,
  named,
  scale,
  chosen,
  fade,
}: {
  node: MapNode;
  artist: Artist | undefined;
  photo: string | undefined;
  colour: string;
  picture: boolean;
  named: boolean;
  scale: number;
  chosen: boolean;
  /** How much of it shows: 1, or less where something else is chosen. */
  fade: number;
}) {
  const styles = useStyles();
  const ring = Math.max(1.5, 2.5 / Math.max(scale, 0.4));
  return (
    <View
      style={[
        styles.dot,
        {
          left: node.x - node.r,
          top: node.y - node.r,
          width: node.r * 2,
          height: node.r * 2,
          borderRadius: node.r,
          backgroundColor: colour,
          // A ring only round the one chosen: one in its own colour round the rest was a second circle drawn for nothing.
          borderWidth: chosen ? ring * 2 : 0,
          borderColor: '#ffffff',
          opacity: fade,
        },
      ]}>
      {picture && artist ? <Face artist={artist} photo={photo} size={node.r * 2} /> : null}
      {named ? (
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            {
              top: node.r * 2 + 3 / scale,
              // As wide on screen however near the map is: a name of a few words, not cut off far out.
              width: 180 / scale,
              left: node.r - 90 / scale,
              fontSize: TYPE.hint / scale,
            },
          ]}>
          {node.name}
        </Text>
      ) : null}
    </View>
  );
});

/** Their photograph where one has been found, otherwise the cover that stands for them. */
/*
  [size] across on the map as laid out (the map is then drawn nearer or
  further as a whole, the picture with it, as it is read at this size): the
  small copy of the picture where that is small (see `lib/media/thumbs`), as
  most of them are -- some three hundred photographs read whole each time the
  map came back into view were most of the wait for it.
*/
function Face({ artist, photo, size }: { artist: Artist; photo: string | undefined; size: number }) {
  const cover = useAlbumArtwork(photo ? null : artist.sleeve);
  const uri = photo ?? cover;
  return uri ? <Image source={{ uri }} style={faceStyle} contentFit="cover" recyclingKey={artist.key} drawnAt={size} /> : null;
}
const faceStyle = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: RADIUS.pill } as const;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    box: { flex: 1, overflow: 'hidden' },
    world: { position: 'absolute', left: 0, top: 0 },
    waiting: { color: c.textMuted, textAlign: 'center' },
    link: { position: 'absolute', borderRadius: 2 },
    bubble: { position: 'absolute' },
    dot: { position: 'absolute', overflow: 'visible' },
    name: { position: 'absolute', textAlign: 'center', color: c.text, fontWeight: '600' },
    card: {
      position: 'absolute',
      left: 10,
      right: 10,
      padding: SPACE.m,
      gap: 10,
      borderRadius: 16,
      backgroundColor: c.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
      // A shadow only under a card that hides it: under one of glass it showed through, a darker box inside the card.
      elevation: glassOf(c) > 0 ? 0 : 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardWords: { flex: 1, minWidth: 0 },
    cardName: { color: c.text, fontSize: TYPE.heading, fontWeight: '700' },
    cardDetail: { color: c.textMuted, fontSize: TYPE.hint },
    lassoButton: {
      position: 'absolute',
      right: 12,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
    },
    lassoButtonOn: { backgroundColor: c.accent, borderColor: c.accent },
    putBackButton: { right: undefined, left: 12 },
    lassoHint: { position: 'absolute', left: 12, right: 66, alignItems: 'flex-start' },
    lassoHintText: {
      color: c.text,
      fontSize: TYPE.small,
      backgroundColor: c.surfaceRaised,
      paddingHorizontal: SPACE.m,
      paddingVertical: 7,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
    },
    partners: { gap: 6, alignItems: 'center' },
    with: { color: c.textFaint, fontSize: TYPE.hint },
    partner: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.card, backgroundColor: c.surface },
    partnerText: { color: c.text, fontSize: TYPE.small },
  })
);

/**
 * An artist being moved by hand: their circle where the finger has them, and
 * a line from each they share songs with, all moved on the thread that draws
 * as the finger goes, the rest of the map left as it is.
 */
function Lifted({
  node,
  others,
  x,
  y,
  colour,
  scale,
  children,
}: {
  node: MapNode;
  others: { node: MapNode; weight: number }[];
  x: SharedValue<number>;
  y: SharedValue<number>;
  colour: string;
  scale: number;
  children: ReactNode;
}) {
  const carried = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() - node.x }, { translateY: y.get() - node.y }],
  }));
  return (
    <>
      {others.map((other) => (
        <LiftedLine key={other.node.key} from={other.node} x={x} y={y} colour={colour} thick={(2 * Math.min(4, 0.8 + other.weight * 0.6)) / Math.min(1, scale)} />
      ))}
      <Animated.View style={[liftedStyles.carried, carried]}>{children}</Animated.View>
    </>
  );
}

/** How long a line is drawn before it is stretched to its length: see `LiftedLine`. */
const LINE_BASE = 1000;

/** One line from [from] to where the finger has the artist being moved: stretched and turned, never laid out again. */
function LiftedLine({ from, x, y, colour, thick }: { from: MapNode; x: SharedValue<number>; y: SharedValue<number>; colour: string; thick: number }) {
  const line = useAnimatedStyle(() => {
    const dx = x.get() - from.x;
    const dy = y.get() - from.y;
    return {
      transform: [
        { translateX: (from.x + x.get()) / 2 - LINE_BASE / 2 },
        { translateY: (from.y + y.get()) / 2 },
        { rotate: `${Math.atan2(dy, dx)}rad` },
        { scaleX: Math.hypot(dx, dy) / LINE_BASE },
      ],
    };
  });
  return <Animated.View style={[liftedStyles.line, { height: thick, top: -thick / 2, backgroundColor: colour }, line]} />;
}

const liftedStyles = StyleSheet.create({
  carried: { position: 'absolute', left: 0, top: 0 },
  line: { position: 'absolute', left: 0, width: LINE_BASE, opacity: 0.9 },
});

/** The lasso's ring, drawn on the phone itself as the finger goes: see `LassoView.kt`. */
const NativeLasso = requireNativeViewManager<{
  style?: object;
  colour: string;
  /** A new number, and the ring drawn last goes. */
  clear: number;
  /** The ring, as the points it went through in points on the screen: x, y, x, y… */
  onLasso: (event: { nativeEvent: { points: number[] } }) => void;
}>('JukeboxAudio', 'LassoView');
