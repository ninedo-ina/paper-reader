package org.paperreader.service

import org.paperreader.exception.InvalidCredentialsException
import org.paperreader.exception.InvalidParameterException
import org.paperreader.dto.*
import org.paperreader.model.User
import org.paperreader.model.UserRecoveryCode
import org.paperreader.model.UserTwoFactor
import org.paperreader.repository.UserRecoveryCodeRepository
import org.paperreader.repository.UserRepository
import org.paperreader.repository.UserTwoFactorRepository
import org.paperreader.security.Totp
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant

@Service
class TwoFactorService(
    private val twoFactorRepository: UserTwoFactorRepository,
    private val recoveryCodeRepository: UserRecoveryCodeRepository,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    companion object {
        const val RECOVERY_CODE_COUNT = 9
        const val RECOVERY_CODE_DIGITS = 6
        private const val ISSUER = "笨迪论文助手"
        private val digits = SecureRandom()
    }

    @Transactional(readOnly = true)
    fun status(user: User): TwoFactorStatusResponse {
        val row = twoFactorRepository.findByUserId(user.id)
        val enabled = row?.enabled == true
        return TwoFactorStatusResponse(
            enabled = enabled,
            recoveryCodesRemaining = if (enabled) {
                recoveryCodeRepository.findByUserIdOrderByIdAsc(user.id).count { it.usedAt == null }
            } else 0,
            recoveryCodesTotal = if (enabled) RECOVERY_CODE_COUNT else 0,
        )
    }

    /**
     * First step of the scan-and-bind wizard: creates (or replaces) a pending
     * secret and returns the payload the client renders as a QR code. The
     * account is not protected until [enable] succeeds.
     */
    @Transactional
    fun setup(user: User): TwoFactorSetupResponse {
        val secret = Totp.generateSecret()
        val existing = twoFactorRepository.findByUserId(user.id)
        val row = UserTwoFactor(
            userId = user.id,
            secret = secret,
            enabled = false,
            confirmedAt = null,
            createdAt = existing?.createdAt ?: Instant.now(),
            updatedAt = Instant.now(),
        )
        twoFactorRepository.save(row)
        // A half-finished re-setup must not leave the old codes usable.
        recoveryCodeRepository.deleteByUserId(user.id)
        return TwoFactorSetupResponse(
            secret = secret,
            otpauthUri = Totp.provisioningUri(secret, user.email, ISSUER),
            digits = Totp.DIGITS,
            period = Totp.PERIOD_SECONDS,
        )
    }

    /**
     * Confirms the pending secret and hands out the recovery codes. Runs both
     * for a first-time enable and for re-enabling after a disable; either way
     * the account password must be supplied again.
     */
    @Transactional
    fun enable(user: User, password: String, code: String): TwoFactorEnableResponse {
        verifyPassword(user, password)
        val row = twoFactorRepository.findByUserId(user.id)
            ?: throw InvalidParameterException("请先获取密钥后再开启两步验证")
        if (!Totp.verify(row.secret, code)) {
            throw InvalidCredentialsException("验证码不正确，请检查当前设备时间后重试")
        }
        twoFactorRepository.save(
            row.copy(enabled = true, confirmedAt = Instant.now(), updatedAt = Instant.now()),
        )
        return TwoFactorEnableResponse(recoveryCodes = issueRecoveryCodes(user.id))
    }

    /** Turns the factor off and invalidates every recovery code issued for it. */
    @Transactional
    fun disable(user: User, password: String, code: String) {
        verifyPassword(user, password)
        val row = twoFactorRepository.findByUserId(user.id)
            ?: throw InvalidParameterException("当前账号未开启两步验证")
        if (!row.enabled) throw InvalidParameterException("当前账号未开启两步验证")
        if (!verifySecondFactor(user.id, row.secret, code)) {
            throw InvalidCredentialsException("验证码不正确")
        }
        twoFactorRepository.save(row.copy(enabled = false, updatedAt = Instant.now()))
        // "Recovery codes are only valid while 2FA is on": wiping them here
        // makes the guarantee structural rather than a check at use time.
        recoveryCodeRepository.deleteByUserId(user.id)
    }

    /** Issues a fresh batch of nine codes; the previous batch stops working. */
    @Transactional
    fun regenerateRecoveryCodes(user: User, password: String): TwoFactorEnableResponse {
        verifyPassword(user, password)
        val row = twoFactorRepository.findByUserId(user.id)
        if (row?.enabled != true) throw InvalidParameterException("请先开启两步验证")
        return TwoFactorEnableResponse(recoveryCodes = issueRecoveryCodes(user.id))
    }

    /**
     * Validates a TOTP code, falling back to a recovery code. Returns true on
     * success; consumed recovery codes are marked used in the same transaction.
     */
    @Transactional
    fun verifySecondFactor(userId: Long, secret: String, code: String): Boolean {
        if (Totp.verify(secret, code)) return true
        return consumeRecoveryCode(userId, code)
    }

    /** True when two-factor authentication is switched on for this user. */
    @Transactional(readOnly = true)
    fun isEnabled(userId: Long): Boolean =
        twoFactorRepository.findByUserId(userId)?.enabled == true

    /** The enabled binding, or a business error when 2FA is off. */
    @Transactional(readOnly = true)
    fun requireEnabled(userId: Long): UserTwoFactor {
        val row = twoFactorRepository.findByUserId(userId)
        if (row?.enabled != true) throw InvalidParameterException("当前账号未开启两步验证")
        return row
    }

    private fun consumeRecoveryCode(userId: Long, code: String): Boolean {
        val candidate = code.trim()
        if (candidate.length != RECOVERY_CODE_DIGITS || !candidate.all { it.isDigit() }) return false
        val codes = recoveryCodeRepository.findByUserIdOrderByIdAsc(userId)
        for (stored in codes) {
            if (stored.usedAt != null) continue
            if (passwordEncoder.matches(candidate, stored.codeHash)) {
                recoveryCodeRepository.save(stored.copy(usedAt = Instant.now()))
                return true
            }
        }
        return false
    }

    private fun issueRecoveryCodes(userId: Long): List<String> {
        recoveryCodeRepository.deleteByUserId(userId)
        val plain = (1..RECOVERY_CODE_COUNT).map { "%06d".format(digits.nextInt(1_000_000)) }
        recoveryCodeRepository.saveAll(
            plain.map { UserRecoveryCode(userId = userId, codeHash = passwordEncoder.encode(it)!!) },
        )
        return plain
    }

    private fun verifyPassword(user: User, password: String) {
        val hash = user.passwordHash
            ?: throw InvalidParameterException("该账号使用第三方登录，请先设置密码")
        if (!passwordEncoder.matches(password, hash)) {
            throw InvalidCredentialsException("密码不正确")
        }
    }
}
