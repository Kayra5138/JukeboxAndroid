import { db } from './index.ts';
import { guestsNamedIn, splitCredit, type Verdict } from '../metadata/credit.ts';
import { foldForMatch } from '../metadata/text.ts';

/** Write down what a lookup learned about a credit. The newest answer stands. */
export function saveCredit(credit: string, oneArtist: boolean): void {
  const key = foldForMatch(credit);
  if (!key) return;
  db().runSync(
    `INSERT INTO artist_credits (credit, one_artist, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(credit) DO UPDATE SET
       one_artist = excluded.one_artist, fetched_at = excluded.fetched_at`,
    key,
    oneArtist ? 1 : 0,
    Date.now()
  );
}

/** Everything a catalogue has settled, as something the splitter can ask. */
function verdicts(): Verdict {
  const known = new Map<string, boolean>();
  for (const row of db().getAllSync<{ credit: string; one_artist: number }>(
    'SELECT credit, one_artist FROM artist_credits'
  )) {
    known.set(row.credit, row.one_artist === 1);
  }
  return (credit) => known.get(foldForMatch(credit));
}

/**
 * A way to read who a listen names that knows what the catalogues have said.
 *
 * The names in the credit, and after them any guest the title names.
 *
 * Read once and handed back as a function, because whoever wants it wants it
 * for a whole list of credits at a time, and a query per credit would be a
 * query per row of somebody's listening history.
 */
export function creditReader(): (listen: { artist: string; title?: string | null }) => string[] {
  const verdict = verdicts();
  return (listen) => [...splitCredit(listen.artist, verdict), ...guestsNamedIn(listen.title)];
}
