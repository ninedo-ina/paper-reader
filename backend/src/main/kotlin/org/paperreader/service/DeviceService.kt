package org.paperreader.service

import org.paperreader.dto.DeviceResponse
import org.paperreader.model.UserDevice
import org.paperreader.repository.UserDeviceRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class DeviceService(
    private val deviceRepository: UserDeviceRepository,
) {
    companion object {
        /** How long "trust this device" lasts before the second factor is asked again. */
        const val TRUST_DURATION_DAYS = 30L
    }

    /**
     * Records (or refreshes) a device. Trust is granted only when the caller
     * asked for it, e.g. by ticking the box on the two-factor screen.
     */
    @Transactional
    fun register(
        userId: Long,
        deviceKey: String?,
        deviceName: String?,
        userAgent: String?,
        ipAddress: String?,
        trust: Boolean = false,
    ): UserDevice {
        val key = deviceKey?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
        val existing = deviceRepository.findByUserIdAndDeviceKey(userId, key)
        val trustedUntil = if (trust) Instant.now().plus(TRUST_DURATION_DAYS, ChronoUnit.DAYS) else existing?.trustedUntil
        val trusted = trust || existing?.trusted == true
        val row = if (existing == null) {
            UserDevice(
                userId = userId,
                deviceKey = key,
                deviceName = deviceName?.takeIf { it.isNotBlank() } ?: describe(userAgent),
                userAgent = userAgent,
                ipAddress = ipAddress,
                trusted = trusted,
                trustedUntil = trustedUntil,
            )
        } else {
            existing.copy(
                deviceName = deviceName?.takeIf { it.isNotBlank() } ?: existing.deviceName,
                userAgent = userAgent,
                ipAddress = ipAddress,
                trusted = trusted,
                trustedUntil = trustedUntil,
                lastLoginAt = Instant.now(),
            )
        }
        return deviceRepository.save(row)
    }

    /** True when this device may skip the second factor for this user. */
    @Transactional(readOnly = true)
    fun isTrusted(userId: Long, deviceKey: String?): Boolean {
        if (deviceKey.isNullOrBlank()) return false
        val device = deviceRepository.findByUserIdAndDeviceKey(userId, deviceKey) ?: return false
        if (!device.trusted) return false
        val until = device.trustedUntil ?: return true
        return until.isAfter(Instant.now())
    }

    /**
     * Whether a token carrying this device key is still allowed. A missing row
     * means the device was removed from the trusted-device list, so its
     * previously issued tokens stop working immediately.
     */
    @Transactional(readOnly = true)
    fun isDeviceActive(userId: Long, deviceKey: String?): Boolean {
        if (deviceKey.isNullOrBlank()) return true // legacy token without a device claim
        return deviceRepository.findByUserIdAndDeviceKey(userId, deviceKey) != null
    }

    @Transactional(readOnly = true)
    fun list(userId: Long, currentDeviceKey: String?): List<DeviceResponse> =
        deviceRepository.findByUserIdOrderByLastLoginAtDesc(userId).map { it.toResponse(currentDeviceKey) }

    @Transactional
    fun delete(userId: Long, ids: List<Long>): Int {
        val targets = deviceRepository.findAllById(ids).filter { it.userId == userId }
        deviceRepository.deleteAll(targets)
        return targets.size
    }

    /** Called when 2FA is switched off — nothing left for a trusted device to skip. */
    @Transactional
    fun clearTrust(userId: Long) {
        deviceRepository.findByUserIdOrderByLastLoginAtDesc(userId).forEach { device ->
            if (device.trusted) {
                deviceRepository.save(device.copy(trusted = false, trustedUntil = null))
            }
        }
    }

    @Transactional
    fun touch(userId: Long, deviceKey: String?) {
        if (deviceKey.isNullOrBlank()) return
        val device = deviceRepository.findByUserIdAndDeviceKey(userId, deviceKey) ?: return
        deviceRepository.save(device.copy(lastLoginAt = Instant.now()))
    }

    private fun describe(userAgent: String?): String = when {
        userAgent.isNullOrBlank() -> "未知设备"
        userAgent.contains("Edg/", true) -> "Edge 浏览器"
        userAgent.contains("Chrome/", true) && !userAgent.contains("Chromium", true) -> "Chrome 浏览器"
        userAgent.contains("Firefox/", true) -> "Firefox 浏览器"
        userAgent.contains("Safari/", true) && userAgent.contains("Version/", true) -> "Safari 浏览器"
        userAgent.contains("curl", true) -> "命令行客户端"
        else -> "浏览器"
    }
}

private fun UserDevice.toResponse(currentDeviceKey: String?): DeviceResponse = DeviceResponse(
    id = id,
    deviceKey = deviceKey,
    deviceName = deviceName,
    userAgent = userAgent,
    ipAddress = ipAddress,
    trusted = trusted,
    trustedUntil = trustedUntil?.toString(),
    lastLoginAt = lastLoginAt.toString(),
    current = currentDeviceKey != null && deviceKey == currentDeviceKey,
)
