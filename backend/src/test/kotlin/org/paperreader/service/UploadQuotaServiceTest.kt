package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import io.mockk.slot
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.UploadQuotaExceededException
import org.paperreader.model.UploadRecord
import org.paperreader.repository.UploadRecordRepository
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@ExtendWith(MockKExtension::class)
class UploadQuotaServiceTest {
    @MockK
    private lateinit var uploadRecordRepository: UploadRecordRepository

    private val appDailyLimitBytes = 1024L * 1024 * 1024

    private val service by lazy { UploadQuotaService(uploadRecordRepository, appDailyLimitBytes) }

    private val mb = 1024L * 1024

    /** 默认「什么都没用过」，各用例只覆盖自己关心的那一个口径。 */
    private fun stubUsage(total: Long = 0, today: Long = 0, appToday: Long = 0) {
        every { uploadRecordRepository.sumBytesByUserId(any()) } returns total
        every { uploadRecordRepository.sumBytesByUserIdSince(any(), any()) } returns today
        every { uploadRecordRepository.sumBytesSince(any()) } returns appToday
    }

    @Test
    fun `allows a file exactly at the 10MB per-file cap`() {
        service.checkFileSize(10 * mb)
    }

    @Test
    fun `rejects a file one byte over the 10MB per-file cap`() {
        val ex = assertThrows<FileTooLargeException> { service.checkFileSize(10 * mb + 1) }

        assertEquals(1009, ex.code)
        assertEquals(413, ex.httpStatus)
        assertTrue(ex.message.contains("10MB"), "限额要出现在报错里: ${ex.message}")
    }

    @Test
    fun `allows an upload that fits all three caps`() {
        stubUsage(total = 199 * mb, today = 99 * mb, appToday = appDailyLimitBytes - mb)

        service.checkQuota(42, mb)
    }

    @Test
    fun `rejects an upload that would push the user past 200MB in total`() {
        stubUsage(total = 200 * mb)

        val ex = assertThrows<UploadQuotaExceededException> { service.checkQuota(42, mb) }

        assertEquals(1010, ex.code)
        assertEquals(429, ex.httpStatus)
        assertTrue(ex.message.contains("累计"), "要指明是累计额度: ${ex.message}")
    }

    @Test
    fun `rejects an upload that would push the user past 100MB today`() {
        stubUsage(today = 100 * mb)

        val ex = assertThrows<UploadQuotaExceededException> { service.checkQuota(42, mb) }

        assertTrue(ex.message.contains("单日"), "要指明是单日额度: ${ex.message}")
    }

    @Test
    fun `rejects an upload that would push the app past its daily total`() {
        stubUsage(appToday = appDailyLimitBytes)

        val ex = assertThrows<UploadQuotaExceededException> { service.checkQuota(42, mb) }

        assertTrue(ex.message.contains("全站"), "要指明是全站额度: ${ex.message}")
    }

    @Test
    fun `does not reject an upload that lands exactly on the total cap`() {
        stubUsage(total = 199 * mb, today = 99 * mb)

        service.checkQuota(42, mb)
    }

    @Test
    fun `counts the daily window from midnight in Asia-Shanghai`() {
        val since = slot<Instant>()
        every { uploadRecordRepository.sumBytesByUserId(any()) } returns 0
        every { uploadRecordRepository.sumBytesByUserIdSince(any(), capture(since)) } returns 0
        every { uploadRecordRepository.sumBytesSince(any()) } returns 0

        service.checkQuota(42, mb)

        val zone = ZoneId.of("Asia/Shanghai")
        val expectedDayStart = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        assertEquals(expectedDayStart, since.captured)
    }

    @Test
    fun `records the uploaded bytes in the ledger`() {
        val record = slot<UploadRecord>()
        every { uploadRecordRepository.save(capture(record)) } returns UploadRecord(id = 1, userId = 42, paperId = 7, bytes = 3 * mb)

        service.record(42, 7, 3 * mb)

        assertEquals(42L, record.captured.userId)
        assertEquals(7L, record.captured.paperId)
        assertEquals(3 * mb, record.captured.bytes)
    }

    @Test
    fun `reports remaining quota for the current user`() {
        stubUsage(total = 120 * mb, today = 30 * mb)

        val status = service.status(42)

        assertEquals(10 * mb, status.fileLimitBytes)
        assertEquals(100 * mb, status.dailyLimitBytes)
        assertEquals(200 * mb, status.totalLimitBytes)
        assertEquals(30 * mb, status.dailyUsedBytes)
        assertEquals(120 * mb, status.totalUsedBytes)
        assertEquals(70 * mb, status.dailyRemainingBytes)
        assertEquals(80 * mb, status.totalRemainingBytes)
    }

    @Test
    fun `never reports negative remaining quota when a user is already over the cap`() {
        stubUsage(total = 250 * mb, today = 150 * mb)

        val status = service.status(42)

        assertEquals(0L, status.dailyRemainingBytes)
        assertEquals(0L, status.totalRemainingBytes)
    }
}
