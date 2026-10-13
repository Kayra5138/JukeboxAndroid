import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Image } from './Picture';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork, warmArtwork } from '../lib/media/artwork';
import type { Album } from '../lib/media/albums';
import { laid, makeStyles } from '../lib/theme/index';

/**
 * A rack of records you flick through, with the one in front turned to face
 * you and the rest fanned away behind it.
 *
 * Sideways only. The shape is records turned about a vertical axis and seen
 * from the side, which needs width; held upright the rack had to stack them
 * instead, and a pile of slabs seen from above is neither a shelf nor a
 * quicker way to find anything than the list already there. The screen that
 * draws this is the one that decides, and it only draws it in landscape.
 *
 * Two layers rather than one. A scroll view underneath carries nothing but
 * empty spacers and exists for its physics — the flick, the deceleration, the
 * snap — and a layer of cards above it is positioned entirely by transforms
 * driven from that scroll offset. Laying the cards out as the scroll view's own
 * children cannot work: they overlap by more than their own width, and a scroll
 * view lays its children end to end.
 *
 * Every transform runs on the native driver, so a flick through a hundred
 * records is the compositor's work and not JavaScript's. Only the cards near
 * the front are mounted at all — the ones that show and a few past them either
 * side, see {@link AHEAD}; the rest would be a hundred animated views to draw
 * nine.
 *
 * Which cards those are is the one thing JavaScript does decide, a detent at a
 * time, and it hears where the rail is a little after the rail is there. So
 * everything a detent costs here is kept small: a flick that outruns it shows
 * as sleeves turning up late, which is the fault this file has had most often.
 */

/**
 * How many cards either side of the front one are worth drawing.
 *
 * As many as the tables below place. The sleeve in front is sized against the
 * frame's shorter way round — its height — so there is width going spare
 * either side of it, and a rack that stops halfway across looks like a rack
 * that ran out of records.
 */
const NEIGHBOURS = 7;

/**
 * How many more are kept mounted past the last one that shows, either side.
 *
 * A sleeve is mounted from here, where the scroll is heard about a frame or
 * more after it happened, and its picture is read off the disk only once it
 * is. Mounted exactly where it starts to show, it had no time for either: one
 * detent of lag and it faded in late, and its picture later still. These are
 * the head start — drawn at no opacity, so they cost the compositor nothing,
 * but there, with their pictures in hand, by the time the rack reaches them.
 *
 * Not more, because each is a picture held in memory and a handful of
 * animated values the native driver works out every frame of a scroll.
 */
const AHEAD = 4;

/**
 * Turn on to have the rack say how it kept up, each time it comes to rest.
 *
 * Off, and nothing below is reached: no listener is given to the pictures and
 * nothing is counted. On, it writes one line to the log per flick — see
 * {@link tally} for what the numbers are. Not for leaving on.
 */
const MEASURE = false;

/**
 * What {@link MEASURE} counts between one rest and the next.
 *
 * `gap` is the longest JavaScript went without hearing of the scroll, which
 * should be a frame or two; `jump` the most sleeves that went by between two
 * hearings. `decoded` are the pictures that had to be read off the disk rather
 * than found in memory, and `late` the ones that arrived on a sleeve already
 * showing — which is the thing that is seen — with `nearest` how close to the
 * front the worst of them was.
 */
const AT_REST = { last: 0, gap: 0, passed: 0, jump: 0, pictures: 0, decoded: 0, late: 0, nearest: NEIGHBOURS };
const tally = { ...AT_REST, front: 0 };

function countScroll(index: number) {
  const now = performance.now();
  if (tally.last > 0) tally.gap = Math.max(tally.gap, now - tally.last);
  tally.last = now;
  const moved = Math.abs(index - tally.front);
  tally.front = index;
  tally.passed += moved;
  tally.jump = Math.max(tally.jump, moved);
}

function countPicture(away: number, from: string) {
  tally.pictures += 1;
  if (from !== 'memory') tally.decoded += 1;
  if (away >= NEIGHBOURS) return;
  tally.late += 1;
  tally.nearest = Math.min(tally.nearest, away);
}

