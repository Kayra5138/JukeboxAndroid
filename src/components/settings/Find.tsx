import { useLocalSearchParams, useRouter } from 'expo-router';
import { Children, createContext, isValidElement, use, useEffect, useRef, type ReactNode, type Ref, type RefObject } from 'react';
import { Text as Plain, type ScrollView, type TextProps } from 'react-native';

import { foldForMatch } from '../../lib/metadata/text';
import { useColours } from '../../lib/theme/index';
import { motionReduced } from '../../lib/ui/motion';

/**
 * A page of Settings opened from its search (Settings' own page) with what was
 * found (`find`): every line that says it marked, and the page scrolled to
 * the first of them.
 *
 * Each page's own words are drawn with [Text] below in place of React
 * Native's, which is that and nothing more on a page opened any other way.
 */
type Finding = { find: string; found: (line: Plain) => void };

const Finding = createContext<Finding | null>(null);

/**
 * Something a page scrolls with, that can be asked where a line is in it:
 * React Native's own has the inner view's ref, though its types do not say so.
 */
type Scroller = Pick<ScrollView, 'scrollTo'> & { getInnerViewRef?: () => unknown };

/** How far down from the top of the page the line found is brought, to be seen with what is over it. */
const BROUGHT_TO = 120;

/**
 * How long what was found stays marked: long enough to be seen, and then the
 * page is as it always is -- Settings' own page above all, which is never
 * left and would otherwise stay marked for as long as the app was open.
 */
const MARKED_FOR_MS = 4000;

export function FindIn({ scroller, children }: { scroller?: RefObject<Scroller | null>; children: ReactNode }) {
  const { find } = useLocalSearchParams<{ find?: string }>();
  const router = useRouter();
  // Scrolled to once, the first line that says it: after that the page is the reader's to scroll.
  const went = useRef(false);
  useEffect(() => {
    if (!find) return;
    went.current = false;
    const timer = setTimeout(() => router.setParams({ find: '' }), MARKED_FOR_MS);
    return () => clearTimeout(timer);
  }, [find, router]);
  const found = (line: Plain) => {
    if (went.current) return;
    went.current = true;
    const inner = scroller?.current?.getInnerViewRef?.();
    if (!inner) return;
    line.measureLayout(inner as Parameters<Plain['measureLayout']>[0], (_x, y) => scroller?.current?.scrollTo({ y: Math.max(0, y - BROUGHT_TO), animated: !motionReduced() }));
  };
  /*
    Round the page whether anything is being looked for or not, and only
    emptied when the mark goes. Left out then, the page was another tree to
    React, made afresh, and its scroller with it: back at the top a few
    seconds after it had been brought to what was found.
  */
  return <Finding value={find ? { find: foldForMatch(find), found } : null}>{children}</Finding>;
}

/** React Native's own, marking itself where it says what was looked for: see [FindIn]. */
export function Text(props: TextProps & { ref?: Ref<Plain> }) {
  const finding = use(Finding);
  if (!finding || !finding.find) return <Plain {...props} />;
  return <Marked finding={finding} {...props} />;
}

function Marked({ finding, ref, style, onLayout, ...props }: TextProps & { finding: Finding; ref?: Ref<Plain> }) {
  const c = useColours();
  const line = useRef<Plain | null>(null);
  const said = wordsOf(props.children);
  if (!foldForMatch(said).includes(finding.find)) return <Plain ref={ref} style={style} onLayout={onLayout} {...props} />;
  return (
    <Plain
      {...props}
      ref={(view) => {
        line.current = view;
        if (typeof ref === 'function') ref(view);
        else if (ref) ref.current = view;
      }}
      style={[style, { backgroundColor: c.accentSoft, color: c.accent }]}
      onLayout={(event) => {
        onLayout?.(event);
        if (line.current) finding.found(line.current);
      }}
    />
  );
}

/** What a line says in so many words: its strings and numbers, not what is drawn inside it as lines of their own. */
function wordsOf(children: ReactNode): string {
  let said = '';
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') said += String(child);
    else if (isValidElement(child) && child.type !== Plain && child.type !== Text) {
      said += wordsOf((child.props as { children?: ReactNode }).children);
    }
  });
  return said;
}
