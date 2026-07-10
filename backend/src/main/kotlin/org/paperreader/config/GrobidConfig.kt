package org.paperreader.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * GROBID 论文解析服务配置 / GROBID PDF parsing service configuration.
 *
 * 绑定 application.yml 中以 app.grobid 为前缀的属性 / Bound to app.grobid.* properties.
 */
@Configuration
@ConfigurationProperties(prefix = "app.grobid")
class GrobidConfig {
    /** GROBID 服务地址 / GROBID server URL */
    lateinit var baseUrl: String
    /** 请求超时，单位毫秒 / Request timeout in milliseconds */
    var timeout: Long = 60000
}
