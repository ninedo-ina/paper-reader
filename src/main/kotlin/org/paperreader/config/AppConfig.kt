package org.paperreader.config

import io.minio.MinioClient
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestTemplate
import java.time.Duration

@Configuration
class AppConfig {

    @Bean
    fun restTemplate(builder: RestTemplateBuilder, @Value("\${app.grobid.timeout}") timeout: Long): RestTemplate =
        builder
            .connectTimeout(Duration.ofMillis(timeout))
            .readTimeout(Duration.ofMillis(timeout))
            .build()

    @Bean
    fun minioClient(
        @Value("\${app.minio.endpoint}") endpoint: String,
        @Value("\${app.minio.access-key}") accessKey: String,
        @Value("\${app.minio.secret-key}") secretKey: String,
    ): MinioClient = MinioClient.builder()
        .endpoint(endpoint)
        .credentials(accessKey, secretKey)
        .build()
}
