/**
 * Whether there is a newer Jukebox than the one on the phone.
 *
 * The app is not in a store, so nothing tells anybody there is a new
 * version: somebody who installed it from GitHub by hand learns of one by
 * going back to look, which nobody does. Obtainium users are told by
 * Obtainium; this is for everybody else, and says so quietly — a row at the
 * top of Settings and a dot on its tab, with no pop-up and no notification.
 *
 * ---------------------------------------------------------------------------
 * What leaves the phone, and to whom
 * ---------------------------------------------------------------------------
 *
 * One request, to GitHub, with no account, key, cookie or token:
 *
 *   GET https://api.github.com/repos/Kayra5138/JukeboxAndroid/releases/latest
 *
 * with the same line about the app that the catalogues are told
 * (`USER_AGENT` in `metadata/http.ts`). Nothing about the phone, the library
 * or what is played goes with it; GitHub sees the address it came from and
 * that it was Jukebox asking. The answer is the newest release that is
 * neither a draft nor a pre-release — the endpoint leaves those out itself.
 *
 * It is made at most once in twenty-four hours, counted from the last time
 * it was tried, answered or not, and only when the app comes to the front.
 * A check that fails says nothing and is not tried again until the day is
 * up. With the switch in Settings → Your data turned off it is not made at
 * all, and what an earlier one found is not shown either.
 *
 * What was learnt is kept, so that the row is there without asking again,
 * and goes as soon as the version on the phone is the one it named or later.
 *
 * This file is the arithmetic of that, with nothing of the phone in it.
 */

export const RELEASES_URL = 'https://api.github.com/repos/Kayra5138/JukeboxAndroid/releases/latest';

/** Where a release's page may be, so that nothing else is opened on the strength of an answer. */
const RELEASE_PAGE = /^https:\/\/github\.com\/Kayra5138\/JukeboxAndroid\/releases\/[^\s]+$/;

/** A day: how often the check is made. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * A version as its three numbers, out of "0.34.0" or a tag such as
 * "v0.34.0"; null for anything else, a pre-release's "-beta.1" included,
 * since nobody is to be offered one of those.
 */
export function parseVersion(text: unknown): [number, number, number] | null {
  if (typeof text !== 'string') return null;
  const found = /^v?(\d{1,6})\.(\d{1,6})(?:\.(\d{1,6}))?$/i.exec(text.trim());
  if (!found) return null;
  return [Number(found[1]), Number(found[2]), Number(found[3] ?? 0)];
}

/** Whether [version] is a later release than [than]; false where either cannot be read. */
export function isNewer(version: unknown, than: unknown): boolean {
  const a = parseVersion(version);
  const b = parseVersion(than);
  if (!a || !b) return false;
  for (let place = 0; place < 3; place += 1) {
    if (a[place] !== b[place]) return a[place] > b[place];
  }
  return false;
}

/** What the last check learnt, and when it was made. */
export type UpdateKnown = {
  /** The newest release's version, without its "v"; null before an answer. */
  latest: string | null;
  /** Its page on GitHub. */
  url: string | null;
  /** When a check was last tried, answered or not; null before the first. */
  triedAt: number | null;
};

export const NOTHING_KNOWN: UpdateKnown = { latest: null, url: null, triedAt: null };

/** [UpdateKnown] out of what was written down, where that is anything at all. */
export function readKnown(text: string | null | undefined): UpdateKnown {
  if (!text) return NOTHING_KNOWN;
  try {
    const kept = JSON.parse(text) as Partial<Record<keyof UpdateKnown, unknown>> | null;
    const version = parseVersion(kept?.latest) ? (kept?.latest as string) : null;
    const url = typeof kept?.url === 'string' && RELEASE_PAGE.test(kept.url) ? kept.url : null;
    const triedAt = typeof kept?.triedAt === 'number' && Number.isFinite(kept.triedAt) && kept.triedAt > 0 ? kept.triedAt : null;
    return version && url ? { latest: version, url, triedAt } : { ...NOTHING_KNOWN, triedAt };
  } catch {
    return NOTHING_KNOWN;
  }
}

/**
 * Whether the check may be made now. [wanted] is the switch. A last try
 * that is still to come is a clock that was put back, and counts as long
 * ago rather than as a reason never to ask again.
 */
export function isDue(known: UpdateKnown, now: number, wanted: boolean): boolean {
  if (!wanted) return false;
  if (known.triedAt == null || known.triedAt > now) return true;
  return now - known.triedAt >= CHECK_EVERY_MS;
}

/**
 * The release out of GitHub's answer, or null for an answer that is not one:
 * a draft or a pre-release, a tag that is not a version, a page that is not
 * this project's.
 */
export function releaseOf(body: unknown): { version: string; url: string } | null {
  const release = body as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown } | null;
  if (!release || typeof release !== 'object') return null;
  if (release.draft === true || release.prerelease === true) return null;
  const parsed = parseVersion(release.tag_name);
  if (!parsed || typeof release.html_url !== 'string' || !RELEASE_PAGE.test(release.html_url)) return null;
  return { version: parsed.join('.'), url: release.html_url };
}

/**
 * The release to tell somebody of: one newer than [running], with the switch
 * on. Null otherwise — and so, once the update is installed, the row and the
 * dot go by themselves.
 */
export function offerOf(known: UpdateKnown, running: string | null | undefined, wanted: boolean): { version: string; url: string } | null {
  if (!wanted || !known.latest || !known.url) return null;
  return isNewer(known.latest, running) ? { version: known.latest, url: known.url } : null;
}
