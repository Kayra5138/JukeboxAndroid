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

/**
 * A link from outside the app, made safe to follow: what it may ask the app
 * to do by itself is taken off, and what it may ask the app to fetch is
 * marked as asked by a link.
 *
 * A search is written into the box and not run (`run`): another app could
 * otherwise have this one search YouTube for whatever it liked, as often as
 * it liked. A podcast's page asks first before reading a feed (`outside`),
 * and will not read one on the phone or on its own network at all.
 */
export function fromOutside(path: string): string {
  const at = path.indexOf('?');
  if (at < 0) return path;
  const head = path.slice(0, at);
  const pairs = path
    .slice(at + 1)
    .split('&')
    .filter((pair) => pair !== '' && !/^(run|outside)(=|$)/i.test(pair));
  if (/(^|\/)podcast$/i.test(head)) pairs.push('outside=1');
  return pairs.length > 0 ? `${head}?${pairs.join('&')}` : head;
}

/**
 * Where a link the system hands the app goes, before the router goes
 * anywhere with it: see `+native-intent.tsx`. A sound file's own address goes
 * nowhere, the app staying where it is or, opening, opening where it would
 * have; every other link where it says, less what it may not ask by itself.
 */
export function systemPathTo(path: string, initial: boolean): string | null {
  try {
    if (/^(content|file):/i.test(path)) return initial ? '/' : null;
    return fromOutside(path);
  } catch {
    return initial ? '/' : null;
  }
}

/**
 * Whether [address] is on this phone or on a network of its own: a name
 * that is the phone itself, or a number from the ranges kept for those.
 * Not a lookup of the name: a link is refused for what it says, and a name
 * that leads somewhere private is the native side's to turn away.
 */
export function isPrivateAddress(address: string): boolean {
  const host = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(address.trim())?.[1]?.toLowerCase();
  if (host == null || host === '') return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1);
    return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('::ffff:');
  }
  const four = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!four) return !host.includes('.');
  const [a, b] = [Number(four[1]), Number(four[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** The name of the place [address] is at, for saying where a link points. */
export function hostOf(address: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#]*)/i.exec(address.trim())?.[1] ?? address;
}
