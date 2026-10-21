import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeLyricsFile, fromBase64 } from '../decode.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new Uint8Array([...text].map((char) => char.charCodeAt(0)));
const utf8 = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));
const utf16le = (text: string) => new Uint8Array(Buffer.from(text, 'utf16le'));
const utf16be = (text: string) => {
  const le = Buffer.from(text, 'utf16le');
  return new Uint8Array(le.length).map((_, index) => le[index ^ 1]!);
};

describe('fromBase64', () => {
  it('reads what the native side sends', () => {
    const text = '[00:01.00]Sözler ♪';
    assert.deepEqual(fromBase64(Buffer.from(text, 'utf8').toString('base64')), utf8(text));
  });

  it('reads every length, padded or not', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd']) {
      const encoded = Buffer.from(text).toString('base64');
      assert.deepEqual(fromBase64(encoded), ascii(text));
      assert.deepEqual(fromBase64(encoded.replace(/=+$/, '')), ascii(text));
    }
  });

  it('refuses what is not base64', () => {
    assert.equal(fromBase64('not*base64'), null);
    assert.equal(fromBase64('abcde'), null);
  });
});

describe('decodeLyricsFile', () => {
  it('reads UTF-8, with the mark at the front or without', () => {
    assert.equal(decodeLyricsFile(utf8('[00:01.00]Yoru ni kakeru 夜に駆ける')), '[00:01.00]Yoru ni kakeru 夜に駆ける');
    assert.equal(decodeLyricsFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Ağaç')])), 'Ağaç');
  });

  it('reads UTF-16 either way round by its mark', () => {
    assert.equal(decodeLyricsFile(new Uint8Array([0xff, 0xfe, ...utf16le('[00:02.00]Привет')])), '[00:02.00]Привет');
    assert.equal(decodeLyricsFile(new Uint8Array([0xfe, 0xff, ...utf16be('[00:02.00]Привет')])), '[00:02.00]Привет');
  });

  it('recognises UTF-16 with no mark by the zeros beside its brackets and digits', () => {
    assert.equal(decodeLyricsFile(utf16le('[00:03.50]歌詞の行\n[00:07.00]次')), '[00:03.50]歌詞の行\n[00:07.00]次');
    assert.equal(decodeLyricsFile(utf16be('[00:03.50]words')), '[00:03.50]words');
  });

  it('reads an old Western file as the Windows code page', () => {
    // "Café — déjà vu" as Windows-1252 writes it.
    const text = bytes(0x43, 0x61, 0x66, 0xe9, 0x20, 0x97, 0x20, 0x64, 0xe9, 0x6a, 0xe0, 0x20, 0x76, 0x75);
    assert.equal(decodeLyricsFile(text), 'Café — déjà vu');
  });

  it('refuses a double-byte code page rather than show the wrong characters', () => {
    // "你好世界" in GBK.
    const gbk = bytes(0x5b, 0x30, 0x30, 0x3a, 0x30, 0x31, 0x5d, 0xc4, 0xe3, 0xba, 0xc3, 0xca, 0xc0, 0xbd, 0xe7);
    assert.equal(decodeLyricsFile(gbk), null);
  });

  it('refuses something that is not text at all', () => {
    assert.equal(decodeLyricsFile(bytes(0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x01, 0x02, 0x41)), null);
    assert.equal(decodeLyricsFile(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46)), null);
  });

  it('forgives a zero at the very end', () => {
    assert.equal(decodeLyricsFile(new Uint8Array([...utf8('words'), 0])), 'words');
  });

  it('keeps line breaks of every kind for the cleaning to deal with', () => {
    assert.equal(decodeLyricsFile(utf8('a\r\nb\rc\n')), 'a\r\nb\rc\n');
  });
});
