package org.paperreader.security

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * RFC 6238 time-based one-time passwords, plus the small slice of RFC 4648
 * Base32 that authenticator apps need. Implemented in-house so the backend
 * carries no extra dependency for ~60 lines of HMAC arithmetic.
 */
object Totp {
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    const val DIGITS = 6
    const val PERIOD_SECONDS = 30L
    /** Accept the neighbouring steps to tolerate clock drift between client and server. */
    const val WINDOW = 1

    private val random = SecureRandom()

    /** Random Base32 secret with 160 bits of entropy, the size RFC 4226 recommends. */
    fun generateSecret(): String {
        val bytes = ByteArray(20)
        random.nextBytes(bytes)
        return base32Encode(bytes)
    }

    fun base32Encode(bytes: ByteArray): String {
        val sb = StringBuilder()
        var buffer = 0
        var bitsLeft = 0
        for (b in bytes) {
            buffer = (buffer shl 8) or (b.toInt() and 0xFF)
            bitsLeft += 8
            while (bitsLeft >= 5) {
                sb.append(ALPHABET[(buffer shr (bitsLeft - 5)) and 0x1F])
                bitsLeft -= 5
            }
        }
        if (bitsLeft > 0) {
            sb.append(ALPHABET[(buffer shl (5 - bitsLeft)) and 0x1F])
        }
        return sb.toString()
    }

    fun base32Decode(encoded: String): ByteArray {
        val cleaned = encoded.uppercase().replace("=", "").replace(" ", "")
        val out = java.io.ByteArrayOutputStream()
        var buffer = 0
        var bitsLeft = 0
        for (c in cleaned) {
            val value = ALPHABET.indexOf(c)
            require(value >= 0) { "Invalid Base32 character: $c" }
            buffer = (buffer shl 5) or value
            bitsLeft += 5
            if (bitsLeft >= 8) {
                out.write((buffer shr (bitsLeft - 8)) and 0xFF)
                bitsLeft -= 8
            }
        }
        return out.toByteArray()
    }

    /** The code for a given counter value (HOTP, RFC 4226 §5.3). */
    fun codeAt(secret: String, counter: Long): String {
        val key = SecretKeySpec(base32Decode(secret), "HmacSHA1")
        val mac = Mac.getInstance("HmacSHA1")
        mac.init(key)
        val data = ByteArray(8)
        var c = counter
        for (i in 7 downTo 0) {
            data[i] = (c and 0xFF).toByte()
            c = c ushr 8
        }
        val hash = mac.doFinal(data)
        val offset = hash[hash.size - 1].toInt() and 0x0F
        val binary = ((hash[offset].toInt() and 0x7F) shl 24) or
            ((hash[offset + 1].toInt() and 0xFF) shl 16) or
            ((hash[offset + 2].toInt() and 0xFF) shl 8) or
            (hash[offset + 3].toInt() and 0xFF)
        val modulo = binary % 1_000_000
        return modulo.toString().padStart(DIGITS, '0')
    }

    fun codeAt(secret: String, instant: java.time.Instant): String =
        codeAt(secret, instant.epochSecond / PERIOD_SECONDS)

    /** True when [code] matches the current step or one on either side of it. */
    fun verify(secret: String, code: String, now: java.time.Instant = java.time.Instant.now()): Boolean {
        val candidate = code.trim().replace(" ", "")
        if (candidate.length != DIGITS || !candidate.all { it.isDigit() }) return false
        val steps = now.epochSecond / PERIOD_SECONDS
        for (offset in -WINDOW..WINDOW) {
            if (constantTimeEquals(codeAt(secret, steps + offset), candidate)) return true
        }
        return false
    }

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].code xor b[i].code)
        return diff == 0
    }

    /** The `otpauth://` URI that authenticator apps turn into a QR code. */
    fun provisioningUri(secret: String, account: String, issuer: String): String {
        val label = URLEncoder.encode("$issuer:$account", StandardCharsets.UTF_8).replace("+", "%20")
        val params = listOf(
            "secret=$secret",
            "issuer=" + URLEncoder.encode(issuer, StandardCharsets.UTF_8).replace("+", "%20"),
            "algorithm=SHA1",
            "digits=$DIGITS",
            "period=$PERIOD_SECONDS",
        ).joinToString("&")
        return "otpauth://totp/$label?$params"
    }
}
