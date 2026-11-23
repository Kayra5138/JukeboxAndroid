import { SETTINGS } from '../db/index.ts';
import { orderSetting } from './order.ts';

/** The five tabs, by the names of their groups (`(lists)` is `lists`), in the order they came. */
export const TABS = ['library', 'lists', 'search', 'stats', 'settings'] as const;
export type TabName = (typeof TABS)[number];

/**
 * The order of the tabs along the bar: Settings → Look & feel. Only the bar
 * is put in it; the tabs themselves are where they were, which is what keeps
 * each as it was left when they are moved.
 */
export const tabOrder = orderSetting<TabName>(SETTINGS.tabOrder, TABS);
