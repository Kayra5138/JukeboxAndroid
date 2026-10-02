import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import { useTrackArtwork } from '../lib/media/artwork';
import type { Album } from '../lib/media/albums';

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
 * records is the compositor's work and not JavaScript's. Only the handful of
 * cards near the front are mounted at all; the rest would be a hundred animated
 * views to draw nine.
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


export function CoverFlow({
  albums,
  onPlay,
}: {
  albums: Album[];
  /** Play the record from a track, which is what the back of a card offers. */
  onPlay: (album: Album, index: number) => void;
}) {
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

  const scroll = useRef(new Animated.Value(0)).current;
  const rail = useRef<ScrollView>(null);
  const [front, setFront] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;

  const turn = useCallback(
    (open: boolean) => {
      setFlipped(open);
      Animated.spring(flip, {
        toValue: open ? 1 : 0,
        useNativeDriver: true,
        bounciness: 3,
        speed: 12,
      }).start();
    },
    [flip]
  );

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

  /** True when a record is square on, near enough to be worth turning over. */
  const squared = () => Math.abs(at.current - Math.round(at.current)) < SQUARE_ENOUGH;

  /*
    Turning the phone changes how far apart the records sit, and the rail is
    still holding the offset it had at the old spacing — so the rack is drawn
    from a position that no longer means what it meant, and stays that way
    until a scroll re-reads it. Put back where it was, in the new spacing.
  */
  useEffect(() => {
    if (step <= 0) return;
    // Anything open is put away first. Turning the phone rebuilds the rack
    // around it, and a record left open through that is one the listener is
    // no longer looking at.
    if (flipped) turn(false);

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
    const target = front * step;
    const frame = requestAnimationFrame(() => {
      rail.current?.scrollTo(
        { x: target, animated: false }
      );
    });
    return () => cancelAnimationFrame(frame);
    // Deliberately only on the spacing: this is a correction for the geometry
    // changing under the rack, not something to do every time it is flicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scroll } } }], {
        useNativeDriver: true,
        listener: (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) => {
          const offset = event.nativeEvent.contentOffset.x;
          at.current = offset / step;
          const index = Math.round(at.current);
          setFront((held) => {
            if (index === held) return held;
            // A record coming to the front clicks, the way a detent does.
            // Fired from here rather than from an effect so it lands with the
            // movement rather than a frame after it.
            JukeboxAudio.tick?.();
            // Turning the rack puts whatever was open away, the same as
            // closing a case to reach for the next one.
            if (flipped) turn(false);
            return index;
          });
        },
      }),
    [flipped, scroll, step, turn]
  );

  /**
   * Each record's distance from the front, as an animated value it keeps.
   *
   * Built once per spacing rather than once per render. These were made inline
   * where the cards are drawn, so every change of the front record — which is
   * every detent the rack passes — handed the native driver fifteen brand new
   * subtraction nodes to wire up and left the old ones attached. The wiring is
   * done on the frame the flick lands on, which is exactly where the animation
   * was seen to stop dead and then crawl back into place.
   */
  const offsetOf = useMemo(() => {
    const progress = Animated.divide(scroll, step);
    const held = new Map<number, Animated.AnimatedNode>();
    return (index: number) => {
      const found = held.get(index);
      if (found) return found as Animated.AnimatedSubtraction<number>;
      const made = Animated.subtract(index, progress);
      held.set(index, made);
      return made;
    };
  }, [scroll, step]);

  /*
    Drawn back to front, so the card at the front of the rack is painted last
    and therefore over the others. `zIndex` cannot be animated on the native
    driver, and a static one would have the fan overlapping the wrong way round
    on one side.
  */
  const visible = useMemo(() => {
    const shown: number[] = [];
    for (let index = front - NEIGHBOURS; index <= front + NEIGHBOURS; index += 1) {
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
          <Text style={styles.emptyText}>
            No albums yet. A record only appears once its tracks have been
            looked up — the folder a file sits in is not an album.
          </Text>
        ) : null}
      </View>
    );
  }

  const current = albums[Math.min(Math.max(front, 0), albums.length - 1)];

  return (
    <View
      style={styles.stage}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setBox((held) => (held.width === w && held.height === h ? held : { width: w, height: h }));
      }}>
      {/*
        Visual only while the rack is closed. The rail sits over the top so
        that a flick anywhere works, which means the cards themselves never see
        a touch — the slots inside the rail stand in for them. Once a record is
        open its own children have to be reachable, so it starts catching
        touches again and the rail keeps whatever falls outside the card.
      */}
      {/*
        The rail. Nothing in it is ever seen; it is here for the flick.

        Under the rack rather than over it. Over it, it took every touch —
        including the ones meant for an open record's listing, which is why
        tapping a track closed the record instead of playing it. Under it, the
        rack lets everything through until a record is open, and then only its
        own listing catches anything.

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
        onMomentumScrollEnd={settle}
        contentContainerStyle={{
          paddingHorizontal: lead,
          width: albums.length * step + lead * 2,
        }}>
        <View
          style={[
            styles.slots,
            styles.slotsWide,
            { width: albums.length * step },
          ]}>
          {albums.map((album, index) => (
            <Pressable
              key={album.key}
              style={{ width: step, height: '100%' }}
              onPress={() => {
                // The one in front turns over; any other comes to the front,
                // which is what reaching past it into the rack would do.
                // Tapped mid-flick it is square to nothing, so it is brought
                // round first and opening waits for the next tap.
                if (index === front) {
                  if (squared()) turn(!flipped);
                  else settle();
                }
                else rail.current?.scrollTo({ x: index * step, animated: true });
              }}
            />
          ))}
        </View>
        {/*
          The records, inside the rail rather than beside it.

          Beside it they were a sibling of the thing that scrolls, and the two
          could not share a gesture: whichever took a touch kept it. A drag on
          an open record scrolled nothing, and a tap on a neighbour reached
          that neighbour's own listing — which played it instead of bringing
          it forward. Inside, the rail is an ancestor: it takes drags and
          passes taps down, which is what a scroll view is for.

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
                The one in front takes its own taps, open or closed, so that a
                tap anywhere on its sleeve opens it. Everything else is left to
                the rail beneath, which is what brings a neighbour forward
                rather than opening it where it stands.
              */
              pointerEvents={index === front ? 'box-none' : 'none'}>
              <Card
                album={albums[index]}
                offset={offsetOf(index)}
                step={step}
                size={card}
                flip={index === front ? flip : null}
                open={flipped && index === front}
                onPress={() => {
                  if (index === front) turn(!flipped);
                }}
                onPlay={(track) => onPlay(albums[index], track)}
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

function Card({
  album,
  offset,
  step,
  size,
  flip,
  open,
  onPress,
  onPlay,
}: {
  album: Album;
  /** Where this card sits relative to the front one, in cards. */
  offset: Animated.AnimatedInterpolation<number>;
  /** How far apart two slots are, which is what the rail has already moved it by. */
  step: number;
  size: number;
  /** Non-null only for the card at the front, which is the one that turns. */
  flip: Animated.Value | null;
  /** Turned over, so the listing is the side facing out. */
  open: boolean;
  onPress: () => void;
  onPlay: (index: number) => void;
}) {
  const artwork = useTrackArtwork(album.tracks[0] ?? null);

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

  const turned = flip
    ? flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
    : '0deg';
  const back = flip
    ? flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
    : '180deg';

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
      <>
        {/*
          Each face takes touches only while it is the one being looked at.

          `backfaceVisibility` hides the side turned away, but only from the
          eye — a touch is still offered to it, and being the later sibling it
          is offered first. So a shut record had an invisible listing lying
          over its sleeve, and a tap meant for the sleeve reached a track row
          and started playing it.
        */}
        <Animated.View
          pointerEvents={open ? 'none' : 'auto'}
          style={[
            styles.face,
            { width: size, height: size, transform: [{ perspective: PERSPECTIVE }, { rotateY: turned }] },
          ]}>
          <Pressable style={styles.art} onPress={onPress}>
            {artwork ? (
              <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
            ) : (
              <View style={[styles.art, styles.artEmpty]} />
            )}
          </Pressable>
        </Animated.View>

        {/*
          Only the record that can be turned has a back at all. Rendering one
          for every record in the rack left a neighbour showing a listing
          whenever the turn value was still up from a record that had since
          stopped being the front one.
        */}
        {flip ? (
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            styles.face,
            styles.reverse,
            { width: size, height: size, transform: [{ perspective: PERSPECTIVE }, { rotateY: back }] },
          ]}>
          {/*
            Anywhere on the face that is not a track turns the record back
            over — the heading, the margins, the empty space below a short
            listing. The rows are nested inside this and win a tap of their
            own, which they only do now that the thing carrying the flick is
            an ancestor rather than a sibling painted over everything.
          */}
          <Pressable style={styles.reverseBody} onPress={onPress}>
            <View style={styles.listingHead}>
              <Text style={styles.listingTitle} numberOfLines={2}>
                {album.name}
              </Text>
              <Text style={styles.listingDetail} numberOfLines={1}>
                {[
                  album.artist,
                  `${album.tracks.length} ${album.tracks.length === 1 ? 'track' : 'tracks'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <ScrollView
              style={styles.listing}
              contentContainerStyle={styles.listingBody}
              // Lets a long listing scroll on its own and hand the rest of the
              // drag back to the rack once it reaches its end.
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              {album.tracks.map((track, index) => (
                <Pressable
                  key={track.id}
                  onPress={() => onPlay(index)}
                  style={({ pressed }) => [styles.line, pressed && styles.linePressed]}>
                  <Text style={styles.lineNumber}>{index + 1}</Text>
                  <Text style={styles.lineTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Animated.View>
        ) : null}
      </>

      {/* The shelf the records are standing on. */}
      <Mirror uri={artwork} size={size} flip={flip} />
    </Animated.View>
  );
}

/**
 * A sleeve reflected off whatever it is standing on.
 *
 * The fade is a stack of bands. There is no gradient in the app and one
 * picture's reflection does not justify adding a drawing library; six steps at
 * this size is below what the eye separates.
 */
function Mirror({
  uri,
  size,
  flip,
}: {
  uri: string | null;
  size: number;
  /** Non-null on the record that can be turned over. */
  flip: Animated.Value | null;
}) {
  const depth = size * MIRROR;
  /* Pinned by the edge it reflects off, which is the sleeve's bottom. */
  const frame = { width: size, height: depth, top: '100%' as const };

  /*
    Goes as the record turns. A reflection is of the face that was showing, so
    once that face is away it is a picture of something that is no longer
    there — and the listing on the back has no reflection to give.
  */
  const showing = flip
    ? flip.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] })
    : 1;

  return (
    <Animated.View style={[styles.mirror, frame, { opacity: showing }]} pointerEvents="none">
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            { width: size, height: size, opacity: 0.28 },
            { transform: [{ scaleY: -1 }] },
          ]}
          contentFit="cover"
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000000' },
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
  emptyText: { color: '#6a6a6a', fontSize: 13, lineHeight: 20, textAlign: 'center' },

  card: { position: 'absolute', alignItems: 'center' },
  face: {
    backfaceVisibility: 'hidden',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
  reverse: { position: 'absolute', top: 0, left: 0, backgroundColor: '#1b1b1b' },
  art: { width: '100%', height: '100%' },
  artEmpty: { backgroundColor: '#1e1e1e' },

  reverseBody: { flex: 1 },
  listingHead: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  listingTitle: { color: '#f2f2f2', fontSize: 14.5, fontWeight: '600' },
  listingDetail: { color: '#7a7a7a', fontSize: 11.5 },
  listing: { flex: 1 },
  listingBody: { paddingVertical: 6 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  linePressed: { backgroundColor: '#242424' },
  lineNumber: {
    color: '#5f5f5f',
    fontSize: 11.5,
    width: 18,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  lineTitle: { color: '#ededed', fontSize: 13.5, flex: 1, minWidth: 0 },

  // Sits against the sleeve, in the card's own transformed space, so it leans
  // and recedes with it.
  mirror: { position: 'absolute', overflow: 'hidden' },
  band: { position: 'absolute', backgroundColor: '#000000' },

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
  */
  name: {
    color: '#f2f2f2',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: '#000000cc',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  detail: {
    color: '#a2a2a2',
    fontSize: 12.5,
    textShadowColor: '#000000cc',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
