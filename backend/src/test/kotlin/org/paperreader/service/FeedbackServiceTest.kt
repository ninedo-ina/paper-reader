package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.model.Feedback
import org.paperreader.repository.FeedbackRepository
import org.springframework.mock.web.MockMultipartFile

@ExtendWith(MockKExtension::class)
class FeedbackServiceTest {
    @MockK
    private lateinit var feedbackRepository: FeedbackRepository

    @MockK
    private lateinit var fileStorageService: FileStorageService

    private val objectMapper = ObjectMapper()

    private val service by lazy { FeedbackService(feedbackRepository, fileStorageService, objectMapper) }

    private val mb = 1024L * 1024

    private fun png(size: Int = 16) = MockMultipartFile("screenshots", "shot.png", "image/png", ByteArray(size))

    private fun stubSave() {
        every { feedbackRepository.save(any()) } answers { firstArg<Feedback>().copy(id = 7) }
    }

    private fun submit(screenshots: List<MockMultipartFile>? = null) = service.submit(
        userId = 42,
        title = "标题",
        content = "内容",
        pagePath = "/zh",
        appVersion = "0.1.64-beta",
        locale = "zh",
        userAgent = "Mozilla/5.0",
        screenshots = screenshots,
    )

    @Test
    fun `stores screenshots and records their metadata`() {
        stubSave()
        every { fileStorageService.storeBytes(any(), any()) } returns "/uploads/feedback/42/a.png"
        val saved = slot<Feedback>()

        val result = submit(listOf(png(), png()))

        assertEquals(7, result.id)
        assertEquals(2, result.screenshotCount)
        verify(exactly = 2) { fileStorageService.storeBytes(any(), any()) }
        verify(exactly = 1) { feedbackRepository.save(capture(saved)) }
        assertTrue(saved.captured.screenshots!!.contains("\"mime\":\"image/png\""), saved.captured.screenshots!!)
        assertTrue(saved.captured.screenshots!!.contains("/uploads/feedback/42/"), saved.captured.screenshots!!)
        assertEquals("0.1.64-beta", saved.captured.appVersion)
        assertEquals("Mozilla/5.0", saved.captured.userAgent)
    }

    @Test
    fun `stores screenshot bytes under a per-user path derived from the content type`() {
        stubSave()
        val path = slot<String>()
        every { fileStorageService.storeBytes(capture(path), any()) } returns "/x"

        submit(listOf(MockMultipartFile("screenshots", "яノート.jpg", "image/jpeg", ByteArray(8))))

        assertTrue(path.captured.startsWith("feedback/42/"), path.captured)
        assertTrue(path.captured.endsWith(".jpg"), path.captured)
    }

    @Test
    fun `keeps the screenshots column null when no file is attached`() {
        stubSave()
        val saved = slot<Feedback>()

        val result = submit(null)

        assertEquals(0, result.screenshotCount)
        verify(exactly = 1) { feedbackRepository.save(capture(saved)) }
        assertNull(saved.captured.screenshots)
    }

    @Test
    fun `ignores an empty part so an untouched file input does not count as a screenshot`() {
        stubSave()
        val saved = slot<Feedback>()

        val result = submit(listOf(MockMultipartFile("screenshots", "", "application/octet-stream", ByteArray(0))))

        assertEquals(0, result.screenshotCount)
        verify(exactly = 1) { feedbackRepository.save(capture(saved)) }
        assertNull(saved.captured.screenshots)
    }

    @Test
    fun `rejects a fourth screenshot`() {
        val ex = assertThrows<InvalidParameterException> { submit(List(4) { png() }) }

        assertEquals(1003, ex.code)
        assertTrue(ex.message.contains("3"), ex.message)
    }

    @Test
    fun `rejects a screenshot over the 5MB cap without touching storage`() {
        val big = MockMultipartFile("screenshots", "big.png", "image/png", ByteArray((5 * mb).toInt() + 1))

        val ex = assertThrows<FileTooLargeException> { submit(listOf(big)) }

        assertEquals(1009, ex.code)
        assertEquals(413, ex.httpStatus)
        assertTrue(ex.message.contains("5MB"), ex.message)
        verify(exactly = 0) { fileStorageService.storeBytes(any(), any()) }
        verify(exactly = 0) { feedbackRepository.save(any()) }
    }

    @Test
    fun `rejects a screenshot type outside the whitelist`() {
        val pdf = MockMultipartFile("screenshots", "x.pdf", "application/pdf", ByteArray(8))

        val ex = assertThrows<InvalidParameterException> { submit(listOf(pdf)) }

        assertEquals(1003, ex.code)
        verify(exactly = 0) { fileStorageService.storeBytes(any(), any()) }
    }

    @Test
    fun `rejects a blank title and a blank content`() {
        assertThrows<InvalidParameterException> {
            service.submit(42, "  ", "内容", null, null, null, null, null)
        }
        assertThrows<InvalidParameterException> {
            service.submit(42, "标题", "\n ", null, null, null, null, null)
        }
    }

    @Test
    fun `rejects a title over 200 characters and content over 5000`() {
        val longTitle = assertThrows<InvalidParameterException> {
            service.submit(42, "标".repeat(201), "内容", null, null, null, null, null)
        }
        assertEquals(1003, longTitle.code)

        val longContent = assertThrows<InvalidParameterException> {
            service.submit(42, "标题", "文".repeat(5001), null, null, null, null, null)
        }
        assertEquals(1003, longContent.code)
    }

    @Test
    fun `truncates an over-long user agent instead of failing the insert`() {
        stubSave()
        val saved = slot<Feedback>()
        val ua = "U".repeat(900)

        service.submit(42, "标题", "内容", "/zh", "0.1.64-beta", "zh", ua, null)

        verify(exactly = 1) { feedbackRepository.save(capture(saved)) }
        assertEquals(500, saved.captured.userAgent!!.length)
    }
}