function reportFlick() {
  if (tally.passed > 0 || tally.pictures > 0) {
    console.log(
      `[rack] passed ${tally.passed} sleeves, at most ${tally.jump} between two scroll events, ` +
        `${Math.round(tally.gap)} ms the longest wait for one; ${tally.pictures} pictures, ` +
        `${tally.decoded} off the disk, ${tally.late} onto a sleeve already showing` +
        (tally.late > 0 ? ` (nearest ${tally.nearest.toFixed(1)} from the front)` : '')
    );
  }
  Object.assign(tally, AT_REST);
}

/**
 * Where each record sits, as a share of a sleeve's width from the middle, and
 * how much of its size it has left by the time it gets there. One entry per
 * step back through the rack.
 *
 * The first step is the big one — far enough for a sleeve to clear the edge of
 * the one in front and show itself at all. After that they close up, 0.15 down
 * to 0.07, every one of them less than the 0.31 of a sleeve's width that a
 * sleeve turned this far still covers. So they overlap, and each shows a slice
 * of itself past the one in front of it. That overlap is the rack. Space them
 * by more than they cover and the shelf comes apart into separate slabs with
 * the background showing between them, which is what happened when these ran
 * out to 1.20.
 *
 * They also shrink, which has to be said explicitly: turning a card about one
 * axis leaves every card the same distance from the eye, so perspective alone
 * makes nothing recede.
 *
 * Before either, these stopped at the second neighbour and clamped — so
 * everything past it was drawn at the same place, at the same size, as the
 * second. Five records and a pile behind each end, which is what read as a
 * carousel rather than a rack.
 */
const SPREAD = [0, 0.46, 0.61, 0.74, 0.85, 0.94, 1.02, 1.09];
const SCALE = [1, 0.90, 0.86, 0.83, 0.80, 0.78, 0.76, 0.74];

/**
 * How far a record is turned once it is off the front.
 *
 * Steep, because a rack is records filed on their edges with one pulled half
 * out to be looked at. Shallower reads as a row of sleeves leaning over.
 */
const ANGLE = 72;

/**
 * How much of the way out a sleeve has to be before it is fully turned.
 *
 * Small, so the one in front is the only one facing you and everything else
 * is on its edge. Interpolating the angle evenly leaves the neighbours half
 * turned, which reads as a row of records leaning rather than a rack.
 */
const TURN_BY = 0.45;

/** Depth of the perspective. Smaller is a wider lens and a harsher fan. */
const PERSPECTIVE = 900;

/** Room the name of what is in front takes, and how far it sits off the floor. */
const CAPTION_HEIGHT = 52;
const CAPTION_LIFT = 18;

/** The margin the rack keeps from the edges of whatever it is given. */
const EDGE = 10;

/**
 * How far off a detent is close enough to leave alone, in sleeves.
 *
 * Load-bearing rather than a tidy-up. Scrolling somewhere ends in a momentum
 * event whether a finger or the code caused it, so a settle that always
 * scrolls answers its own event and asks again, for ever — which looks exactly
 * like a hung screen, because the queue never empties and nothing else gets
 * a turn. This is what ends it: the second time round the rail is already
 * there, so nothing more is asked.
 */
const SQUARE_ENOUGH = 0.01;

/**
 * Above this, a release was a throw and has momentum coming after it.
 *
 * In points a millisecond, which is what the release reports. Low enough that
 * a finger coming to rest counts as a stop, high enough that a gentle push
 * still flies.
 */
const FLICK = 0.05;

/**
 * Which sleeve the rack is sized to hold, counting out from the front.
 *
 * Not the outermost. The last one runs off the edge of the frame and is meant
 * to — that is where the rack stops looking like it ends, and it is what the
 * thing this is drawn after does too. Sizing for every one of them would take
 * it off the sleeve in front, which is the one anybody is actually looking at.
 */
const FITS_TO = 3;

