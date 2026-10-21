/**
 * What French does to the words around a count or a name, kept in one place.
 */

/**
 * One of two wordings, the French way: 0 and 1 take the singular — « 0 titre »,
 * « 1 titre », « 2 titres » — where English's `oneOrMany` would say « 0 titres ».
 */
export const one = (count: number, singular: string, plural: string) =>
  Math.abs(count) < 2 ? singular : plural;

/**
 * « de » before a name, as French joins it: « de Pomme », « d’Adele »,
 * « des Rita Mitsouko », « du Grand Orchestre ». An h is left alone, since
 * whether it elides depends on the name and « de » before one is never wrong
 * enough to stumble over.
 */
export function de(name: string): string {
  if (/^les\s/i.test(name)) return `des ${name.slice(4)}`;
  if (/^le\s/i.test(name)) return `du ${name.slice(3)}`;
  return /^[aeiouàâäéèêëîïôöùûüœæ]/i.test(name) ? `d’${name}` : `de ${name}`;
}
