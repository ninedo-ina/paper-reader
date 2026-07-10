package org.paperreader.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import org.springframework.web.filter.CorsFilter

/**
 * CORS 跨域配置 / Cross-Origin Resource Sharing configuration.
 *
 * - 允许所有来源（开发环境），生产环境应限制 / Allow all origins for dev; restrict in production
 * - 允许携带凭证（Cookie / Authorization header）/ Credentials allowed
 */
@Configuration
class CorsConfig {

    // CORS 过滤器，作用于 /api/** 路径 / CORS filter applied to /api/** paths
    @Bean
    fun corsFilter(): CorsFilter {
        val config = CorsConfiguration().apply {
            allowedOriginPatterns = listOf("*")
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
            maxAge = 3600
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/**", config)
        return CorsFilter(source)
    }
}
