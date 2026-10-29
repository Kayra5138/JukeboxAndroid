import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/*
  A view that cuts its contents to its shape works out that shape from its
  corners and its border. Given a border by one theme and then none at all by
  the next — which is what `outlined` gives a theme without an outline — it
  goes on cutting to the shape it had, and shows its fill and nothing inside
  it. It happened to every card in Settings once, and to the lists on the Lists
  tab again. `outlinedClip` says "no border" in as many words and is the one to
  use on such a view; this keeps it that way.
*/

const SRC = fileURLToPath(new URL('../../../', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Each `{ … }` in [text] whose own level, not a nested one, holds both [first] and [second]. */
function bothAtOneLevel(text: string, first: string, second: RegExp): number[] {
  const found: number[] = [];
  const open: number[] = [];
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === '{') open.push(at);
    else if (text[at] === '}' && open.length > 0) {
      const from = open.pop()!;
      const inner = text.slice(from + 1, at);
      let depth = 0;
      let hasFirst = false;
      let hasSecond = false;
      for (let index = 0; index < inner.length; index += 1) {
        const ch = inner[index];
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        else if (depth === 0) {
          if (inner.startsWith(first, index)) hasFirst = true;
          second.lastIndex = index;
          const match = second.exec(inner);
          if (match && match.index === index) hasSecond = true;
        }
      }
      if (hasFirst && hasSecond) found.push(text.slice(0, from).split('\n').length);
    }
  }
  return found;
}

describe('views that cut their contents to their shape', () => {
  it('are given their edge by outlinedClip, which says when there is none', () => {
    const wrong: string[] = [];
    for (const path of files(SRC)) {
      const text = readFileSync(path, 'utf8');
      if (!text.includes("overflow: 'hidden'")) continue;
      for (const line of bothAtOneLevel(text, "overflow: 'hidden'", /\.\.\.outlined\(/y)) {
        wrong.push(`${path.slice(SRC.length)}:${line}`);
      }
    }
    assert.deepEqual(wrong, [], `outlined where outlinedClip is wanted:\n${wrong.join('\n')}`);
  });
});

describe('pictures', () => {
  /*
    A change of theme can hand a native picture from one parent to another,
    and one that has been through that does not always fetch what it showed
    again: covers went missing that way, twice. The app's own `Image` is made
    afresh for a new theme and has nothing to lose; every picture goes through it.
  */
  it('are drawn by the app’s own Image, which is made afresh with the theme', () => {
    const direct = files(SRC)
      .filter((path) => !path.endsWith(join('components', 'Picture.tsx')))
      .filter((path) => /from 'expo-image'/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(SRC.length));
    assert.deepEqual(direct, [], `expo-image used directly:\n${direct.join('\n')}`);
  });
});
