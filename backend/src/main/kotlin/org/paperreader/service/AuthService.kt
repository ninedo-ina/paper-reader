package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.paperreader.dto.*
import org.paperreader.exception.InvalidCredentialsException
import org.paperreader.model.User
import org.paperreader.repository.UserRepository
import org.paperreader.security.JwtUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.*
import org.springframework.core.ParameterizedTypeReference
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestTemplate
import java.security.SecureRandom
import java.time.Duration

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtUtil: JwtUtil,
    private val redisTemplate: RedisTemplate<String, String>,
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
    private val auditLogService: AuditLogService,
    private val twoFactorService: TwoFactorService,
    private val deviceService: DeviceService,
    private val notifyCenterClient: NotifyCenterClient,
    @Value("\${app.github.client-id}") private val githubClientId: String,
    @Value("\${app.github.client-secret}") private val githubClientSecret: String,
    @Value("\${app.mail.from}") private val mailFrom: String,
) {
    private val logger = LoggerFactory.getLogger(AuthService::class.java)
    private val random = SecureRandom()

    private companion object {
        /** 验证码有效期 / how long a login code stays valid. */
        val CODE_TTL: Duration = Duration.ofMinutes(5)

        /** 同一邮箱两次发送之间的最小间隔，与前端倒计时一致。 */
        val CODE_COOLDOWN: Duration = Duration.ofSeconds(60)

        /**
         * 读不到 GitHub 邮箱时用的占位域名。这类地址收不到信，只是为了让
         * email 这一列的非空/唯一约束过得去；登录时一旦拿到真实邮箱就会被替换。
         */
        const val GITHUB_PLACEHOLDER_DOMAIN = "@github.user"
    }

    /**
     * Everything the backend knows about the browser asking to sign in. Used
     * both to recognise a trusted device and to populate the trusted-device list.
     */
    data class DeviceContext(
        val deviceKey: String?,
        val deviceName: String?,
        val userAgent: String?,
        val ipAddress: String?,
    )

    fun register(request: RegisterRequest, ctx: DeviceContext): TokenResponse {
        require(!userRepository.existsByEmail(request.email)) { "Email already registered" }

        val user = userRepository.save(
            User(
                email = request.email,
                passwordHash = passwordEncoder.encode(request.password),
                displayName = request.displayName,
                authProvider = "local",
            )
        )
        return finishLogin(user, isNewUser = true, ctx = ctx, trust = false)
    }

    fun login(request: LoginRequest, ctx: DeviceContext): TokenResponse {
        val existing = userRepository.findByEmail(request.email)
        val (user, isNew) = if (existing.isPresent) {
            val u = existing.get()
            require(u.passwordHash != null) {
                "This account uses ${u.authProvider} login, not password"
            }
            require(passwordEncoder.matches(request.password, u.passwordHash)) {
                "Invalid credentials"
            }
            u to false
        } else {
            userRepository.save(
                User(
                    email = request.email.trim().lowercase(),
                    passwordHash = passwordEncoder.encode(request.password),
                    // 不再拿邮箱前缀当用户名：界面上显示的名字由前端统一兜底成「用户{id}」
                    displayName = null,
                    authProvider = "local",
                )
            ) to true
        }
        return completeLogin(user, isNewUser = isNew, ctx = ctx)
    }

    fun sendEmailCode(request: SendCodeRequest) {
        val email = request.email.trim().lowercase()

        // 前端有 60 秒倒计时，这里再挡一道：接口是公开的，不能让人用一封封邮件
        // 把通知中心的邮件额度刷光。冷却期内直接返回，之前那封码仍然有效。
        val cooldownKey = "pr:email_code_cooldown:$email"
        if (redisTemplate.opsForValue().setIfAbsent(cooldownKey, "1", CODE_COOLDOWN) != true) {
            logger.info("Verification code for {} requested within cooldown, skipped", email)
            return
        }

        val code = String.format("%06d", random.nextInt(1_000_000))
        val key = "pr:email_code:$email"

        redisTemplate.opsForValue().set(key, code, CODE_TTL)
        logger.info("Email verification code for {}: {}", email, code)

        // 邮件统一交给通知中心投递：失败只记 WARN，不影响「验证码已发送」的返回，
        // 用户在倒计时结束后可以重发。
        notifyCenterClient.notifyLoginCode(
            email = email,
            code = code,
            expiresMinutes = CODE_TTL.toMinutes(),
            userId = userRepository.findByEmail(email).map { it.id }.orElse(null),
        )
    }

    fun emailCodeLogin(request: EmailLoginRequest, ctx: DeviceContext): TokenResponse {
        val email = request.email.trim().lowercase()
        val code = request.code.trim()

        val storedCode = redisTemplate.opsForValue().get("pr:email_code:$email")
            ?: throw IllegalArgumentException("Verification code expired or not sent")
        require(storedCode == code) { "Invalid verification code" }

        redisTemplate.delete("pr:email_code:$email")

        val existing = userRepository.findByEmail(email)
        val (user, isNew) = if (existing.isPresent) {
            existing.get() to false
        } else {
            userRepository.save(
                User(
                    email = email,
                    displayName = null,
                    authProvider = "email",
                )
            ) to true
        }
        return completeLogin(user, isNewUser = isNew, ctx = ctx)
    }

    fun githubLogin(request: GitHubAuthRequest, ctx: DeviceContext): TokenResponse {
        val accessToken = exchangeGithubToken(request.code)
        val githubUser = fetchGithubUser(accessToken)

        val byGithubId = userRepository.findByGithubId(githubUser.id)
        if (byGithubId.isPresent) {
            // 老账号可能存着 {login}@github.user 的占位邮箱，这次读到真实邮箱就补上
            val u = backfillGithubEmail(byGithubId.get(), githubUser)
            return completeLogin(u, isNewUser = false, ctx = ctx)
        }

        val email = githubUser.email ?: "${githubUser.login}$GITHUB_PLACEHOLDER_DOMAIN"
        val byEmail = userRepository.findByEmail(email)
        if (byEmail.isPresent) {
            val linked = byEmail.get().copy(githubId = githubUser.id, avatarUrl = githubUser.avatarUrl)
                .let { userRepository.save(it) }
            return completeLogin(linked, isNewUser = false, ctx = ctx)
        }

        val newUser = userRepository.save(
            User(
                email = email,
                githubId = githubUser.id,
                // 只认 GitHub 上自己填的昵称；没填就让前端兜底成「用户{id}」，
                // 不要把 login（那是账号名）直接当用户名展示
                displayName = githubUser.name?.trim()?.takeIf { it.isNotEmpty() },
                avatarUrl = githubUser.avatarUrl,
                authProvider = "github",
            )
        )
        return completeLogin(newUser, isNewUser = true, ctx = ctx)
    }

    /**
     * 把早年拿不到邮箱、被写成 {login}@github.user 的账号升级成真实邮箱。
     * 这类地址收不到任何邮件（登录验证码也发不过去），属于必须修掉的历史数据。
     * 真实邮箱若已被别的账号占用，保持原样并记 WARN，交给人工处理。
     */
    private fun backfillGithubEmail(user: User, githubUser: GithubUser): User {
        val real = githubUser.email?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return user
        if (real == user.email || !user.email.endsWith(GITHUB_PLACEHOLDER_DOMAIN)) return user

        val owner = userRepository.findByEmail(real)
        if (owner.isPresent && owner.get().id != user.id) {
            logger.warn(
                "GitHub email {} already belongs to user {}, keeping placeholder for user {}",
                real, owner.get().id, user.id,
            )
            return user
        }
        logger.info("Upgraded GitHub placeholder email of user {} to {}", user.id, real)
        return userRepository.save(user.copy(email = real))
    }

    /**
     * Shared tail of every login path: passwords, email codes and GitHub
     * authorisation all land here, so two-factor enforcement lives in exactly
     * one place. A trusted device skips the second factor entirely.
     */
    private fun completeLogin(user: User, isNewUser: Boolean, ctx: DeviceContext): TokenResponse {
        val needsSecondFactor = twoFactorService.isEnabled(user.id) &&
            !deviceService.isTrusted(user.id, ctx.deviceKey)
        if (needsSecondFactor) {
            return TokenResponse(
                twoFactorRequired = true,
                challengeToken = jwtUtil.generateTwoFactorChallengeToken(user.id, user.email, ctx.deviceKey),
                isNewUser = isNewUser,
            )
        }
        return finishLogin(user, isNewUser, ctx, trust = false)
    }

    /** Records the device and issues the real token pair. */
    private fun finishLogin(user: User, isNewUser: Boolean, ctx: DeviceContext, trust: Boolean): TokenResponse {
        val device = deviceService.register(
            userId = user.id,
            deviceKey = ctx.deviceKey,
            deviceName = ctx.deviceName,
            userAgent = ctx.userAgent,
            ipAddress = ctx.ipAddress,
            trust = trust,
        )
        auditLogService.log(user.id, "登录", user.email)
        return TokenResponse(
            accessToken = jwtUtil.generateAccessToken(user.id, user.email, device.deviceKey),
            refreshToken = jwtUtil.generateRefreshToken(user.id, user.email, device.deviceKey),
            expiresIn = 3600000,
            isNewUser = isNewUser,
        )
    }

    /** Second step of a challenged login: checks the code, then logs the user in. */
    fun verifyTwoFactor(request: TwoFactorVerifyRequest, ctx: DeviceContext): TokenResponse {
        // The challenge lives for five minutes, so "the user went for coffee
        // between the password step and the code step" is an ordinary event,
        // not a 500. Anything unparseable is reported as a restart rather than
        // letting ExpiredJwtException escape as an internal error.
        val claims = try {
            jwtUtil.extractClaims(request.challengeToken)
        } catch (ex: io.jsonwebtoken.JwtException) {
            throw InvalidCredentialsException("登录凭证已失效，请重新登录")
        }
        if (claims[JwtUtil.SCOPE_CLAIM] != JwtUtil.SCOPE_TWO_FACTOR_CHALLENGE) {
            throw InvalidCredentialsException("登录凭证已失效，请重新登录")
        }
        val userId = claims.subject.toLong()
        val email = claims["email"] as? String ?: throw InvalidCredentialsException("登录凭证已失效，请重新登录")
        val user = userRepository.findById(userId).orElseThrow {
            InvalidCredentialsException("登录凭证已失效，请重新登录")
        }
        val row = twoFactorService.requireEnabled(userId)
        if (!twoFactorService.verifySecondFactor(userId, row.secret, request.code)) {
            throw InvalidCredentialsException("验证码或恢复码不正确")
        }
        // The device key travels inside the challenge token, so an attacker
        // cannot claim someone else's trusted device by replaying a code.
        val deviceKey = request.deviceId?.takeIf { it.isNotBlank() }
            ?: (claims[JwtUtil.DEVICE_CLAIM] as? String)
            ?: ctx.deviceKey
        return finishLogin(
            user = user,
            isNewUser = false,
            ctx = ctx.copy(deviceKey = deviceKey, deviceName = request.deviceName ?: ctx.deviceName),
            trust = request.trustDevice,
        )
    }

    private fun exchangeGithubToken(code: String): String {
        val body = LinkedMultiValueMap<String, String>()
        body.add("client_id", githubClientId)
        body.add("client_secret", githubClientSecret)
        body.add("code", code)

        val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_FORM_URLENCODED }
        headers.accept = listOf(MediaType.APPLICATION_JSON)

        val resp = restTemplate.postForEntity(
            "https://github.com/login/oauth/access_token",
            HttpEntity(body, headers),
            Map::class.java,
        )

        val token = resp.body?.get("access_token") as? String
            ?: throw RuntimeException("Failed to exchange GitHub token: ${resp.body}")
        return token
    }

    private fun fetchGithubUser(accessToken: String): GithubUser {
        val headers = HttpHeaders().apply {
            setBearerAuth(accessToken)
            accept = listOf(MediaType.APPLICATION_JSON)
        }
        val resp = restTemplate.exchange(
            "https://api.github.com/user",
            HttpMethod.GET,
            HttpEntity<String>(headers),
            Map::class.java,
        )
        val body = resp.body ?: throw RuntimeException("GitHub user API returned null")
        return GithubUser(
            id = (body["id"] as Number).toLong(),
            login = body["login"] as? String ?: "",
            name = body["name"] as? String,
            // /user 只在用户把邮箱设为公开时才返回 email；没返回就再问一次
            // /user/emails，否则会退化成 xxx@github.user 这种收不到信的假地址
            email = ((body["email"] as? String) ?: fetchGithubPrimaryEmail(headers))
                ?.trim()?.lowercase()?.takeIf { it.isNotEmpty() },
            avatarUrl = body["avatar_url"] as? String,
        )
    }

    /**
     * 取 GitHub 账号的邮箱：优先 primary + verified，其次任意 verified，
     * 最后才退回列表里的第一个。授权时带了 user:email scope，这个接口才读得到。
     */
    private fun fetchGithubPrimaryEmail(headers: HttpHeaders): String? {
        return try {
            val resp = restTemplate.exchange(
                "https://api.github.com/user/emails",
                HttpMethod.GET,
                HttpEntity<String>(headers),
                object : ParameterizedTypeReference<List<Map<String, Any>>>() {},
            )
            val emails = resp.body.orEmpty()
            val pick = emails.firstOrNull { it["primary"] == true && it["verified"] == true }
                ?: emails.firstOrNull { it["verified"] == true }
                ?: emails.firstOrNull()
            pick?.get("email") as? String
        } catch (e: Exception) {
            logger.warn("Failed to read GitHub email list: {}", e.message)
            null
        }
    }

    fun updateProfile(userId: Long, request: UpdateProfileRequest): UserProfile {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }
        val updated = user.copy(
            displayName = request.displayName ?: user.displayName,
            avatarUrl = request.avatarUrl ?: user.avatarUrl,
        ).let { userRepository.save(it) }
        return UserProfile(
            id = updated.id,
            email = updated.email,
            displayName = updated.displayName,
            avatarUrl = updated.avatarUrl,
            authProvider = updated.authProvider,
        )
    }

    fun changePassword(userId: Long, request: ChangePasswordRequest) {
        val user = userRepository.findById(userId).orElseThrow {
            IllegalArgumentException("User not found")
        }
        require(user.passwordHash != null) {
            "This account uses ${user.authProvider} login, password change not available"
        }
        require(passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            "Current password is incorrect"
        }
        require(request.newPassword.length >= 6) {
            "New password must be at least 6 characters"
        }
        userRepository.save(user.copy(passwordHash = passwordEncoder.encode(request.newPassword)))
        auditLogService.log(userId, "修改密码", user.email)
    }

    private data class GithubUser(
        val id: Long,
        val login: String,
        val name: String?,
        val email: String?,
        val avatarUrl: String?,
    )
}
