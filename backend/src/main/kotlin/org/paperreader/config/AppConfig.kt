package org.paperreader.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestTemplate
import java.time.Duration

/**
 * 应用通用配置 / General application beans.
 *
 * - RestTemplate 统一使用 GROBID 超时配置 / RestTemplate shares GROBID timeout settings
 */
@Configuration
class AppConfig {

    /** HTTP 客户端，超时由 grobid.timeout 控制 / HTTP client with timeout from grobid config */
    @Bean
    fun restTemplate(builder: RestTemplateBuilder, @Value("\${app.grobid.timeout}") timeout: Long): RestTemplate =
        builder
            .connectTimeout(Duration.ofMillis(timeout))
            .readTimeout(Duration.ofMillis(timeout))
            .build()
}
