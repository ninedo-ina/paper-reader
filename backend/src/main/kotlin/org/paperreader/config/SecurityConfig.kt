package org.paperreader.config

import org.paperreader.security.JwtAuthFilter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

/**
 * Spring Security 配置 / Security filter chain configuration.
 *
 * - 无状态会话（JWT），禁用 CSRF / Stateless sessions with JWT, CSRF disabled
 * - 公开端点不鉴权，其余请求需携带合法 JWT / Public endpoints excluded, all others require valid JWT
 * - 使用 BCrypt 编码密码 / Passwords encoded with BCrypt
 */
@Configuration
class SecurityConfig(
    private val jwtAuthFilter: JwtAuthFilter,
) {

    /** 安全过滤链 / Security filter chain */
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers(
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/auth/send-code",
                        "/api/auth/email-login",
                        "/api/auth/github",
                        "/api/auth/refresh",
                    ).permitAll()
                    .requestMatchers("/api/health").permitAll()
                    .anyRequest().authenticated()
            }
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }

    /** 密码编码器 / Password encoder */
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
}
