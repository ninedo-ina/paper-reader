package org.paperreader.service

import org.paperreader.dto.PageResponse
import org.paperreader.model.AuditLog
import org.paperreader.repository.AuditLogRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AuditLogService(
    private val auditLogRepository: AuditLogRepository,
) {
    private val logger = LoggerFactory.getLogger(AuditLogService::class.java)

    @Transactional
    fun log(userId: Long, event: String, operator: String) {
        try {
            auditLogRepository.save(AuditLog(userId = userId, event = event, operator = operator))
        } catch (e: Exception) {
            logger.error("Failed to save audit log: event=$event userId=$userId", e)
        }
    }

    fun list(userId: Long, page: Int, pageSize: Int): PageResponse<AuditLogDto> {
        val result = auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, pageSize))
        return PageResponse(
            items = result.content.map { AuditLogDto(id = it.id, event = it.event, operator = it.operator, createdAt = it.createdAt.toString()) },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    data class AuditLogDto(
        val id: Long,
        val event: String,
        val operator: String,
        val createdAt: String,
    )
}
