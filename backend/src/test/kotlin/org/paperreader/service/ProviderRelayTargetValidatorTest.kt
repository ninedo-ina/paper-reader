package org.paperreader.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.paperreader.exception.InvalidParameterException

class ProviderRelayTargetValidatorTest {
    @Test
    fun `builds the allowed upstream endpoint`() {
        val target = ProviderRelayTargetValidator.target(
            "https://1.1.1.1/v1/",
            "chat/completions",
        )

        assertEquals("https://1.1.1.1/v1/chat/completions", target.toString())
    }

    @Test
    fun `removes an endpoint accidentally included in the base url`() {
        val target = ProviderRelayTargetValidator.target(
            "https://1.1.1.1/v1/models",
            "models",
        )

        assertEquals("https://1.1.1.1/v1/models", target.toString())
    }

    @Test
    fun `rejects non https and local targets`() {
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("http://1.1.1.1/v1", "models")
        }
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("https://localhost/v1", "models")
        }
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("https://127.0.0.1/v1", "models")
        }
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("https://100.64.0.1/v1", "models")
        }
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("https://198.51.100.1/v1", "models")
        }
        assertThrows(InvalidParameterException::class.java) {
            ProviderRelayTargetValidator.target("https://[2001:db8::1]/v1", "models")
        }
    }
}
