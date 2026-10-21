/**
 * Turning the bytes of a lyrics file into its text.
 *
 * A `.lrc` says nothing about what it is written in, and the files people keep
 * beside their songs come from everywhere: UTF-8 from a modern tagger, with or
 * without the mark at the front that Windows tools add; UTF-16 from Notepad;
 * an old Western code page from a player twenty years old. All of those are
 * read here. What is not — the double-byte code pages a great many Chinese and
 * Japanese files were saved in — is refused rather than guessed at, because
 * the guess would be a screen of the wrong characters where LRCLIB might have
 * had the right ones.
 *
 * Done by hand rather than with `TextDecoder`, which the app's JavaScript
 * engine is not promised to have, and so that every rule is one a test can
 * hold it to.
 */

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64, as the native side sends a file's bytes. Null for anything that is not base64. */
export function fromBase64(text: string): Uint8Array | null {
  const clean = text.replace(/[\s=]+$/g, '').replace(/\s+/g, '');
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let held = 0;
  let at = 0;
  for (const char of clean) {
    const value = BASE64.indexOf(char);
    if (value < 0) return null;
    held = (held << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (held >> bits) & 0xff;
    }
  }
  return out.subarray(0, at);
}

/** UTF-8, strictly: null at the first byte that cannot be part of it. */
export function utf8(bytes: Uint8Array, from: number): string | null {
  let out = '';
  let index = from;
  while (index < bytes.length) {
    const first = bytes[index]!;
    let code: number;
    let follow: number;
    if (first < 0x80) {
      code = first;
      follow = 0;
    } else if (first >= 0xc2 && first <= 0xdf) {
      code = first & 0x1f;
      follow = 1;
    } else if (first >= 0xe0 && first <= 0xef) {
      code = first & 0x0f;
      follow = 2;
    } else if (first >= 0xf0 && first <= 0xf4) {
      code = first & 0x07;
      follow = 3;
    } else {
      return null;
    }
    if (index + follow >= bytes.length && follow > 0) return null;
    for (let step = 1; step <= follow; step++) {
      const next = bytes[index + step]!;
      if ((next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 0x3f);
    }
    // Overlong forms, surrogates and anything past the last code point are
    // not UTF-8 however they are spelled.
    if (
      (follow === 2 && code < 0x800) ||
      (follow === 3 && (code < 0x10000 || code > 0x10ffff)) ||
      (code >= 0xd800 && code <= 0xdfff)
    ) {
      return null;
    }
    out += String.fromCodePoint(code);
    index += follow + 1;
  }
  return out;
}

export function utf16(bytes: Uint8Array, from: number, littleEndian: boolean): string {
  let out = '';
  for (let index = from; index + 1 < bytes.length; index += 2) {
    const unit = littleEndian
      ? bytes[index]! | (bytes[index + 1]! << 8)
      : (bytes[index]! << 8) | bytes[index + 1]!;
    out += String.fromCharCode(unit);
  }
  return out;
}

/** Windows-1252's own characters in 0x80–0x9F; the rest of its upper half is Latin-1. */
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

export function cp1252(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(CP1252[byte] ?? byte);
  return out;
}

/**
 * Whether bytes that are not UTF-8 look like a double-byte code page — GBK,
 * Big5, Shift JIS — rather than a single-byte Western one.
 *
 * In a Western file the bytes above 0x7F are letters with accents, and stand
 * one at a time among plain ones: "caf\xe9". In a double-byte file every
 * character outside ASCII is two of them together, and runs of them make up
 * most of a line. So: most high bytes in pairs or longer runs means a
 * double-byte file.
 */
function looksDoubleByte(bytes: Uint8Array): boolean {
  let high = 0;
  let paired = 0;
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index]! < 0x80) continue;
    high++;
    const before = index > 0 && bytes[index - 1]! >= 0x80;
    const after = index + 1 < bytes.length && bytes[index + 1]! >= 0x80;
    if (before || after) paired++;
  }
  return high > 0 && paired / high > 0.5;
}

/**
 * Which way round UTF-16 with no mark at the front is, or null when it does
 * not look like UTF-16 at all.
 *
 * Lyrics are mostly spaces, digits and brackets even in a language that is
 * not written in Latin letters, and each of those is a zero byte beside its
 * own in UTF-16. A file where most of one side is zeros is UTF-16 with that
 * side high; text in any single-byte encoding has no zeros at all.
 */
export function bareUtf16(bytes: Uint8Array): boolean | null {
  if (bytes.length < 4 || bytes.length % 2 !== 0) return null;
  // A zero only at the very end is a single-byte file finished the way some
  // tools finish one, and in a file that short it would be most of a side.
  if (bytes.subarray(0, -1).indexOf(0) < 0) return null;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    if (bytes[index] === 0) evenZeros++;
    if (bytes[index + 1] === 0) oddZeros++;
  }
  const pairs = bytes.length / 2;
  if (oddZeros / pairs > 0.3 && evenZeros / pairs < 0.05) return true;
  if (evenZeros / pairs > 0.3 && oddZeros / pairs < 0.05) return false;
  return null;
}

/**
 * The text of a lyrics file, or null when it cannot be read as text.
 *
 * A mark at the front decides it. Without one: UTF-16 if it looks like it,
 * UTF-8 if every byte agrees, and the Western code page if the high bytes
 * stand alone. Anything else, and anything with control characters in it
 * beyond the line breaks and tabs a text has, is not a lyrics file whatever
 * it is called.
 */
export function decodeLyricsFile(bytes: Uint8Array): string | null {
  let text: string | null;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = utf8(bytes, 3);
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = utf16(bytes, 2, true);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = utf16(bytes, 2, false);
  } else {
    const order = bareUtf16(bytes);
    if (order !== null) {
      text = utf16(bytes, 0, order);
    } else {
      text = utf8(bytes, 0) ?? (looksDoubleByte(bytes) ? null : cp1252(bytes));
    }
  }
  if (text === null) return null;
  // A stray zero at the very end is how some tools finish a file; anywhere
  // else, or any other control character, and this was never text.
  text = text.replace(/\u0000+$/, '');
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text)) return null;
  return text;
}
