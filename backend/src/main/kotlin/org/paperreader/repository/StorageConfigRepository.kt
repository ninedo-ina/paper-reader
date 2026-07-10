package org.paperreader.repository

import org.paperreader.model.StorageConfig
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface StorageConfigRepository : JpaRepository<StorageConfig, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<StorageConfig>
    fun findByIdAndUserId(id: Long, userId: Long): StorageConfig?
    fun findByUserIdAndIsDefaultTrue(userId: Long): StorageConfig?
}