/**
 * How far that sleeve reaches from the middle, in sleeves.
 *
 * Its centre is [SPREAD] out, and from there it reaches half its own width —
 * but that width is not a sleeve's. It is turned nearly on edge and shrunk,
 * and what it covers is what is left after both: the cosine of the angle it is
 * turned through, times how much of its size it kept.
 *
 * Counting it as half a full sleeve is what left the rack small inside a frame
 * it was supposedly measured against.
 */
const HALF_SPAN =
  SPREAD[FITS_TO]! + 0.5 * SCALE[FITS_TO]! * Math.cos((ANGLE * Math.PI) / 180);

/** How much of a sleeve its reflection takes up on the shelf below it. */
const MIRROR = 0.38;

/** Where a sleeve is on the glass, measured from the window's top left. */
export type Sleeve = { x: number; y: number; width: number; height: number };

/** What the screen holding the rack can ask of it. */
export type Rack = {
  /**
   * Where a record's sleeve is now, or null if it is not the one square on.
   *
   * Asked when a record that was opened is being put back, which can be long
   * after it was taken out: the phone may have been turned since, or the
   * player's panel may have arrived and taken a share of the width. Where the
   * sleeve was when it was tapped is not where it has to be returned to.
   */
  sleeveOf: (key: string, then: (sleeve: Sleeve | null) => void) => void;
};

