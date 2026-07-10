package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.exception.InvalidParameterException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.StorageConfig
import org.paperreader.repository.StorageConfigRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class StorageConfigService(
    private val storageConfigRepository: StorageConfigRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun create(userId: Long, request: CreateStorageConfigRequest): StorageConfigDto {
        if (request.isDefault) {
            storageConfigRepository.findByUserIdAndIsDefaultTrue(userId)
                ?.let { storageConfigRepository.save(it.copy(isDefault = false)) }
        }

        val config = storageConfigRepository.save(
            StorageConfig(
                userId = userId,
                name = request.name,
                storageType = request.storageType,
                config = objectMapper.writeValueAsString(request.config),
                isDefault = request.isDefault,
            )
        )
        return config.toDto()
    }

    fun list(userId: Long): List<StorageConfigDto> {
        return storageConfigRepository.findByUserIdOrderByCreatedAtDesc(userId).map { it.toDto() }
    }

    fun getById(id: Long, userId: Long): StorageConfigDto {
        val config = storageConfigRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("StorageConfig", id)
        return config.toDto()
    }

    @Transactional
    fun update(id: Long, userId: Long, request: UpdateStorageConfigRequest): StorageConfigDto {
        val config = storageConfigRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("StorageConfig", id)

        if (request.isDefault == true) {
            storageConfigRepository.findByUserIdAndIsDefaultTrue(userId)
                ?.let { if (it.id != id) storageConfigRepository.save(it.copy(isDefault = false)) }
        }

        val updated = config.copy(
            name = request.name ?: config.name,
            config = request.config?.let { objectMapper.writeValueAsString(it) } ?: config.config,
            isDefault = request.isDefault ?: config.isDefault,
            updatedAt = Instant.now(),
        )
        return storageConfigRepository.save(updated).toDto()
    }

    @Transactional
    fun delete(id: Long, userId: Long) {
        val config = storageConfigRepository.findByIdAndUserId(id, userId)
            ?: throw ResourceNotFoundException("StorageConfig", id)
        storageConfigRepository.delete(config)
    }

    private fun StorageConfig.toDto() = StorageConfigDto(
        id = id,
        name = name,
        storageType = storageType,
        config = objectMapper.readValue(config, Map::class.java) as Map<String, Any?>,
        isDefault = isDefault,
        createdAt = createdAt,
    )
}
