import { DiscoverSettings } from '../../../components/DiscoverSettings';
import { PageScroll } from '../../../components/Page';

/**
 * Discover's settings on a screen of their own, opened from the gear over
 * the list and from a row in Settings.
 *
 * They were a card in Settings once, a long way down it, and that was the
 * only way to them: to keep five songs ready in place of three meant leaving
 * the list, finding the card and coming back.
 */
export default function DiscoverSettingsScreen() {
  return (
    <PageScroll>
      <DiscoverSettings standalone />
    </PageScroll>
  );
}
