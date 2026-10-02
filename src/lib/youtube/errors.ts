/** Native bridge exception envelopes and extractor traces belong in logs, not the UI. */
export function youtubeError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/does not contain a playlist|paste a YouTube playlist link|Illegal character in/i.test(message)) return 'Paste a YouTube playlist link, or search by playlist name.';
  if (/single video link|Use a video link|YouTube video link/i.test(message)) return 'Enter a song name or a valid YouTube video link.';
  if (/queue is full|up to 500/i.test(message)) return 'The download queue is full. Wait for some tracks to finish, then try again.';
  if (/private|unavailable|does not exist/i.test(message)) return 'This video or playlist is unavailable. Try another public playlist or search.';
  if (/network|resolve|connection|timed out|too long/i.test(message)) return 'Could not reach YouTube. Check your connection and try again.';
  if (/Sign in|verification|bot|403/i.test(message)) return 'YouTube could not complete this request. Try again later or choose another result.';
  return fallback;
}
