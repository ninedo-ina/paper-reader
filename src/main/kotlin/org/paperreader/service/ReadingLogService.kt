package org.paperreader.service

import org.paperreader.dto.CreateReadingLogRequest
import org.paperreader.dto.ReadingLogDto
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.ReadingLog
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.ReadingLogRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReadingLogService(
    private val readingLogRepository: ReadingLogRepository,
    private val paperRepository: PaperRepository,
) {
    @Transactional
    fun record(request: CreateReadingLogRequest, userId: Long): ReadingLogDto {
        return readingLogRepository.save(
            ReadingLog(
                userId = userId,
                paperId = request.paperId,
                currentPage = request.currentPage,
                totalPages = request.totalPages,
                durationSeconds = request.durationSeconds,
            )
        ).toDto()
    }

    fun getByPaper(paperId: Long, userId: Long): List<ReadingLogDto> =
        readingLogRepository.findByPaperIdAndUserIdOrderByCreatedAtDesc(paperId, userId).map { it.toDto() }

    fun getRecent(userId: Long, limit: Int = 20): List<ReadingLogDto> =
        readingLogRepository.findByUserIdOrderByCreatedAtDesc(userId).take(limit).map { it.toDto() }

    fun getCurrentProgress(paperId: Long, userId: Long): ReadingLogDto? =
        readingLogRepository.findTopByUserIdAndPaperIdOrderByCreatedAtDesc(userId, paperId)
            .map { it.toDto() }
            .orElse(null)

    private fun ReadingLog.toDto() = ReadingLogDto(
        id = id, paperId = paperId,
        currentPage = currentPage, totalPages = totalPages,
        durationSeconds = durationSeconds, createdAt = createdAt,
    )
}
