/**
 * The artists as a map: each a circle as big as how many songs they have,
 * joined to everyone they share a song with, and laid out so that what goes
 * together is near -- the artists of a genre gathered round its middle, the
 * genres that share the most artists beside one another, and anybody joined
 * to somebody pulled towards them.
 *
 * Worked out here and not drawn here (`components/artists/ArtistMap.tsx`):
 * plain numbers in, positions out, the same positions for the same library
 * every time, so that the map is where it was left.
 */

export type MapInput = {
  key: string;
  name: string;
  /** The ids of their songs: two artists with one in common are joined. */
  trackIds: readonly string[];
  /** The genre they are filed under, or null for none. */
  genre: string | null;
};

export type MapNode = {
  key: string;
  name: string;
  songs: number;
  genre: string | null;
  r: number;
  x: number;
  y: number;
};

/** Two artists who share [weight] songs, by their places in the nodes. */
export type MapLink = { a: number; b: number; weight: number };

export type ArtistMapLayout = {
  nodes: MapNode[];
  links: MapLink[];
  /** Where each genre's gathering is, and how far it spreads, for its name. */
  genres: { name: string; x: number; y: number; r: number }[];
  /**
   * Where each genre was set down to gather round, the artists of no genre
   * under '': what an artist moved by hand is kept beside ({@link MapPin}),
   * and what the map is laid out again from (see `previous`).
   */
  discs?: { name: string; x: number; y: number; r: number }[];
  width: number;
  height: number;
  /**
   * How far everything was moved to start at nought with its margin, against
   * where it was in the `previous` this was laid out from: what is drawn at
   * a point of that one is drawn here at that point and this.
   */
  offset?: { x: number; y: number };
};

/**
 * An artist put somewhere by hand, kept as where they are from the middle
 * of the genre they were put beside -- not as a place on the map, which the
 * map's laying out again moves about: their genre goes where it goes, and
 * they go with it.
 */
export type MapPin = { genre: string; dx: number; dy: number };

export type LayoutOptions = {
  /**
   * The map as it was before the library changed: laid out from it, with
   * everybody where they were and only those new or changed found a place
   * and let settle, rather than the whole of it laid out anew and everybody
   * somewhere else for one song more.
   */
  previous?: ArtistMapLayout | null;
  /** Artists put somewhere by hand, by their key: held where they were put while the rest settle round them. */
  pins?: Readonly<Record<string, MapPin>>;
  iterations?: number;
};

/** How big an artist's circle is for how many songs they have. */
export function radiusFor(songs: number): number {
  return Math.min(90, 16 + 8 * Math.sqrt(Math.max(1, songs) - 1) + Math.max(0, songs - 1) * 0.2);
}

/** Every pair of artists who share a song, and how many they share. */
export function linksOf(artists: readonly MapInput[]): MapLink[] {
  const byTrack = new Map<string, number[]>();
  artists.forEach((artist, index) => {
    for (const id of artist.trackIds) {
      const held = byTrack.get(id);
      if (held) held.push(index);
      else byTrack.set(id, [index]);
    }
  });
  const weights = new Map<string, MapLink>();
  for (const held of byTrack.values()) {
    if (held.length < 2) continue;
    for (let i = 0; i < held.length; i++) {
      for (let j = i + 1; j < held.length; j++) {
        const a = Math.min(held[i]!, held[j]!);
        const b = Math.max(held[i]!, held[j]!);
        if (a === b) continue;
        const key = `${a}:${b}`;
        const link = weights.get(key);
        if (link) link.weight += 1;
        else weights.set(key, { a, b, weight: 1 });
      }
    }
  }
  return [...weights.values()];
}

