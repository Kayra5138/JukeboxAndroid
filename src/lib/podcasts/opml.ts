/**
 * The podcasts followed as an OPML file, the list every podcast app writes
 * and reads, to move from one app to another: written from the shows followed
 * here, and read for the feeds another app followed. Nothing here reads or
 * writes a file, so it can be tested; the settings for tapes do that.
 */

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

const CHANNEL_PAGE = /^https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/i;
const CHANNEL_FEED = /^https?:\/\/(?:www\.)?youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[A-Za-z0-9_-]{22})$/i;

/**
 * A show's address as another app reads it: a YouTube channel, followed here
 * by its page, as the feed YouTube gives of it, which is what a podcast app
 * takes; a podcast's as it is.
 */
export function feedForOthers(feedUrl: string): string {
  const channel = CHANNEL_PAGE.exec(feedUrl.trim());
  return channel ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channel[1]}` : feedUrl;
}

/** A feed another app followed as it is followed here: a YouTube channel's feed as the channel's page. */
export function feedFromOthers(feed: string): string {
  const channel = CHANNEL_FEED.exec(feed.trim());
  return channel ? `https://www.youtube.com/channel/${channel[1]}` : feed;
}

/** [shows] as an OPML document, one outline each. */
export function toOpml(shows: readonly { feedUrl: string; title: string }[], now = new Date()): string {
  const lines = shows.map(
    (show) => `    <outline type="rss" text="${escape(show.title)}" title="${escape(show.title)}" xmlUrl="${escape(feedForOthers(show.feedUrl))}" />`
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    '    <title>Jukebox podcasts</title>',
    `    <dateCreated>${now.toUTCString()}</dateCreated>`,
    '  </head>',
    '  <body>',
    ...lines,
    '  </body>',
    '</opml>',
    '',
  ].join('\n');
}

/**
 * The feeds an OPML document follows, each once, in its order: every outline
 * with an `xmlUrl` that is a web address, however deep in folders it is and
 * whatever the case of the attribute's name.
 */
export function feedsInOpml(text: string): string[] {
  const feeds: string[] = [];
  // A quoted value is taken whole, with any `>` in it: a title saying "A > B" ended the outline there, before its feed.
  for (const outline of text.matchAll(/<outline\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const found = /\bxmlurl\s*=\s*("([^"]*)"|'([^']*)')/i.exec(outline[0]);
    const feed = found ? feedFromOthers(unescape((found[2] ?? found[3] ?? '').trim())) : '';
    if (/^https?:\/\/\S+$/i.test(feed) && !feeds.includes(feed)) feeds.push(feed);
  }
  return feeds;
}