export function CoverFlow({
  albums,
  onOpen,
  onHold,
  ref,
}: {
  albums: Album[];
  /**
   * Open the record in front, given where its sleeve is so that whatever
   * opens can start out as that sleeve.
   */
  onOpen: (album: Album, sleeve: Sleeve) => void;
  /** The record in front, held down: the same menu a held row of the list opens. */
  onHold?: (album: Album) => void;
  ref?: Ref<Rack>;
}) {
  const t = useT();
  const styles = useStyles();
  /*
    Its own size, not the window's. The rack sits under a header and over a tab
    bar, and centring on the window put the front record low enough to sit on
    top of the caption — which is what the whole layout is measured from.
  */
  const [{ width, height }, setBox] = useState({ width: 0, height: 0 });

  /*
    The card, and how far apart two of them sit. The gap is much less than the
    width — that overlap is the whole look — and it is also the distance the
    scroll view snaps to, so the two cannot drift apart.
  */
  /*
    As large as the frame allows.

    Two things bound it. Across the rack, the fan — whose outermost sleeve is
    turned almost on edge and so takes far less room than a sleeve's width.
    Through it, the reflection below: a sleeve big enough to push its own
    reflection out of the frame has taken the room from the thing that made it
    look like a rack.

    The caption is drawn over the reflection rather than given a row of its
    own, so it costs nothing here.
  */
  const along = Math.max(0, width - EDGE * 2);
  const across = Math.max(0, height - EDGE * 2);
  const card = Math.min(along / (HALF_SPAN * 2), across / (1 + MIRROR));
  const mirror = card * MIRROR;
  const step = card * 0.52;

  const viewport = width;
  const lead = Math.max(0, (viewport - step) / 2);

  // Kept as state and not in a ref: it is read while drawing, every time.
  const [scroll] = useState(() => new Animated.Value(0));
  const rail = useRef<ScrollView>(null);
  const stage = useRef<View>(null);
  const [front, setFront] = useState(0);

  /**
   * Where the rail is, in sleeves. A whole number means a record is square on.
   *
   * Read from the value the cards are drawn from rather than from a listener,
   * so it cannot lag behind what is on screen.
   */
  const at = useRef(0);

  /**
   * Puts the rail on the nearest detent, if it is not on one already.
   *
   * `snapToInterval` does this for a flick and only for a flick: let go
   * without throwing it and Android leaves the rail exactly where the finger
   * stopped. A record resting between two detents is a record drawn part way
   * through its turn — and it could be tapped in that state, which opened it
   * crooked and left it that way.
   */
  const settle = useCallback(() => {
    const nearest = Math.round(at.current);
    if (Math.abs(at.current - nearest) < SQUARE_ENOUGH) return;
    rail.current?.scrollTo(
      { x: nearest * step, animated: true }
    );
  }, [step]);

  /** True when a record is square on, near enough to be worth opening. */
  const squared = () => Math.abs(at.current - Math.round(at.current)) < SQUARE_ENOUGH;

  /**
   * Where the sleeve in front is on the glass.
   *
   * Only the frame is measured, and the sleeve is placed inside it by the same
   * arithmetic that draws it. Measuring the sleeve itself would be asking the
   * layout about a view that is put where it is by transforms the layout never
   * hears of — they are the native driver's, set from the scroll — and the
   * answer is where the record would have been with the rail at its start.
   * Square on, those transforms come to nothing, so what is left is the middle
   * of the frame across and the middle of what the reflection leaves through.
   */
  const sleeve = (then: (found: Sleeve | null) => void) => {
    const frame = stage.current;
    if (!frame) return then(null);
    frame.measureInWindow((x, y) =>
      then({
        x: x + (width - card) / 2,
        y: y + (height - mirror - card) / 2,
        width: card,
        height: card,
      })
    );
  };

  /**
   * Opens the record in front, or brings it round first.
   *
   * Tapped mid-flick it is square to nothing, and whatever it opens into would
   * set out from a sleeve that is not where it was said to be. So it is settled
   * and opening waits for the next tap.
   *
   * Which record is in front is asked of the rail, here and in the two below,
   * and not taken from `front`. They are the same number — `front` is this,
   * rounded, by the same scroll event — but one that is read when a finger
   * lands rather than when the rack is drawn. Taken from `front`, each of
   * these was a new function at every detent and was handed to every sleeve
   * and every slot, so passing a record redrew all of them: a few hundred
   * pressables, on the thread that has to say which sleeves exist.
   */
  const open = () => {
    const album = albums[Math.round(at.current)];
    if (!album) return;
    if (!squared()) return settle();
    sleeve((found) => {
      if (found) onOpen(album, found);
    });
  };

  /**
   * A slot of the rail tapped. The one in front opens; any other comes to the
   * front, which is what reaching past it into the rack would do.
   */
  const reach = (index: number) => {
    if (index === Math.round(at.current)) open();
    else rail.current?.scrollTo({ x: index * step, animated: true });
  };

  /**
   * The record in front held down. Only where it stands square: mid-flick the
   * one under the finger is not yet the one the caption names.
   */
  const hold = onHold
    ? (album: Album) => {
        if (squared()) onHold(album);
      }
    : undefined;

  /** Where a picture arrived, for {@link MEASURE}. */
  const pictured = (album: Album, from: string) =>
    countPicture(Math.abs(albums.indexOf(album) - at.current), from);

  /*
    The covers, found before the rack is thrown across them, nearest first.

    A sleeve otherwise asks for its own as it is mounted, which is the wrong
    moment twice over: it is drawn empty and then again with its picture, and
    after a hard flick its question is behind those of every sleeve the flick
    passed on the way there.
  */
  useEffect(() => {
    const from = Math.round(at.current) || 0;
    const covers = [albums[from]?.tracks[0]];
    for (let out = 1; out < albums.length; out += 1) {
      covers.push(albums[from + out]?.tracks[0], albums[from - out]?.tracks[0]);
    }
    return warmArtwork(covers);
  }, [albums]);

  useImperativeHandle(ref, () => ({
    sleeveOf: (key, then) => {
      if (albums[front]?.key !== key || !squared()) return then(null);
      sleeve(then);
    },
  }));

  /*
    Turning the phone changes how far apart the records sit, and the rail is
    still holding the offset it had at the old spacing — so the rack is drawn
    from a position that no longer means what it meant, and stays that way
    until a scroll re-reads it. Put back where it was, in the new spacing.
  */
  useEffect(() => {
    if (step <= 0) return;

    /*
      Only the rail is moved, and the value that drives the fan is left to
      catch up from the scroll event that follows.

      Writing it here as well would be writing down where the rack ought to be
      while the rail is still somewhere else — and since the records now ride
      inside the rail, the two disagreeing leaves the fan opened around a gap
      with no record in it.

      A frame late, because the rail has to have been laid out at the new size
      before it can be told where to sit in it.
    */
    /*
      Which record was in front is read off the rail, as it is at `open`, and
      for a reason of its own. This is a correction for the geometry changing
      under the rack and must run only when the spacing does: taken from
      `front` it either runs at every detent, which stops a flick dead, or is
      kept from that by switching a lint rule off — and a component with a rule
      switched off is one the compiler will not take, so nothing in the rack
      was remembered between one detent and the next.
    */
    const target = Math.round(at.current) * step;
    const frame = requestAnimationFrame(() => {
      rail.current?.scrollTo(
        { x: target, animated: false }
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  /** Told where the rail is, in points, each time it moves. */
  const heard = useCallback(
    (offset: number) => {
      at.current = offset / step;
      const index = Math.round(at.current);
      if (MEASURE) countScroll(index);
      setFront((held) => {
        if (index === held) return held;
        // A record coming to the front clicks, the way a detent does.
        // Fired from here rather than from an effect so it lands with the
        // movement rather than a frame after it.
        JukeboxAudio.tick?.();
        return index;
      });
    },
    [step]
  );
  const onScroll = useRailEvent(scroll, heard);

  /**
   * Each record's distance from the front, as an animated value it keeps.
   *
   * Built once per spacing rather than once per render. These were made inline
   * where the cards are drawn, so every change of the front record — which is
   * every detent the rack passes — handed the native driver fifteen brand new
   * subtraction nodes to wire up and left the old ones attached. The wiring is
   * done on the frame the flick lands on, which is exactly where the animation
   * was seen to stop dead and then crawl back into place.
   *
   * One for every record there is, made together, rather than each as it is
   * first wanted: a list filled in while the rack is being drawn is something
   * changed behind the compiler's back, and it will not take a component that
   * does it. One of these that nothing is drawn from is not wired to anything
   * and is never worked out, so the ones far from the front cost a few words.
   */
  const count = albums.length;
  const offsets = useMemo(() => {
    const progress = Animated.divide(scroll, step);
    return Array.from({ length: count }, (_, index) => Animated.subtract(index, progress));
  }, [count, scroll, step]);

  /*
    Drawn back to front, so the card at the front of the rack is painted last
    and therefore over the others. `zIndex` cannot be animated on the native
    driver, and a static one would have the fan overlapping the wrong way round
    on one side.

    Further out than the fan reaches, by {@link AHEAD}: those are mounted and
    not yet seen.
  */
  const visible = useMemo(() => {
    const shown: number[] = [];
    const mounted = NEIGHBOURS + AHEAD;
    for (let index = front - mounted; index <= front + mounted; index += 1) {
      if (index >= 0 && index < albums.length) shown.push(index);
    }
    return shown.sort((left, right) => Math.abs(right - front) - Math.abs(left - front));
  }, [albums.length, front]);

  if (albums.length === 0 || width === 0) {
    return (
      <View
        style={[styles.stage, styles.empty]}
        onLayout={(event) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setBox((held) => (held.width === w && held.height === h ? held : { width: w, height: h }));
        }}>
        {albums.length === 0 ? (
          <Text style={styles.emptyText}>{t.library.noAlbums}</Text>
        ) : null}
      </View>
    );
  }

  const current = albums[Math.min(Math.max(front, 0), albums.length - 1)];

  return (
    <View
      ref={stage}
      style={styles.stage}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setBox((held) => (held.width === w && held.height === h ? held : { width: w, height: h }));
      }}>
      {/*
        The rail. Nothing in it is ever seen; it is here for the flick.

        Animated.ScrollView rather than a plain one, because a natively driven
        `Animated.event` is an object the view has to know how to attach. A
        plain scroll view treats whatever it is handed as a callback and calls
        it, which is a crash rather than a missing animation.
      */}
      <Animated.ScrollView
        ref={rail}
        style={StyleSheet.absoluteFill}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        /*
          A flick is left alone. It ends in momentum, `snapToInterval` carries
          it, and settling on the release instead cancelled the throw — the
          rack could not be sent past its neighbour. Only a release with
          nothing behind it is settled here, because no momentum is coming to
          do it.
        */
        onScrollEndDrag={(event) => {
          const { x, y } = event.nativeEvent.velocity ?? { x: 0, y: 0 };
          if (Math.abs(x) < FLICK) settle();
        }}
        onMomentumScrollEnd={
          MEASURE
            ? () => {
                settle();
                reportFlick();
              }
            : settle
        }
        contentContainerStyle={{
          paddingHorizontal: lead,
          width: albums.length * step + lead * 2,
        }}>
        <Slots albums={albums} step={step} onReach={reach} />
        {/*
          The records, inside the rail rather than beside it.

          Beside it they were a sibling of the thing that scrolls, and the two
          could not share a gesture: whichever took a touch kept it, and a
          drag that began on the record in front scrolled nothing. Inside, the
          rail is an ancestor: it takes drags and passes taps down, which is
          what a scroll view is for.

          Absolutely placed rather than laid out in the slots, so they can be
          painted back to front — a record overlaps its neighbours by more
          than its own width, and the one at the front has to be over both.
        */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {visible.map((index) => (
            <View
              key={albums[index].key}
              style={[
                styles.berth,
                /*
                  Centred on the slot but as long as the record itself.

                  A slot is barely half a sleeve wide, and a view only ever
                  hears about a touch its parent heard about first — so with
                  the berth cut to the slot, the outer quarter of the sleeve
                  either side was untouchable. Taps there fell through to the
                  rail beneath, which read them as reaching for the neighbour
                  and slid the rack along instead of opening the record.

                  Through the rack it takes the whole frame less the
                  reflection's share, so what ends up centred is the record and
                  its reflection together.
                */
                {
                  left: lead + index * step + (step - card) / 2,
                  width: card,
                  top: 0,
                  bottom: mirror,
                },
              ]}
              /*
                The one in front takes its own taps, so that a tap anywhere on
                its sleeve opens it. Everything else is left to
                the rail beneath, which is what brings a neighbour forward
                rather than opening it where it stands.
              */
              pointerEvents={index === front ? 'box-none' : 'none'}>
              <Card
                album={albums[index]}
                offset={offsets[index]!}
                step={step}
                size={card}
                inFront={index === front}
                onOpen={open}
                onHold={hold}
                onPicture={MEASURE ? pictured : undefined}
              />
            </View>
          ))}
        </View>
      </Animated.ScrollView>

      <View style={styles.caption} pointerEvents="none">
        <Text style={styles.name} numberOfLines={1}>
          {current.name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {[current.artist, current.year].filter(Boolean).join(' · ')}
        </Text>
      </View>

    </View>
  );
}

/**
 * The rail's scroll, tied to the value the cards are drawn from and reported
 * to [heard] as well.
 *
 * A hook of its own on the compiler's account. What hears the scroll writes
 * where the rail is into a ref, and built in the rack itself that is a function
 * touching a ref handed to another function while drawing — which the compiler
 * takes for a ref read while drawing, and then leaves the whole rack alone.
 * Handed to a hook it is what it is: something kept for later.
 */
function useRailEvent(scroll: Animated.Value, heard: (offset: number) => void) {
  return useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scroll } } }], {
        useNativeDriver: true,
        listener: (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) =>
          heard(event.nativeEvent.contentOffset.x),
      }),
    [scroll, heard]
  );
}