/** The genre most of [genres] name, with ties to the first met; null where none is named. */
export function mostNamed(genres: readonly (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let most = 0;
  for (const raw of genres) {
    const genre = raw?.trim().toLowerCase();
    if (!genre) continue;
    const count = (counts.get(genre) ?? 0) + 1;
    counts.set(genre, count);
    if (count > most) {
      most = count;
      best = genre;
    }
  }
  return best;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const PAD = 3;

/** The map of [artists]: see the top of this file, and {@link LayoutOptions}. */
export function layoutArtistMap(artists: readonly MapInput[], options: LayoutOptions | number = {}): ArtistMapLayout {
  const { previous = null, pins = {}, iterations: asked } = typeof options === 'number' ? { iterations: options } : options;
  // Laid out from before only where before knows where its genres were (a map kept from before that did not).
  const before = previous?.discs ? previous : null;
  const iterations = asked ?? (before ? 40 : 160);
  const links = linksOf(artists);
  const nodes: MapNode[] = artists.map((artist) => ({
    key: artist.key,
    name: artist.name,
    songs: artist.trackIds.length,
    genre: artist.genre,
    r: radiusFor(artist.trackIds.length),
    x: 0,
    y: 0,
  }));
  if (nodes.length === 0) return { nodes, links, genres: [], discs: [], width: 0, height: 0, offset: { x: 0, y: 0 } };

  // The genres, largest first; the artists filed under none gathered last, as one more.
  const groups = new Map<string, number[]>();
  nodes.forEach((node, index) => {
    const name = node.genre ?? '';
    const held = groups.get(name);
    if (held) held.push(index);
    else groups.set(name, [index]);
  });
  const area = (members: number[]) => members.reduce((sum, i) => sum + (nodes[i]!.r + PAD) ** 2, 0);
  const order = [...groups.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : area(b[1]) - area(a[1]) || a[0].localeCompare(b[0])));

  // How many artists each pair of genres have joined across them: the genres put beside the one they share most with.
  const genreOf = new Map<number, string>();
  for (const [name, members] of order) for (const i of members) genreOf.set(i, name);
  const across = new Map<string, number>();
  for (const link of links) {
    const ga = genreOf.get(link.a) ?? '';
    const gb = genreOf.get(link.b) ?? '';
    if (ga === gb) continue;
    const key = ga < gb ? `${ga}\u0000${gb}` : `${gb}\u0000${ga}`;
    across.set(key, (across.get(key) ?? 0) + link.weight);
  }
  const shared = (ga: string, gb: string) => across.get(ga < gb ? `${ga}\u0000${gb}` : `${gb}\u0000${ga}`) ?? 0;

  /*
    Each genre a disc big enough for its artists. From before, where it was
    then; a genre new since, and every genre on a map laid out from nothing,
    set down one after another beside the one placed already it shares most
    with, round it to the first place clear of every disc.
  */
  const discBefore = new Map((before?.discs ?? []).map((disc) => [disc.name, disc]));
  const placed: { name: string; x: number; y: number; r: number }[] = [];
  for (const [name, members] of order) {
    const r = Math.sqrt(area(members)) * 1.08 + 6;
    const was = discBefore.get(name);
    if (was) placed.push({ name, x: was.x, y: was.y, r });
  }
  for (const [name, members] of order) {
    if (discBefore.has(name)) continue;
    const r = Math.sqrt(area(members)) * 1.08 + 6;
    if (placed.length === 0) {
      placed.push({ name, x: 0, y: 0, r });
      continue;
    }
    let anchor = placed[0]!;
    let best = -1;
    for (const other of placed) {
      const weight = shared(name, other.name);
      if (weight > best) {
        best = weight;
        anchor = other;
      }
    }
    let spot = { x: anchor.x + anchor.r + r, y: anchor.y };
    search: for (let step = 0; step < 4000; step++) {
      const angle = step * GOLDEN;
      const distance = anchor.r + r + 4 + step * 2;
      const x = anchor.x + Math.cos(angle) * distance;
      const y = anchor.y + Math.sin(angle) * distance;
      for (const other of placed) {
        if (Math.hypot(other.x - x, other.y - y) < other.r + r + 4) continue search;
      }
      spot = { x, y };
      break;
    }
    placed.push({ name, x: spot.x, y: spot.y, r });
  }
  const centreOf = new Map(placed.map((disc) => [disc.name, disc]));

  /*
    Where each artist starts. Somebody put somewhere by hand, there, from
    the middle of the genre they were put beside, and held there; from
    before, where they were; and anybody new, on a map laid out from before,
    round their genre's middle to the first place clear of the rest, and on
    one laid out from nothing, with the rest of their genre: the biggest in
    the middle, the others spiralling out.
  */
  const fixed = new Set<number>();
  const where = new Map((before?.nodes ?? []).map((node) => [node.key, node]));
  const set = new Set<number>();
  nodes.forEach((node, index) => {
    const pin = pins[node.key];
    const disc = pin ? centreOf.get(pin.genre) : undefined;
    if (pin && disc) {
      node.x = disc.x + pin.dx;
      node.y = disc.y + pin.dy;
      fixed.add(index);
      set.add(index);
      return;
    }
    const was = where.get(node.key);
    if (was) {
      node.x = was.x;
      node.y = was.y;
      set.add(index);
    }
  });
  for (const [name, members] of order) {
    const disc = centreOf.get(name)!;
    const sorted = [...members].sort((a, b) => nodes[b]!.songs - nodes[a]!.songs || nodes[a]!.key.localeCompare(nodes[b]!.key));
    if (!before) {
      let spread = 0;
      sorted.forEach((i, at) => {
        const node = nodes[i]!;
        spread += (node.r + PAD) ** 2;
        if (set.has(i)) return;
        const distance = Math.sqrt(spread) * 0.95;
        node.x = disc.x + Math.cos(at * GOLDEN) * distance;
        node.y = disc.y + Math.sin(at * GOLDEN) * distance;
      });
      continue;
    }
    for (const i of sorted) {
      if (set.has(i)) continue;
      const node = nodes[i]!;
      search: for (let step = 0; step < 4000; step++) {
        const distance = step * 3;
        const x = disc.x + Math.cos(step * GOLDEN) * distance;
        const y = disc.y + Math.sin(step * GOLDEN) * distance;
        for (const other of set) {
          const o = nodes[other]!;
          if (Math.hypot(o.x - x, o.y - y) < o.r + node.r + PAD) continue search;
        }
        node.x = x;
        node.y = y;
        break;
      }
      set.add(i);
    }
  }

  /*
    Then let them settle: joined artists drawn together, each drawn to its
    genre, and none on top of another. Laid out from before, gently: those
    who were there already hardly move, and make room for those who were
    not. Those held by hand do not move at all; whoever is in their way does.
  */
  const heatFrom = before ? 0.35 : 1;
  const cell = 2 * (Math.max(...nodes.map((node) => node.r)) + PAD);
  for (let round = 0; round < iterations; round++) {
    const heat = heatFrom * (1 - round / iterations);
    for (const link of links) {
      const a = nodes[link.a]!;
      const b = nodes[link.b]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const want = a.r + b.r + 8;
      const pull = ((distance - want) / distance) * Math.min(0.2, 0.04 * link.weight) * heat;
      const ax = dx * pull;
      const ay = dy * pull;
      // The smaller one moves the more, and one held moves not at all.
      const heldA = fixed.has(link.a);
      const heldB = fixed.has(link.b);
      if (heldA && heldB) continue;
      const share = heldA ? 0 : heldB ? 1 : b.r / (a.r + b.r);
      a.x += ax * share;
      a.y += ay * share;
      b.x -= ax * (1 - share);
      b.y -= ay * (1 - share);
    }
    nodes.forEach((node, index) => {
      if (fixed.has(index)) return;
      const disc = centreOf.get(node.genre ?? '')!;
      node.x += (disc.x - node.x) * 0.03 * heat;
      node.y += (disc.y - node.y) * 0.03 * heat;
    });
    // Overlaps pushed apart, each circle only against those in the cells round it.
    const grid = new Map<string, number[]>();
    nodes.forEach((node, index) => {
      const key = `${Math.floor(node.x / cell)}:${Math.floor(node.y / cell)}`;
      const held = grid.get(key);
      if (held) held.push(index);
      else grid.set(key, [index]);
    });
    nodes.forEach((node, index) => {
      const cx = Math.floor(node.x / cell);
      const cy = Math.floor(node.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const other of grid.get(`${gx}:${gy}`) ?? []) {
            if (other <= index) continue;
            const b = nodes[other]!;
            const dx = b.x - node.x;
            const dy = b.y - node.y;
            const distance = Math.hypot(dx, dy);
            const want = node.r + b.r + PAD;
            if (distance >= want) continue;
            // Two in the same place are parted along a direction of their own.
            const ux = distance > 0.01 ? dx / distance : Math.cos(index + other);
            const uy = distance > 0.01 ? dy / distance : Math.sin(index + other);
            const heldA = fixed.has(index);
            const heldB = fixed.has(other);
            if (heldA && heldB) continue;
            const push = want - distance;
            const mine = heldA ? 0 : heldB ? 1 : 0.5;
            node.x -= ux * push * mine;
            node.y -= uy * push * mine;
            b.x += ux * push * (1 - mine);
            b.y += uy * push * (1 - mine);
          }
        }
      }
    });
  }

  // Moved so that the map starts at nought, with a margin all round.
  const margin = 40;
  const left = Math.min(...nodes.map((node) => node.x - node.r)) - margin;
  const top = Math.min(...nodes.map((node) => node.y - node.r)) - margin;
  for (const node of nodes) {
    node.x -= left;
    node.y -= top;
  }
  const discs = placed.map((disc) => ({ name: disc.name, x: disc.x - left, y: disc.y - top, r: disc.r }));
  const genres = discs
    .filter((disc) => disc.name !== '')
    .map((disc) => {
      const members = groups.get(disc.name) ?? [];
      // Where its artists ended up, which is not quite where they started.
      const x = members.reduce((sum, i) => sum + nodes[i]!.x, 0) / Math.max(1, members.length);
      const y = members.reduce((sum, i) => sum + nodes[i]!.y, 0) / Math.max(1, members.length);
      return { name: disc.name, x, y, r: disc.r };
    });
  return {
    nodes,
    links,
    genres,
    discs,
    width: Math.max(...nodes.map((node) => node.x + node.r)) + margin,
    height: Math.max(...nodes.map((node) => node.y + node.r)) + margin,
    offset: { x: -left, y: -top },
  };
}

