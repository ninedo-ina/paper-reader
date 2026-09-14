package org.paperreader.repository

import org.paperreader.model.UserDevice
import org.springframework.data.jpa.repository.JpaRepository

interface UserDeviceRepository : JpaRepository<UserDevice, Long> {
    fun findByUserIdOrderByLastLoginAtDesc(userId: Long): List<UserDevice>

    fun findByUserIdAndDeviceKey(userId: Long, deviceKey: String): UserDevice?

    fun deleteByUserIdAndDeviceKey(userId: Long, deviceKey: String)

    fun deleteByUserId(userId: Long)

    fun countByUserId(userId: Long): Long
}
