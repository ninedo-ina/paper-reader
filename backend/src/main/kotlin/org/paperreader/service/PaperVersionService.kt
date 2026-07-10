package org.paperreader.service

import org.paperreader.dto.CreateVersionRequest
import org.paperreader.dto.PaperVersionDto
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.PaperVersion
import org.paperreader.repository.PaperRepository
import org.paperreader.repository.PaperVersionRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class PaperVersionService(
    private val paperVersionRepository: PaperVersionRepository,
    private val paperRepository: PaperRepository,
) {
    private val logger = LoggerFactory.getLogger(PaperVersionService::class.java)

    @Transactional
    fun createVersion(paperId: Long, userId: Long, request: CreateVersionRequest): PaperVersionDto {
        val paper = paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)

        val version = paperVersionRepository.save(
            PaperVersion(
                paperId = paperId,
                version = request.version,
                remark = request.remark,
                storagePushStatus = "pending",
            )
        )

        // Push to configured storage platform (skeleton — actual push TBD)
        if (paper.storageConfigId != null) {
            try {
                pushToStorage(paper.storageConfigId, paperId, request.version)
                paperVersionRepository.save(version.copy(storagePushStatus = "success"))
            } catch (e: Exception) {
                logger.error("Failed to push version ${request.version} for paper $paperId", e)
                paperVersionRepository.save(version.copy(storagePushStatus = "failed"))
            }
        }

        return version.toDto()
    }

    fun listVersions(paperId: Long, userId: Long): List<PaperVersionDto> {
        paperRepository.findByIdAndUserId(paperId, userId)
            ?: throw ResourceNotFoundException("Paper", paperId)
        return paperVersionRepository.findByPaperIdOrderByCreatedAtDesc(paperId).map { it.toDto() }
    }

    private fun pushToStorage(storageConfigId: Long, paperId: Long, version: String) {
        // TODO: Implement actual push to GitHub/Gitee/OSS/S3 based on storage config
        logger.info("Push to storage: configId=$storageConfigId, paperId=$paperId, version=$version")
    }

    private fun PaperVersion.toDto() = PaperVersionDto(
        id = id,
        paperId = paperId,
        version = version,
        remark = remark,
        storagePushStatus = storagePushStatus,
        createdAt = createdAt,
    )
}
