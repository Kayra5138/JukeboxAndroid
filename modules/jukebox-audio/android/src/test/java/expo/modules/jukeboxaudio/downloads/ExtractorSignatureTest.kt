package expo.modules.jukeboxaudio.downloads

import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExtractorSignatureTest {
  /** yt-dlp 2026.10.26's own list of checksums, and its signature, as published. */
  private val sums = Base64.getDecoder().decode(
      "ZTUxZTY5ZTg5NDg5ZjE5OTUzMGYxM2QzMmE0MzQyZGEzZGRiMmNmMzQ4NDJmMzY0NjAzYTA2NmRiMDVhZmJmMyAgeXQtZGxwCmY1" +
      "Mzg5ZDM2OThlY2RlNGVmMDZmNGU2YjFjZTAyOTRmZTlhYzEzOTYyMjhjODk5MGI4ZDM0MTZkNmQxNzdhN2QgIHl0LWRscC5leGUK" +
      "MjFmOTQyZDI1OGQyNWNjNGU2MGI0OTgyYTI1YzQyMzQ2MGYwYmViYjgzNWYzOGU2ZGZkMWZjYjE0MDA4N2Y5NSAgeXQtZGxwLnRh" +
      "ci5negowMDY2ZGJhYzNjMTI0MDI4ZTJkY2FlMmExOTdmY2NlZTMzY2Q5MWY0NTYzMTNkMjRmN2FmODlmZDU0NTkwZTk4ICB5dC1k" +
      "bHBfYXJtNjQuZXhlCjc2N2JhOWRjZTcwNTJhYTE5NmY4YjEyNjUyZjQzM2Q3NmRlMTI4YmExNjg5NjZmYTg0YjYzOTRkNWU2YzY3" +
      "OTUgIHl0LWRscF9saW51eApmMzQwNTM0MTUxMzZlNTUwNzNkZDY0YmE1MzI2ZDE2MWVjYzIzY2UwZTk4YzA4MWQ4NzUyODY3YjM3" +
      "ODA5NDUwICB5dC1kbHBfbGludXguemlwCmU4N2U5NTMzZTg5ZmU1ODg5YWJhYTIxZjUxMTRkZmU3NzU2ZDZhYTYyMTliODM1NTFh" +
      "ZGQwNGQ0OGIxOGU0ODMgIHl0LWRscF9saW51eF9hYXJjaDY0Cjc0NzA4ZTcwN2U4ZmE4MTc3YzgzNDdlNTgxNTIzMzdlZGYzMjAx" +
      "NDljZDdiMjI1ZGVmZDQ1M2Y3Y2RlNDc4MjIgIHl0LWRscF9saW51eF9hYXJjaDY0LnppcAplYzgyOGMyNmM2ZGE3ODk4YjI3OWRh" +
      "MmNhZDNkY2E0MzRlYmVjN2Y4ZjE4YWU3YjY0MjAwMjdmM2FhMDM3YmYyICB5dC1kbHBfbGludXhfYXJtdjdsLnppcAowZjkyMmMx" +
      "NWNjYzBiODNlZWZhMWM4YmM5MTA0ZTQzNDMxOGM0YmYxNmU0MDhlMWVlOTNiNzc0NWE2ZWZlMGFhICB5dC1kbHBfbWFjb3MKMjBk" +
      "OThmYTYwODk5OGVmZjg3ZDFkMzVhNmU5ZmI2NWU0Yjg3NDYzOWE2Y2M4OWFkZGMxOWRhM2JlY2RlM2VmMSAgeXQtZGxwX21hY29z" +
      "LnppcAplOTdhNGRkOTE5MjIxZDIzM2U3NzIwZTE4ZmEzZjY2ZGI2MGZiZDFkOGMwODQ2YmY2ZGViOGU4OGUwNDQ3NWE4ICB5dC1k" +
      "bHBfbXVzbGxpbnV4CmMzYTY3ZjdjMTRkNGNiZjg3NmU3ODAxMDM5MjM3ZmMxNmI5MjlhNjI5YzcyZjljNzg1ZWMzZmRjOGFhNDA3" +
      "NDggIHl0LWRscF9tdXNsbGludXguemlwCmVhOTdiODU2NDY2N2YzY2FiYzMzNGMzMjE2NTI2ZGUzOWJjNjg0ZTk5ODE1ZWNmMDdi" +
      "NjY0MmY0Y2JhOGFmNGQgIHl0LWRscF9tdXNsbGludXhfYWFyY2g2NAoxNjQ4YmVlYjdiMGM3OGI0NzE2NTQyNjI2OTcwNjZjMDE2" +
      "NzgzZDMzODEzNjU5MzY3YTVjMjc0ODI4YmEzMjQwICB5dC1kbHBfbXVzbGxpbnV4X2FhcmNoNjQuemlwCmZkNTFiMjEyY2Y4Mzgw" +
      "YzdhNTJlZTA4YzBkNmJlN2YzYzU5YjJmMmM4MzJlYWY3YjQ1YWNmYWU2ZWFiNTc0MTkgIHl0LWRscF93aW4uemlwCjVlYWE0YzYx" +
      "ZjNjMDkxODlmM2E1NTFiZjE4NTVjMTNhYWQ2MWZiODY1Y2MzM2YwNjAxMmE2YzJkYmUyODdhNDUgIHl0LWRscF93aW5fYXJtNjQu" +
      "emlwCmUyODk4YWZkNTFjMDI5ZDIzYzU4ZGU2MGNkODQ0NmIxMTBkZDNhYTEyMWIzZTQxNDliYWZjZWUzMzU2YzU5YzAgIHl0LWRs" +
      "cF93aW5feDg2LnppcApjMDQwN2M2NjM2MWY1MGE5OWUxMDk0OWFlODgyZWEyYWQ3ZGU5MDg2Yjc1ZDIyNmQ4ZmQ4OGRhNGY3NDgy" +
      "OGZhICB5dC1kbHBfeDg2LmV4ZQo="
  )
  private val signature = Base64.getDecoder().decode(
      "iQIzBAABCgAdFiEErAy75oSNaoc0ZK9OV89lkztadYEFAmrf0ykACgkQV89lkztadYFrgRAAi88f07ETAUGIzH/ifgZLMdYcQavM" +
      "pBw5GsbCi4Os7K2+MJNZgJ1SpTYa/qQZ0GPS+RCsebOPcbByTAt9OSjnN7ZzJVPbl8B/FioDRWBond7Z3JvZojU28Xv6dd0YGv7s" +
      "w0pNit1Rro+9qtxQ1ibiNlqZHyj8BHyANOvSNNRLJuVmDkXWirmQwAjHnTmnK3Qcg2dOmuQr5DX/XbeNqzxxcqphUO7upijylfOt" +
      "VQyKoY91ze41k0XE4H1e+jdn8OuZEZhw2h/UEk9EX5ENn6jAqOPN3c0t33vUgZqYUliDnYogSC2ITb8tbsxdMRnQG5HouYLHVK56" +
      "aPClkx5sm/891XpwYw2xF8RIqqDEt9yf+V0xbd2rJBOvjQmPMJ6iLUbaBI440VRaJDd5ZEkMAGd+O8xxMQ+xf/SvPpFM8ytAgxk+" +
      "B76xTYv/2Z9FiMC08Au0iXkEaJ72ws/i0Ly55BvZ8bbON3yMrk64WG3JHoQo0xF+1K1YuWjpXxkesseLlj6fPcNlcAKjK2mzKV5E" +
      "Qe+ZPdCzWy4+BM3tQybyrUkHYQkJnCUad1a2/ufpnZFy1sFm/SM+o71Sf3qLYFz/BP6RVSnChN5DvuxN+hPZfL4dqubxUIXZAAYx" +
      "t1dss2NhqBc7BdhbetJwmt/foI8NLAiKYp6D5Rhv1zhdajQta+BlF78="
  )

  @Test
  fun `believes the list yt-dlp signed`() {
    assertTrue(ExtractorSignature.verifies(sums, signature))
  }

  @Test
  fun `does not believe it changed by a single character`() {
    val changed = sums.copyOf().also { it[100] = (it[100].toInt() xor 1).toByte() }
    assertFalse(ExtractorSignature.verifies(changed, signature))
  }

  @Test
  fun `does not believe a signature that was tampered with, cut short, or is not one at all`() {
    val tampered = signature.copyOf().also { it[it.size - 10] = (it[it.size - 10].toInt() xor 1).toByte() }
    assertFalse(ExtractorSignature.verifies(sums, tampered))
    assertFalse(ExtractorSignature.verifies(sums, signature.copyOf(200)))
    assertFalse(ExtractorSignature.verifies(sums, ByteArray(0)))
    assertFalse(ExtractorSignature.verifies(sums, "not a signature".toByteArray()))
  }
}