/**
 * The slots of the rail, one to a record and a detent wide: what a tap lands
 * on when it lands beside the record in front.
 *
 * Apart from the rack, and remembered, because there is one of these for every
 * record in the library and nothing about them changes as the rack is flicked.
 * Drawn along with it they were all drawn again at each detent.
 */
const Slots = memo(function Slots({
  albums,
  step,
  onReach,
}: {
  albums: Album[];
  step: number;
  onReach: (index: number) => void;
}) {
  const styles = useStyles();
  const slot = { width: step, height: '100%' as const };
  return (
    <View style={[styles.slots, styles.slotsWide, { width: albums.length * step }]}>
      {albums.map((album, index) => (
        <Pressable key={album.key} style={slot} onPress={() => onReach(index)} />
      ))}
    </View>
  );
});

/**
 * One record of the rack.
 *
 * Remembered, and handed nothing that changes as the rack moves except whether
 * it is the one in front. So a detent draws two of these again — the one that
 * was in front and the one that now is — and mounts one, rather than drawing
 * all of them; where each one is has never been JavaScript's to say.
 */
const Card = memo(function Card({
  album,
  offset,
  step,
  size,
  inFront,
  onOpen,
  onHold,
  onPicture,
}: {
  album: Album;
  /** Where this card sits relative to the front one, in cards. */
  offset: Animated.AnimatedInterpolation<number>;
  /** How far apart two slots are, which is what the rail has already moved it by. */
  step: number;
  size: number;
  /** The one square on, which is the only one a tap opens. */
  inFront: boolean;
  /** Opens whichever record is in front. The same function for every card. */
  onOpen: () => void;
  /** The same again for a record held down; only the one in front offers it. */
  onHold?: (album: Album) => void;
  /** Told when the picture is there and where it came from. Only while measuring. */
  onPicture?: (album: Album, from: string) => void;
}) {
  const t = useT();
  const styles = useStyles();
  const artwork = useTrackArtwork(album.tracks[0] ?? null);
  const press = () => {
    if (inFront) onOpen();
  };
  const held = inFront && onHold ? () => onHold(album) : undefined;

  /*
    Only the difference between where the fan wants this record and where the
    rail has already carried it.

    It rides in a slot now, and that slot moves with the scroll — so the whole
    fan offset would be applied on top of a displacement it has already had,
    and the rack would fly apart at twice the speed of the flick.
  */
  /*
    One stop per step back, mirrored either side of the front. Built rather
    than written out, so the two tables above are the only place the shape of
    the rack is described.
  */
  const steps = SPREAD.map((_, at) => at);
  const both = [...steps.slice(1).reverse().map((at) => -at), ...steps];
  const fan = offset.interpolate({
    inputRange: both,
    outputRange: both.map((at) => Math.sign(at) * size * SPREAD[Math.abs(at)]!),
    extrapolate: 'clamp',
  });
  const slide = Animated.subtract(fan, Animated.multiply(offset, step));
  const lean = offset.interpolate({
    inputRange: [-1, -TURN_BY, 0, TURN_BY, 1],
    outputRange: [`${ANGLE}deg`, `${ANGLE}deg`, '0deg', `${-ANGLE}deg`, `${-ANGLE}deg`],
    extrapolate: 'clamp',
  });
  const shrink = offset.interpolate({
    inputRange: both,
    outputRange: both.map((at) => SCALE[Math.abs(at)]!),
    extrapolate: 'clamp',
  });
  const fade = offset.interpolate({
    inputRange: [-NEIGHBOURS, -NEIGHBOURS + 1, 0, NEIGHBOURS - 1, NEIGHBOURS],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });

  /*
    Perspective has to be the first entry, and the lean has to come after the
    slide: rotating first would turn the axis the card then moves along, and
    the fan would bend towards the viewer instead of away.
  */
  const placement = [
    { perspective: PERSPECTIVE },
    { translateX: slide },
    { rotateY: lean },
    { scale: shrink },
  ];

  return (
    <Animated.View
      style={[styles.card, { width: size, height: size, opacity: fade, transform: placement }]}>
      <View style={[styles.face, { width: size, height: size }]}>
        <Pressable
          style={styles.art}
          accessibilityRole="button"
          // Only the one in front says so, because only it does: a neighbour
          // is brought forward by the slot it stands in, not opened.
          accessibilityLabel={inFront ? t.library.rack.open(album.name) : album.name}
          accessibilityHint={inFront ? t.library.rack.openHint : undefined}
          // Named, as a row's is: nobody finds a held sleeve by trying.
          accessibilityActions={
            held ? [{ name: 'longpress', label: t.library.albumMenu }] : undefined
          }
          onAccessibilityAction={
            held &&
            ((event) => {
              if (event.nativeEvent.actionName === 'longpress') held();
            })
          }
          onPress={press}
          onLongPress={held}>
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={styles.art}
              contentFit="cover"
              cachePolicy={KEPT}
              onLoad={onPicture && ((event) => onPicture(album, event.cacheType))}
            />
          ) : (
            <View style={[styles.art, styles.artEmpty]} />
          )}
        </Pressable>
      </View>

      {/* The shelf the records are standing on. */}
      <Mirror uri={artwork} size={size} />
    </Animated.View>
  );
});

