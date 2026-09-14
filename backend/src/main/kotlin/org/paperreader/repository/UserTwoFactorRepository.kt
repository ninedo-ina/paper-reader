package org.paperreader.repository

import org.paperreader.model.UserTwoFactor
import org.springframework.data.jpa.repository.JpaRepository

interface UserTwoFactorRepository : JpaRepository<UserTwoFactor, Long> {
    fun findByUserId(userId: Long): UserTwoFactor?
}
