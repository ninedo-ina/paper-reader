package org.paperreader.service

import org.paperreader.exception.RateLimitedException
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration

/**
 * 登录类接口的按来源限流。这几条接口都在登录态之外，此前唯一的门槛就是密码本身：
 * 脚本可以无限次试密码、无限次建号、无限次发验证码（把通知中心的邮件额度刷光）。
 *
 * 计数放 Redis（本来就为邮箱验证码接好了，见 AuthService）。固定窗口：窗口内第
 * limit+1 次直接 429。固定窗口在窗口边界上最多放过两倍流量，对「挡脚本」够用了，
 * 不值得为此换成令牌桶。
 */
@Service
class AuthRateLimiter(private val redisTemplate: RedisTemplate<String, String>) {

    private val logger = LoggerFactory.getLogger(AuthRateLimiter::class.java)

    /**
     * 限额表。身份维度只有来源 IP —— 这些接口没有登录态，也没有别的可信维度可用。
     */
    enum class Kind(val limit: Int, val window: Duration) {
        /** 试密码。5 分钟 10 次够正常人打错几遍，对上在线爆破等于把成本抬到不可行。 */
        LOGIN(10, Duration.ofMinutes(5)),

        /** 建号。探测脚本就是这么批量造号的，给一个宽但有限的额度。 */
        REGISTER(10, Duration.ofHours(1)),

        /** 发验证码。AuthService 里还有一道「同邮箱 60 秒冷却」，这里挡的是换邮箱刷。 */
        SEND_CODE(10, Duration.ofHours(1)),

        /** 邮箱验证码登录。6 位数字码只有 100 万种，不限流就等于可以爆破。 */
        EMAIL_LOGIN(10, Duration.ofMinutes(5)),
    }

    fun check(kind: Kind, clientIp: String) {
        val key = "pr:auth_rate_limit:${kind.name.lowercase()}:$clientIp"
        val hits = try {
            // SET NX 是带着 TTL 一起下发的：计数键从存在的那一刻就有过期时间。
            // 先 INCR 再 EXPIRE 的话，两次调用之间只要断一次，这个 IP 就被永久封住了。
            redisTemplate.opsForValue().setIfAbsent(key, "0", kind.window)
            redisTemplate.opsForValue().increment(key) ?: return
        } catch (ex: Exception) {
            // 限流是加固，不是鉴权本身。Redis 出问题时放请求过去、只留日志，
            // 总好过让整个登录入口跟着 Redis 一起挂掉。
            logger.warn("Rate limiter unavailable, request allowed: {}", ex.message)
            return
        }

        if (hits > kind.limit) {
            logger.warn("Rate limited {} from {}: {} hits in {}", kind, clientIp, hits, kind.window)
            throw RateLimitedException()
        }
    }
}
