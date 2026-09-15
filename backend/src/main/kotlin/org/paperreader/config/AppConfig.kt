package org.paperreader.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
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
    @Primary
    fun restTemplate(builder: RestTemplateBuilder, @Value("\${app.grobid.timeout}") timeout: Long): RestTemplate =
        builder
            .connectTimeout(Duration.ofMillis(timeout))
            .readTimeout(Duration.ofMillis(timeout))
            .build()

    /**
     * 通知中心专用 HTTP 客户端 / HTTP client for notify-center calls.
     *
     * 超时短得多（默认 5s）：通知是旁路动作，通知中心慢不能拖着业务请求。
     */
    @Bean(name = ["notifyRestTemplate"])
    fun notifyRestTemplate(
        builder: RestTemplateBuilder,
        @Value("\${app.notify.timeout-ms:5000}") timeoutMs: Long,
    ): RestTemplate =
        builder
            .connectTimeout(Duration.ofMillis(timeoutMs))
            .readTimeout(Duration.ofMillis(timeoutMs))
            .build()

    /**
     * 通知中心调用专用线程池 / Dedicated executor for notify-center calls.
     *
     * 通知是「发完就忘」的旁路动作：池子小、队列有界，通知中心挂了也不会
     * 把请求线程或者 GROBID 解析线程吃掉。
     */
    @Bean(name = ["notifyExecutor"])
    fun notifyExecutor(): Executor = ThreadPoolTaskExecutor().apply {
        corePoolSize = 1
        maxPoolSize = 2
        setQueueCapacity(200)
        setThreadNamePrefix("notify-")
        setWaitForTasksToCompleteOnShutdown(true)
        setAwaitTerminationSeconds(5)
        initialize()
    }

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
