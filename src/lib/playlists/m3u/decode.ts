import { bareUtf16, cp1252, utf16, utf8 } from '../../lyrics/decode.ts';

/**
 * Turning the bytes of a playlist file into its text.
 *
 * An `.m3u8` is UTF-8 by definition, and a plain `.m3u` is whatever the
 * program that wrote it was using: UTF-8 from anything recent on a phone,
 * the Windows code page from Winamp, foobar2000 or MusicBee on a PC, now and
 * then UTF-16 from a Windows tool that thought it was being helpful. The
 * name of the file is not trusted to say which. A file that is valid UTF-8 is
 * read as UTF-8 whatever it is called, since text in a single-byte code page
 * almost never is by accident; a file called `.m3u8` that is not valid UTF-8
 * was written by something that was wrong about it, and is read the way an
 * `.m3u` would be.
 *
 * Where it comes to a code page, nothing in the bytes says which one. A
 * Turkish PC writes `Şımarık` in Windows-1254, a Russian one writes `Кино` in
 * Windows-1251, and both are byte for byte a believable Western file too. So
 * this does not choose: it offers each reading, the Western one first, and
 * the import keeps whichever finds more of the songs in the library (see
 * `index.ts`). The playlist is a list of the user's own files, and which
 * reading names more of them is a better judge than any guess at the text.
 *
 * The rules about marks, UTF-16 and UTF-8 are the lyrics reader's
 * (`lyrics/decode.ts`), shared rather than written twice.
 */

/** One way of reading the file, and what it is called in a message. */
export type Reading = { encoding: string; text: string };

/** Windows-1254, which is Windows-1252 with six letters changed for Turkish. */
const CP1254: Record<number, number> = {
  0xd0: 0x011e, 0xdd: 0x0130, 0xde: 0x015e, 0xf0: 0x011f, 0xfd: 0x0131, 0xfe: 0x015f,
};

/** Windows-1251's 0x80–0xBF. From 0xC0 on it is the Russian alphabet in order, А to я. */
const CP1251: number[] = [
  0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021, 0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
  0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0xfffd, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
  0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7, 0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
  0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7, 0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
];

function cp1254(bytes: Uint8Array): string {
  const western = cp1252(bytes);
  let out = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const turkish = CP1254[bytes[index]!];
    out += turkish ? String.fromCharCode(turkish) : western[index]!;
  }
  return out;
}

function cp1251(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += String.fromCharCode(byte < 0x80 ? byte : byte < 0xc0 ? CP1251[byte - 0x80]! : 0x0410 + byte - 0xc0);
  }
  return out;
}

/**
 * The ways the file can be read, the likeliest first, or an empty list when
 * it is not text at all: a picture or a song picked by mistake.
 *
 * Only one where the bytes say: a mark at the front, UTF-16 by its zeros, or
 * valid UTF-8. Three where they do not -- Western, Turkish and Cyrillic, the
 * code pages of the PCs this app's own languages are spoken on that write
 * one byte to a letter. The double-byte pages of China and Japan are not
 * among them; a playlist saved in one of those is read as Western, and its
 * file names will not be found.
 */
export function readings(bytes: Uint8Array): Reading[] {
  let found: Reading[];
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = utf8(bytes, 3);
    found = text === null ? singleByte(bytes.subarray(3)) : [{ encoding: 'UTF-8', text }];
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    found = [{ encoding: 'UTF-16', text: utf16(bytes, 2, true) }];
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    found = [{ encoding: 'UTF-16', text: utf16(bytes, 2, false) }];
  } else {
    const order = bareUtf16(bytes);
    const text = order === null ? utf8(bytes, 0) : utf16(bytes, 0, order);
    found = text === null ? singleByte(bytes) : [{ encoding: order === null ? 'UTF-8' : 'UTF-16', text }];
  }
  return found
    .map((reading) => ({ ...reading, text: reading.text.replace(/\u0000+$/, '') }))
    // Control characters beyond line breaks and tabs are not in any playlist
    // anybody wrote, and are in every binary file.
    .filter((reading) => !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(reading.text));
}

function singleByte(bytes: Uint8Array): Reading[] {
  return [
    { encoding: 'Windows-1252', text: cp1252(bytes) },
    { encoding: 'Windows-1254', text: cp1254(bytes) },
    { encoding: 'Windows-1251', text: cp1251(bytes) },
  ];
}
