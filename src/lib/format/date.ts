/**
 * Dates written day first: `23/09/2026`.
 *
 * Spelled out rather than left to `toLocaleString`, which reads the order off
 * the device's locale and on this phone settles on the American month-first
 * one — so a build made on the twenty-third of September was shown as 9/23.
 * The order is a choice the app makes, not something to be inherited, and
 * writing it out also keeps it away from Intl, whose support on React Native's
 * engine has never been something to lean on.
 */
const pad = (value: number) => String(value).padStart(2, '0');

export function formatDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** The same, with the time of day: `23/09/2026 14:05`. */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
