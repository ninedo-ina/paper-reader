package org.paperreader.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import org.springframework.web.client.RestTemplate
import java.time.Duration
import java.util.concurrent.Executor

/**
 * 应用通用配置 / General application beans.
 *
 * - RestTemplate 统一使用 GROBID 超时配置 / RestTemplate shares GROBID timeout settings
 */
@Configuration
@EnableAsync
class AppConfig {

    /** HTTP 客户端，超时由 grobid.timeout 控制 / HTTP client with timeout from grobid config */
    @Bean
    fun restTemplate(builder: RestTemplateBuilder, @Value("\${app.grobid.timeout}") timeout: Long): RestTemplate =
        builder
            .connectTimeout(Duration.ofMillis(timeout))
            .readTimeout(Duration.ofMillis(timeout))
            .build()

    /** Dedicated executor so GROBID work cannot consume request/websocket threads. */
    @Bean(name = ["paperParsingExecutor"])
    fun paperParsingExecutor(
        @Value("\${app.grobid.parse-core-pool-size:2}") corePoolSize: Int,
        @Value("\${app.grobid.parse-max-pool-size:4}") maxPoolSize: Int,
        @Value("\${app.grobid.parse-queue-capacity:20}") queueCapacity: Int,
    ): Executor = ThreadPoolTaskExecutor().apply {
        val safeCorePoolSize = corePoolSize.coerceAtLeast(1)
        this.corePoolSize = safeCorePoolSize
        this.maxPoolSize = maxPoolSize.coerceAtLeast(safeCorePoolSize)
        setQueueCapacity(queueCapacity.coerceAtLeast(1))
        setThreadNamePrefix("paper-parse-")
        setWaitForTasksToCompleteOnShutdown(true)
        setAwaitTerminationSeconds(30)
        initialize()
    }
}
