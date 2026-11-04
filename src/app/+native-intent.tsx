/**
 * Links the system hands the app, before the router goes anywhere with them.
 *
 * A sound file opened with Jukebox — from Files, from a chat — comes as the
 * file's own address, `content://…` or `file://…`, and the router would take
 * it for a page of the app and show that there is no such page. It is no page:
 * the player plays it (`player/OpenedAudio.tsx`), and the app stays where it
 * is, or opens where it would have. Every other link goes where it says.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (/^(content|file):/i.test(path)) return initial ? '/' : null;
    return path;
  } catch {
    return initial ? '/' : null;
  }
}
