import { useState } from 'react';
import { Text, type LayoutChangeEvent, type TextProps } from 'react-native';

/**
 * Words made smaller to fit the room they are given (`adjustsFontSizeToFit`),
 * made again whenever that room changes.
 *
 * Android makes them smaller once, for the size the words have the first time
 * they are drawn, by shrinking the text itself, and never makes them bigger:
 * drawn first in a room that was still narrow, as a row of choices is for a
 * moment while a screen is first laid out, they stayed a few points high once
 * the room had grown, until something about them changed (Search's Videos and
 * Playlists, until each had been pressed). Nor does it keep to
 * `minimumFontScale`, going down as far as four points. So the words are
 * drawn afresh in a room of a new size, and fitted to it from their own size.
 */
export function FittedText({ onLayout, ...props }: TextProps) {
  /** The size they were drawn for, and how many times they have been drawn afresh. */
  const [drawn, setDrawn] = useState<{ size: string | null; times: number }>({ size: null, times: 0 });
  const laid = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    const { width, height } = event.nativeEvent.layout;
    const size = `${Math.round(width)}x${Math.round(height)}`;
    setDrawn((before) =>
      before.size === size ? before : { size, times: before.size == null ? before.times : before.times + 1 }
    );
  };
  return <Text key={drawn.times} {...props} adjustsFontSizeToFit onLayout={laid} />;
}
