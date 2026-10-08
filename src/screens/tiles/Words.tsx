import type { ReactNode } from 'react';

import { useT, type Strings } from '../../lib/i18n/index';
import type { Speed } from '../../lib/tiles/game';

/**
 * The words of the language in use, for a part of the game's screen.
 *
 * `<Words>{(t) => <Text>{t.tiles.pause.title}</Text>}</Words>`
 *
 * A component of its own rather than a `useT()` in `TilesScreen`, and for one
 * reason: that screen's hooks are a long run of shared values, worklets and
 * effects whose order has been settled on a phone, and asking for the language
 * there would put one more in among them. Here the asking is this component's
 * own, the screen is told nothing, and only the pages that have words on them
 * — which are never up while keys are falling — are drawn again when the
 * language changes.
 */
export function Words({ children }: { children: (t: Strings) => ReactNode }) {
  return <>{children(useT())}</>;
}

/**
 * What a difficulty is called.
 *
 * Looked up by the id it is stored under. One the table has no line for is
 * shown by the name it carries, which is the English one.
 */
export function speedName(speed: Speed, t: Strings): string {
  return (t.tiles.speeds as Record<string, string>)[speed.id] ?? speed.name;
}
