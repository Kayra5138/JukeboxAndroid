package expo.modules.jukeboxaudio.downloads

import java.math.BigInteger
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.RSAPublicKeySpec

/**
 * Whether a detached OpenPGP signature over a file is yt-dlp's own.
 *
 * The update checked the new yt-dlp against the list of checksums published
 * beside it, and that list came from the same place as the file: anybody able
 * to put another file there could put another list beside it. The list is
 * signed, though, with a key yt-dlp keeps apart from where its files are
 * published, and the signature is checked here against that key, written
 * into the app. A list that is not signed by it is not believed, and nothing
 * it lists is installed.
 *
 * Only as much of OpenPGP as that signature uses: a version 4 signature
 * packet, by an RSA key, over SHA-256 or SHA-512 — a hundred lines and the
 * phone's own RSA, rather than a library of several megabytes.
 */
internal object ExtractorSignature {
  /**
   * yt-dlp's signing key, RSA, 4096 bits: `AC0C BBE6 848D 6A87 3464 AF4E 57CF 6593 3B5A 7581`,
   * as published in its repository (`public.key`).
   */
  private val MODULUS = BigInteger(
    "f4ac5f738c63c0b74b6196de42d5e6f371c0155fb35bd6ff9ea908e4f961197531135428375803399e002b947766fdf6" +
    "6acd480efa9018ac1eb418a7a0edf7d40dff92d1714a11975e44b61e01aaaa2a14a26d56a50e3bce04ecedbb75bad3b1" +
    "cb113400a80ef04cfb88b765aa9a92fad0d21ccabdbb2f1aa681d37798dbd9da22cef9b3f49ca47f0be3e013d1f8cadc" +
    "b00dad76cccc7a3e66429d538e3aee97644166754c71750f5f143a9df4b701298d8b0ce712628d6c698d185a26561edc" +
    "d5a19bb590ece39d2e458eaff204724b2260c7ee93711e6eecfcf9dababa66405b4316bba4b7eda58439e9294986aff2" +
    "3fdc81ea1ff5fef673e84b8ba2a90e47a5b941f012bee167e96a2120ef92e7bee38f7d920f298c976bfd00ed0a233308" +
    "0eac3f3ca334fe54290a92427e8a35d9ee01cd8e670169474a2bb7c320439823adcbc9ce905a41904e28057df4945d61" +
    "c308ef5a5cd84fdde8ea15680632d094b2b6e4709916b9663bab9011cbfd391db48cdcae0353d7aab67c66895d5643c9" +
    "d7b88f49809411be1e4f4e49f2e4bb71ab3726aaf58ef538c705baecd7804f10ef5f717c4a2ff08505bcd70d2bef0200" +
    "2b76aaa53289dc43fca271395f2faab327c10a162a96d7840c4dd027e92bae653a1d5c24e2227c284fb5a38ee14f28a7" +
    "6f7c7d463f86e7a9dcd39f32f10920c812d7f27cfb085fef4623b26493fcd98d",
    16
  )
  private val EXPONENT = BigInteger("010001", 16)
  /** The key's id, the last eight bytes of its fingerprint, which a signature by it names. */
  private const val KEY_ID = "57cf65933b5a7581"

  /** Whether [signature], detached and not armoured, is the key's over [data]. Never throws. */
  fun verifies(data: ByteArray, signature: ByteArray): Boolean = runCatching {
    val packet = packetOf(signature) ?: return false
    check(packet, data)
  }.getOrDefault(false)

  /** The body of the first packet, where it is a signature packet. */
  private fun packetOf(bytes: ByteArray): ByteArray? {
    if (bytes.isEmpty()) return null
    val head = bytes[0].toInt() and 0xff
    if (head and 0x80 == 0) return null
    var at = 1
    val tag: Int
    val length: Int
    if (head and 0x40 != 0) {
      tag = head and 0x3f
      val first = bytes[at++].toInt() and 0xff
      length = when {
        first < 192 -> first
        first < 224 -> ((first - 192) shl 8) + (bytes[at++].toInt() and 0xff) + 192
        first == 255 -> number(bytes, at, 4).also { at += 4 }
        else -> return null
      }
    } else {
      tag = (head shr 2) and 0x0f
      val size = when (head and 3) { 0 -> 1; 1 -> 2; 2 -> 4; else -> return null }
      length = number(bytes, at, size)
      at += size
    }
    if (tag != 2 || length < 0 || at + length > bytes.size) return null
    return bytes.copyOfRange(at, at + length)
  }

  private fun check(body: ByteArray, data: ByteArray): Boolean {
    // Version 4, of a binary document, by RSA.
    if (body[0].toInt() != 4 || body[1].toInt() != 0 || body[2].toInt() != 1) return false
    val hash = when (body[3].toInt()) { 8 -> "SHA256withRSA"; 10 -> "SHA512withRSA"; else -> return false }
    val hashedLength = number(body, 4, 2)
    val hashedEnd = 6 + hashedLength
    val unhashedLength = number(body, hashedEnd, 2)
    var at = hashedEnd + 2 + unhashedLength
    // By this key, where the signature says whose it is at all.
    val issuer = issuerOf(body, 6, hashedEnd) ?: issuerOf(body, hashedEnd + 2, hashedEnd + 2 + unhashedLength)
    if (issuer != null && issuer != KEY_ID) return false
    at += 2 // The first two bytes of the hash, a hint and not a check.
    val bits = number(body, at, 2)
    at += 2
    val value = body.copyOfRange(at, at + (bits + 7) / 8)

    val key = KeyFactory.getInstance("RSA").generatePublic(RSAPublicKeySpec(MODULUS, EXPONENT))
    val verifier = Signature.getInstance(hash)
    verifier.initVerify(key)
    verifier.update(data)
    // What OpenPGP signs after the document: the signature's own hashed part, and a trailer saying how long it was.
    verifier.update(body, 0, hashedEnd)
    verifier.update(byteArrayOf(4, 0xff.toByte()))
    verifier.update(byteArrayOf((hashedEnd ushr 24).toByte(), (hashedEnd ushr 16).toByte(), (hashedEnd ushr 8).toByte(), hashedEnd.toByte()))
    // The signature as long as the key, as RSA wants it: OpenPGP drops its leading noughts.
    val size = (MODULUS.bitLength() + 7) / 8
    val padded = if (value.size >= size) value else ByteArray(size - value.size) + value
    return verifier.verify(padded)
  }

  /** The key id an issuer subpacket in [from, until) names, or the one an issuer fingerprint ends in. */
  private fun issuerOf(body: ByteArray, from: Int, until: Int): String? {
    var at = from
    while (at < until) {
      val first = body[at++].toInt() and 0xff
      val length = when {
        first < 192 -> first
        first < 255 -> ((first - 192) shl 8) + (body[at++].toInt() and 0xff) + 192
        else -> number(body, at, 4).also { at += 4 }
      }
      if (length <= 0) return null
      val type = body[at].toInt() and 0x7f
      val content = body.copyOfRange(at + 1, at + length)
      at += length
      if (type == 16 && content.size == 8) return hex(content)
      if (type == 33 && content.size == 21) return hex(content.copyOfRange(13, 21))
    }
    return null
  }

  private fun number(bytes: ByteArray, at: Int, size: Int): Int {
    var value = 0
    for (index in 0 until size) value = (value shl 8) or (bytes[at + index].toInt() and 0xff)
    return value
  }

  private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
}
