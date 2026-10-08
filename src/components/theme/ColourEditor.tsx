import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../Pressable';

import { TextField } from '../FormScroll';
import { TrackSlider, type TrackColours } from './TrackSlider';
import { useT } from '../../lib/i18n/index';
import { fromLch, toLch, type Lch } from '../../lib/theme/colour.ts';
import { SEED_PRESETS, seedColour, type SeedRole } from '../../lib/theme/custom.ts';
import { hintKey, makeStyles, useColours, usePressed } from '../../lib/theme/index';

/**
 * As strong as the slider goes. About the strongest colour a screen can
 * show, at the hues where it can show the most; elsewhere the far end of
 * the slider is past what there is, and the colour stops getting stronger
 * before the thumb stops moving.
 */
const STRONGEST = 0.3;

/** The hues in order, at a lightness and a strength every one of them can be shown at. */
const RAINBOW = Array.from({ length: 13 }, (_, at) =>
  fromLch({ l: 0.74, c: 0.14, h: at * 30 })
) as unknown as TrackColours;

/** A strip of colours between two ends, in enough pieces that it bends where the colours do. */
function strip(pieces: number, at: (fraction: number) => Lch): TrackColours {
  return Array.from({ length: pieces + 1 }, (_, index) => fromLch(at(index / pieces))) as unknown as TrackColours;
}

const HEX_HINT = '#rrggbb';

/**
 * One colour, chosen three ways: from a row of suggestions, by three
 * sliders, or by typing its code.
 *
 * The sliders are hue, strength and lightness as `colour.ts` reckons them,
 * and for its reason: a step along one is the same step to the eye wherever
 * the other two are, and moving the lightness leaves the hue where it was.
 * In red, green and blue nobody can find "this, but a little darker".
 *
 * What the sliders hold is kept here and not worked back out of the colour.
 * A colour forgets things: white has no hue and a grey has none either, so a
 * thumb placed by the colour alone would jump to nought the moment the
 * lightness reached the top, and the colour on the way back down would be a
 * red nobody asked for. Held here, the hue is still what it was.
 *
 * [onChange] is told while a slider is being dragged and [onCommit] when
 * something has been settled on — a finger lifted, a suggestion tapped, a
 * whole code typed. The difference is the caller's to use: the first is for
 * what can be redrawn sixty times a second.
 */
export function ColourEditor({
  role,
  value,
  onChange,
  onCommit,
}: {
  role: SeedRole;
  /** The colour as it stands, `#rrggbb`. */
  value: string;
  onChange: (colour: string) => void;
  onCommit: (colour: string) => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const say = t.settings.customTheme;

  /*
    The sliders' three numbers, and the colour they were last known to make.
    When the colour handed in is another — a suggestion was tapped, a code
    typed, everything reset — they are read from it afresh; while it is the
    one they made, they are left as the finger left them.
  */
  const [held, setHeld] = useState(() => ({ colour: value, lch: toLch(value) }));
  let lch = held.lch;
  if (held.colour !== value) {
    lch = toLch(value);
    setHeld({ colour: value, lch });
  }

  /*
    What is in the field, and the colour it was last right for. Left alone
    while it is being typed in, since half a code is no colour and changes
    nothing; replaced when the colour is changed from anywhere else.
  */
  const [typed, setTyped] = useState({ colour: value, text: value });
  let text = typed.text;
  if (typed.colour !== value) {
    if (seedColour(typed.text) !== value) text = value;
    setTyped({ colour: value, text });
  }

  const slide = (part: Partial<Lch>, settled: boolean) => {
    const next = { ...lch, ...part };
    const colour = fromLch(next);
    setHeld({ colour, lch: next });
    if (settled) onCommit(colour);
    else onChange(colour);
  };

  const type = (entered: string) => {
    setTyped({ colour: value, text: entered });
    /*
      Six digits are a colour and are taken at once. Three are one too, but
      they are also the first half of six, and taking them would repaint the
      app in a colour nobody meant on the way to the one they did; those wait
      until the typing is over.
    */
    if (entered.trim().replace(/^#/, '').length !== 6) return;
    const colour = seedColour(entered);
    if (colour && colour !== value) onCommit(colour);
  };

  const finish = () => {
    const colour = seedColour(text);
    if (colour && colour !== value) onCommit(colour);
    else setTyped({ colour: value, text: value });
  };

  return (
    <View style={styles.editor}>
      <View style={styles.presets} accessibilityLabel={say.presets}>
        {SEED_PRESETS[role].map((preset) => {
          const on = preset === value;
          return (
            <Pressable
              android_ripple={pressed}
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={preset}
              accessibilityState={{ selected: on }}
              hitSlop={3}
              style={[styles.ring, on && styles.ringOn]}
              onPress={() => {
                if (!on) onCommit(preset);
              }}>
              <View style={[styles.preset, { backgroundColor: preset }]} />
            </Pressable>
          );
        })}
      </View>

      <TrackSlider
        label={say.hue}
        value={lch.h}
        min={0}
        max={360}
        step={10}
        track={RAINBOW}
        thumb={value}
        written={(hue) => say.degrees(String(Math.round(hue)))}
        onChange={(h) => slide({ h }, false)}
        onSettle={(h) => slide({ h }, true)}
      />
      <TrackSlider
        label={say.saturation}
        value={Math.min(STRONGEST, lch.c)}
        min={0}
        max={STRONGEST}
        step={STRONGEST / 20}
        track={strip(4, (part) => ({ l: lch.l, c: part * STRONGEST, h: lch.h }))}
        thumb={value}
        written={(strength) => say.percent(String(Math.round((strength / STRONGEST) * 100)))}
        onChange={(strength) => slide({ c: strength }, false)}
        onSettle={(strength) => slide({ c: strength }, true)}
      />
      <TrackSlider
        label={say.lightness}
        value={lch.l}
        min={0}
        max={1}
        step={0.05}
        track={strip(8, (part) => ({ l: part, c: lch.c, h: lch.h }))}
        thumb={value}
        written={(lightness) => say.percent(String(Math.round(lightness * 100)))}
        onChange={(l) => slide({ l }, false)}
        onSettle={(l) => slide({ l }, true)}
      />

      <View style={styles.code}>
        <Text style={styles.codeLabel}>{say.hex}</Text>
        <TextField
          // Made again when its colours change, which on this screen is often; see `hintKey`.
          key={hintKey(c, HEX_HINT)}
          style={styles.field}
          value={text}
          onChangeText={type}
          onEndEditing={finish}
          placeholder={HEX_HINT}
          placeholderTextColor={c.textDisabled}
          accessibilityLabel={say.hex}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          returnKeyType="done"
          disableFullscreenUI
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  editor: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  /*
    The mark of the one in use, and room for it round the ones that are not,
    so that choosing does not move anything: as the picker rings its themes.
  */
  ring: { borderRadius: 19, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  ringOn: { borderColor: c.accent },
  // An edge in this theme's colours, for the suggestion that is the colour of the card it is offered on.
  preset: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },

  code: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  codeLabel: { color: c.textSecondary, fontSize: 13.5 },
  // Set into a card, and so the colour of the page.
  field: {
    minWidth: 120,
    color: c.text,
    backgroundColor: c.bg,
    borderRadius: 9,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
}));
