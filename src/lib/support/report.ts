import type { ErrorEntry } from './errorLog.ts';

/**
 * What a bug report says about the app and the phone, and the link that
 * opens a new issue with it filled in.
 *
 * The report screen shows exactly what this makes, before anything is done
 * with it: the same lines go into the link, onto the clipboard and onto the
 * screen. They are in English whatever the app is speaking, being read by
 * whoever answers the issue, and are plain enough to be read by anybody.
 *
 * Nothing here knows about the phone, so what goes into a report, and how
 * the link is kept short enough to open, can be tested.
 */

export const NEW_ISSUE_URL = 'https://github.com/Kayra5138/JukeboxAndroid/issues/new';
/** The issue form in `.github/ISSUE_TEMPLATE/bug.yml`, whose field ids are the parameters below. */
export const TEMPLATE = 'bug.yml';

/**
 * How long the link may be. Browsers take far longer ones; GitHub does not,
 * and answers a long enough address with an error page instead of the form.
 */
export const URL_LIMIT = 7000;

export type ReportFacts = {
  version: string | null;
  /** When the build was made, already written out; null where the build does not say. */
  built: string | null;
  /** The phone's Android version, as "14". */
  android: string | null;
  maker: string | null;
  model: string | null;
  language: string;
  /** The theme chosen, and where that is the phone's choice, the one it came to. */
  theme: string;
  /** How many tracks the library has; null while it is not read. */
  tracks: number | null;
  /** Whether this build can download from YouTube, which Discover depends on too. */
  downloads: boolean;
};

/**
 * "Google Pixel 8, Android 14". The maker is left out where the model
 * already begins with it, and given a capital where it has none.
 */
export function phoneLine(facts: Pick<ReportFacts, 'maker' | 'model' | 'android'>): string {
  const maker = (facts.maker ?? '').trim();
  const model = (facts.model ?? '').trim();
  const named = maker ? maker.charAt(0).toUpperCase() + maker.slice(1) : '';
  const device = !model ? named : !named || model.toLowerCase().startsWith(maker.toLowerCase()) ? model : `${named} ${model}`;
  const android = facts.android ? `Android ${facts.android}` : '';
  return [device, android].filter(Boolean).join(', ') || 'Unknown';
}

/** The facts beyond the version and the phone, one to a line. */
export function detailLines(facts: ReportFacts): string[] {
  return [
    `Built: ${facts.built ?? 'unknown'}`,
    `Language: ${facts.language}`,
    `Theme: ${facts.theme}`,
    `Library: ${facts.tracks == null ? 'not read' : `${facts.tracks} tracks`}`,
    `Downloads and Discover: ${facts.downloads ? 'available' : 'not in this build'}`,
  ];
}

/** "2026-10-15 14:03" in UTC, which reads the same to whoever answers wherever they are. */
export function stamp(at: number): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return '?';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')}Z`;
}

/** One failure as a line of the report. */
export function errorLine(entry: ErrorEntry): string {
  return `${stamp(entry.at)} ${entry.version} ${entry.kind}: ${entry.message}`;
}

/** What goes in the form's last box: the details, and the failures under them. */
export function moreText(facts: ReportFacts, errors: readonly ErrorEntry[] | null): string {
  const lines = detailLines(facts);
  if (errors) {
    lines.push('', errors.length ? `Recent errors (oldest first, UTC):` : 'Recent errors: none');
    for (const entry of errors) lines.push(errorLine(entry));
  }
  return ['```', ...lines, '```'].join('\n');
}

/** All of it as one piece of text, for the clipboard: to paste into an issue or a message. */
export function reportText(facts: ReportFacts, errors: readonly ErrorEntry[] | null): string {
  return [`Version: ${facts.version ?? 'unknown'}`, `Phone: ${phoneLine(facts)}`, '', moreText(facts, errors)].join('\n');
}

function linkWith(facts: ReportFacts, errors: readonly ErrorEntry[] | null): string {
  const fields: [string, string][] = [
    ['template', TEMPLATE],
    ['version', facts.version ?? ''],
    ['phone', phoneLine(facts)],
    ['more', moreText(facts, errors)],
  ];
  return `${NEW_ISSUE_URL}?${fields.map(([key, value]) => `${key}=${encodeURIComponent(wellFormed(value))}`).join('&')}`;
}

/**
 * [text] with any half of a surrogate pair standing alone put as U+FFFD.
 * `encodeURIComponent` throws on one, and an error's message can carry one —
 * a file name cut short, a title read badly — which made the report screen
 * fail to draw at all.
 */
export function wellFormed(text: string): string {
  let out = '';
  for (let at = 0; at < text.length; at++) {
    const code = text.charCodeAt(at);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(at + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[at] + text[at + 1];
        at++;
      } else out += '\ufffd';
    } else if (code >= 0xdc00 && code <= 0xdfff) out += '\ufffd';
    else out += text[at];
  }
  return out;
}

/**
 * The link to a new issue with the form filled in, and how many failures
 * had to be left out of it. Under {@link URL_LIMIT}: the oldest failures go
 * first, one at a time, since the latest are the ones the report is about.
 * [errors] is null where they are not to be included at all.
 */
export function issueLink(
  facts: ReportFacts,
  errors: readonly ErrorEntry[] | null,
  limit = URL_LIMIT
): { url: string; left: number } {
  if (!errors) return { url: linkWith(facts, null), left: 0 };
  let kept = errors;
  let url = linkWith(facts, kept);
  while (url.length > limit && kept.length > 0) {
    kept = kept.slice(1);
    url = linkWith(facts, kept);
  }
  return { url, left: errors.length - kept.length };
}
