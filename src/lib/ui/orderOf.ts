/** The arithmetic of an order somebody chose (`order.ts`), apart from where it is kept, for the tests to reach. */
export function orderFrom<T extends string>(stored: string | null, all: readonly T[]): T[] {
  const named: T[] = [];
  for (const name of (stored ?? '').split(',')) {
    if ((all as readonly string[]).includes(name) && !named.includes(name as T)) named.push(name as T);
  }
  return [...named, ...all.filter((one) => !named.includes(one))];
}

/** [order] with [item] a place earlier ([by] -1) or later (1), where there is a place to go. */
export function moved<T>(order: readonly T[], item: T, by: -1 | 1): T[] {
  const at = order.indexOf(item);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  next[at] = next[to]!;
  next[to] = item;
  return next;
}
