package org.paperreader.service

import org.paperreader.dto.UploadQuotaDto
import org.paperreader.exception.FileTooLargeException
import org.paperreader.exception.UploadQuotaExceededException
import org.paperreader.exception.formatBytes
import org.paperreader.model.UploadRecord
import org.paperreader.repository.UploadRecordRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 上传限制（REQ-202609-0267）。三个固定额度写死在代码里，不随测试/上线变化；
 * 用量来自只增不删的 pr_upload_records 台账，删论文不会退还额度，避免「传满-删掉-再传」绕过。
 *
 * 已知取舍：先 SUM 再 INSERT，并发下两个请求可能同时越过边界（最多超出并发数 × 单文件大小）。
 * 这是防滥用的软上限，不值得为它引入行锁/咨询锁；真要卡死再加。
 */
@Service
class UploadQuotaService(
    private val uploadRecordRepository: UploadRecordRepository,
    @Value("\${app.upload.app-daily-limit-bytes:1073741824}") private val appDailyLimitBytes: Long,
) {
    companion object {
        /** 单个文件上限：所有上传入口都不允许超过 10MB。 */
        const val MAX_FILE_BYTES = 10L * 1024 * 1024

        /** 单用户单日上限。 */
        const val USER_DAILY_BYTES = 100L * 1024 * 1024

        /** 单用户累计上限。固定值，不随环境变化。 */
        const val USER_TOTAL_BYTES = 200L * 1024 * 1024

        /**
         * 「单日」按东八区自然日切分，与站内其它按天统计（通知中心）保持同一时区，
         * 否则北京时间 00:00–08:00 的额度会算到前一天。
         */
        private val DAY_ZONE: ZoneId = ZoneId.of("Asia/Shanghai")
    }

    /** 单文件大小校验。两个上传入口都要先过这一关。 */
    fun checkFileSize(bytes: Long) {
        if (bytes > MAX_FILE_BYTES) throw FileTooLargeException(bytes, MAX_FILE_BYTES)
    }

    /**
     * 额度校验。incomingBytes 传本次将要写入的字节数；URL 导入在下载前拿不到大小，
     * 可以先传 0 做一次前置检查（已超额就别去下载了），拿到实际大小后再校验一次。
     */
    fun checkQuota(userId: Long, incomingBytes: Long) {
        val usedTotal = uploadRecordRepository.sumBytesByUserId(userId)
        if (usedTotal + incomingBytes > USER_TOTAL_BYTES) {
            throw UploadQuotaExceededException(
                "上传额度不足：单用户累计上限 ${formatBytes(USER_TOTAL_BYTES)}，已用 ${formatBytes(usedTotal)}",
            )
        }

        val dayStart = currentDayStart()
        val usedToday = uploadRecordRepository.sumBytesByUserIdSince(userId, dayStart)
        if (usedToday + incomingBytes > USER_DAILY_BYTES) {
            throw UploadQuotaExceededException(
                "今日上传额度不足：单用户单日上限 ${formatBytes(USER_DAILY_BYTES)}，今日已用 ${formatBytes(usedToday)}",
            )
        }

        val usedByAppToday = uploadRecordRepository.sumBytesSince(dayStart)
        if (usedByAppToday + incomingBytes > appDailyLimitBytes) {
            throw UploadQuotaExceededException(
                "今日全站上传额度已用完（上限 ${formatBytes(appDailyLimitBytes)}），请稍后再试",
            )
        }
    }

    /** 落盘成功后记账。与调用方共用一个事务：上传失败回滚时这行也不会留下。 */
    @Transactional
    fun record(userId: Long, paperId: Long, bytes: Long) {
        uploadRecordRepository.save(UploadRecord(userId = userId, paperId = paperId, bytes = bytes))
    }

    /** 只暴露用户自己的额度，不暴露全站 1GB 的用量。 */
    @Transactional(readOnly = true)
    fun status(userId: Long): UploadQuotaDto {
        val usedToday = uploadRecordRepository.sumBytesByUserIdSince(userId, currentDayStart())
        val usedTotal = uploadRecordRepository.sumBytesByUserId(userId)
        return UploadQuotaDto(
            fileLimitBytes = MAX_FILE_BYTES,
            dailyLimitBytes = USER_DAILY_BYTES,
            totalLimitBytes = USER_TOTAL_BYTES,
            dailyUsedBytes = usedToday,
            totalUsedBytes = usedTotal,
            dailyRemainingBytes = (USER_DAILY_BYTES - usedToday).coerceAtLeast(0),
            totalRemainingBytes = (USER_TOTAL_BYTES - usedTotal).coerceAtLeast(0),
        )
    }

    private fun currentDayStart(): Instant =
        LocalDate.now(DAY_ZONE).atStartOfDay(DAY_ZONE).toInstant()
}
