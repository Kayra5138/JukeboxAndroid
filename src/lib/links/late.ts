/**
 * Where a link the app was opened with goes, as a page of the app; null for
 * one that is not a page. A sound file's own address, `content://…` or
 * `file://…`, is no page: the player plays it (`player/OpenedAudio.tsx`).
 * See `LateLink.tsx` for when this is asked.
 */
export function pageOfLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = /^([a-z][a-z0-9+.-]*):\/\/\/?(.*)$/i.exec(url.trim());
  if (!parsed || !/^jukebox$/i.test(parsed[1]!)) return null;
  const rest = parsed[2]!;
  if (rest === '' || rest.startsWith('?')) return null;
  return `/${rest}`;
}