/**
 * Where a sleeve's picture is kept once it has been read: in memory as well as
 * on the disk.
 *
 * Left to itself the image view keeps nothing in memory, so a sleeve was read
 * off the disk and decoded each time it was mounted — passed a second ago or
 * not — and its reflection, which is the same picture at the same size, was a
 * second reading of its own. In memory the two are one picture, and a sleeve
 * the rack comes back to has it on the frame it is mounted.
 */
const KEPT = 'memory-disk';

/**
 * A sleeve reflected off whatever it is standing on.
 *
 * The fade is a stack of bands. There is no gradient in the app and one
 * picture's reflection does not justify adding a drawing library; six steps at
 * this size is below what the eye separates.
 */
function Mirror({ uri, size }: { uri: string | null; size: number }) {
  const styles = useStyles();
  const depth = size * MIRROR;
  /* Pinned by the edge it reflects off, which is the sleeve's bottom. */
  const frame = { width: size, height: depth, top: '100%' as const };

  return (
    <View style={[styles.mirror, frame]} pointerEvents="none">
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            { width: size, height: size, opacity: 0.28 },
            { transform: [{ scaleY: -1 }] },
          ]}
          contentFit="cover"
          cachePolicy={KEPT}
        />
      ) : null}
      {[0.1, 0.28, 0.46, 0.64, 0.82, 0.95].map((cover, band) => {
        const along = `${(band / 6) * 100}%` as const;
        const thickness = `${100 / 6}%` as const;
        return (
          <View
            key={cover}
            style={[
              styles.band,
              { top: along, height: thickness, left: 0, right: 0 },
              { opacity: cover },
            ]}
          />
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  stage: { flex: 1, backgroundColor: c.bg },
  /*
    One record's place in the rail, the width of a slot. The record itself is
    far wider and centres on it, spilling over its neighbours — which is the
    overlap the rack is made of.
  */
  berth: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  cards: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 36 },
  emptyText: { color: c.textFaint, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  card: { position: 'absolute', alignItems: 'center' },
  // Flat, as the stage is: the sleeves stand in front of one another, and
  // one of glass would show the next through it until its picture came.
  face: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: laid(c.surface, c.bg),
  },
  art: { width: '100%', height: '100%' },
  artEmpty: { backgroundColor: c.surfaceRaised },

  // Sits against the sleeve, in the card's own transformed space, so it leans
  // and recedes with it.
  mirror: { position: 'absolute', overflow: 'hidden' },
  // The stage's own colour, since what a reflection fades into is whatever
  // it is standing on.
  band: { position: 'absolute', backgroundColor: c.bg },

  slots: { flexDirection: 'column' },
  slotsWide: { flexDirection: 'row' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CAPTION_LIFT,
    height: CAPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 20,
  },
  /*
    A shadow under the writing, because it is not written on a background.

    The caption is drawn over the rack rather than below it — that is what lets
    the sleeves have the whole frame — so what is behind any given letter is
    whatever sleeve happens to be there. Upright that is a run of artwork right
    under the words. The shadow is what keeps them legible against a bright
    one without having to put a bar behind them and take the height back.

    In the stage's colour rather than in black: the words are the theme's, so
    what sets them off from a sleeve has to be the shade they were chosen to be
    read on, which is black only in a dark theme.
  */
  name: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: c.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  detail: {
    color: c.textSecondary,
    fontSize: 12.5,
    textShadowColor: c.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
}));
