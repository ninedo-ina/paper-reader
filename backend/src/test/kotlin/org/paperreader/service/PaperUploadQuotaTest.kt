package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.just
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.UploadFromUrlRequest
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.UploadQuotaExceededException
import org.paperreader.model.Paper
import org.paperreader.model.UploadRecord
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperTagRepository
import org.paperreader.repository.UploadRecordRepository
import org.springframework.mock.web.MockMultipartFile

/**
 * 两个上传入口的限额行为。这里用真的 [UploadQuotaService] + 打桩的台账仓储，
 * 而不是把 UploadQuotaService 整个 mock 掉——否则断言只能证明「被调用过」，
 * 证明不了「收到 12MB 时确实拒绝了」。
 */
@ExtendWith(MockKExtension::class)
class PaperUploadQuotaTest {
    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var paperTagRepository: PaperTagRepository

    @MockK
    private lateinit var fileStorageService: FileStorageService

    @MockK
    private lateinit var paperParsingService: PaperParsingService

    @MockK
    private lateinit var auditLogService: AuditLogService

    @MockK
    private lateinit var uploadRecordRepository: UploadRecordRepository

    private val objectMapper = ObjectMapper()
    private val mb = 1024L * 1024

    private val quotaService by lazy {
        UploadQuotaService(uploadRecordRepository, 1024L * 1024 * 1024)
    }

    private val service by lazy {
        PaperService(
            paperRepository,
            paperTagRepository,
            fileStorageService,
            paperParsingService,
            objectMapper,
            auditLogService,
            quotaService,
        )
    }

    private fun stubUsage(total: Long = 0, today: Long = 0, appToday: Long = 0) {
        every { uploadRecordRepository.sumBytesByUserId(any()) } returns total
        every { uploadRecordRepository.sumBytesByUserIdSince(any(), any()) } returns today
        every { uploadRecordRepository.sumBytesSince(any()) } returns appToday
    }

    private fun stubPaperInsert() {
        every { paperRepository.save(any<Paper>()) } answers { firstArg<Paper>().copy(id = 7) }
        every { paperParsingService.requestParse(any()) } answers { firstArg() }
        every { auditLogService.log(any(), any(), any()) } just runs
        every { uploadRecordRepository.save(any()) } answers { firstArg() }
    }

    private fun pdf(sizeMb: Long) = MockMultipartFile(
        "file", "paper.pdf", "application/pdf", ByteArray((sizeMb * mb).toInt()),
    )

    @Test
    fun `rejects an oversized file before creating a paper or touching storage`() {
        stubUsage()

        val ex = assertThrows<FileTooLargeException> { service.uploadPdf(pdf(12), 42, "Big") }

        assertEquals(1009, ex.code)
        verify(exactly = 0) { paperRepository.save(any<Paper>()) }
        verify(exactly = 0) { fileStorageService.store(any(), any(), any()) }
        verify(exactly = 0) { uploadRecordRepository.save(any()) }
    }

    @Test
    fun `rejects an upload from a user who is already at the 200MB total`() {
        stubUsage(total = 200 * mb)

        val ex = assertThrows<UploadQuotaExceededException> { service.uploadPdf(pdf(1), 42, "Over") }

        assertEquals(1010, ex.code)
        verify(exactly = 0) { fileStorageService.store(any(), any(), any()) }
        verify(exactly = 0) { uploadRecordRepository.save(any()) }
    }

    @Test
    fun `records the stored size in the ledger after a successful upload`() {
        stubUsage()
        stubPaperInsert()
        every { fileStorageService.store(any(), any(), any()) } returns "42/7/abc.pdf"

        service.uploadPdf(pdf(2), 42, "Fits")

        val record = slot<UploadRecord>()
        verify(exactly = 1) { uploadRecordRepository.save(capture(record)) }
        assertEquals(42L, record.captured.userId)
        assertEquals(7L, record.captured.paperId)
        assertEquals(2 * mb, record.captured.bytes)
    }

    @Test
    fun `rejects a URL import whose file exceeds the per-file cap and records nothing`() {
        stubUsage()
        every { paperRepository.save(any<Paper>()) } answers { firstArg<Paper>().copy(id = 7) }
        every { fileStorageService.storeFromUrl(any(), any(), any(), any()) } throws
            FileTooLargeException(12 * mb, 10 * mb)

        val ex = assertThrows<FileTooLargeException> {
            service.uploadFromUrl(UploadFromUrlRequest(url = "https://example.com/big.pdf"), 42)
        }

        assertEquals(1009, ex.code)
        assertTrue(ex.message.contains("10MB"), "限额要出现在报错里: ${ex.message}")
        verify(exactly = 0) { uploadRecordRepository.save(any()) }
    }

    @Test
    fun `rejects a URL import when the downloaded size no longer fits the daily quota`() {
        // 下载前没超额（配额探一次时 incoming=0），下载完 1MB 才越界——第二道校验必须拦住。
        stubUsage(today = 100 * mb - 512 * 1024)
        every { paperRepository.save(any<Paper>()) } answers { firstArg<Paper>().copy(id = 7) }
        every { fileStorageService.storeFromUrl(any(), any(), any(), any()) } returns
            ("42/7/abc.pdf" to ByteArray(mb.toInt()))

        val ex = assertThrows<UploadQuotaExceededException> {
            service.uploadFromUrl(UploadFromUrlRequest(url = "https://example.com/paper.pdf"), 42)
        }

        assertEquals(1010, ex.code)
        assertTrue(ex.message.contains("单日"), "要指明是单日额度: ${ex.message}")
        verify(exactly = 0) { uploadRecordRepository.save(any()) }
    }

    @Test
    fun `records the downloaded size in the ledger after a successful URL import`() {
        stubUsage()
        stubPaperInsert()
        every { fileStorageService.storeFromUrl(any(), any(), any(), any()) } returns
            ("42/7/abc.pdf" to ByteArray((2 * mb).toInt()))

        service.uploadFromUrl(UploadFromUrlRequest(url = "https://example.com/paper.pdf"), 42)

        val record = slot<UploadRecord>()
        verify(exactly = 1) { uploadRecordRepository.save(capture(record)) }
        assertEquals(42L, record.captured.userId)
        assertEquals(7L, record.captured.paperId)
        assertEquals(2 * mb, record.captured.bytes)
    }

    @Test
    fun `caps the URL download at the per-file limit`() {
        stubUsage()
        stubPaperInsert()
        every { fileStorageService.storeFromUrl(any(), any(), any(), any()) } returns
            ("42/7/abc.pdf" to ByteArray(0))

        service.uploadFromUrl(UploadFromUrlRequest(url = "https://example.com/paper.pdf"), 42)

        verify(exactly = 1) {
            fileStorageService.storeFromUrl(any(), any(), any(), UploadQuotaService.MAX_FILE_BYTES)
        }
    }
}
