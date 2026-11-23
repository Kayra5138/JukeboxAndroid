import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { ScrollView, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { FADE_EDGE } from '../lib/theme/measures';

/**
 * A list that scrolls, fading out at an end only where there is more of it
 * past that end: at its start the far end fades and the near one does not,
 * at its end the other way round, and in between both. For what does not
 * otherwise look as if it moves: a shelf's covers going on past the card,
 * the column down the left of a page held sideways.
 *
 * Told by its own scrolling rather than by Android, whose own fading edge
 * React Native draws at the same strength at both ends wherever the list
 * stands, so that it faded at its start and its end as well (24 November
 * 2026, Kayra). Drawn again only when an end comes or goes, not at every
 * step of a scroll.
 */
export function FadingScroll({
  horizontal = false,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...rest
}: Omit<ComponentProps<typeof ScrollView>, 'fadingEdgeLength'>) {
  const [more, setMore] = useState({ before: false, after: false });
  const sizes = useRef({ view: 0, content: 0, at: 0 });
  const look = () => {
    const { view, content, at } = sizes.current;
    const before = at > 1;
    const after = at + view < content - 1;
    setMore((was) => (was.before === before && was.after === after ? was : { before, after }));
  };
  const fade = useMemo(() => ({ start: more.before ? FADE_EDGE : 0, end: more.after ? FADE_EDGE : 0 }), [more]);
  return (
    <ScrollView
      {...rest}
      horizontal={horizontal}
      fadingEdgeLength={fade}
      scrollEventThrottle={rest.scrollEventThrottle ?? 16}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offset = event.nativeEvent.contentOffset;
        sizes.current.at = horizontal ? offset.x : offset.y;
        look();
        onScroll?.(event);
      }}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        sizes.current.view = horizontal ? width : height;
        look();
        onLayout?.(event);
      }}
      onContentSizeChange={(width: number, height: number) => {
        sizes.current.content = horizontal ? width : height;
        look();
        onContentSizeChange?.(width, height);
      }}
    />
  );
}