/** Where [node] stands from the middle of its genre on [layout]: what is kept of somebody put there by hand. */
export function pinOf(layout: ArtistMapLayout, node: Pick<MapNode, 'genre' | 'x' | 'y'>): MapPin | null {
  const genre = node.genre ?? '';
  const disc = layout.discs?.find((one) => one.name === genre);
  return disc ? { genre, dx: node.x - disc.x, dy: node.y - disc.y } : null;
}

/**
 * Whether ([x], [y]) is inside the ring through [ring] -- x then y, point
 * after point, closed from the last back to the first -- by how many of its
 * sides a line from the point out to the right crosses: an odd number, in.
 * A ring that crosses itself counts what it goes round an odd number of times.
 */
export function insideRing(ring: readonly number[], x: number, y: number): boolean {
  const count = Math.floor(ring.length / 2);
  if (count < 3) return false;
  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2]!;
    const yi = ring[i * 2 + 1]!;
    const xj = ring[j * 2]!;
    const yj = ring[j * 2 + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The places, among [nodes], of those whose middle is inside [ring] (as for {@link insideRing}). */
export function nodesInside(nodes: readonly Pick<MapNode, 'x' | 'y'>[], ring: readonly number[]): number[] {
  const out: number[] = [];
  nodes.forEach((node, index) => {
    if (insideRing(ring, node.x, node.y)) out.push(index);
  });
  return out;
}
