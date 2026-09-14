package org.paperreader.repository

import org.paperreader.model.UserRecoveryCode
import org.springframework.data.jpa.repository.JpaRepository

interface UserRecoveryCodeRepository : JpaRepository<UserRecoveryCode, Long> {
    fun findByUserIdOrderByIdAsc(userId: Long): List<UserRecoveryCode>

    fun deleteByUserId(userId: Long)
}
