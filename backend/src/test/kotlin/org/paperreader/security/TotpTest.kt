package org.paperreader.security

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

class TotpTest {

    /**
     * RFC 6238 appendix B vectors, SHA-1 rows. The RFC uses an 8-digit code,
     * so these assert the truncated counter rather than our 6-digit output.
     */
    private val rfcSecret = "12345678901234567890".toByteArray().let { Totp.base32Encode(it) }

    /**
     * The RFC prints 8 digits (94287082). Because 10^6 divides 10^8, taking the
     * last six of an RFC value is exactly our `binary mod 10^6`, so the vectors
     * are still meaningful for a 6-digit implementation.
     */
    private fun code(secret: String, epochSecond: Long): String =
        Totp.codeAt(secret, Instant.ofEpochSecond(epochSecond))

    @Test
    fun `base32 round trip`() {
        val bytes = ByteArray(20) { (it * 7 + 3).toByte() }
        assertEquals(bytes.toList(), Totp.base32Decode(Totp.base32Encode(bytes)).toList())
    }

    @Test
    fun `secret is 32 base32 characters with no padding`() {
        repeat(20) {
            val secret = Totp.generateSecret()
            assertEquals(32, secret.length)
            assertTrue(secret.all { it in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" })
        }
    }

    @Test
    fun `codes match the RFC 6238 sha1 vectors after truncation`() {
        // TOTP values from RFC 6238 appendix B (SHA-1), last 6 digits.
        assertEquals("287082", code(rfcSecret, 59))
        assertEquals("081804", code(rfcSecret, 1111111109))
        assertEquals("050471", code(rfcSecret, 1111111111))
        assertEquals("005924", code(rfcSecret, 1234567890))
        assertEquals("279037", code(rfcSecret, 2000000000))
    }

    @Test
    fun `verify accepts the current step and one step of drift`() {
        val secret = Totp.generateSecret()
        val now = Instant.ofEpochSecond(1_700_000_000)
        assertTrue(Totp.verify(secret, Totp.codeAt(secret, now), now))
        assertTrue(Totp.verify(secret, Totp.codeAt(secret, now.minusSeconds(30)), now))
        assertTrue(Totp.verify(secret, Totp.codeAt(secret, now.plusSeconds(30)), now))
        assertFalse(Totp.verify(secret, Totp.codeAt(secret, now.minusSeconds(90)), now))
    }

    @Test
    fun `verify rejects malformed codes`() {
        val secret = Totp.generateSecret()
        val now = Instant.ofEpochSecond(1_700_000_000)
        assertFalse(Totp.verify(secret, "", now))
        assertFalse(Totp.verify(secret, "12345", now))
        assertFalse(Totp.verify(secret, "1234567", now))
        assertFalse(Totp.verify(secret, "abcdef", now))
    }

    @Test
    fun `provisioning uri carries the parameters authenticator apps expect`() {
        val uri = Totp.provisioningUri("ABCDEFGH", "user@example.com", "笨迪论文助手")
        assertTrue(uri.startsWith("otpauth://totp/"))
        assertTrue(uri.contains("secret=ABCDEFGH"))
        assertTrue(uri.contains("digits=6"))
        assertTrue(uri.contains("period=30"))
        assertTrue(uri.contains("algorithm=SHA1"))
        assertFalse(uri.contains(" "), "the URI must be safe to put in a QR code")
    }
}
