import { SETTINGS } from '../db/index';
import { switchSetting } from './switchSetting';

/**
 * Whether a list's page says, under its songs, which others might belong in
 * it (`playlists/suggest.ts`): Settings → Library. On unless turned off.
 */
const suggesting = switchSetting(SETTINGS.listSuggestions, true);

export const useListSuggestions = suggesting.useOn;
export const setListSuggestions = suggesting.set;
